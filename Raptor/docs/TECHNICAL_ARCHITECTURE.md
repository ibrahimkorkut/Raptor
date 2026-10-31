# Technical Architecture: IDM REBORN (Rust)

**Document Version:** 1.0.0  
**Project:** IDM REBORN — High-Performance Clean-Room Windows Download Manager  
**Language Edition:** Rust 2024 / 2021  
**Architecture Paradigm:** Async Actor-Pipeline Architecture with Zero-Copy I/O  

---

## 1. System Architecture Overview

IDM REBORN is engineered as a high-throughput, memory-safe, asynchronous Windows download system. It replaces the legacy MFC/C++ architecture of the original binary with an actor-driven async pipeline built on `tokio`, providing crash-resilience, multi-gigabit throughput, deterministic resource bounds, and seamless Windows desktop integration.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                 │
│      idm_gui (Desktop UI & Tray)        │       idm_cli (CLI Interface)     │
│   (List View, Progress, Speed Graph)    │     (/d, /p, /f, /n, /a, /s)      │
└─────────────────────────────────────┬───┴───────────────────────────────────┘
                                      │ IPC / MPSC Channels
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                           IPC & BROWSER SUBSYSTEM                           │
│     idm_ipc (Named Pipes \\.\pipe\IdmRebornIpc + Native Messaging Stdio)    │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ Tasks & Commands
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                               ENGINE CORE                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     DownloadManager (Actor Coordinator)                │ │
│  └───────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                      │
│  ┌───────────────────────────────────▼────────────────────────────────────┐ │
│  │                    QueueScheduler (Main, Sync, Custom)                 │ │
│  └───────────────────────────────────┬────────────────────────────────────┘ │
│                                      │ Dispatches Active Tasks              │
│  ┌───────────────────────────────────▼────────────────────────────────────┐ │
│  │                       DownloadTask Controller                          │ │
│  │    State: Probing ──► Segmenting ──► Downloading ──► Assembling        │ │
│  └───────┬─────────────────────────────────────────────────┬──────────────┘ │
│          │ Range Requests                                  │ Write Chunks   │
│          ▼                                                 ▼                │
│  ┌───────────────┐                             ┌──────────────────────────┐ │
│  │ SegmentWorker │◄───[Dynamic Work-Stealer]──►│  Preallocated Target File │ │
│  │  (Connection) │                             │   (Windows NTFS Sparse)  │ │
│  └───────┬───────┘                             └──────────────────────────┘ │
│          │                                                                  │
│          ▼                                                                  │
│  ┌───────────────┐                                                          │
│  │ CSpeedLimiter │ (Token Bucket Rate Limiter)                              │
│  └───────┬───────┘                                                          │
└──────────┼──────────────────────────────────────────────────────────────────┘
           │
           ├──► idm_net     (reqwest / hyper / rustls / HTTP/1.1 & HTTP/2)
           ├──► idm_storage (tokio::fs / memmap2 / SQLite persistence)
           └──► idm_media   (HLS .m3u8 & MPEG-DASH .mpd remuxer)
