use crate::headers::build_headers_from_options;
use hyperdownload_shared::{DownloadError, DownloadMetadata, HttpOptions, Result, ResumeValidation};
use reqwest::header::{
    ACCEPT_RANGES, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, ETAG, IF_MATCH, IF_RANGE,
    LAST_MODIFIED, RANGE,
};
use reqwest::Client;
use std::time::Duration;
use tracing::info;

pub struct CapabilityProber {
    client: Client,
}

impl CapabilityProber {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .expect("Failed to build HTTP client");
        Self { client }
    }

    /// Perform a capability probe (HEAD or preliminary GET with Range)
    /// to determine file size, range support, ETag, and suggested filename.
    pub async fn probe(
        &self,
        url: &str,
        referer: Option<&str>,
        cookie: Option<&str>,
    ) -> Result<DownloadMetadata> {
        let mut opts = HttpOptions::default();
        opts.referer = referer.map(|s| s.to_string());
        opts.cookies = cookie.map(|s| s.to_string());
        self.probe_with_options(url, &opts).await
    }

    pub async fn probe_with_options(
        &self,
        url: &str,
        options: &HttpOptions,
    ) -> Result<DownloadMetadata> {
        info!("Probing capabilities for URL: {}", url);
        let headers = build_headers_from_options(options);

        // 1. Try HEAD request first
        let head_resp = self.client.head(url).headers(headers.clone()).send().await;

        if let Ok(resp) = head_resp {
            let status = resp.status();
            if status.is_success() {
                let content_length = resp
                    .headers()
                    .get(CONTENT_LENGTH)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok());

                let accept_ranges = resp
                    .headers()
                    .get(ACCEPT_RANGES)
                    .and_then(|v| v.to_str().ok())
                    .map(|v| v.eq_ignore_ascii_case("bytes"))
                    .unwrap_or(false);

                let etag = resp
                    .headers()
                    .get(ETAG)
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());

                let last_modified = resp
                    .headers()
                    .get(LAST_MODIFIED)
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());

                let content_type = resp
                    .headers()
                    .get(CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string());

                let final_url = resp.url().to_string();
                let file_name = Self::extract_filename(&final_url, &resp.headers());

                return Ok(DownloadMetadata {
                    url: url.to_string(),
                    final_url: Some(final_url),
                    file_name,
                    content_length,
                    accept_ranges,
                    etag,
                    last_modified,
                    content_type,
                });
            } else if status.as_u16() == 404 {
                return Err(DownloadError::NotFound);
            } else if status.is_server_error() {
                return Err(DownloadError::ServerError(status.as_u16()));
            } else if status.is_client_error() && status.as_u16() != 405 {
                // If 405 Method Not Allowed, fallback to GET. Otherwise, return status error.
                return Err(DownloadError::HttpStatus(status.as_u16()));
            }
        }

        // 2. Fallback: Send a GET request with Range: bytes=0-0 to test Range & Content-Range
        let mut get_headers = headers;
        get_headers.insert(RANGE, reqwest::header::HeaderValue::from_static("bytes=0-0"));

        let resp = self
            .client
            .get(url)
            .headers(get_headers)
            .send()
            .await
            .map_err(|e| DownloadError::Network(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 404 {
            return Err(DownloadError::NotFound);
        } else if status.is_server_error() {
            return Err(DownloadError::ServerError(status.as_u16()));
        } else if status.is_client_error() {
            return Err(DownloadError::HttpStatus(status.as_u16()));
        } else if !status.is_success() && status.as_u16() != 206 {
            return Err(DownloadError::HttpStatus(status.as_u16()));
        }

        let accept_ranges = status.as_u16() == 206
            || resp
                .headers()
                .get(ACCEPT_RANGES)
                .and_then(|v| v.to_str().ok())
                .map(|v| v.eq_ignore_ascii_case("bytes"))
                .unwrap_or(false);

        // Parse content length from Content-Range: bytes 0-0/total
        let content_length = resp
            .headers()
            .get(CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .and_then(|cr| cr.split('/').last())
            .and_then(|total| total.parse::<u64>().ok())
            .or_else(|| {
                resp.headers()
                    .get(CONTENT_LENGTH)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
            });

        let etag = resp
            .headers()
            .get(ETAG)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let last_modified = resp
            .headers()
            .get(LAST_MODIFIED)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let content_type = resp
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let final_url = resp.url().to_string();
        let file_name = Self::extract_filename(&final_url, &resp.headers());

        Ok(DownloadMetadata {
            url: url.to_string(),
            final_url: Some(final_url),
            file_name,
            content_length,
            accept_ranges,
            etag,
            last_modified,
            content_type,
        })
    }

    /// Validates whether a paused or interrupted download can be resumed safely.
    /// Sends a conditional range check to detect if the remote file was replaced or altered.
    pub async fn validate_resume(
        &self,
        url: &str,
        previous_etag: Option<&str>,
        _previous_last_modified: Option<&str>,
        previous_size: Option<u64>,
        options: &HttpOptions,
    ) -> Result<ResumeValidation> {
        let mut headers = build_headers_from_options(options);
        headers.insert(RANGE, reqwest::header::HeaderValue::from_static("bytes=0-0"));

        if let Some(etag) = previous_etag {
            if let Ok(val) = reqwest::header::HeaderValue::from_str(etag) {
                headers.insert(IF_RANGE, val.clone());
                headers.insert(IF_MATCH, val);
            }
        }

        let resp = self
            .client
            .get(url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| DownloadError::Network(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 412 {
            return Ok(ResumeValidation::RemoteFileChanged {
                old_etag: previous_etag.map(|s| s.to_string()),
                new_etag: None,
            });
        }

        if status.as_u16() == 200 {
            // Server returned 200 OK instead of 206 Partial Content (range ignored)
            return Ok(ResumeValidation::RangeNotSupported);
        }

        if status.as_u16() == 206 {
            let current_etag = resp
                .headers()
                .get(ETAG)
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());

            let current_size = resp
                .headers()
                .get(CONTENT_RANGE)
                .and_then(|v| v.to_str().ok())
                .and_then(|cr| cr.split('/').last())
                .and_then(|total| total.parse::<u64>().ok());

            if let (Some(old_e), Some(new_e)) = (previous_etag, current_etag.as_deref()) {
                if old_e != new_e {
                    return Ok(ResumeValidation::RemoteFileChanged {
                        old_etag: Some(old_e.to_string()),
                        new_etag: Some(new_e.to_string()),
                    });
                }
            }

            if let (Some(old_len), Some(new_len)) = (previous_size, current_size) {
                if old_len != new_len {
                    return Ok(ResumeValidation::RemoteFileChanged {
                        old_etag: previous_etag.map(|s| s.to_string()),
                        new_etag: current_etag,
                    });
                }
            }

            return Ok(ResumeValidation::Valid);
        }

        if status.as_u16() == 404 {
            return Err(DownloadError::NotFound);
        }

        Err(DownloadError::HttpStatus(status.as_u16()))
    }

    fn extract_filename(url_str: &str, headers: &reqwest::header::HeaderMap) -> String {
        // Try Content-Disposition: attachment; filename="foo.bin"
        if let Some(cd) = headers.get("content-disposition").and_then(|v| v.to_str().ok()) {
            if let Some(pos) = cd.find("filename=") {
                let name = &cd[pos + 9..].trim_matches(|c| c == '"' || c == '\'' || c == ' ');
                if !name.is_empty() {
                    return name.split(';').next().unwrap_or(name).to_string();
                }
            }
        }

        // Fallback: parse URL path
        if let Ok(parsed) = reqwest::Url::parse(url_str) {
            if let Some(segments) = parsed.path_segments() {
                if let Some(last) = segments.last() {
                    if !last.is_empty() {
                        return last.to_string();
                    }
                }
            }
        }

        "download.bin".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::{HeaderMap, HeaderValue};

    #[test]
    fn test_extract_filename_from_url() {
        let headers = HeaderMap::new();
        let fname = CapabilityProber::extract_filename("https://example.com/files/archive_v1.2.zip", &headers);
        assert_eq!(fname, "archive_v1.2.zip");
    }

    #[test]
    fn test_extract_filename_from_content_disposition() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "content-disposition",
            HeaderValue::from_static("attachment; filename=\"installer_setup.exe\""),
        );
        let fname = CapabilityProber::extract_filename("https://example.com/download?id=99", &headers);
        assert_eq!(fname, "installer_setup.exe");
    }

    #[test]
    fn test_extract_filename_fallback() {
        let headers = HeaderMap::new();
        let fname = CapabilityProber::extract_filename("https://example.com/", &headers);
        assert_eq!(fname, "download.bin");
    }
}
