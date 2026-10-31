pub mod classifier;

pub use classifier::FileCategory;

pub struct ClipboardMonitor;

impl ClipboardMonitor {
    pub fn is_downloadable_url(text: &str) -> bool {
        let trimmed = text.trim();
        (trimmed.starts_with("http://")
            || trimmed.starts_with("https://")
            || trimmed.starts_with("ftp://"))
            && trimmed.len() > 10
    }
}