```

---

## 2. Workspace & Crate Structure

The project is structured as a modular Cargo workspace:

```
faster_download_manager/
├── Cargo.toml                  # Workspace root manifest
├── crates/
│   ├── idm_core/               # Download coordinator, task actors, work-stealing scheduler
│   ├── idm_net/                # HTTP/HTTPS transport, TLS, connection pooling, proxies
│   ├── idm_storage/            # Windows disk preallocation, chunk writes, SQLite database
│   ├── idm_ipc/                # Windows Named Pipes & Chrome/Firefox Native Messaging host
│   ├── idm_media/              # HLS/DASH video stream parser and TS-to-MP4 remuxer
│   ├── idm_cli/                # Command-line interface with IDM flag compatibility
│   └── idm_gui/                # Desktop UI, list controls, speed charts, system tray
├── docs/                       # Specifications and reverse engineering findings
└── tests/                      # Conformance, integration, and stress test suites
```

### Module Responsibilities

#### 1. `idm_core`
- **`DownloadManager`:** Top-level actor maintaining global state, active tasks, and cross-cutting event channels.
- **`DownloadTask`:** State machine representing an individual download:
  `Queued -> Probing -> Downloading -> Paused -> Joining -> Completed / Error`.
- **`SegmentWorker`:** Asynchronous worker streaming an assigned byte range $[b_{\text{start}}, b_{\text{end}}]$.
- **`WorkStealingScheduler`:** Dynamic range bisection engine that continuously inspects active workers and splits the largest remaining span when idle worker slots appear.
- **`SpeedLimiter`:** Asynchronous token-bucket traffic shaper enforcing per-download and global bandwidth limits.

#### 2. `idm_net`
- Asynchronous transport layer built on `reqwest` and `hyper`.
- Configurable TLS via `rustls` (pure memory-safe Rust) with fallback to native Windows SChannel.
- Dynamic browser header emulation (`User-Agent`, `Referer`, `Cookie` persistence).
- Upstream proxy resolution: HTTP `CONNECT` tunneling and SOCKS5 proxy support.

#### 3. `idm_storage`
- **`DiskAllocator`:** Preallocates target files using Windows API `SetFileInformationByHandle` (`FILE_ALLOCATION_INFO`) to prevent NTFS fragmentation.
- **`ChunkWriter`:** Coordinates concurrent multi-threaded writes into distinct byte ranges of a single preallocated file handle using non-blocking asynchronous positioned writes.
- **`StateDatabase`:** High-performance embedded SQLite database via `sqlx` or `rusqlite`, tracking downloads, segments, categories, and queue history with ACID transactional guarantees.

#### 4. `idm_ipc`
- **`NativeMessagingHost`:** CLI bridge adhering to Chromium and Gecko Native Messaging format (32-bit length prefix + JSON over stdio).
- **`PipeServer`:** Windows Named Pipe server (`\\.\pipe\IdmRebornIpc`) allowing GUI, CLI, and browser extensions to communicate concurrently with the running background engine.

#### 5. `idm_media`
- Parses HLS playlists (`.m3u8`) and MPEG-DASH manifest descriptors (`.mpd`).
- Coordinates concurrent segment downloads through the core engine.
- Fast, lossless muxing of MPEG-TS chunks into standardized `.mp4` containers.

#### 6. `idm_cli`
- Command-line entrypoint built with `clap`.
- Provides 100% flag parity with IDM syntax:
  `idm_reborn /d <URL> /p <PATH> /f <FILENAME> /n /q /s /a`.

#### 7. `idm_gui`
- Modern, lightweight desktop interface (Slint, Iced, or native Win32 controls).
- Real-time download progress list, transfer speed charts, queue drawer, and system tray integration.

---

## 3. Technology Stack & Key Dependencies

```toml
[workspace.dependencies]
# Asynchronous Runtime & Networking
tokio = { version = "1.43", features = ["full"] }
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "stream", "cookies", "socks"] }
hyper = { version = "1.5", features = ["full"] }
rustls = "0.23"

# Windows Internals & Platform APIs
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_Storage_FileSystem",
    "Win32_System_Pipes",
    "Win32_System_Shutdown",
    "Win32_System_DataExchange",
    "Win32_UI_WindowsAndMessaging",
    "Win32_Security"
] }

# Persistence & Storage
rusqlite = { version = "0.33", features = ["bundled"] }
memmap2 = "0.9"

# Concurrency & Traffic Shaping
governor = "0.8"        # Token-bucket rate limiter
bytes = "1.10"          # Zero-copy byte buffers
futures-util = "0.3"
async-channel = "2.3"

