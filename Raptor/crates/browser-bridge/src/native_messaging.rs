use hyperdownload_shared::{DownloadError, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};

/// Standard Chromium & Gecko Native Messaging message protocol (32-bit uint length prefix)
pub struct NativeMessagingStream;

impl NativeMessagingStream {
    pub fn read_message<R: Read, T: for<'de> Deserialize<'de>>(reader: &mut R) -> Result<Option<T>> {
        let mut len_bytes = [0u8; 4];
        if reader.read_exact(&mut len_bytes).is_err() {
            return Ok(None);
        }

        let length = u32::from_le_bytes(len_bytes) as usize;
        if length > 10 * 1024 * 1024 {
            return Err(DownloadError::Internal("Message exceeded 10MB limit".into()));
        }

        let mut buf = vec![0u8; length];
        reader
            .read_exact(&mut buf)
            .map_err(|e| DownloadError::Io(e.to_string()))?;

        let msg = serde_json::from_slice(&buf).map_err(|e| DownloadError::Internal(e.to_string()))?;
        Ok(Some(msg))
    }

    pub fn write_message<W: Write, T: Serialize>(writer: &mut W, value: &T) -> Result<()> {
        let json_bytes =
            serde_json::to_vec(value).map_err(|e| DownloadError::Internal(e.to_string()))?;
        let length = (json_bytes.len() as u32).to_le_bytes();

        writer
            .write_all(&length)
            .map_err(|e| DownloadError::Io(e.to_string()))?;
        writer
            .write_all(&json_bytes)
            .map_err(|e| DownloadError::Io(e.to_string()))?;
        writer.flush().map_err(|e| DownloadError::Io(e.to_string()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct TestMessage {
        action: String,
        count: u32,
    }

    #[test]
    fn test_native_messaging_roundtrip() {
        let msg = TestMessage {
            action: "download".into(),
            count: 42,
        };

        let mut buffer = Vec::new();
        NativeMessagingStream::write_message(&mut buffer, &msg).unwrap();

        // Length prefix check: 4 bytes little-endian
        assert!(buffer.len() > 4);
        let len = u32::from_le_bytes(buffer[0..4].try_into().unwrap()) as usize;
        assert_eq!(len, buffer.len() - 4);

        // Read back
        let mut cursor = Cursor::new(buffer);
        let parsed: Option<TestMessage> =
            NativeMessagingStream::read_message(&mut cursor).unwrap();
        assert_eq!(parsed, Some(msg));
    }

    #[test]
    fn test_native_messaging_eof() {
        let mut cursor = Cursor::new(Vec::new());
        let res: Option<TestMessage> = NativeMessagingStream::read_message(&mut cursor).unwrap();
        assert_eq!(res, None);
    }
}
