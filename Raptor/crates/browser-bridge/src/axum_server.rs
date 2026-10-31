use axum::extract::{Query, State};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use hyperdownload_download_engine::{is_playable_media_or_stream_url, is_unwanted_fallback_name, DownloadEngine};
use hyperdownload_shared::{DownloadId, DownloadStatus};
use hyperdownload_storage::StateDatabase;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewDownloadRequest {
    pub url: String,
    pub referer: Option<String>,
    pub cookie: Option<String>,
    pub filename: Option<String>,
    pub quality: Option<String>,
    #[serde(rename = "autoStart", alias = "auto_start")]
    pub auto_start: Option<bool>,
    #[serde(rename = "fileSize", alias = "file_size")]
    pub file_size: Option<u64>,
    pub mime: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetSpeedLimitRequest {
    #[serde(rename = "limitBps", alias = "limit_bps")]
    pub limit_bps: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFolderRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenUrlRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientDownloadTask {
    pub id: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    pub url: String,
    pub domain: String,
    #[serde(rename = "totalBytes")]
    pub total_bytes: Option<u64>,
    #[serde(rename = "downloadedBytes")]
    pub downloaded_bytes: u64,
    pub status: String,
    #[serde(rename = "activeConnections")]
    pub active_connections: usize,
    #[serde(rename = "currentSpeedBps")]
    pub current_speed_bps: u64,
    #[serde(rename = "averageSpeedBps")]
    pub average_speed_bps: u64,
    #[serde(rename = "etaSeconds")]
    pub eta_seconds: Option<u64>,
    #[serde(rename = "elapsedSeconds")]
    pub elapsed_seconds: u64,
    pub category: String,
    pub collection: Option<String>,
    #[serde(rename = "destinationPath")]
    pub destination_path: String,
    #[serde(rename = "completedTime")]
    pub completed_time: Option<String>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartDownloadRequest {
    pub url: String,
    #[serde(rename = "destinationDir")]
    pub destination_dir: Option<String>,
    pub filename: Option<String>,
    pub connections: Option<usize>,
    pub category: Option<String>,
    pub referer: Option<String>,
    pub cookie: Option<String>,
    pub quality: Option<String>,
    pub paused: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskActionRequest {
    pub id: String,
    #[serde(rename = "deleteFile")]
    pub delete_file: Option<bool>,
}

#[derive(Clone)]
pub struct BridgeState {
    pub command_tx: mpsc::Sender<NewDownloadRequest>,
    pub incoming: Arc<RwLock<Vec<NewDownloadRequest>>>,
    pub engine: Option<Arc<DownloadEngine>>,
    pub db: Option<Arc<StateDatabase>>,
}

pub struct LocalBridgeServer;

fn log_bridge(msg: &str) {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let log_dir = PathBuf::from(local).join("Raptor");
        let _ = std::fs::create_dir_all(&log_dir);
        let log_file = log_dir.join("native.log");
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_file) {
            let _ = writeln!(f, "[BRIDGE] {}", msg);
            let _ = f.flush();
        }
    }
}

impl LocalBridgeServer {
    pub async fn start(
        port: u16,
        command_tx: mpsc::Sender<NewDownloadRequest>,
        engine: Option<Arc<DownloadEngine>>,
        db: Option<Arc<StateDatabase>>,
    ) {
        log_bridge("LocalBridgeServer::start entered");
        let state = BridgeState {
            command_tx,
            incoming: Arc::new(RwLock::new(Vec::new())),
            engine,
            db,
        };

        // Determine dist directory path for native static serving
        let mut final_dist: Option<PathBuf> = None;

        let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf()));
        let mut candidates = vec![
            PathBuf::from("desktop/dist"),
            PathBuf::from("../desktop/dist"),
            PathBuf::from("dist"),
            PathBuf::from("C:\\Users\\ibrahim\\Desktop\\faster_download_manager\\HyperDownload\\desktop\\dist"),
        ];
        if let Some(ref ed) = exe_dir {
            candidates.insert(0, ed.join("dist"));
        }

        for candidate in &candidates {
            if candidate.join("index.html").exists() {
                final_dist = Some(candidate.clone());
                break;
            }
        }

        let dist_path = match final_dist {
            Some(p) => {
                log_bridge(&format!("Using disk dist: {:?}", p));
                p
            }
            None => {
                log_bridge("Extracting embedded dist to %TEMP%");
                // Standalone mode: extract embedded dist to %TEMP%\Raptor\dist
                let temp_dist = std::env::temp_dir().join("Raptor").join("dist");
                let _ = std::fs::create_dir_all(temp_dist.join("assets"));

                let _ = std::fs::write(temp_dist.join("index.html"), include_bytes!("../../../desktop/dist/index.html"));
                let _ = std::fs::write(temp_dist.join("raptor-logo.png"), include_bytes!("../../../desktop/dist/raptor-logo.png"));
                let _ = std::fs::write(temp_dist.join("raptor-logo.svg"), include_bytes!("../../../desktop/dist/raptor-logo.svg"));
                let _ = std::fs::write(temp_dist.join("assets/index.js"), include_bytes!("../../../desktop/dist/assets/index.js"));
                let _ = std::fs::write(temp_dist.join("assets/index.css"), include_bytes!("../../../desktop/dist/assets/index.css"));

                temp_dist
            }
        };
        log_bridge(&format!("Serving desktop UI from: {:?}", dist_path));

        let index_file = dist_path.join("index.html");
        let serve_dir = ServeDir::new(&dist_path).fallback(ServeFile::new(index_file));

        let app = Router::new()
            .route("/health", get(health_handler))
            .route("/api/media/probe", get(probe_media_handler))
            .route("/api/downloads", get(get_downloads_handler))
            .route("/api/download", post(add_download_handler))
            .route("/api/download/start", post(start_download_handler))
            .route("/api/download/pause", post(pause_download_handler))
            .route("/api/download/resume", post(resume_download_handler))
            .route("/api/download/delete", post(delete_download_handler))
            .route("/api/download/clear-completed", post(clear_completed_handler))
            .route("/api/download/touch", post(touch_file_handler))
            .route("/api/downloads/incoming", get(get_incoming_handler))
            .route("/api/open-folder", post(open_folder_handler))
            .route("/api/browse-folder", post(browse_folder_handler).get(browse_folder_handler))
            .route("/api/open-file", post(open_file_handler))
            .route("/api/open-url", post(open_url_handler))
            .route("/api/system/disk", get(get_disk_handler))
            .route("/api/settings/speed-limit", post(set_speed_limit_handler).get(get_speed_limit_handler))
            .fallback_service(serve_dir)
            .layer(CorsLayer::permissive())
            .with_state(state);

        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        log_bridge(&format!("Binding to {}", addr));

        let mut retries = 25;
        let mut bound_listener = None;
        while retries > 0 {
            match tokio::net::TcpListener::bind(addr).await {
                Ok(l) => {
                    log_bridge("TcpListener::bind succeeded!");
                    bound_listener = Some(l);
                    break;
                }
                Err(e) => {
                    retries -= 1;
                    log_bridge(&format!("TcpListener::bind waiting for port release (remaining retries: {}): {:?}", retries, e));
                    if retries > 0 {
                        tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
                    }
                }
            }
        }

        if let Some(listener) = bound_listener {
            log_bridge("Starting axum::serve");
            let serve_res = axum::serve(listener, app).await;
            log_bridge(&format!("axum::serve returned: {:?}", serve_res));
        } else {
            log_bridge("Could not bind listener after all retries!");
        }
    }
}

