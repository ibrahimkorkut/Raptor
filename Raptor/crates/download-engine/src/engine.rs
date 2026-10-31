use crate::worker::SegmentWorker;
use dashmap::DashMap;
use hyperdownload_http_client::CapabilityProber;
use hyperdownload_segment_manager::{
    ActiveSegment, AsyncSpeedLimiter, WorkStealer, MIN_BISECTION_CHUNK_SIZE,
};
use hyperdownload_shared::{
    ByteRange, DownloadError, DownloadEvent, DownloadId, DownloadMetadata, DownloadStatus,
    DownloadTaskInfo, HttpOptions, PersistedSegment, Result, ResumeValidation,
};
use hyperdownload_storage::{DiskAllocator, PositionedChunkWriter, StateDatabase};
use reqwest::Client;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::{broadcast, RwLock};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

pub fn get_category_for_filename(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    let ext = lower.split('.').last().unwrap_or("");
    match ext {
        "mp4" | "mkv" | "avi" | "mov" | "webm" | "flv" | "ts" | "m4v" => "Video",
        "mp3" | "wav" | "flac" | "aac" | "m4a" | "ogg" | "opus" => "Music",
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "iso" | "dmg" => "Compressed",
        "exe" | "msi" | "bat" | "cmd" | "apk" | "bin" => "Programs",
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" => "Documents",
        _ => "General",
    }
}

pub fn decode_resilient_turkish_text(bytes: &[u8]) -> String {
    if let Ok(valid) = std::str::from_utf8(bytes) {
        return valid.to_string();
    }
    let lossy = String::from_utf8_lossy(bytes);
    if !lossy.contains('\u{FFFD}') {
        return lossy.to_string();
    }
    // Fallback decoding for CP1254 (Windows Turkish ANSI) and CP857 (DOS/Console Turkish)
    let mut s = String::with_capacity(bytes.len());
    for &b in bytes {
        match b {
            // CP1254
            0xD6 => s.push('Ö'),
            0xDC => s.push('Ü'),
            0xC7 => s.push('Ç'),
            0xDE => s.push('Ş'),
            0xD0 => s.push('Ğ'),
            0xDD => s.push('İ'),
            0xF6 => s.push('ö'),
            0xFC => s.push('ü'),
            0xE7 => s.push('ç'),
            0xFE => s.push('ş'),
            0xF0 => s.push('ğ'),
            0xFD => s.push('ı'),
            // CP857
            0x99 => s.push('Ö'),
            0x9A => s.push('Ü'),
            0x80 => s.push('Ç'),
            0x9E => s.push('Ş'),
            0xA6 => s.push('Ğ'),
            0x98 => s.push('İ'),
            0x94 => s.push('ö'),
            0x81 => s.push('ü'),
            0x87 => s.push('ç'),
            0x9F => s.push('ş'),
            0xA7 => s.push('ğ'),
            0x8D => s.push('ı'),
            _ if b < 0x80 => s.push(b as char),
            _ => s.push('?'),
        }
    }
    if s.chars().filter(|&c| c == '?').count() < lossy.chars().filter(|&c| c == '\u{FFFD}').count() {
        s
    } else {
        lossy.to_string()
    }
}

pub fn is_unwanted_fallback_name(s: &str) -> bool {
    let trimmed = s.trim();
    if trimmed.is_empty() || trimmed.len() <= 2 {
        return true;
    }
    let lower = trimmed.to_lowercase();
    if lower == "view_video.php"
        || lower.starts_with("view_video")
        || lower == "watch"
        || lower == "video"
        || lower == "media_video"
        || lower == "youtube_video"
        || lower == "downloaded video"
        || lower == "c"
        || lower.ends_with(".php")
        || lower.ends_with(".asp")
        || lower.ends_with(".aspx")
        || lower.ends_with(".jsp")
        || lower.ends_with(".htm")
        || lower.ends_with(".html")
        || lower.starts_with("index.")
        || lower.starts_with("master.")
        || lower.starts_with("playlist.")
        || lower.starts_with("chunklist.")
        || lower.starts_with("manifest.")
        || lower == "master.m3u8"
        || lower == "playlist.m3u8"
        || lower == "index.m3u8"
        || lower == "manifest.mpd"
    {
        return true;
    }
    let stem = trimmed
        .trim_end_matches(".mp4")
        .trim_end_matches(".webm")
        .trim_end_matches(".mkv")
        .trim_end_matches(".m4a")
        .trim_end_matches(".mp3")
        .trim_end_matches(".m3u8")
        .trim_end_matches(".mpd");
    if stem.len() == 11 && stem.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return true;
    }
    false
}

pub fn is_playable_media_or_stream_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    
    // 1. Direct stream playlist / manifest formats
    if lower.contains(".m3u8") || lower.contains(".mpd") || lower.contains("/hls/") || lower.contains("/dash/") || lower.contains("m3u8?") || lower.contains("mpd?") {
        return true;
    }

    // 2. Comprehensive non-DRM media platforms (extractable via yt-dlp)
    const MEDIA_DOMAINS: &[&str] = &[
        "youtube.com", "youtu.be",
        "twitter.com", "x.com",
        "tiktok.com",
        "instagram.com",
        "reddit.com", "v.redd.it",
        "facebook.com", "fb.watch", "fb.com",
        "twitch.tv",
        "vimeo.com",
        "dailymotion.com",
        "soundcloud.com",
        "bilibili.com",
        "threads.net",
        "kick.com",
        "vk.com",
        "rumble.com",
        "streamable.com",
        "odysee.com",
        "bitchute.com",
        "pinterest.com",
        "pornhub.com", "xvideos.com", "xnxx.com", "spankbang.com", "redtube.com",
    ];

    for domain in MEDIA_DOMAINS {
        if lower.contains(domain) {
            return true;
        }
    }

    false
}

/// Identifies CDN domains and signed video streams that require single-connection streaming
/// to prevent connection resets, 403 Forbidden, or range reject errors (e.g. Instagram/FB CDN, TikTok, Twitter).
pub fn is_single_connection_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.contains("fbcdn.net")
        || lower.contains("cdninstagram.com")
        || lower.contains("facebook.com")
        || lower.contains("tiktokcdn.com")
        || lower.contains("twimg.com")
        || lower.contains("v.redd.it")
        || lower.contains("googlevideo.com")
        || lower.contains("_nc_sid=")
        || lower.contains("_nc_ht=")
}

