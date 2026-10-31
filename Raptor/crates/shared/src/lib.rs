pub mod errors;
pub mod events;
pub mod models;

pub use errors::{DownloadError, Result};
pub use events::{DownloadEvent, UiCommand};
pub use models::{
    ByteRange, DownloadId, DownloadMetadata, DownloadStatus, DownloadTaskInfo,
    HttpAuth, HttpOptions, PersistedSegment, ResumeValidation,
};