async fn health_handler() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok", "service": "HyperDownload Engine" }))
}

async fn get_downloads_handler(State(state): State<BridgeState>) -> impl IntoResponse {
    let mut client_tasks: Vec<ClientDownloadTask> = Vec::new();

    if let Some(engine) = &state.engine {
        if let Ok(tasks) = engine.get_all_tasks_status().await {
            for t in tasks {
                let domain = reqwest::Url::parse(&t.url)
                    .ok()
                    .and_then(|u| u.host_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "web.download".into());

                let status_str = match &t.status {
                    DownloadStatus::Queued => "Queued".to_string(),
                    DownloadStatus::Probing => "Connecting".to_string(),
                    DownloadStatus::Allocating => "Allocating".to_string(),
                    DownloadStatus::Downloading => "Downloading".to_string(),
                    DownloadStatus::Paused => "Paused".to_string(),
                    DownloadStatus::Completed => "Completed".to_string(),
                    DownloadStatus::Failed(e) => {
                        if e.starts_with("Failed:") {
                            e.clone()
                        } else if e == "Failed" {
                            "Failed".to_string()
                        } else {
                            format!("Failed: {}", e)
                        }
                    }
                };

                let is_completed = status_str == "Completed";
                let is_failed = status_str.starts_with("Failed");

                client_tasks.push(ClientDownloadTask {
                    id: t.id.to_string(),
                    file_name: t.file_name,
                    url: t.url,
                    domain,
                    total_bytes: t.total_bytes,
                    downloaded_bytes: t.downloaded_bytes,
                    status: if is_completed {
                        "Completed".into()
                    } else if is_failed {
                        "Failed".into()
                    } else {
                        status_str.clone()
                    },
                    active_connections: t.active_connections,
                    current_speed_bps: t.current_speed_bps,
                    average_speed_bps: t.current_speed_bps,
                    eta_seconds: t.eta_seconds,
                    elapsed_seconds: 0,
                    category: t.category,
                    collection: Some("Personal".into()),
                    destination_path: t.destination_path.to_string_lossy().to_string(),
                    completed_time: if is_completed { Some("Completed".into()) } else { None },
                    error_message: if is_failed { Some(status_str) } else { None },
                    created_at: "".into(),
                });
            }
        }
    }

    Json(client_tasks)
}

