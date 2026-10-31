use axum::body::Body;
use axum::extract::Request;
use axum::http::{header, StatusCode};
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use hyperdownload_download_engine::DownloadEngine;
use hyperdownload_shared::{DownloadEvent, DownloadStatus};
use hyperdownload_storage::StateDatabase;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;

const TEST_FILE_SIZE: usize = 2 * 1024 * 1024; // 2 MB

async fn mock_file_handler(req: Request) -> Response {
    let data: Vec<u8> = (0..TEST_FILE_SIZE).map(|i| (i % 256) as u8).collect();

    if let Some(range_header) = req.headers().get(header::RANGE).and_then(|v| v.to_str().ok()) {
        if let Some(spec) = range_header.strip_prefix("bytes=") {
            let parts: Vec<&str> = spec.split('-').collect();
            let start: usize = parts[0].parse().unwrap_or(0);
            let end: usize = if parts.len() > 1 && !parts[1].is_empty() {
                parts[1].parse().unwrap_or(TEST_FILE_SIZE - 1)
            } else {
                TEST_FILE_SIZE - 1
            };

            let end = end.min(TEST_FILE_SIZE - 1);
            if start <= end && start < TEST_FILE_SIZE {
                let chunk = data[start..=end].to_vec();
                let content_range = format!("bytes {}-{}/{}", start, end, TEST_FILE_SIZE);

                return Response::builder()
                    .status(StatusCode::PARTIAL_CONTENT)
                    .header(header::ACCEPT_RANGES, "bytes")
                    .header(header::ETAG, "\"stable-test-etag-123\"")
                    .header(header::CONTENT_RANGE, content_range)
                    .header(header::CONTENT_LENGTH, chunk.len().to_string())
                    .header(header::CONTENT_TYPE, "application/octet-stream")
                    .body(Body::from(chunk))
                    .unwrap();
            }
        }
    }

    Response::builder()
        .status(StatusCode::OK)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::ETAG, "\"stable-test-etag-123\"")
        .header(header::CONTENT_LENGTH, TEST_FILE_SIZE.to_string())
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .body(Body::from(data))
        .unwrap()
}

#[tokio::test]
async fn test_end_to_end_accelerated_download() {
    let app = Router::new().route("/testfile.bin", get(mock_file_handler));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    let url = format!("http://127.0.0.1:{}/testfile.bin", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db.clone());
    let mut rx = engine.subscribe_events();

    let temp_dir = std::env::temp_dir().join(format!("hd_test_acc_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let dest_file = temp_dir.join("testfile.bin");
    let _ = std::fs::remove_file(&dest_file);

    let task = engine
        .start_download(&url, &temp_dir, Some("testfile.bin"), 4)
        .await
        .expect("Failed to start download");

    let mut completed = false;
    while let Ok(event) = rx.recv().await {
        match event {
            DownloadEvent::TaskCompleted { id, total_bytes, .. } => {
                assert_eq!(id, task.id);
                assert_eq!(total_bytes, TEST_FILE_SIZE as u64);
                completed = true;
                break;
            }
            DownloadEvent::TaskFailed { id, error } => {
                panic!("Download failed for {}: {}", id, error);
            }
            _ => {}
        }
    }

    assert!(completed, "TaskCompleted event was not received");
    assert!(dest_file.exists(), "Downloaded file does not exist on disk");
    let downloaded_bytes = std::fs::read(&dest_file).unwrap();
    assert_eq!(downloaded_bytes.len(), TEST_FILE_SIZE);

    let expected_pattern: Vec<u8> = (0..TEST_FILE_SIZE).map(|i| (i % 256) as u8).collect();
    assert_eq!(downloaded_bytes, expected_pattern);

    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_dir(&temp_dir);
}

#[tokio::test]
async fn test_pause_and_resume_download() {
    let app = Router::new().route("/resumefile.bin", get(mock_file_handler));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    let url = format!("http://127.0.0.1:{}/resumefile.bin", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db.clone());
    let mut rx = engine.subscribe_events();

    let temp_dir = std::env::temp_dir().join(format!("hd_test_resume_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let dest_file = temp_dir.join("resumefile.bin");
    let _ = std::fs::remove_file(&dest_file);

    // 1. Start download
    let task = engine
        .start_download(&url, &temp_dir, Some("resumefile.bin"), 4)
        .await
        .expect("Failed to start download");

    // 2. Pause immediately after starting
    tokio::time::sleep(Duration::from_millis(50)).await;
    engine.pause_download(&task.id).await.expect("Failed to pause");

    // 3. Verify state in SQLite
    let persisted_task = db.get_task(&task.id).unwrap().expect("Task should be in DB");
    assert_eq!(persisted_task.status, DownloadStatus::Paused);

    // 4. Resume download
    let _ = engine
        .resume_download(&task.id, None)
        .await
        .expect("Failed to resume download");

    // 5. Await completion
    let mut completed = false;
    while let Ok(event) = rx.recv().await {
        match event {
            DownloadEvent::TaskCompleted { id, total_bytes, .. } => {
                if id == task.id {
                    assert_eq!(total_bytes, TEST_FILE_SIZE as u64);
                    completed = true;
                    break;
                }
            }
            _ => {}
        }
    }

    assert!(completed, "Resumed download did not complete");
    assert!(dest_file.exists());
    let downloaded_bytes = std::fs::read(&dest_file).unwrap();
    assert_eq!(downloaded_bytes.len(), TEST_FILE_SIZE);

    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_dir(&temp_dir);
}

#[tokio::test]
async fn test_single_connection_fallback_when_no_range() {
    // Server does NOT send Accept-Ranges and rejects Range requests with 200 OK full file
    async fn non_range_handler() -> Response {
        let data: Vec<u8> = vec![42u8; 100_000]; // 100 KB
        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_LENGTH, "100000")
            .header(header::CONTENT_TYPE, "application/octet-stream")
            .body(Body::from(data))
            .unwrap()
    }

    let app = Router::new().route("/nonrange.bin", get(non_range_handler));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    let url = format!("http://127.0.0.1:{}/nonrange.bin", addr.port());
    let db = Arc::new(StateDatabase::open_in_memory().unwrap());
    let engine = DownloadEngine::new(db.clone());
    let mut rx = engine.subscribe_events();

    let temp_dir = std::env::temp_dir().join(format!("hd_test_fallback_{}", std::process::id()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    let dest_file = temp_dir.join("nonrange.bin");
    let _ = std::fs::remove_file(&dest_file);

    // Request 8 connections, but server has no range support -> engine should fallback to 1 connection
    let task = engine
        .start_download(&url, &temp_dir, Some("nonrange.bin"), 8)
        .await
        .expect("Failed to start download");

    assert_eq!(task.active_connections, 1);

    let mut completed = false;
    while let Ok(event) = rx.recv().await {
        if let DownloadEvent::TaskCompleted { id, total_bytes, .. } = event {
            if id == task.id {
                assert_eq!(total_bytes, 100_000);
                completed = true;
                break;
            }
        }
    }

    assert!(completed);
    let downloaded_bytes = std::fs::read(&dest_file).unwrap();
    assert_eq!(downloaded_bytes.len(), 100_000);
    assert_eq!(downloaded_bytes[0], 42);

    let _ = std::fs::remove_file(&dest_file);
    let _ = std::fs::remove_dir(&temp_dir);
}
