use axum::body::Body;
use axum::extract::Request;
use axum::http::{header, StatusCode};
use axum::response::{Redirect, Response};
use axum::routing::get;
use axum::Router;
use hyperdownload_download_engine::DownloadEngine;
use hyperdownload_shared::{DownloadError, DownloadEvent};
use hyperdownload_storage::StateDatabase;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;

// ----------------------------------------------------------------------------
// 1. SMALL FILES TEST
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_small_file_download() {
    const SMALL_SIZE: usize = 1024; // 1 KB
    let data: Vec<u8> = (0..SMALL_SIZE).map(|i| (i % 256) as u8).collect();
    let data_clone = data.clone();

    let app = Router::new().route("/small.bin", get(move || {
        let d = data_clone.clone();
        async move {
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_LENGTH, SMALL_SIZE.to_string())
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .body(Body::from(d))
                .unwrap()
        }
    }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let url = format!("http://127.0.0.1:{}/small.bin", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);
    let mut rx = engine.subscribe_events();

    let temp_dir = std::env::temp_dir().join(format!("hd_small_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let dest_file = temp_dir.join("small.bin");
    let _ = std::fs::remove_file(&dest_file);

    let task = engine.start_download(&url, &temp_dir, Some("small.bin"), 1).await.unwrap();

    let mut done = false;
    while let Ok(event) = rx.recv().await {
        if let DownloadEvent::TaskCompleted { id, total_bytes, .. } = event {
            if id == task.id {
                assert_eq!(total_bytes, SMALL_SIZE as u64);
                done = true;
                break;
            }
        }
    }

    assert!(done);
    assert_eq!(std::fs::read(&dest_file).unwrap(), data);
    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_dir(&temp_dir);
}

// ----------------------------------------------------------------------------
// 2. LARGE FILES & MULTI-CONNECTION DOWNLOADS
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_large_file_multi_connection() {
    const LARGE_SIZE: usize = 12 * 1024 * 1024; // 12 MB (triggers 8 connections)
    let large_data: Arc<Vec<u8>> = Arc::new((0..LARGE_SIZE).map(|i| (i % 251) as u8).collect());
    let data_ref = large_data.clone();

    let app = Router::new().route("/large.bin", get(move |req: Request| {
        let d = data_ref.clone();
        async move {
            if let Some(range_h) = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok()) {
                if let Some(spec) = range_h.strip_prefix("bytes=") {
                    let parts: Vec<&str> = spec.split('-').collect();
                    let start: usize = parts[0].parse().unwrap_or(0);
                    let end: usize = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(LARGE_SIZE - 1).min(LARGE_SIZE - 1);

                    let slice = d[start..=end].to_vec();
                    return Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, LARGE_SIZE))
                        .header(header::CONTENT_LENGTH, slice.len().to_string())
                        .header(header::CONTENT_TYPE, "application/octet-stream")
                        .body(Body::from(slice))
                        .unwrap();
                }
            }
            Response::builder()
                .status(StatusCode::OK)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CONTENT_LENGTH, LARGE_SIZE.to_string())
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .body(Body::from((*d).clone()))
                .unwrap()
        }
    }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let url = format!("http://127.0.0.1:{}/large.bin", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);
    let mut rx = engine.subscribe_events();

    let temp_dir = std::env::temp_dir().join(format!("hd_large_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let dest_file = temp_dir.join("large.bin");
    let _ = std::fs::remove_file(&dest_file);

    // Download with 8 concurrent connections
    let task = engine.start_download(&url, &temp_dir, Some("large.bin"), 8).await.unwrap();
    assert_eq!(task.active_connections, 8);

    let mut done = false;
    while let Ok(event) = rx.recv().await {
        if let DownloadEvent::TaskCompleted { id, total_bytes, .. } = event {
            if id == task.id {
                assert_eq!(total_bytes, LARGE_SIZE as u64);
                done = true;
                break;
            }
        }
    }

    assert!(done);
    let downloaded = std::fs::read(&dest_file).unwrap();
    assert_eq!(downloaded.len(), LARGE_SIZE);
    assert_eq!(downloaded, *large_data);

    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_dir(&temp_dir);
}

// ----------------------------------------------------------------------------
// 3. INTERRUPTED CONNECTIONS & AUTOMATIC RETRY RECOVERY
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_interrupted_connection_recovery() {
    const TOTAL_SIZE: usize = 64 * 1024; // 64 KB
    let full_data: Arc<Vec<u8>> = Arc::new((0..TOTAL_SIZE).map(|i| (i % 127) as u8).collect());
    let attempts = Arc::new(AtomicUsize::new(0));

    let data_ref = full_data.clone();
    let attempts_ref = attempts.clone();

    let app = Router::new()
        .route(
            "/interrupted.bin",
            get(move |req: Request| {
                let d = data_ref.clone();
                let att = attempts_ref.clone();
                async move {
                    let range_h = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok());

                    // 1. Prober request: bytes=0-0 succeeds
                    if range_h == Some("bytes=0-0") {
                        return Response::builder()
                            .status(StatusCode::PARTIAL_CONTENT)
                            .header(header::ACCEPT_RANGES, "bytes")
                            .header(header::CONTENT_RANGE, format!("bytes 0-0/{}", TOTAL_SIZE))
                            .header(header::CONTENT_LENGTH, "1")
                            .body(Body::from(vec![d[0]]))
                            .unwrap();
                    }

                    // 2. First worker connection encounters a transient drop (HTTP 503)
                    let attempt_num = att.fetch_add(1, Ordering::SeqCst);
                    if attempt_num == 0 {
                        return Response::builder()
                            .status(StatusCode::SERVICE_UNAVAILABLE)
                            .body(Body::from("Transient network drop"))
                            .unwrap();
                    }

                    // 3. Worker retry succeeds with sub-range
                    if let Some(spec) = range_h.and_then(|r| r.strip_prefix("bytes=")) {
                        let parts: Vec<&str> = spec.split('-').collect();
                        let start: usize = parts[0].parse().unwrap_or(0);
                        let end: usize = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(TOTAL_SIZE - 1).min(TOTAL_SIZE - 1);

                        let slice = d[start..=end].to_vec();
                        return Response::builder()
                            .status(StatusCode::PARTIAL_CONTENT)
                            .header(header::ACCEPT_RANGES, "bytes")
                            .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, TOTAL_SIZE))
                            .header(header::CONTENT_LENGTH, slice.len().to_string())
                            .header(header::CONTENT_TYPE, "application/octet-stream")
                            .body(Body::from(slice))
                            .unwrap();
                    }

                    Response::builder()
                        .status(StatusCode::OK)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::CONTENT_LENGTH, TOTAL_SIZE.to_string())
                        .body(Body::from((*d).clone()))
                        .unwrap()
                }
            })
            .head(|| async {
                Response::builder()
                    .status(StatusCode::OK)
                    .header(header::ACCEPT_RANGES, "bytes")
                    .header(header::CONTENT_LENGTH, TOTAL_SIZE.to_string())
                    .body(Body::empty())
                    .unwrap()
            }),
        );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let url = format!("http://127.0.0.1:{}/interrupted.bin", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);
    let mut rx = engine.subscribe_events();

    let temp_dir = std::env::temp_dir().join(format!("hd_interrupted_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let dest_file = temp_dir.join("interrupted.bin");
    let _ = std::fs::remove_file(&dest_file);

    let task = engine.start_download(&url, &temp_dir, Some("interrupted.bin"), 2).await.unwrap();

    let mut done = false;
    while let Ok(event) = rx.recv().await {
        if let DownloadEvent::TaskCompleted { id, total_bytes, .. } = event {
            if id == task.id {
                assert_eq!(total_bytes, TOTAL_SIZE as u64);
                done = true;
                break;
            }
        }
    }

    assert!(done, "Worker failed to recover from interrupted connection");
    assert!(attempts.load(Ordering::SeqCst) > 0, "Expected retry attempts to occur");
    assert_eq!(std::fs::read(&dest_file).unwrap(), *full_data);

    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_dir(&temp_dir);
}

// ----------------------------------------------------------------------------
// 4. INVALID URLS
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_invalid_urls() {
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);
    let temp_dir = std::env::temp_dir();

    // 1. Invalid scheme
    let res1 = engine.start_download("ftp://bad-scheme.local/file.bin", &temp_dir, None, 1).await;
    assert!(res1.is_err(), "Unsupported scheme should return an error");

    // 2. Unreachable port
    let res2 = engine.start_download("http://127.0.0.1:59999/nonexistent.bin", &temp_dir, None, 1).await;
    assert!(res2.is_err(), "Unreachable connection should return network error");
}