pub fn is_youtube_url(url: &str) -> bool {
    is_playable_media_or_stream_url(url)
}

pub async fn probe_media_title(url: &str) -> Option<String> {
    let yt_exe = get_yt_dlp_executable();
    let mut cmd = tokio::process::Command::new(yt_exe);
    cmd.env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .arg("--encoding")
        .arg("utf-8")
        .arg("--print")
        .arg("%(title)s")
        .arg("--no-warnings")
        .arg("--skip-download")
        .arg(url);
    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::null());

    let child = cmd.spawn().ok()?;
    let output = tokio::time::timeout(Duration::from_secs(15), child.wait_with_output()).await.ok()?.ok()?;
    if output.status.success() {
        let title_raw = decode_resilient_turkish_text(&output.stdout).trim().to_string();
        if !title_raw.is_empty() && !is_unwanted_fallback_name(&title_raw) {
            return Some(title_raw);
        }
    }
    None
}

fn get_yt_dlp_executable() -> PathBuf {
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let p1 = PathBuf::from(&userprofile).join(r"AppData\Local\Microsoft\WinGet\Links\yt-dlp.exe");
        if p1.exists() {
            return p1;
        }
        let p2 = PathBuf::from(&userprofile).join(r"AppData\Local\Programs\Python\Python313\Scripts\yt-dlp.exe");
        if p2.exists() {
            return p2;
        }
    }
    PathBuf::from("yt-dlp")
}


#[allow(dead_code)]
struct ActiveTaskHandle {
    cancel_token: CancellationToken,
    segments: Arc<RwLock<Vec<ActiveSegment>>>,
    speed_limiter: AsyncSpeedLimiter,
    task_info: Arc<RwLock<DownloadTaskInfo>>,
}

pub struct DownloadEngine {
    event_tx: broadcast::Sender<DownloadEvent>,
    prober: Arc<CapabilityProber>,
    database: Arc<StateDatabase>,
    client: Client,
    active_handles: Arc<DashMap<DownloadId, ActiveTaskHandle>>,
    speed_limit_bps: Arc<std::sync::atomic::AtomicU64>,
}

impl DownloadEngine {
    pub fn new(database: Arc<StateDatabase>) -> Self {
        let (event_tx, _) = broadcast::channel(100);
        let prober = Arc::new(CapabilityProber::new());
        let client = Client::builder()
            .pool_max_idle_per_host(32)
            .timeout(Duration::from_secs(60))
            .build()
            .expect("Failed to build engine HTTP client");

        Self {
            event_tx,
            prober,
            database,
            client,
            active_handles: Arc::new(DashMap::new()),
            speed_limit_bps: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        }
    }

    pub fn set_global_speed_limit(&self, bps: u64) {
        self.speed_limit_bps.store(bps, std::sync::atomic::Ordering::Relaxed);
        for handle in self.active_handles.iter() {
            handle.value().speed_limiter.set_bytes_per_sec(bps);
        }
    }