#[derive(Debug, Deserialize)]
pub struct ProbeQuery {
    pub url: String,
}

async fn probe_media_handler(
    State(state): State<BridgeState>,
    Query(query): Query<ProbeQuery>,
) -> impl IntoResponse {
    let is_media = is_playable_media_or_stream_url(&query.url);
    if is_media {
        if let Some(engine) = &state.engine {
            if let Some(title) = engine.probe_title(&query.url).await {
                return Json(serde_json::json!({
                    "success": true,
                    "title": title,
                    "isMedia": true,
                    "formats": [
                        { "id": "best-mp4", "label": "MP4 - En İyi Kalite (Best Video + Audio)", "ext": "mp4", "quality": "best" },
                        { "id": "1080p", "label": "MP4 - 1080p Full HD", "ext": "mp4", "quality": "1080p" },
                        { "id": "720p", "label": "MP4 - 720p HD", "ext": "mp4", "quality": "720p" },
                        { "id": "480p", "label": "MP4 - 480p SD", "ext": "mp4", "quality": "480p" },
                        { "id": "360p", "label": "MP4 - 360p", "ext": "mp4", "quality": "360p" },
                        { "id": "mkv-best", "label": "MKV - En Yüksek Kalite / Kayıpsız", "ext": "mkv", "quality": "mkv" },
                        { "id": "audio-320k", "label": "MP3 - Sadece Ses (320 kbps Yüksek Kalite)", "ext": "mp3", "quality": "audio-320k" },
                        { "id": "audio-192k", "label": "MP3 - Sadece Ses (192 kbps Standart)", "ext": "mp3", "quality": "audio-192k" },
                        { "id": "audio-128k", "label": "MP3 - Sadece Ses (128 kbps Hafif Boyut)", "ext": "mp3", "quality": "audio-128k" }
                    ]
                }));
            }
        }
    } else {
        // Fast HTTP HEAD request to determine file size, filename, and mime
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(4))
            .build()
            .unwrap_or_default();

        let mut file_size: Option<u64> = None;
        let mut filename: Option<String> = None;
        let mut mime: Option<String> = None;

        if let Ok(res) = client.head(&query.url).send().await {
            if let Some(cl) = res.headers().get(reqwest::header::CONTENT_LENGTH) {
                if let Ok(s) = cl.to_str() {
                    file_size = s.parse::<u64>().ok();
                }
            }
            if let Some(ct) = res.headers().get(reqwest::header::CONTENT_TYPE) {
                if let Ok(s) = ct.to_str() {
                    mime = Some(s.to_string());
                }
            }
            if let Some(cd) = res.headers().get(reqwest::header::CONTENT_DISPOSITION) {
                if let Ok(s) = cd.to_str() {
                    if let Some(idx) = s.find("filename=") {
                        let name_part = &s[idx + 9..];
                        let clean_name = name_part.trim_matches(|c| c == '"' || c == ';' || c == ' ');
                        if !clean_name.is_empty() {
                            filename = Some(clean_name.to_string());
                        }
                    }
                }
            }
        }

        if filename.is_none() {
            if let Ok(parsed) = reqwest::Url::parse(&query.url) {
                if let Some(segment) = parsed.path_segments().and_then(|mut s| s.next_back()) {
                    if !segment.is_empty() && !is_unwanted_fallback_name(segment) {
                        filename = Some(segment.to_string());
                    }
                }
            }
        }

        return Json(serde_json::json!({
            "success": true,
            "isMedia": false,
            "filename": filename,
            "fileSize": file_size,
            "mime": mime
        }));
    }

    Json(serde_json::json!({ "success": false, "isMedia": is_media }))
}

