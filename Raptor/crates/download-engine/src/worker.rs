use futures_util::StreamExt;
use hyperdownload_http_client::build_headers_from_options;
use hyperdownload_segment_manager::AsyncSpeedLimiter;
use hyperdownload_shared::{DownloadError, HttpOptions, Result};
use hyperdownload_storage::PositionedChunkWriter;
use reqwest::header::RANGE;
use reqwest::Client;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

pub const MAX_WORKER_RETRIES: usize = 5;
pub const BASE_RETRY_DELAY_MS: u64 = 500;

pub struct SegmentWorker;

impl SegmentWorker {
    pub async fn run_range_download(
        worker_id: usize,
        client: Client,
        url: String,
        current_tracker: Arc<AtomicU64>,
        end_tracker: Arc<AtomicU64>,
        writer: PositionedChunkWriter,
        speed_limiter: AsyncSpeedLimiter,
        options: HttpOptions,
        cancel_token: CancellationToken,
    ) -> Result<u64> {
        let mut retry_count = 0;
        let mut total_written: u64 = 0;

        loop {
            // Check cancellation before connecting
            if cancel_token.is_cancelled() {
                return Err(DownloadError::Cancelled);
            }

            let start_byte = current_tracker.load(Ordering::Acquire);
            let end_byte = end_tracker.load(Ordering::Acquire);

            if start_byte > end_byte {
                debug!("Worker {} range is already fulfilled", worker_id);
                return Ok(total_written);
            }

            // `u64::MAX` marks an unknown-size stream: ask for an open-ended range.
            let unbounded = end_byte == u64::MAX;
            let range_val = if unbounded {
                format!("bytes={}-", start_byte)
            } else {
                format!("bytes={}-{}", start_byte, end_byte)
            };
            debug!("Worker {} connecting for range: {}", worker_id, range_val);

            let mut headers = build_headers_from_options(&options);
            headers.insert(
                RANGE,
                reqwest::header::HeaderValue::from_str(&range_val).unwrap(),
            );

            let req = client.get(&url).headers(headers);

            // Execute request with cancellation race
            let resp_result = tokio::select! {
                _ = cancel_token.cancelled() => return Err(DownloadError::Cancelled),
                res = req.send() => res,
            };

            let resp = match resp_result {
                Ok(r) => r,
                Err(e) => {
                    warn!("Worker {} network connect error: {}", worker_id, e);
                    retry_count += 1;
                    if retry_count > MAX_WORKER_RETRIES {
                        return Err(DownloadError::Network(format!(
                            "Worker {} exceeded max retries: {}",
                            worker_id, e
                        )));
                    }
                    Self::backoff(retry_count, &cancel_token).await?;
                    continue;
                }
            };

            let status = resp.status();

            // Validate HTTP 206 Partial Content
            if status.as_u16() == 200 {
                if worker_id > 0 {
                    error!(
                        "Worker {} requested sub-range but server sent 200 OK (range unsupported)",
                        worker_id
                    );
                    return Err(DownloadError::ResumeNotSupported);
                } else if start_byte > 0 {
                    error!("Worker 0 requested resume offset {} but server sent 200 OK", start_byte);
                    return Err(DownloadError::ResumeNotSupported);
                }
                // If worker 0 starting from byte 0, server sent full file as single stream
                info!("Worker 0 proceeding with full stream (server returned 200 OK)");
            } else if status.as_u16() != 206 {
                if status.is_server_error() && retry_count < MAX_WORKER_RETRIES {
                    warn!("Worker {} received transient server error HTTP {}, retrying", worker_id, status);
                    retry_count += 1;
                    Self::backoff(retry_count, &cancel_token).await?;
                    continue;
                }
                error!("Worker {} received fatal HTTP status {}", worker_id, status);
                return Err(DownloadError::HttpStatus(status.as_u16()));
            }

            // Stream response chunks
            let mut stream = resp.bytes_stream();
            let mut stream_interrupted = false;

            loop {
                let next_chunk = tokio::select! {
                    _ = cancel_token.cancelled() => return Err(DownloadError::Cancelled),
                    item = stream.next() => item,
                };

                let chunk = match next_chunk {
                    Some(Ok(bytes)) => bytes,
                    Some(Err(e)) => {
                        warn!("Worker {} stream interrupted: {}", worker_id, e);
                        stream_interrupted = true;
                        break;
                    }
                    None => break, // Stream naturally completed
                };

                let chunk_len = chunk.len();

                // Throttle speed if limit is configured
                speed_limiter.throttle(chunk_len).await;

                let cur_offset = current_tracker.load(Ordering::Acquire);
                let active_end = end_tracker.load(Ordering::Acquire);

                if cur_offset > active_end {
                    debug!("Worker {} finished bounded range up to {}", worker_id, active_end);
                    return Ok(total_written);
                }

                let remaining = active_end.saturating_add(1).saturating_sub(cur_offset);
                let write_len = (chunk_len as u64).min(remaining) as usize;

                if write_len > 0 {
                    if let Err(e) = writer.write_at(cur_offset, &chunk[..write_len]).await {
                        error!("Worker {} disk write error: {}", worker_id, e);
                        return Err(e);
                    }
                    current_tracker.fetch_add(write_len as u64, Ordering::Release);
                    total_written += write_len as u64;
                    // Reset retry count on successful write progress
                    retry_count = 0;
                }

                if cur_offset + (write_len as u64) > active_end {
                    debug!("Worker {} saturated current segment up to {}", worker_id, active_end);
                    return Ok(total_written);
                }
            }

            if stream_interrupted {
                retry_count += 1;
                if retry_count > MAX_WORKER_RETRIES {
                    return Err(DownloadError::Network(format!(
                        "Worker {} stream connection lost after max retries",
                        worker_id
                    )));
                }
                Self::backoff(retry_count, &cancel_token).await?;
                continue;
            }

            // Unknown-size stream that ended cleanly: the server sent everything it has.
            if unbounded {
                return Ok(total_written);
            }

            // If we reached here without stream interruption and current_tracker meets or exceeds end
            let current_pos = current_tracker.load(Ordering::Acquire);
            let target_end = end_tracker.load(Ordering::Acquire);
            if current_pos > target_end {
                return Ok(total_written);
            }
        }
    }

    async fn backoff(attempt: usize, cancel_token: &CancellationToken) -> Result<()> {
        let delay_ms = BASE_RETRY_DELAY_MS * (1 << (attempt - 1).min(5));
        let delay = Duration::from_millis(delay_ms);
        debug!("Worker backing off for {}ms (attempt {})", delay_ms, attempt);

        tokio::select! {
            _ = cancel_token.cancelled() => Err(DownloadError::Cancelled),
            _ = tokio::time::sleep(delay) => Ok(()),
        }
    }
}
