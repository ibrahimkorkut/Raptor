use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileCategory {
    Compressed,
    Documents,
    Music,
    Programs,
    Video,
    General,
}

impl FileCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Compressed => "Compressed",
            Self::Documents => "Documents",
            Self::Music => "Music",
            Self::Programs => "Programs",
            Self::Video => "Video",
            Self::General => "General",
        }
    }

    pub fn classify_filename(filename: &str) -> Self {
        let ext = Path::new(filename)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        match ext.as_str() {
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "iso" | "zst" => Self::Compressed,
            "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "epub" => {
                Self::Documents
            }
            "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" | "wma" => Self::Music,
            "exe" | "msi" | "bat" | "cmd" | "apk" | "appx" => Self::Programs,
            "mp4" | "mkv" | "avi" | "flv" | "webm" | "mov" | "ts" | "wmv" => Self::Video,
            _ => Self::General,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_extensions() {
        assert_eq!(FileCategory::classify_filename("archive.tar.gz"), FileCategory::Compressed);
        assert_eq!(FileCategory::classify_filename("backup.7z"), FileCategory::Compressed);
        assert_eq!(FileCategory::classify_filename("document.pdf"), FileCategory::Documents);
        assert_eq!(FileCategory::classify_filename("sheet.xlsx"), FileCategory::Documents);
        assert_eq!(FileCategory::classify_filename("song.flac"), FileCategory::Music);
        assert_eq!(FileCategory::classify_filename("app.exe"), FileCategory::Programs);
        assert_eq!(FileCategory::classify_filename("movie.mkv"), FileCategory::Video);
        assert_eq!(FileCategory::classify_filename("unknown.dat"), FileCategory::General);
    }
}