async fn set_speed_limit_handler(
    State(state): State<BridgeState>,
    Json(payload): Json<SetSpeedLimitRequest>,
) -> impl IntoResponse {
    if let Some(engine) = &state.engine {
        engine.set_global_speed_limit(payload.limit_bps);
        Json(serde_json::json!({ "success": true, "limitBps": payload.limit_bps }))
    } else {
        Json(serde_json::json!({ "success": false, "error": "Engine not attached" }))
    }
}

async fn get_speed_limit_handler(
    State(state): State<BridgeState>,
) -> impl IntoResponse {
    let limit = if let Some(engine) = &state.engine {
        engine.get_global_speed_limit()
    } else {
        0
    };
    Json(serde_json::json!({ "success": true, "limitBps": limit }))
}

/// Starts a download through the right pipeline and reports the real outcome.
/// Direct files go through the segmented HTTP engine (with referer/cookie);
/// streams, embedded player pages, and anything the direct probe rejects
/// (403 without proper headers, HTML pages, disguised playlists) fall back
/// to the media extractor (yt-dlp) so the task is never silently dropped.
#[allow(clippy::too_many_arguments)]
async fn dispatch_download(
    eng: Arc<DownloadEngine>,
    url: String,
    dest_dir: PathBuf,
    filename: Option<String>,
    connections: usize,
    referer: Option<String>,
    cookie: Option<String>,
    quality: Option<String>,
) -> std::result::Result<String, String> {
    log_bridge(&format!("dispatch_download url={} referer={:?} filename={:?}", url, referer, filename));

    if is_playable_media_or_stream_url(&url) {
        return eng
            .start_stream_download(&url, &dest_dir, filename.as_deref(), referer.as_deref(), cookie.as_deref(), quality.as_deref())
            .await
            .map(|t| t.file_name)
            .map_err(|e| format!("{:?}", e));
    }

    let mut opts = hyperdownload_shared::HttpOptions::default();
    opts.referer = referer.clone().filter(|r| !r.trim().is_empty());
    opts.cookies = cookie.clone().filter(|c| !c.trim().is_empty());

    match eng.start_download_with_options(&url, &dest_dir, filename.as_deref(), connections, opts).await {
        Ok(t) => Ok(t.file_name),
        Err(e) => {
            log_bridge(&format!("Direct download failed ({:?}); falling back to media extractor", e));
            eng.start_stream_download(&url, &dest_dir, filename.as_deref(), referer.as_deref(), cookie.as_deref(), quality.as_deref())
                .await
                .map(|t| t.file_name)
                .map_err(|e2| format!("{:?} / {:?}", e, e2))
        }
    }
}

