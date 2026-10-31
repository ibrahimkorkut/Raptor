use crate::models::{ByteRange, DownloadId, DownloadStatus, DownloadTaskInfo};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DownloadEvent {
    TaskCreated(DownloadTaskInfo),
    StatusChanged {
        id: DownloadId,
        status: DownloadStatus,
    },
    ProgressUpdate {
        id: DownloadId,
        downloaded_bytes: u64,
        total_bytes: Option<u64>,
        speed_bps: u64,
        eta_seconds: Option<u64>,
    },
    SegmentSplit {
        id: DownloadId,
        worker_id: usize,
        new_worker_id: usize,
        original_range: ByteRange,
        new_range: ByteRange,
    },
    TaskCompleted {
        id: DownloadId,
        destination_path: String,
        total_bytes: u64,
        elapsed_seconds: f64,
    },
    TaskFailed {
        id: DownloadId,
        error: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UiCommand {
    StartDownload {
        url: String,
        destination_dir: Option<String>,
        file_name: Option<String>,
        queue_id: Option<String>,
        max_connections: Option<usize>,
    },
    PauseDownload(DownloadId),
    ResumeDownload(DownloadId),
    CancelDownload {
        id: DownloadId,
        delete_file: bool,
    },
    SetSpeedLimit {
        id: Option<DownloadId>, // None for global limit
        limit_bytes_per_sec: Option<u64>,
    },
    QueryAllTasks,
}
