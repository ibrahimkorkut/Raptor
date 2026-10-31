use hyperdownload_browser_bridge::NativeMessagingStream;
use serde::{Deserialize, Serialize};
use std::io::{stdin, stdout};

#[derive(Debug, Deserialize, Serialize)]
struct NativeMessagePayload {
    url: String,
    #[serde(default)]
    referer: Option<String>,
    #[serde(default)]
    cookie: Option<String>,
    #[serde(default)]
    filename: Option<String>,
}

#[derive(Debug, Serialize)]
struct NativeResponse {
    success: bool,
    message: String,
}

#[tokio::main]
async fn main() {
    let mut stdin_lock = stdin().lock();
    let mut stdout_lock = stdout().lock();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_default();

    loop {
        match NativeMessagingStream::read_message::<_, NativeMessagePayload>(&mut stdin_lock) {
            Ok(Some(payload)) => {
                // Forward request to HyperDownload local REST Bridge
                let forward_res = client
                    .post("http://127.0.0.1:9145/api/download")
                    .json(&payload)
                    .send()
                    .await;

                let response = match forward_res {
                    Ok(resp) if resp.status().is_success() => NativeResponse {
                        success: true,
                        message: "Download transferred to HyperDownload".into(),
                    },
                    Ok(resp) => NativeResponse {
                        success: false,
                        message: format!("Bridge returned HTTP {}", resp.status()),
                    },
                    Err(err) => NativeResponse {
                        success: false,
                        message: format!("Could not reach HyperDownload engine: {err}"),
                    },
                };

                let _ = NativeMessagingStream::write_message(&mut stdout_lock, &response);
            }
            Ok(None) => {
                // EOF on stdin - browser closed the connection
                break;
            }
            Err(e) => {
                let err_resp = NativeResponse {
                    success: false,
                    message: format!("Malformed message: {e}"),
                };
                let _ = NativeMessagingStream::write_message(&mut stdout_lock, &err_resp);
                break;
            }
        }
    }
}