async fn start_download_handler(
    State(state): State<BridgeState>,
    Json(payload): Json<StartDownloadRequest>,
) -> impl IntoResponse {
    info!("Starting download for url: {}", payload.url);
    if let Some(engine) = &state.engine {
        let default_dir = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:".into()) + "\\Downloads";
        let dest_dir = PathBuf::from(payload.destination_dir.as_deref().unwrap_or(&default_dir));
        let _ = std::fs::create_dir_all(&dest_dir);

        let filename = payload.filename.filter(|f| !is_unwanted_fallback_name(f));
        let connections = payload.connections.unwrap_or(16);

        let fut = dispatch_download(
            engine.clone(),
            payload.url.clone(),
            dest_dir,
            filename,
            connections,
            payload.referer.clone(),
            payload.cookie.clone(),
            payload.quality.clone(),
        );

        match tokio::time::timeout(std::time::Duration::from_secs(25), fut).await {
            Ok(Ok(name)) => {
                log_bridge(&format!("Download started: {}", name));
                if payload.paused.unwrap_or(false) {
                    if let Ok(tasks) = engine.list_tasks() {
                        if let Some(t) = tasks.iter().find(|t| t.file_name == name) {
                            let _ = engine.pause_download(&t.id).await;
                        }
                    }
                }
                Json(serde_json::json!({ "success": true, "message": "Download started", "fileName": name }))
            }
            Ok(Err(err)) => {
                log_bridge(&format!("Download failed to start: {}", err));
                Json(serde_json::json!({ "success": false, "error": err }))
            }
            Err(_) => {
                log_bridge("Download start timed out after 25s");
                Json(serde_json::json!({ "success": false, "error": "Sunucu yanıt vermedi (zaman aşımı)" }))
            }
        }
    } else {
        Json(serde_json::json!({ "success": false, "error": "Engine not attached" }))
    }
}

async fn pause_download_handler(
    State(state): State<BridgeState>,
    Json(payload): Json<TaskActionRequest>,
) -> impl IntoResponse {
    if let Some(engine) = &state.engine {
        if let Ok(uuid) = Uuid::parse_str(&payload.id) {
            let id = DownloadId(uuid);
            let _ = engine.pause_download(&id).await;
            return Json(serde_json::json!({ "success": true }));
        }
    }
    Json(serde_json::json!({ "success": false }))
}

async fn resume_download_handler(
    State(state): State<BridgeState>,
    Json(payload): Json<TaskActionRequest>,
) -> impl IntoResponse {
    if let Some(engine) = &state.engine {
        if let Ok(uuid) = Uuid::parse_str(&payload.id) {
            let id = DownloadId(uuid);
            let eng = engine.clone();
            tokio::spawn(async move {
                let _ = eng.resume_download(&id, None).await;
            });
            return Json(serde_json::json!({ "success": true }));
        }
    }
    Json(serde_json::json!({ "success": false }))
}

async fn delete_download_handler(
    State(state): State<BridgeState>,
    Json(payload): Json<TaskActionRequest>,
) -> impl IntoResponse {
    if let Some(engine) = &state.engine {
        if let Ok(uuid) = Uuid::parse_str(&payload.id) {
            let id = DownloadId(uuid);
            let delete_file = payload.delete_file.unwrap_or(false);
            let _ = engine.cancel_download(&id, delete_file).await;
            return Json(serde_json::json!({ "success": true }));
        }
    }
    Json(serde_json::json!({ "success": false }))
}

async fn clear_completed_handler(
    State(state): State<BridgeState>,
) -> impl IntoResponse {
    if let Some(engine) = &state.engine {
        if let Ok(tasks) = engine.list_tasks() {
            for t in tasks {
                if t.status == DownloadStatus::Completed {
                    let _ = engine.cancel_download(&t.id, false).await;
                }
            }
        }
    }
    Json(serde_json::json!({ "success": true }))
}

async fn add_download_handler(
    State(state): State<BridgeState>,
    Json(payload): Json<NewDownloadRequest>,
) -> impl IntoResponse {
    info!("Received download request: {} (file: {:?})", payload.url, payload.filename);
    {
        let mut queue = state.incoming.write().await;
        queue.push(payload.clone());
    }
    let _ = state.command_tx.send(payload.clone()).await;

    #[cfg(windows)]
    bring_raptor_to_foreground();

    if payload.auto_start.unwrap_or(false) {
        if let Some(engine) = &state.engine {
            let dest = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_else(|_| "C:".into())).join("Downloads");
            let eng = engine.clone();
            let url = payload.url.clone();
            let filename = payload.filename.filter(|f| !is_unwanted_fallback_name(f));
            let referer = payload.referer.clone();
            let cookie = payload.cookie.clone();
            let quality = payload.quality.clone();

            tokio::spawn(async move {
                if let Err(e) = dispatch_download(eng, url, dest, filename, 16, referer, cookie, quality).await {
                    log_bridge(&format!("Auto-start download failed: {}", e));
                }
            });
        }
    }

    Json(serde_json::json!({ "success": true, "message": "Download queued for user confirmation" }))
}

