use thiserror::Error;

pub type Result<T> = std::result::Result<T, DownloadError>;

#[derive(Error, Debug, Clone)]
pub enum DownloadError {
    #[error("File not found on server (HTTP 404, IDM code: 30053)")]
    NotFound,

    #[error("Remote server returned an internal error (HTTP {0}, IDM code: 30018)")]
    ServerError(u16),

    #[error("Server returned an unexpected HTTP status: {0}")]
    HttpStatus(u16),

    #[error("Server does not support range requests or resume (IDM code: 30071)")]
    ResumeNotSupported,

    #[error("Remote file was modified on server since last download (HTTP 412 Precondition Failed)")]
    PreconditionFailed,

    #[error("Connection timed out after {0} seconds")]
    Timeout(u64),

    #[error("Insufficient disk space on destination volume")]
    DiskFull,

    #[error("Network connection was interrupted: {0}")]
    Network(String),

    #[error("Disk I/O error occurred: {0}")]
    Io(String),

    #[error("Download task was cancelled by user")]
    Cancelled,

    #[error("Internal engine error: {0}")]
    Internal(String),
}
