use hyperdownload_shared::{DownloadError, Result};
use std::fs::File;
use std::path::Path;
use tracing::info;

pub struct DiskAllocator;

impl DiskAllocator {
    /// Preallocates the file to `total_size` bytes on disk.
    /// On Windows, this physically allocates clusters upfront to prevent fragmentation.
    pub fn preallocate(path: &Path, total_size: u64) -> Result<File> {
        info!("Preallocating {} bytes for {:?}", total_size, path);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| DownloadError::Io(e.to_string()))?;
        }

        let file = File::options()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(path)
            .map_err(|e| DownloadError::Io(e.to_string()))?;

        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            use windows::Win32::Storage::FileSystem::{
                SetFileInformationByHandle, FileAllocationInfo, FILE_ALLOCATION_INFO,
            };

            let handle = windows::Win32::Foundation::HANDLE(file.as_raw_handle());
            let alloc_info = FILE_ALLOCATION_INFO {
                AllocationSize: total_size as i64,
            };

            unsafe {
                let _ = SetFileInformationByHandle(
                    handle,
                    FileAllocationInfo,
                    &alloc_info as *const _ as *const _,
                    std::mem::size_of::<FILE_ALLOCATION_INFO>() as u32,
                );
            }
        }

        file.set_len(total_size)
            .map_err(|e| DownloadError::Io(e.to_string()))?;

        Ok(file)
    }
}
