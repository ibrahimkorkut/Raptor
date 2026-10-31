use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DownloadId(pub Uuid);

impl DownloadId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for DownloadId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for DownloadId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ByteRange {
    pub start: u64,
    pub current: u64,
    pub end: u64,
}

impl ByteRange {
    pub fn new(start: u64, end: u64) -> Self {
        Self {
            start,
            current: start,
            end,
        }
    }

    pub fn total_bytes(&self) -> u64 {
        if self.end >= self.start {
            self.end - self.start + 1
        } else {
            0
        }
    }

    pub fn remaining_bytes(&self) -> u64 {
        if self.end >= self.current {
            self.end - self.current + 1
        } else {
            0
        }
    }

    pub fn is_completed(&self) -> bool {
        self.current > self.end
    }

    /// Try bisecting the remaining unread range.
    /// Returns Some(upper_half) if remaining bytes >= min_split_size.
    pub fn try_bisect(&mut self, min_split_size: u64) -> Option<ByteRange> {
        let remaining = self.remaining_bytes();
        if remaining < min_split_size * 2 {
            return None;
        }

        let mid = self.current + (remaining / 2);
        let upper_range = ByteRange::new(mid + 1, self.end);
        self.end = mid;

        Some(upper_range)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DownloadMetadata {
    pub url: String,
    pub final_url: Option<String>,
    pub file_name: String,
    pub content_length: Option<u64>,
    pub accept_ranges: bool,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DownloadStatus {
    Queued,
    Probing,
    Allocating,
    Downloading,
    Paused,
    Completed,
    Failed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTaskInfo {
    pub id: DownloadId,
    pub url: String,
    pub destination_path: PathBuf,
    pub file_name: String,
    pub total_bytes: Option<u64>,
    pub downloaded_bytes: u64,
    pub status: DownloadStatus,
    pub active_connections: usize,
    pub current_speed_bps: u64,
    pub eta_seconds: Option<u64>,
    pub category: String,
    pub queue_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedSegment {
    pub worker_id: usize,
    pub start_byte: u64,
    pub current_byte: u64,
    pub end_byte: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HttpOptions {
    pub user_agent: Option<String>,
    pub referer: Option<String>,
    pub cookies: Option<String>,
    pub auth: Option<HttpAuth>,
    pub timeout_seconds: Option<u64>,
    pub max_redirects: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HttpAuth {
    Basic { username: String, password: Option<String> },
    Bearer { token: String },
    CustomHeader { name: String, value: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResumeValidation {
    Valid,
    RemoteFileChanged {
        old_etag: Option<String>,
        new_etag: Option<String>,
    },
    RangeNotSupported,
}