// ----------------------------------------------------------------------------
// 5. HTTP REDIRECTS (301 -> 302 -> FINAL)
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_http_redirects() {
    let data = b"Redirected content verified!";

    let app = Router::new()
        .route("/redirect1", get(|| async { Redirect::permanent("/redirect2") }))
        .route("/redirect2", get(|| async { Redirect::temporary("/final.txt") }))
        .route("/final.txt", get(|| async {
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_LENGTH, "28")
                .body(Body::from(&b"Redirected content verified!"[..]))
                .unwrap()
        }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let url = format!("http://127.0.0.1:{}/redirect1", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);
    let mut rx = engine.subscribe_events();

    let temp_dir = std::env::temp_dir().join(format!("hd_redir_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let dest_file = temp_dir.join("final.txt");
    let _ = std::fs::remove_file(&dest_file);

    let task = engine.start_download(&url, &temp_dir, Some("final.txt"), 1).await.unwrap();

    let mut done = false;
    while let Ok(event) = rx.recv().await {
        if let DownloadEvent::TaskCompleted { id, .. } = event {
            if id == task.id {
                done = true;
                break;
            }
        }
    }

    assert!(done);
    assert_eq!(std::fs::read(&dest_file).unwrap(), data);
    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_dir(&temp_dir);
}

// ----------------------------------------------------------------------------
// 6. HTTP ERRORS (404, 403, 500)
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_http_errors() {
    let app = Router::new()
        .route("/404", get(|| async { StatusCode::NOT_FOUND }))
        .route("/403", get(|| async { StatusCode::FORBIDDEN }))
        .route("/500", get(|| async { StatusCode::INTERNAL_SERVER_ERROR }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);
    let temp_dir = std::env::temp_dir();

    // 404 Not Found
    let res_404 = engine.start_download(&format!("http://127.0.0.1:{}/404", addr.port()), &temp_dir, None, 1).await;
    match res_404 {
        Err(DownloadError::NotFound) => {}
        other => panic!("Expected NotFound, got {:?}", other),
    }

    // 403 Forbidden
    let res_403 = engine.start_download(&format!("http://127.0.0.1:{}/403", addr.port()), &temp_dir, None, 1).await;
    match res_403 {
        Err(DownloadError::HttpStatus(403)) => {}
        other => panic!("Expected HttpStatus(403), got {:?}", other),
    }

    // 500 Server Error
    let res_500 = engine.start_download(&format!("http://127.0.0.1:{}/500", addr.port()), &temp_dir, None, 1).await;
    match res_500 {
        Err(DownloadError::ServerError(500)) => {}
        other => panic!("Expected ServerError(500), got {:?}", other),
    }
}

// ----------------------------------------------------------------------------
// 7. CHANGED REMOTE FILES (ETag Invalidation on Resume)
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_changed_remote_files() {
    const SIZE: usize = 2 * 1024 * 1024; // 2 MB
    let current_etag = Arc::new(AtomicUsize::new(1));
    let etag_ref = current_etag.clone();

    let app = Router::new().route("/etag_file.bin", get(move |req: Request| {
        let tag_ver = etag_ref.load(Ordering::SeqCst);
        let tag_str = format!("\"etag-v{}\"", tag_ver);
        async move {
            let if_match = req.headers().get(header::IF_MATCH).and_then(|v| v.to_str().ok());
            let if_range = req.headers().get(header::IF_RANGE).and_then(|v| v.to_str().ok());
            if let Some(im) = if_match.or(if_range) {
                if im != tag_str {
                    return Response::builder()
                        .status(StatusCode::PRECONDITION_FAILED)
                        .header(header::ETAG, tag_str)
                        .body(Body::empty())
                        .unwrap();
                }
            }

            if let Some(range) = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok()) {
                if range == "bytes=0-0" {
                    return Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::ETAG, tag_str)
                        .header(header::CONTENT_RANGE, format!("bytes 0-0/{}", SIZE))
                        .header(header::CONTENT_LENGTH, "1")
                        .body(Body::from(vec![1u8]))
                        .unwrap();
                }
            }

            Response::builder()
                .status(StatusCode::OK)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::ETAG, tag_str)
                .header(header::CONTENT_LENGTH, SIZE.to_string())
                .body(Body::from(vec![1u8; SIZE]))
                .unwrap()
        }
    }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let url = format!("http://127.0.0.1:{}/etag_file.bin", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);

    let temp_dir = std::env::temp_dir().join(format!("hd_etag_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let dest_file = temp_dir.join("etag_file.bin");

    // Start download
    let task = engine.start_download(&url, &temp_dir, Some("etag_file.bin"), 2).await.unwrap();

    // Pause download
    tokio::time::sleep(Duration::from_millis(50)).await;
    engine.pause_download(&task.id).await.unwrap();

    // Change server ETag from v1 to v2
    current_etag.store(2, Ordering::SeqCst);

    // Attempt resume -> should detect altered remote file and return PreconditionFailed
    let resume_res = engine.resume_download(&task.id, None).await;
    match resume_res {
        Err(DownloadError::PreconditionFailed) => {
            // Success: detected changed file!
        }
        other => panic!("Expected PreconditionFailed, got {:?}", other),
    }

    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_dir(&temp_dir);
}

// ----------------------------------------------------------------------------
// 8. DISK WRITE FAILURES
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_disk_write_failures() {
    let app = Router::new().route("/dummy.bin", get(|| async {
        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_LENGTH, "1024")
            .body(Body::from(vec![0u8; 1024]))
            .unwrap()
    }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let url = format!("http://127.0.0.1:{}/dummy.bin", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);

    // Non-existent invalid drive letter path on Windows
    let invalid_dir = std::path::PathBuf::from(r"Z:\nonexistent_drive_12345\downloads");

    let res = engine.start_download(&url, &invalid_dir, Some("test.bin"), 1).await;
    match res {
        Err(DownloadError::Io(_)) | Err(DownloadError::Internal(_)) => {
            // Properly handled disk write/preallocation error
        }
        other => panic!("Expected Io error on invalid disk path, got {:?}", other),
    }
}

// ----------------------------------------------------------------------------
// 9. APPLICATION RESTARTS & PERSISTENCE
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_application_restart_persistence() {
    const RESTART_SIZE: usize = 2 * 1024 * 1024; // 2 MB
    let data: Arc<Vec<u8>> = Arc::new((0..RESTART_SIZE).map(|i| (i % 255) as u8).collect());
    let data_ref = data.clone();

    let app = Router::new().route("/restart.bin", get(move |req: Request| {
        let d = data_ref.clone();
        async move {
            if let Some(range_h) = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok()) {
                if let Some(spec) = range_h.strip_prefix("bytes=") {
                    let parts: Vec<&str> = spec.split('-').collect();
                    let start: usize = parts[0].parse().unwrap_or(0);
                    let end: usize = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(RESTART_SIZE - 1).min(RESTART_SIZE - 1);

                    let slice = d[start..=end].to_vec();
                    return Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::ETAG, "\"stable-restart-etag\"")
                        .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, RESTART_SIZE))
                        .header(header::CONTENT_LENGTH, slice.len().to_string())
                        .body(Body::from(slice))
                        .unwrap();
                }
            }
            Response::builder()
                .status(StatusCode::OK)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::ETAG, "\"stable-restart-etag\"")
                .header(header::CONTENT_LENGTH, RESTART_SIZE.to_string())
                .body(Body::from((*d).clone()))
                .unwrap()
        }
    }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let temp_dir = std::env::temp_dir().join(format!("hd_restart_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let db_path = temp_dir.join("state.sqlite");
    let dest_file = temp_dir.join("restart.bin");
    let url = format!("http://127.0.0.1:{}/restart.bin", addr.port());

    let task_id = {
        // --- SESSION 1: Engine 1 Starts and Pauses ---
        let db1 = Arc::new(StateDatabase::open(&db_path).unwrap());
        let engine1 = DownloadEngine::new(db1);

        let task = engine1.start_download(&url, &temp_dir, Some("restart.bin"), 4).await.unwrap();
        tokio::time::sleep(Duration::from_millis(60)).await;
        engine1.pause_download(&task.id).await.unwrap();
        task.id
        // engine1 & db1 are dropped here, simulating process exit
    };

    // --- SESSION 2: Engine 2 Reloads Database from Disk & Resumes ---
    let db2 = Arc::new(StateDatabase::open(&db_path).unwrap());
    let engine2 = DownloadEngine::new(db2);
    let mut rx2 = engine2.subscribe_events();

    let _ = engine2.resume_download(&task_id, None).await.expect("Resume after restart failed");

    let mut done = false;
    while let Ok(event) = rx2.recv().await {
        if let DownloadEvent::TaskCompleted { id, total_bytes, .. } = event {
            if id == task_id {
                assert_eq!(total_bytes, RESTART_SIZE as u64);
                done = true;
                break;
            }
        }
    }

    assert!(done, "Download did not complete after restart");
    assert_eq!(std::fs::read(&dest_file).unwrap(), *data);

    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_dir(&temp_dir);
}

// ----------------------------------------------------------------------------
// 10. CONCURRENT DOWNLOADS
// ----------------------------------------------------------------------------
#[tokio::test]
async fn test_concurrent_downloads() {
    let app = Router::new()
        .route("/item1.bin", get(|| async {
            Response::builder().header(header::CONTENT_LENGTH, "1000").body(Body::from(vec![1u8; 1000])).unwrap()
        }))
        .route("/item2.bin", get(|| async {
            Response::builder().header(header::CONTENT_LENGTH, "2000").body(Body::from(vec![2u8; 2000])).unwrap()
        }))
        .route("/item3.bin", get(|| async {
            Response::builder().header(header::CONTENT_LENGTH, "3000").body(Body::from(vec![3u8; 3000])).unwrap()
        }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db);
    let mut rx = engine.subscribe_events();

    let temp_dir = std::env::temp_dir().join(format!("hd_concurrent_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();

    let t1 = engine.start_download(&format!("http://127.0.0.1:{}/item1.bin", addr.port()), &temp_dir, Some("item1.bin"), 1).await.unwrap();
    let t2 = engine.start_download(&format!("http://127.0.0.1:{}/item2.bin", addr.port()), &temp_dir, Some("item2.bin"), 1).await.unwrap();
    let t3 = engine.start_download(&format!("http://127.0.0.1:{}/item3.bin", addr.port()), &temp_dir, Some("item3.bin"), 1).await.unwrap();

    let mut completed_count = 0;
    while let Ok(event) = rx.recv().await {
        if let DownloadEvent::TaskCompleted { id, .. } = event {
            if id == t1.id || id == t2.id || id == t3.id {
                completed_count += 1;
                if completed_count == 3 {
                    break;
                }
            }
        }
    }

    assert_eq!(completed_count, 3);
    assert_eq!(std::fs::read(temp_dir.join("item1.bin")).unwrap().len(), 1000);
    assert_eq!(std::fs::read(temp_dir.join("item2.bin")).unwrap().len(), 2000);
    assert_eq!(std::fs::read(temp_dir.join("item3.bin")).unwrap().len(), 3000);

    let _ = std::fs::remove_file(temp_dir.join("item1.bin"));
    let _ = std::fs::remove_file(temp_dir.join("item2.bin"));
    let _ = std::fs::remove_file(temp_dir.join("item3.bin"));
    let _ = std::fs::remove_dir(&temp_dir);
}