    pub fn get_global_speed_limit(&self) -> u64 {
        self.speed_limit_bps.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn subscribe_events(&self) -> broadcast::Receiver<DownloadEvent> {
        self.event_tx.subscribe()
    }

    /// Primary entry point to initiate a download with configurable connections, options, and preallocation
    pub async fn start_download(
        &self,
        url: &str,
        dest_dir: &Path,
        custom_filename: Option<&str>,
        max_connections: usize,
    ) -> Result<DownloadTaskInfo> {
        self.start_download_with_options(url, dest_dir, custom_filename, max_connections, HttpOptions::default()).await
    }

    pub async fn start_download_with_options(
        &self,
        url: &str,
        dest_dir: &Path,
        custom_filename: Option<&str>,
        max_connections: usize,
        options: HttpOptions,
    ) -> Result<DownloadTaskInfo> {
        let task_id = DownloadId::new();

        let opt_ref = options.referer.clone();
        let opt_cookie = options.cookies.clone();

        if is_playable_media_or_stream_url(url) {
            info!("URL '{}' matches media/stream platform. Routing directly to stream download engine.", url);
            return self.start_stream_download(url, dest_dir, custom_filename, opt_ref.as_deref(), opt_cookie.as_deref(), None).await;
        }

        // 1. Probe server capabilities
        let meta = self.prober.probe_with_options(url, &options).await?;

        // Check if server returned a streaming playlist manifest MIME type, or an HTML page
        // (embedded player page) that must be resolved by the media extractor (yt-dlp).
        if let Some(ref ct) = meta.content_type {
            let lower_ct = ct.to_lowercase();
            if lower_ct.contains("mpegurl") || lower_ct.contains("dash+xml") {
                info!("Detected streaming playlist MIME '{}'. Routing to stream download engine.", ct);
                return self.start_stream_download(url, dest_dir, custom_filename, opt_ref.as_deref(), opt_cookie.as_deref(), None).await;
            }
            if lower_ct.contains("text/html") {
                info!("URL returned an HTML page ('{}'). Routing to media extractor.", ct);
                return self.start_stream_download(url, dest_dir, custom_filename, opt_ref.as_deref(), opt_cookie.as_deref(), None).await;
            }
        }
        if meta.file_name.ends_with(".m3u8") || meta.file_name.ends_with(".mpd") {
            info!("Detected streaming playlist file extension. Routing to stream download engine.");
            return self.start_stream_download(url, dest_dir, custom_filename, opt_ref.as_deref(), opt_cookie.as_deref(), None).await;
        }

        let filename = match custom_filename {
            Some(f) if !is_unwanted_fallback_name(f) => f.to_string(),
            _ => {
                if !is_unwanted_fallback_name(&meta.file_name) {
                    meta.file_name.clone()
                } else {
                    format!("download_{}.bin", &task_id.0.to_string()[..8])
                }
            }
        };

        let category_str = get_category_for_filename(&filename);
        let dest_str = dest_dir.to_string_lossy().to_lowercase();
        let is_default_downloads = dest_str.ends_with("downloads") || dest_str.ends_with("downloads\\") || dest_str.ends_with("downloads/");
        let effective_dest = if is_default_downloads && category_str != "General" {
            dest_dir.join(category_str)
        } else {
            dest_dir.to_path_buf()
        };
        let _ = std::fs::create_dir_all(&effective_dest);
        let final_path = effective_dest.join(&filename);

        let total_size = meta.content_length.unwrap_or(0);
        info!("Initiating download {}: {} ({} bytes)", task_id, filename, total_size);

        let task = DownloadTaskInfo {
            id: task_id,
            url: url.to_string(),
            destination_path: final_path.clone(),
            file_name: filename,
            total_bytes: meta.content_length,
            downloaded_bytes: 0,
            status: DownloadStatus::Allocating,
            active_connections: 0,
            current_speed_bps: 0,
            eta_seconds: None,
            category: category_str.to_string(),
            queue_id: None,
        };

        // Persist initial state
        self.database.insert_task(&task, &meta)?;
        let _ = self.event_tx.send(DownloadEvent::TaskCreated(task.clone()));

        // 2. Preallocate destination file directly
        let file = DiskAllocator::preallocate(&final_path, total_size)?;
        let writer = PositionedChunkWriter::new(file);

        let mut final_options = options.clone();
        if is_single_connection_url(url) {
            if final_options.referer.is_none() || final_options.referer.as_deref() == Some("") {
                if url.contains("fbcdn.net") || url.contains("cdninstagram.com") {
                    final_options.referer = Some("https://www.instagram.com/".to_string());
                }
            }
        }

        // 3. Compute optimal connection count based on verified heuristic
        let conn_count = self.calculate_connection_count(url, total_size, meta.accept_ranges, max_connections);

        // 4. Construct initial segment distribution
        let chunk_size = if conn_count > 0 { total_size / (conn_count as u64) } else { total_size };
        let mut segments = Vec::new();
        for i in 0..conn_count {
            let start = (i as u64) * chunk_size;
            let end = if i == conn_count - 1 {
                total_size - 1
            } else {
                ((i + 1) as u64) * chunk_size - 1
            };
            segments.push(ActiveSegment::new(i, start, end));
        }

        self.spawn_pipeline(task, meta, segments, writer, final_options).await
    }

    /// Resumes a paused or interrupted download after verifying remote file freshness
    pub async fn resume_download(
        &self,
        id: &DownloadId,
        options: Option<HttpOptions>,
    ) -> Result<DownloadTaskInfo> {
        if self.active_handles.contains_key(id) {
            return Err(DownloadError::Internal("Download is already running".to_string()));
        }

        let task = self.database.get_task(id)?
            .ok_or_else(|| DownloadError::Internal("Task not found in state store".to_string()))?;

        if is_playable_media_or_stream_url(&task.url) {
            let dest_dir = task.destination_path.parent().unwrap_or(std::path::Path::new("C:\\Downloads"));
            return self.start_stream_download(&task.url, dest_dir, Some(&task.file_name), None, None, None).await;
        }

        if !task.destination_path.exists() {
            return Err(DownloadError::Io("Destination file missing on disk; cannot resume".to_string()));
        }

        let opts = options.unwrap_or_default();
        let (saved_etag, saved_lm) = self.database.get_task_metadata(id)?
            .unwrap_or((None, None));

        // Validate whether remote resource has changed
        let validation = self.prober.validate_resume(
            &task.url,
            saved_etag.as_deref(),
            saved_lm.as_deref(),
            task.total_bytes,
            &opts,
        ).await?;

        match validation {
            ResumeValidation::RemoteFileChanged { old_etag, new_etag } => {
                warn!("Remote file changed on server ({:?} -> {:?})", old_etag, new_etag);
                return Err(DownloadError::PreconditionFailed);
            }
            ResumeValidation::RangeNotSupported => {
                warn!("Server no longer supports range requests for {}", task.url);
                return Err(DownloadError::ResumeNotSupported);
            }
            ResumeValidation::Valid => {
                info!("Resume validation successful for task {}", id);
            }
        }

        let persisted_segs = self.database.get_segments(id)?;
        let mut active_segments = Vec::new();

        if persisted_segs.is_empty() {
            // Fallback to single segment covering remaining bytes
            let total = task.total_bytes.unwrap_or(0);
            active_segments.push(ActiveSegment::new(0, task.downloaded_bytes, total.saturating_sub(1)));
        } else {
            for p in persisted_segs {
                if p.current_byte <= p.end_byte {
                    let seg = ActiveSegment::new(p.worker_id, p.start_byte, p.end_byte);
                    seg.current.store(p.current_byte, Ordering::Release);
                    active_segments.push(seg);
                }
            }
        }

        let file = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&task.destination_path)
            .map_err(|e| DownloadError::Io(e.to_string()))?;
        let writer = PositionedChunkWriter::new(file);

        let meta = DownloadMetadata {
            url: task.url.clone(),
            final_url: Some(task.url.clone()),
            file_name: task.file_name.clone(),
            content_length: task.total_bytes,
            accept_ranges: true,
            etag: saved_etag,
            last_modified: saved_lm,
            content_type: None,
        };

        self.spawn_pipeline(task, meta, active_segments, writer, opts).await
    }

    /// Pauses an active download, signalling cancellation to workers and persisting segment checkpoints
    pub async fn pause_download(&self, id: &DownloadId) -> Result<()> {
        if let Some((_, handle)) = self.active_handles.remove(id) {
            handle.cancel_token.cancel();

            let segs_lock = handle.segments.read().await;
            let persisted: Vec<PersistedSegment> = segs_lock
                .iter()
                .map(|s| PersistedSegment {
                    worker_id: s.id,
                    start_byte: s.start,
                    current_byte: s.current_pos(),
                    end_byte: s.end_pos(),
                })
                .collect();

            let total_downloaded: u64 = segs_lock
                .iter()
                .map(|s| s.current_pos().saturating_sub(s.start))
                .sum();

            self.database.save_segments(id, &persisted)?;
            self.database.update_progress(id, total_downloaded, "Paused")?;

            let _ = self.event_tx.send(DownloadEvent::StatusChanged {
                id: *id,
                status: DownloadStatus::Paused,
            });

            info!("Download {} paused successfully", id);
            Ok(())
        } else {
            // If not active, simply ensure DB status is Paused
            self.database.update_progress(id, 0, "Paused")?;
            Ok(())
        }
    }