async fn get_incoming_handler(State(state): State<BridgeState>) -> impl IntoResponse {
    let mut queue = state.incoming.write().await;
    let list: Vec<NewDownloadRequest> = queue.drain(..).collect();
    Json(list)
}

async fn open_folder_handler(Json(payload): Json<OpenFolderRequest>) -> impl IntoResponse {
    let clean_path = payload.path.replace('/', "\\");
    log_bridge(&format!("Request to open path: {}", clean_path));

    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        use std::process::Command;
        use std::os::windows::process::CommandExt;

        let mut p = std::path::PathBuf::from(&clean_path);

        // Resolve real file if extension differs (e.g. yt-dlp saved as webm/mp4/mkv)
        if !p.exists() {
            let webm = p.with_extension("webm");
            let mp4 = p.with_extension("mp4");
            let mkv = p.with_extension("mkv");
            if webm.exists() {
                p = webm;
            } else if mp4.exists() {
                p = mp4;
            } else if mkv.exists() {
                p = mkv;
            }
        }

        // 1. If it's an existing file, highlight it with /select
        if p.is_file() && p.exists() {
            let file_target = p.to_string_lossy().to_string();
            log_bridge(&format!("Highlighting file in explorer: {}", file_target));
            
            let open_wide: Vec<u16> = "open".encode_utf16().chain(std::iter::once(0)).collect();
            let explorer_wide: Vec<u16> = "explorer.exe".encode_utf16().chain(std::iter::once(0)).collect();
            let params = format!("/select,\"{}\"", file_target);
            let params_wide: Vec<u16> = params.encode_utf16().chain(std::iter::once(0)).collect();

            unsafe {
                let res = ShellExecuteW(
                    None,
                    PCWSTR(open_wide.as_ptr()),
                    PCWSTR(explorer_wide.as_ptr()),
                    PCWSTR(params_wide.as_ptr()),
                    None,
                    SW_SHOWNORMAL,
                );
                log_bridge(&format!("ShellExecuteW /select result: {:?}", res));

                if (res.0 as isize) <= 32 {
                    let mut cmd = Command::new("explorer.exe");
                    cmd.raw_arg(params);
                    let _ = cmd.spawn();
                }
            }
        } else {
            // 2. If directory or target does not exist, open the containing folder
            let dir_to_open = if p.is_dir() && p.exists() {
                p.to_string_lossy().to_string()
            } else if let Some(parent) = p.parent() {
                if parent.exists() {
                    parent.to_string_lossy().to_string()
                } else {
                    let _ = std::fs::create_dir_all(parent);
                    parent.to_string_lossy().to_string()
                }
            } else {
                let default_dir = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:".into()) + "\\Downloads";
                let _ = std::fs::create_dir_all(&default_dir);
                default_dir
            };

            log_bridge(&format!("Opening directory: {}", dir_to_open));
            let open_wide: Vec<u16> = "open".encode_utf16().chain(std::iter::once(0)).collect();
            let dir_wide: Vec<u16> = dir_to_open.encode_utf16().chain(std::iter::once(0)).collect();

            unsafe {
                let res = ShellExecuteW(
                    None,
                    PCWSTR(open_wide.as_ptr()),
                    PCWSTR(dir_wide.as_ptr()),
                    None,
                    None,
                    SW_SHOWNORMAL,
                );
                log_bridge(&format!("ShellExecuteW dir result: {:?}", res));

                if (res.0 as isize) <= 32 {
                    let mut cmd = Command::new("explorer.exe");
                    cmd.arg(&dir_to_open);
                    let _ = cmd.spawn();
                }
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&clean_path).spawn();
    }

    Json(serde_json::json!({ "success": true, "path": clean_path }))
}

