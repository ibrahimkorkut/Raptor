use clap::Parser;
use hyperdownload_download_engine::DownloadEngine;
use hyperdownload_shared::{DownloadEvent, Result};
use hyperdownload_storage::StateDatabase;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

#[derive(Parser, Debug)]
#[command(name = "hyperdownload-cli", about = "HyperDownload Command-Line Runner & Benchmarking Tool")]
struct Args {
    #[arg(short, long, help = "Download URL")]
    url: String,

    #[arg(short, long, default_value = ".", help = "Destination directory")]
    dest: PathBuf,

    #[arg(short, long, help = "Custom output filename")]
    filename: Option<String>,

    #[arg(short, long, default_value_t = 8, help = "Maximum parallel connections")]
    connections: usize,

    #[arg(long, help = "Path to SQLite state database (default: in-memory)")]
    db: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    let db = match args.db {
        Some(path) => Arc::new(StateDatabase::open(&path)?),
        None => Arc::new(StateDatabase::open_in_memory()?),
    };

    let engine = DownloadEngine::new(db);
    let mut rx = engine.subscribe_events();

    let start_time = Instant::now();
    let task = engine
        .start_download(
            &args.url,
            &args.dest,
            args.filename.as_deref(),
            args.connections,
        )
        .await?;

    println!("[INFO] Task created: {} ({})", task.id, task.file_name);
    println!("[INFO] Target URL: {}", task.url);
    println!("[INFO] Configured max connections: {}", args.connections);

    while let Ok(event) = rx.recv().await {
        match event {
            DownloadEvent::ProgressUpdate {
                id,
                downloaded_bytes,
                total_bytes,
                speed_bps,
                ..
            } => {
                if id == task.id {
                    let total_str = total_bytes
                        .map(|t| format!("{:.2} MB", t as f64 / 1_048_576.0))
                        .unwrap_or_else(|| "Unknown".to_string());
                    let dl_mb = downloaded_bytes as f64 / 1_048_576.0;
                    let speed_mb = speed_bps as f64 / 1_048_576.0;
                    eprint!(
                        "\r[PROGRESS] {:.2} MB / {} | Speed: {:.2} MB/s",
                        dl_mb, total_str, speed_mb
                    );
                }
            }
            DownloadEvent::TaskCompleted {
                id,
                total_bytes,
                elapsed_seconds,
                destination_path,
            } => {
                if id == task.id {
                    eprintln!();
                    let elapsed_sec = start_time.elapsed().as_secs_f64();
                    let total_mb = total_bytes as f64 / 1_048_576.0;
                    let throughput_mbps = if elapsed_sec > 0.0 {
                        total_mb / elapsed_sec
                    } else {
                        0.0
                    };

                    println!("[SUCCESS] Download completed in {:.3}s (engine reported: {:.3}s)", elapsed_sec, elapsed_seconds);
                    println!("[METRIC] Saved To: {}", destination_path);
                    println!("[METRIC] Total Bytes: {}", total_bytes);
                    println!("[METRIC] Total Size: {:.2} MB", total_mb);
                    println!("[METRIC] Throughput: {:.2} MB/s", throughput_mbps);
                    return Ok(());
                }
            }
            DownloadEvent::TaskFailed { id, error } => {
                if id == task.id {
                    eprintln!();
                    eprintln!("[ERROR] Download failed: {}", error);
                    std::process::exit(1);
                }
            }
            _ => {}
        }
    }

    Ok(())
}