    /// Cancels a download task and optionally purges the destination file from disk
    pub async fn cancel_download(&self, id: &DownloadId, delete_file: bool) -> Result<()> {
        let _ = self.pause_download(id).await;

        if let Some(task) = self.database.get_task(id)? {
            if delete_file && task.destination_path.exists() {
                let _ = std::fs::remove_file(&task.destination_path);
            }
        }

        self.database.delete_task(id)?;
        let _ = self.event_tx.send(DownloadEvent::StatusChanged {
            id: *id,
            status: DownloadStatus::Failed("Cancelled by user".to_string()),
        });

        Ok(())
    }

    pub async fn set_speed_limit(&self, id: &DownloadId, bytes_per_sec: u64) -> Result<()> {
        if let Some(handle) = self.active_handles.get(id) {
            let mut info = handle.task_info.write().await;
            info.current_speed_bps = bytes_per_sec;
            Ok(())
        } else {
            Err(DownloadError::Internal("Task is not active".to_string()))
        }
    }

    pub fn get_task_status(&self, id: &DownloadId) -> Result<Option<DownloadTaskInfo>> {
        self.database.get_task(id)
    }

    pub fn list_tasks(&self) -> Result<Vec<DownloadTaskInfo>> {
        self.database.list_tasks()
    }

    pub async fn get_all_tasks_status(&self) -> Result<Vec<DownloadTaskInfo>> {
        let mut db_tasks = self.database.list_tasks()?;
        for task in &mut db_tasks {
            if let Some(handle) = self.active_handles.get(&task.id) {
                let active = handle.task_info.read().await;
                task.downloaded_bytes = active.downloaded_bytes;
                if active.total_bytes.is_some() {
                    task.total_bytes = active.total_bytes;
                }
                task.current_speed_bps = active.current_speed_bps;
                task.eta_seconds = active.eta_seconds;
                task.active_connections = active.active_connections;
                task.status = active.status.clone();
                task.destination_path = active.destination_path.clone();
                task.file_name = active.file_name.clone();
            }
        }
        Ok(db_tasks)
    }

    pub async fn probe_title(&self, url: &str) -> Option<String> {
        if is_playable_media_or_stream_url(url) {
            probe_media_title(url).await
        } else {
            if let Ok(meta) = self.prober.probe(url, None, None).await {
                if !meta.file_name.is_empty() && !is_unwanted_fallback_name(&meta.file_name) {
                    return Some(meta.file_name);
                }
            }
            None
        }
    }

    pub async fn start_youtube_download(
        &self,
        url: &str,
        dest_dir: &Path,
        custom_filename: Option<&str>,
    ) -> Result<DownloadTaskInfo> {
        self.start_stream_download(url, dest_dir, custom_filename, None, None, None).await
    }