async fn open_file_handler(Json(payload): Json<OpenFolderRequest>) -> impl IntoResponse {
    let clean_path = payload.path.replace('/', "\\");
    log_bridge(&format!("Request to open file directly: {}", clean_path));

    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        use std::process::Command;

        let mut p = std::path::PathBuf::from(&clean_path);
        if !p.exists() {
            for ext in ["mp4", "webm", "mkv", "mp3", "m4a", "zip", "iso", "exe"] {
                let cand = p.with_extension(ext);
                if cand.exists() {
                    p = cand;
                    break;
                }
            }
        }

        if p.exists() {
            let target = p.to_string_lossy().to_string();
            let open_wide: Vec<u16> = "open".encode_utf16().chain(std::iter::once(0)).collect();
            let file_wide: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();

            unsafe {
                let res = ShellExecuteW(
                    None,
                    PCWSTR(open_wide.as_ptr()),
                    PCWSTR(file_wide.as_ptr()),
                    None,
                    None,
                    SW_SHOWNORMAL,
                );
                log_bridge(&format!("ShellExecuteW open file result: {:?}", res));
                if (res.0 as isize) > 32 {
                    return Json(serde_json::json!({ "success": true, "path": target }));
                }
            }

            // Fallback via start
            let _ = Command::new("cmd")
                .args(["/c", "start", "", &target])
                .spawn();
            return Json(serde_json::json!({ "success": true, "path": target }));
        }
    }

    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&clean_path).spawn();
    }

    Json(serde_json::json!({ "success": false, "error": "File not found" }))
}

async fn browse_folder_handler() -> impl IntoResponse {
    let folder = tokio::task::spawn_blocking(|| {
        #[cfg(windows)]
        {
            let output = std::process::Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }",
                ])
                .output();
            if let Ok(out) = output {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !s.is_empty() {
                    return Some(s);
                }
            }
        }
        None
    })
    .await
    .unwrap_or(None);

    Json(serde_json::json!({ "success": folder.is_some(), "path": folder }))
}

#[cfg(windows)]
fn bring_raptor_to_foreground() {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, EnumWindows, GetWindowTextW, IsWindowVisible, SetForegroundWindow,
        ShowWindow, SW_RESTORE,
    };

    unsafe extern "system" fn enum_window_proc(hwnd: HWND, _: LPARAM) -> BOOL {
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }
        let mut title = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title);
        if len > 0 {
            let s = String::from_utf16_lossy(&title[..len as usize]);
            if s.contains("Raptor") {
                let _ = ShowWindow(hwnd, SW_RESTORE);
                let _ = BringWindowToTop(hwnd);
                let _ = SetForegroundWindow(hwnd);
                return BOOL(0);
            }
        }
        BOOL(1)
    }

    unsafe {
        let _ = EnumWindows(Some(enum_window_proc), LPARAM(0));
    }
}

async fn touch_file_handler(Json(payload): Json<OpenFolderRequest>) -> impl IntoResponse {
    let clean_path = payload.path.replace('/', "\\");
    let p = std::path::Path::new(&clean_path);
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if !p.exists() {
        let _ = std::fs::write(&clean_path, b"Raptor Video Download Complete\n");
        log_bridge(&format!("touch_file_handler: Created {}", clean_path));
    }
    Json(serde_json::json!({ "success": true, "path": clean_path }))
}

async fn open_url_handler(Json(payload): Json<OpenUrlRequest>) -> impl IntoResponse {
    let target = payload.url.trim().to_string();
    log_bridge(&format!("Request to open URL: {}", target));

    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        use std::process::Command;

        let open_wide: Vec<u16> = "open".encode_utf16().chain(std::iter::once(0)).collect();
        let url_wide: Vec<u16> = target.encode_utf16().chain(std::iter::once(0)).collect();

        unsafe {
            let res = ShellExecuteW(
                None,
                PCWSTR(open_wide.as_ptr()),
                PCWSTR(url_wide.as_ptr()),
                None,
                None,
                SW_SHOWNORMAL,
            );
            if (res.0 as isize) > 32 {
                return Json(serde_json::json!({ "success": true }));
            }
        }

        // Fallback via start
        let _ = Command::new("cmd")
            .args(["/c", "start", "", &target])
            .spawn();
    }

    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&target).spawn();
    }

    Json(serde_json::json!({ "success": true }))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskStats {
    pub drive: String,
    pub name: String,
    #[serde(rename = "freeGB")]
    pub free_gb: f64,
    #[serde(rename = "totalGB")]
    pub total_gb: f64,
    #[serde(rename = "usedGB")]
    pub used_gb: f64,
    #[serde(rename = "usedPercent")]
    pub used_percent: f64,
    pub label: String,
}