# CLI & Serialization
clap = { version = "4.5", features = ["derive"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

---

## 4. Concurrency Model & Dynamic Work-Stealing

### Dynamic Work-Stealing Bisection Flow
```
Worker 1: [=======================>.................] (Remaining: 4 MB)
                                   ▲
                                   │ Midpoint calculated: M = 2 MB
Worker 2 (Idle):                  [=========>.......] (Assigned: 2 MB)
```

1. **Detection:** When `Worker N` finishes streaming its range, it sends `WorkerEvent::Completed(id)` to the `DownloadTask` actor.
2. **Evaluation:** `DownloadTask` queries all running workers for their current confirmed byte offsets $b_{\text{curr}}$ and target ceilings $b_{\text{end}}$.
3. **Selection:** The worker with the maximum pending span $\Delta = b_{\text{end}} - b_{\text{curr}}$ is selected.
4. **Bisection:** If $\Delta \ge 512\text{ KB}$, the range is halved:
   - Worker 1's ceiling is adjusted to $M = b_{\text{curr}} + \lfloor \Delta / 2 \rfloor$.
   - Worker 2 is immediately spawned with range $[M + 1, b_{\text{end}}]$.
5. **Execution:** Worker 2 issues an HTTP request with `Range: bytes=(M+1)-b_end` and streams chunks directly into the preallocated file.

---

## 5. Storage Architecture & Zero-Copy Disk I/O

Legacy downloaders write individual segments into separate temporary files and merge them in a slow sequential copy phase at 100% download.

IDM REBORN eliminates this bottleneck:
1. **Preallocation:** On startup, the file is created and sized instantly via `SetFileInformationByHandle` with `FILE_ALLOCATION_INFO`.
2. **Direct-to-File Positioned Writes:**
   - On Windows, file handles opened with `FILE_WRITE_DATA` can write to arbitrary offsets simultaneously without modifying a shared file pointer.
   - Worker threads call asynchronous positioned write operations (`tokio::fs::File` with `seek` or Windows `WriteFile` with `OVERLAPPED` offsets).
3. **Instant Completion:** When the final segment worker concludes, the file is already fully assembled. **No joining or copying delay is required.**

---

## 6. Communication Mechanisms

### 1. Internal Actor Channels
- **`tokio::sync::mpsc`:** Command channels between UI/CLI and `DownloadManager`.
- **`tokio::sync::broadcast`:** Real-time telemetry broadcast (speed, bytes transferred, ETA) consumed by UI and console formatters.

### 2. External Browser IPC
- **Windows Named Pipe:** Server listening at `\\.\pipe\IdmRebornIpc` protected by DACLs allowing only the current user.
- **Native Messaging Stdio:** Chrome/Firefox extension communicates with `idm_ipc` using standard 4-byte length-prefixed JSON packets.

---

## 7. Data Flow Lifecycle

```
[Browser / CLI] ──► [Named Pipe IPC]
                           │
                           ▼
                 [DownloadManager Actor]
                           │ Validates & inserts into SQLite
                           ▼
                  [QueueScheduler]
                           │ Checks concurrency limits
                           ▼
                   [DownloadTask]
                           │
          ┌────────────────┴────────────────┐
          ▼                                 ▼
   [Capability Probe]              [DiskAllocator]
   (HEAD Range: bytes=0-)          (Preallocates NTFS sparse file)
          │                                 │
          └────────────────┬────────────────┘
                           ▼
                [WorkStealingScheduler]
                           │ Spawns N SegmentWorkers
                           ▼
               [SegmentWorkers (1..32)]
              (Streams blocks via tokio)
                           │
                           ▼
                     [ChunkWriter]
          (Direct positioned async writes)
                           │
                           ▼
                [Integrity Validation]
                 (SHA-256 Checksum)
                           │
                           ▼
                  [Completed File]
```

---

## 8. Verification & Test Strategy

1. **Unit Testing:**
   - Work-stealing math and range boundary edge cases.
   - Token-bucket rate limiter accuracy under bursty loads.
   - URL parsing and file extension categorization tables.
2. **Loopback Integration Testing:**
   - Dedicated local HTTP/1.1 and HTTP/2 test servers simulating range responses, network jitter, premature disconnections, and 5xx errors.
   - Verification of byte-for-byte SHA-256 file matching across single-connection and multi-connection downloads.
3. **Benchmarking:**
   - Direct throughput comparisons between `idm_reborn` and the original `IDMan.exe` on 100 MB, 1 GB, and 10 GB payloads over local and simulated high-latency WAN links.