    pub async fn start_stream_download(
        &self,
        url: &str,
        dest_dir: &Path,
        custom_filename: Option<&str>,
        referer: Option<&str>,
        cookie: Option<&str>,
        quality: Option<&str>,
    ) -> Result<DownloadTaskInfo> {
        let task_id = DownloadId::new();
        let is_audio = quality == Some("audio")
            || quality == Some("audio-128k")
            || quality == Some("audio-192k")
            || quality == Some("audio-320k")
            || quality == Some("mp3")
            || url.to_lowercase().contains("soundcloud.com");

        let format_choice = if is_audio {
            "mp3"
        } else if let Some(q) = quality {
            if q.contains("mkv") {
                "mkv"
            } else if q.contains("webm") {
                "webm"
            } else {
                "mp4"
            }
        } else if let Some(f) = custom_filename {
            if f.ends_with(".mkv") {
                "mkv"
            } else if f.ends_with(".webm") {
                "webm"
            } else if f.ends_with(".mp3") {
                "mp3"
            } else {
                "mp4"
            }
        } else {
            "mp4"
        };

        let initial_stem = match custom_filename {
            Some(f) if !is_unwanted_fallback_name(f) => {
                let trimmed = f.trim();
                trimmed
                    .trim_end_matches(".mp4")
                    .trim_end_matches(".mkv")
                    .trim_end_matches(".webm")
                    .trim_end_matches(".mp3")
                    .trim_end_matches(".m4a")
                    .trim_end_matches(".m3u8")
                    .trim_end_matches(".mpd")
                    .to_string()
            }
            _ => {
                let lower_url = url.to_lowercase();
                let mut base_id = "Media_Video".to_string();
                if let Some(pos) = url.find("v=") {
                    let sub = &url[pos + 2..];
                    let id: String = sub.chars().take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
                    if !id.is_empty() {
                        base_id = format!("Video_{}", id);
                    }
                } else if let Some(pos) = url.find("youtu.be/") {
                    let sub = &url[pos + 9..];
                    let id: String = sub.chars().take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
                    if !id.is_empty() {
                        base_id = format!("Video_{}", id);
                    }
                } else if lower_url.contains("twitter.com") || lower_url.contains("x.com") {
                    base_id = "Twitter_X_Video".to_string();
                } else if lower_url.contains("tiktok.com") {
                    base_id = "TikTok_Video".to_string();
                } else if lower_url.contains("instagram.com") {
                    base_id = "Instagram_Media".to_string();
                } else if lower_url.contains("reddit.com") || lower_url.contains("v.redd.it") {
                    base_id = "Reddit_Video".to_string();
                } else if lower_url.contains("twitch.tv") {
                    base_id = "Twitch_Stream".to_string();
                } else if lower_url.contains(".m3u8") {
                    base_id = "HLS_Stream".to_string();
                } else if lower_url.contains(".mpd") {
                    base_id = "DASH_Stream".to_string();
                } else if lower_url.contains("soundcloud.com") {
                    base_id = "SoundCloud_Track".to_string();
                }
                base_id
            }
        };

        let initial_display_name = format!("{}.{}", initial_stem, format_choice);
        let output_template = format!("{}.%(ext)s", initial_stem);

        let category = if is_audio {
            "Music".to_string()
        } else {
            "Video".to_string()
        };

        let dest_str = dest_dir.to_string_lossy().to_lowercase();
        let is_default_downloads = dest_str.ends_with("downloads") || dest_str.ends_with("downloads\\") || dest_str.ends_with("downloads/");
        let effective_dest = if is_default_downloads {
            dest_dir.join(&category)
        } else {
            dest_dir.to_path_buf()
        };
        let _ = std::fs::create_dir_all(&effective_dest);
        let final_path = effective_dest.join(&initial_display_name);
        let task = DownloadTaskInfo {
            id: task_id,
            url: url.to_string(),
            destination_path: final_path.clone(),
            file_name: initial_display_name.clone(),
            total_bytes: None,
            downloaded_bytes: 0,
            status: DownloadStatus::Downloading,
            active_connections: 1,
            current_speed_bps: 0,
            eta_seconds: None,
            category: category.clone(),
            queue_id: None,
        };

        let meta = DownloadMetadata {
            url: url.to_string(),
            final_url: Some(url.to_string()),
            file_name: initial_display_name.clone(),
            content_length: None,
            accept_ranges: false,
            etag: None,
            last_modified: None,
            content_type: Some(if category == "Audio" { "audio/mp3".to_string() } else { "video/mp4".to_string() }),
        };

        self.database.insert_task(&task, &meta)?;
        let _ = self.event_tx.send(DownloadEvent::TaskCreated(task.clone()));

        let cancel_token = CancellationToken::new();
        let speed_limiter = AsyncSpeedLimiter::unlimited();
        let task_info_arc = Arc::new(RwLock::new(task.clone()));

        self.active_handles.insert(
            task_id,
            ActiveTaskHandle {
                cancel_token: cancel_token.clone(),
                segments: Arc::new(RwLock::new(Vec::new())),
                speed_limiter,
                task_info: task_info_arc.clone(),
            },
        );

        let yt_exe = get_yt_dlp_executable();
        let target_url = url.to_string();
        let dest_folder = effective_dest.clone();
        let mut final_file_path = final_path.clone();
        let event_tx = self.event_tx.clone();
        let db = self.database.clone();
        let active_handles = self.active_handles.clone();
        let opt_referer = referer.map(|s| s.to_string());
        let opt_cookie = cookie.map(|s| s.to_string());
        let opt_quality = quality.map(|s| s.to_string());
        let current_speed_limit = self.get_global_speed_limit();
        let has_custom_name = custom_filename.is_some() && !is_unwanted_fallback_name(custom_filename.unwrap());

        tokio::spawn(async move {
            let mut cmd = tokio::process::Command::new(yt_exe);
            cmd.env("PYTHONIOENCODING", "utf-8")
                .env("PYTHONUTF8", "1")
                .arg("--encoding")
                .arg("utf-8")
                .arg("--newline")
                .arg("--no-colors")
                .arg("--progress-template")
                .arg("download:RAPTOR_PROG|||%(progress.downloaded_bytes)s|||%(progress.total_bytes)s|||%(progress.total_bytes_estimate)s|||%(progress.speed)s|||%(progress.eta)s|||%(info.title)s|||%(info.filename)s")
                .arg("-P")
                .arg(&dest_folder)
                .arg("-o")
                .arg(&output_template)
                .arg("--force-overwrites")
                .arg("--no-mtime")
                .arg("--concurrent-fragments")
                .arg("4")
                .arg("--retries")
                .arg("5")
                .arg("--fragment-retries")
                .arg("5");

            if current_speed_limit > 0 {
                cmd.arg("--limit-rate").arg(format!("{}K", (current_speed_limit / 1024).max(10)));
            }

            if let Some(ref r) = opt_referer {
                if !r.trim().is_empty() {
                    cmd.arg("--referer").arg(r.trim());
                }
            }

            if let Some(ref c) = opt_cookie {
                if !c.trim().is_empty() {
                    cmd.arg("--add-header").arg(format!("Cookie: {}", c.trim()));
                }
            }

            if format_choice == "mp3" {
                cmd.arg("-x").arg("--audio-format").arg("mp3");
                match opt_quality.as_deref() {
                    Some("audio-320k") => { cmd.arg("--audio-quality").arg("0"); }
                    Some("audio-192k") => { cmd.arg("--audio-quality").arg("2"); }
                    Some("audio-128k") => { cmd.arg("--audio-quality").arg("5"); }
                    _ => {}
                }
            } else {
                cmd.arg("--merge-output-format").arg(format_choice);
                match opt_quality.as_deref() {
                    Some("1080p") => {
                        cmd.arg("-f").arg("bestvideo[height<=1080]+bestaudio/best[height<=1080]/best");
                    }
                    Some("720p") => {
                        cmd.arg("-f").arg("bestvideo[height<=720]+bestaudio/best[height<=720]/best");
                    }
                    Some("480p") => {
                        cmd.arg("-f").arg("bestvideo[height<=480]+bestaudio/best[height<=480]/best");
                    }
                    Some("360p") => {
                        cmd.arg("-f").arg("bestvideo[height<=360]+bestaudio/best[height<=360]/best");
                    }
                    _ => {
                        cmd.arg("-f").arg("bestvideo+bestaudio/best");
                    }
                }
            }

            let ffmpeg_dirs = [
                PathBuf::from(r"C:\ffmpeg\bin"),
                PathBuf::from(r"C:\ProgramData\chocolatey\bin"),
                PathBuf::from(r"C:\Program Files\ffmpeg\bin"),
            ];
            for fdir in &ffmpeg_dirs {
                if fdir.join("ffmpeg.exe").exists() {
                    cmd.arg("--ffmpeg-location").arg(fdir);
                    break;
                }
            }

            cmd.arg(&target_url);

            #[cfg(windows)]
            {
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }

            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());
            cmd.stdin(Stdio::null());

            let mut child = match cmd.spawn() {
                Ok(c) => c,
                Err(e) => {
                    error!("Failed to spawn yt-dlp: {:?}", e);
                    let _ = db.update_progress(&task_id, 0, "Failed");
                    let _ = event_tx.send(DownloadEvent::TaskFailed {
                        id: task_id,
                        error: format!("yt-dlp spawn failed: {}", e),
                    });
                    active_handles.remove(&task_id);
                    return;
                }
            };

            let stderr = child.stderr.take();
            if let Some(err_pipe) = stderr {
                tokio::spawn(async move {
                    let mut err_reader = BufReader::new(err_pipe).lines();
                    while let Ok(Some(line)) = err_reader.next_line().await {
                        debug!("yt-dlp stderr: {}", line);
                    }
                });
            }

            let stdout = child.stdout.take();
            if let Some(stdout_pipe) = stdout {
                use tokio::io::AsyncBufReadExt;
                let mut reader = BufReader::new(stdout_pipe);
                let mut raw_buf = Vec::new();
                let mut last_db_update = Instant::now();

                loop {
                    tokio::select! {
                        _ = cancel_token.cancelled() => {
                            let _ = child.kill().await;
                            info!("yt-dlp child process killed due to cancellation");
                            break;
                        }
                        bytes_read = reader.read_until(b'\n', &mut raw_buf) => {
                            match bytes_read {
                                Ok(0) => break,
                                Ok(_) => {
                                    let line = decode_resilient_turkish_text(&raw_buf);
                                    raw_buf.clear();

                                    if let Some(idx) = line.find("RAPTOR_PROG|||") {
                                        let payload = &line[idx + 14..];
                                        let parts: Vec<&str> = payload.split("|||").collect();
                                        if parts.len() >= 5 {
                                            let downloaded: u64 = parts[0].parse().unwrap_or(0);
                                            let total_direct: Option<u64> = parts[1].parse().ok();
                                            let total_est: Option<u64> = parts[2].parse().ok();
                                            let total = total_direct.or(total_est);
                                            let speed: u64 = parts[3].parse::<f64>().map(|s| s as u64).unwrap_or(0);
                                            let eta: Option<u64> = parts[4].parse().ok();

                                            let mut detected_title = None;
                                            if parts.len() >= 6 && !parts[5].trim().is_empty() && parts[5] != "NA" {
                                                let t = parts[5].trim();
                                                if !is_unwanted_fallback_name(t) {
                                                    detected_title = Some(t.to_string());
                                                }
                                            }

                                            if parts.len() >= 7 && !parts[6].trim().is_empty() && parts[6] != "NA" {
                                                let parsed = PathBuf::from(parts[6].trim());
                                                if parsed.file_name().is_some() {
                                                    final_file_path = parsed;
                                                }
                                            }

                                            {
                                                let mut info = task_info_arc.write().await;
                                                info.downloaded_bytes = downloaded;
                                                if let Some(t) = total {
                                                    info.total_bytes = Some(t);
                                                }
                                                info.current_speed_bps = speed;
                                                info.eta_seconds = eta;
                                                info.status = DownloadStatus::Downloading;
                                                info.destination_path = final_file_path.clone();

                                                if !has_custom_name {
                                                    if let Some(title) = detected_title {
                                                        if !title.contains('\u{FFFD}') {
                                                            info.file_name = title;
                                                        }
                                                    } else if let Some(name) = final_file_path.file_name().and_then(|n| n.to_str()) {
                                                        let clean_name = if let Some(dot_idx) = name.find(".f") {
                                                            if let Some(ext_idx) = name.rfind('.') {
                                                                if ext_idx > dot_idx {
                                                                    format!("{}{}", &name[..dot_idx], &name[ext_idx..])
                                                                } else {
                                                                    name.to_string()
                                                                }
                                                            } else {
                                                                name.to_string()
                                                            }
                                                        } else {
                                                            name.to_string()
                                                        };
                                                        if !is_unwanted_fallback_name(&clean_name) && !clean_name.contains('\u{FFFD}') {
                                                            info.file_name = clean_name;
                                                        }
                                                    }
                                                }
                                            }

                                            let _ = event_tx.send(DownloadEvent::ProgressUpdate {
                                                id: task_id,
                                                downloaded_bytes: downloaded,
                                                total_bytes: total,
                                                speed_bps: speed,
                                                eta_seconds: eta,
                                            });

                                            if last_db_update.elapsed() > Duration::from_secs(1) {
                                                let _ = db.update_progress(&task_id, downloaded, "Downloading");
                                                last_db_update = Instant::now();
                                            }
                                        }
                                    }
                                }
                                Err(_) => break,
                            }
                        }
                    }
                }
            }

            let status = child.wait().await;
            active_handles.remove(&task_id);

            if cancel_token.is_cancelled() {
                return;
            }

            match status {
                Ok(exit) if exit.success() => {
                    let mut resolved_path = final_file_path.clone();
                    if !resolved_path.exists() {
                        let mp4 = final_file_path.with_extension("mp4");
                        let mkv = final_file_path.with_extension("mkv");
                        let webm = final_file_path.with_extension("webm");
                        let mp3 = final_file_path.with_extension("mp3");
                        if mp4.exists() {
                            resolved_path = mp4;
                        } else if mkv.exists() {
                            resolved_path = mkv;
                        } else if webm.exists() {
                            resolved_path = webm;
                        } else if mp3.exists() {
                            resolved_path = mp3;
                        } else if let Some(parent) = final_file_path.parent() {
                            if let Some(stem) = final_file_path.file_stem().and_then(|s| s.to_str()) {
                                let base_stem = if let Some(idx) = stem.find(".f") {
                                    &stem[..idx]
                                } else {
                                    stem
                                };
                                let clean_stem = base_stem
                                    .trim_end_matches(".mp4")
                                    .trim_end_matches(".mkv")
                                    .trim_end_matches(".webm")
                                    .trim_end_matches(".mp3");

                                for ext in ["mp4", "mkv", "webm", "mp3"] {
                                    let cand = parent.join(format!("{}.{}", clean_stem, ext));
                                    if cand.exists() {
                                        resolved_path = cand;
                                        break;
                                    }
                                    let cand_double = parent.join(format!("{}.mp4.{}", clean_stem, ext));
                                    if cand_double.exists() {
                                        let target = parent.join(format!("{}.{}", clean_stem, ext));
                                        let _ = std::fs::rename(&cand_double, &target);
                                        resolved_path = target;
                                        break;
                                    }
                                }

                                if !resolved_path.exists() {
                                    if let Ok(entries) = std::fs::read_dir(parent) {
                                        for entry in entries.flatten() {
                                            let name = entry.file_name().to_string_lossy().to_string();
                                            if name.starts_with(clean_stem)
                                                && !name.ends_with(".part")
                                                && !name.ends_with(".ytdl")
                                                && !name.ends_with(".temp")
                                            {
                                                let p = entry.path();
                                                if std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0) > 0 {
                                                    resolved_path = p;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let final_size = std::fs::metadata(&resolved_path).map(|m| m.len()).unwrap_or(0);
                    if final_size == 0 {
                        warn!("Download process finished, but resolved file {:?} has 0 bytes or is missing", resolved_path);
                        let _ = db.update_progress(&task_id, 0, "Failed: File not written");
                        let _ = event_tx.send(DownloadEvent::TaskFailed {
                            id: task_id,
                            error: "Download produced 0 bytes on disk".to_string(),
                        });
                        return;
                    }
                    let mut final_name = resolved_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("video.mp4")
                        .to_string();

                    if is_unwanted_fallback_name(&final_name) {
                        let active_name = task_info_arc.read().await.file_name.clone();
                        if !is_unwanted_fallback_name(&active_name) {
                            final_name = active_name;
                        }
                    }

                    {
                        let mut info = task_info_arc.write().await;
                        info.destination_path = resolved_path.clone();
                        info.file_name = final_name.clone();
                        info.downloaded_bytes = final_size;
                        info.total_bytes = Some(final_size);
                        info.current_speed_bps = 0;
                        info.eta_seconds = Some(0);
                        info.status = DownloadStatus::Completed;
                    }
                    let _ = db.update_task_completed(&task_id, &final_name, &resolved_path, final_size);
                    let _ = event_tx.send(DownloadEvent::TaskCompleted {
                        id: task_id,
                        destination_path: resolved_path.to_string_lossy().to_string(),
                        total_bytes: final_size,
                        elapsed_seconds: 0.0,
                    });
                    info!("yt-dlp download completed successfully: {:?}", resolved_path);
                }
                Ok(exit) => {
                    error!("yt-dlp exited with status: {:?}", exit);
                    let _ = db.update_progress(&task_id, 0, "Failed");
                    let _ = event_tx.send(DownloadEvent::TaskFailed {
                        id: task_id,
                        error: format!("yt-dlp process failed (code {:?})", exit.code()),
                    });
                }
                Err(e) => {
                    error!("yt-dlp wait error: {:?}", e);
                    let _ = db.update_progress(&task_id, 0, "Failed");
                    let _ = event_tx.send(DownloadEvent::TaskFailed {
                        id: task_id,
                        error: format!("yt-dlp wait error: {}", e),
                    });
                }
            }
        });

        Ok(task)
    }

    fn calculate_connection_count(&self, url: &str, total_size: u64, accept_ranges: bool, max_connections: usize) -> usize {
        if is_single_connection_url(url) {
            info!("Target URL is identified as a single-connection media CDN ({}). Enforcing 1 connection.", url);
            return 1;
        }
        if !accept_ranges || total_size < (MIN_BISECTION_CHUNK_SIZE * 2) {
            1
        } else if total_size < 10 * 1024 * 1024 {
            max_connections.clamp(1, 4)
        } else if total_size < 50 * 1024 * 1024 {
            max_connections.clamp(1, 8)
        } else {
            max_connections.clamp(1, 32)
        }
    }

    async fn spawn_pipeline(
        &self,
        mut task: DownloadTaskInfo,
        meta: DownloadMetadata,
        segments: Vec<ActiveSegment>,
        writer: PositionedChunkWriter,
        options: HttpOptions,
    ) -> Result<DownloadTaskInfo> {
        let task_id = task.id;
        let total_size = meta.content_length.unwrap_or(0);
        let cancel_token = CancellationToken::new();
        let speed_limiter = AsyncSpeedLimiter::unlimited();
        let segments_arc = Arc::new(RwLock::new(segments));

        task.status = DownloadStatus::Downloading;
        task.active_connections = {
            let segs = segments_arc.read().await;
            segs.len()
        };

        let task_info_arc = Arc::new(RwLock::new(task.clone()));

        self.active_handles.insert(
            task_id,
            ActiveTaskHandle {
                cancel_token: cancel_token.clone(),
                segments: segments_arc.clone(),
                speed_limiter: speed_limiter.clone(),
                task_info: task_info_arc.clone(),
            },
        );

        let engine_client = self.client.clone();
        let event_tx = self.event_tx.clone();
        let db = self.database.clone();
        let target_url = task.url.clone();
        let final_path = task.destination_path.clone();
        let active_handles = self.active_handles.clone();

        tokio::spawn(async move {
            let start_time = Instant::now();
            let mut join_set = tokio::task::JoinSet::new();

            // Spawn worker tasks
            {
                let segs = segments_arc.read().await;
                for seg in segs.iter() {
                    let cur_atomic = seg.current.clone();
                    let end_atomic = seg.end.clone();
                    let w_id = seg.id;
                    let w_client = engine_client.clone();
                    let w_url = target_url.clone();
                    let w_writer = writer.clone();
                    let w_limiter = speed_limiter.clone();
                    let w_token = cancel_token.clone();
                    let w_opts = options.clone();

                    join_set.spawn(async move {
                        SegmentWorker::run_range_download(
                            w_id,
                            w_client,
                            w_url,
                            cur_atomic,
                            end_atomic,
                            w_writer,
                            w_limiter,
                            w_opts,
                            w_token,
                        )
                        .await
                    });
                }
            }

            // Periodic progress & dynamic bisection loop
            let mut progress_interval = tokio::time::interval(Duration::from_millis(500));
            let mut last_downloaded = 0u64;

            loop {
                tokio::select! {
                    _ = progress_interval.tick() => {
                        let segs = segments_arc.read().await;
                        let current_total: u64 = segs
                            .iter()
                            .map(|s| s.current_pos().saturating_sub(s.start))
                            .sum();

                        let delta = current_total.saturating_sub(last_downloaded);
                        last_downloaded = current_total;
                        let speed_bps = delta * 2; // sampled every 500ms
                        let rem_bytes = total_size.saturating_sub(current_total);
                        let eta = if speed_bps > 0 { Some(rem_bytes / speed_bps) } else { None };

                        {
                            let mut info = task_info_arc.write().await;
                            info.downloaded_bytes = current_total;
                            info.current_speed_bps = speed_bps;
                            info.eta_seconds = eta;
                            info.active_connections = segs.len();
                            info.status = DownloadStatus::Downloading;
                        }

                        let _ = event_tx.send(DownloadEvent::ProgressUpdate {
                            id: task_id,
                            downloaded_bytes: current_total,
                            total_bytes: Some(total_size),
                            speed_bps,
                            eta_seconds: eta,
                        });

                        // Checkpoint progress to database
                        let _ = db.update_progress(&task_id, current_total, "Downloading");

                        // Dynamic Bisection Work-Stealing check
                        let completed_workers = segs.iter().filter(|s| s.remaining() == 0).count();
                        if completed_workers > 0 && completed_workers < segs.len() && segs.len() < 32 {
                            drop(segs);
                            let mut segs_mut = segments_arc.write().await;
                            if let Some((victim_id, stolen_range)) = WorkStealer::try_steal_chunk(&segs_mut, MIN_BISECTION_CHUNK_SIZE) {
                                let new_id = segs_mut.len();
                                let new_seg = ActiveSegment::new(new_id, stolen_range.start, stolen_range.end);
                                let cur_atomic = new_seg.current.clone();
                                let end_atomic = new_seg.end.clone();
                                segs_mut.push(new_seg);

                                let w_id = new_id;
                                let w_client = engine_client.clone();
                                let w_url = target_url.clone();
                                let w_writer = writer.clone();
                                let w_limiter = speed_limiter.clone();
                                let w_token = cancel_token.clone();
                                let w_opts = options.clone();

                                join_set.spawn(async move {
                                    SegmentWorker::run_range_download(
                                        w_id,
                                        w_client,
                                        w_url,
                                        cur_atomic,
                                        end_atomic,
                                        w_writer,
                                        w_limiter,
                                        w_opts,
                                        w_token,
                                    )
                                    .await
                                });

                                info!(
                                    "Work-stealing triggered: spawned worker {} splitting victim {} with range {:?}",
                                    new_id, victim_id, stolen_range
                                );

                                let _ = event_tx.send(DownloadEvent::SegmentSplit {
                                    id: task_id,
                                    worker_id: victim_id,
                                    new_worker_id: new_id,
                                    original_range: ByteRange::new(stolen_range.start, stolen_range.end),
                                    new_range: stolen_range,
                                });
                            }
                        }
                    }
                    res = join_set.join_next() => {
                        match res {
                            Some(Ok(Ok(bytes))) => {
                                info!("Worker finished slice ({} bytes)", bytes);
                            }
                            Some(Ok(Err(DownloadError::Cancelled))) => {
                                info!("Worker received cancellation signal");
                                break;
                            }
                            Some(Ok(Err(e))) => {
                                error!("Worker encountered fatal error: {}", e);
                                let _ = db.update_progress(&task_id, 0, &format!("Failed: {}", e));
                                let _ = event_tx.send(DownloadEvent::TaskFailed {
                                    id: task_id,
                                    error: e.to_string(),
                                });
                                active_handles.remove(&task_id);
                                return;
                            }
                            Some(Err(e)) => {
                                error!("Worker task panicked or join failed: {}", e);
                                break;
                            }
                            None => {
                                // All workers naturally completed
                                break;
                            }
                        }
                    }
                }
            }

            active_handles.remove(&task_id);

            if cancel_token.is_cancelled() {
                info!("Pipeline for task {} terminated due to cancellation", task_id);
                return;
            }

            // Validate Content-Length and sync file to disk
            let sync_res = writer.sync_all().await;
            let elapsed = start_time.elapsed().as_secs_f64();

            if let Err(e) = sync_res {
                error!("Failed to sync file to disk: {}", e);
                let _ = db.update_progress(&task_id, 0, "Failed");
                let _ = event_tx.send(DownloadEvent::TaskFailed {
                    id: task_id,
                    error: format!("Disk flush failure: {}", e),
                });
                return;
            }

            // Verify final disk size equals expected content length
            if let Ok(file_meta) = std::fs::metadata(&final_path) {
                if total_size > 0 && file_meta.len() != total_size {
                    error!(
                        "Content-Length validation failed: expected {} bytes, on disk {} bytes",
                        total_size, file_meta.len()
                    );
                    let _ = db.update_progress(&task_id, file_meta.len(), "Failed");
                    let _ = event_tx.send(DownloadEvent::TaskFailed {
                        id: task_id,
                        error: "Content-Length integrity mismatch".to_string(),
                    });
                    return;
                }
            }

            {
                let mut info = task_info_arc.write().await;
                info.downloaded_bytes = total_size;
                info.total_bytes = Some(total_size);
                info.current_speed_bps = 0;
                info.eta_seconds = Some(0);
                info.active_connections = 0;
                info.status = DownloadStatus::Completed;
            }

            let _ = db.update_progress(&task_id, total_size, "Completed");
            let _ = event_tx.send(DownloadEvent::TaskCompleted {
                id: task_id,
                destination_path: final_path.to_string_lossy().to_string(),
                total_bytes: total_size,
                elapsed_seconds: elapsed,
            });

            info!("Download {} completed successfully in {:.2}s", task_id, elapsed);
        });

        Ok(task)
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_turkish_character_decoding() {
        let utf8_bytes = "GÖREV DÜKKAN SOYGUNU!! - ÇŞĞIöüçşğı".as_bytes();
        let decoded = decode_resilient_turkish_text(utf8_bytes);
        assert_eq!(decoded, "GÖREV DÜKKAN SOYGUNU!! - ÇŞĞIöüçşğı");

        let cp1254_bytes = b"G\xd6REV D\xdcKKAN SOYGUNU!! - GTA 5 Online PC";
        let decoded_cp1254 = decode_resilient_turkish_text(cp1254_bytes);
        assert_eq!(decoded_cp1254, "GÖREV DÜKKAN SOYGUNU!! - GTA 5 Online PC");

        // CP857 DOS/Console Turkish codepoints
        let cp857_bytes = b"G\x99REV D\x9aKKAN SOYGUNU!!";
        let decoded_cp857 = decode_resilient_turkish_text(cp857_bytes);
        assert_eq!(decoded_cp857, "GÖREV DÜKKAN SOYGUNU!!");
    }
}