#[derive(Debug, Deserialize)]
pub struct DiskQuery {
    pub path: Option<String>,
}

async fn get_disk_handler(Query(query): Query<DiskQuery>) -> impl IntoResponse {
    let target_path = query.path.unwrap_or_else(|| {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "C:".into()) + "\\Downloads"
    });

    let stats = get_disk_stats_for_path(&target_path);
    Json(stats)
}

#[cfg(windows)]
fn get_disk_stats_for_path(path_str: &str) -> DiskStats {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{GetDiskFreeSpaceExW, GetVolumeInformationW};

    let clean = path_str.replace('/', "\\");
    let drive_char = clean.chars().next().unwrap_or('C').to_ascii_uppercase();
    let root = format!("{}:\\", drive_char);
    let root_wide: Vec<u16> = root.encode_utf16().chain(std::iter::once(0)).collect();

    let mut free_available: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free: u64 = 0;

    let space_ok = unsafe {
        GetDiskFreeSpaceExW(
            PCWSTR(root_wide.as_ptr()),
            Some(&mut free_available),
            Some(&mut total_bytes),
            Some(&mut total_free),
        )
    };

    let mut vol_name = [0u16; 261];
    let mut serial = 0u32;
    let mut max_len = 0u32;
    let mut flags = 0u32;
    let mut fs_name = [0u16; 261];

    let vol_ok = unsafe {
        GetVolumeInformationW(
            PCWSTR(root_wide.as_ptr()),
            Some(&mut vol_name),
            Some(&mut serial),
            Some(&mut max_len),
            Some(&mut flags),
            Some(&mut fs_name),
        )
    };

    let volume_label = if vol_ok.is_ok() {
        let len = vol_name.iter().position(|&c| c == 0).unwrap_or(0);
        String::from_utf16_lossy(&vol_name[..len])
    } else {
        String::new()
    };

    let display_name = if !volume_label.trim().is_empty() {
        format!("{} ({}:)", volume_label.trim(), drive_char)
    } else {
        format!("Yerel Disk ({}:)", drive_char)
    };

    if space_ok.is_ok() && total_bytes > 0 {
        let gb = 1024.0 * 1024.0 * 1024.0;
        let total_gb = (total_bytes as f64 / gb * 10.0).round() / 10.0;
        let free_gb = (free_available as f64 / gb * 10.0).round() / 10.0;
        let used_gb = ((total_bytes - free_available) as f64 / gb * 10.0).round() / 10.0;
        let used_percent = (((total_bytes - free_available) as f64 / total_bytes as f64) * 1000.0).round() / 10.0;

        DiskStats {
            drive: format!("{}:", drive_char),
            name: display_name,
            free_gb,
            total_gb,
            used_gb,
            used_percent,
            label: format!("{} GB free of {} GB", free_gb, total_gb),
        }
    } else {
        DiskStats {
            drive: format!("{}:", drive_char),
            name: display_name,
            free_gb: 0.0,
            total_gb: 0.0,
            used_gb: 0.0,
            used_percent: 0.0,
            label: "Disk bilgisi alınamadı".into(),
        }
    }
}

#[cfg(not(windows))]
fn get_disk_stats_for_path(_path_str: &str) -> DiskStats {
    DiskStats {
        drive: "C:".into(),
        name: "Yerel Disk (C:)".into(),
        free_gb: 19.4,
        total_gb: 446.2,
        used_gb: 426.8,
        used_percent: 95.7,
        label: "19.4 GB free of 446.2 GB".into(),
    }
}
