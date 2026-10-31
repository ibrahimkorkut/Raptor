use hyperdownload_shared::{DownloadError, Result};
use std::fs::File;
use std::sync::Arc;

#[cfg(windows)]
use std::os::windows::fs::FileExt;

#[derive(Clone)]
pub struct PositionedChunkWriter {
    file: Arc<File>,
}

impl PositionedChunkWriter {
    pub fn new(file: File) -> Self {
        Self {
            file: Arc::new(file),
        }
    }

    /// Writes buffer directly to the specified byte offset in the destination file.
    /// On Windows and Unix, this writes directly to the file offset with zero mutex contention,
    /// enabling maximum NVMe SSD queue depth and full saturating write throughput.
    pub async fn write_at(&self, offset: u64, buf: &[u8]) -> Result<usize> {
        #[cfg(windows)]
        {
            self.file
                .seek_write(buf, offset)
                .map_err(|e| DownloadError::Io(e.to_string()))
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::FileExt;
            self.file
                .write_at(buf, offset)
                .map_err(|e| DownloadError::Io(e.to_string()))
        }

        #[cfg(not(any(windows, unix)))]
        {
            use std::io::{Seek, SeekFrom, Write};
            let mut f = &*self.file;
            f.seek(SeekFrom::Start(offset))
                .map_err(|e| DownloadError::Io(e.to_string()))?;
            f.write_all(buf)
                .map_err(|e| DownloadError::Io(e.to_string()))?;
            Ok(buf.len())
        }
    }

    pub async fn sync_all(&self) -> Result<()> {
        self.file
            .sync_all()
            .map_err(|e| DownloadError::Io(e.to_string()))
    }
}
