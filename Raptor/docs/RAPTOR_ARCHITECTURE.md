# HyperDownload: Modern Rust Download Manager Architecture
## Adapted Clean-Room System Architecture Based on Reverse Engineering Findings

**Project Name:** HyperDownload  
**Document Version:** 1.0.0  
**Target Platform:** Windows 10 & 11 (x64, ARM64)  
**Technology Stack:** Rust (Tokio, Reqwest, Serde), Tauri 2, React, TypeScript, SQLite, Axum  

---

## 1. Architectural Adaptation Based on Empirical Findings

Through deep reverse engineering and controlled dynamic loopback analysis of the original Internet Download Manager executable (`IDMan.exe`), four critical operational characteristics were uncovered that directly inform and refine HyperDownload's architecture:

### 1.1 Dynamic Work-Stealing Bisection vs. Static Chunking
* **IDM Finding:** IDM does not slice files into fixed chunks upfront. When connection $A$ starts at byte 0, connection $B$ joins by requesting the unread tail. When any connection completes its chunk, it dynamically steals and bisects the upper half of the slowest running worker's remaining byte span.
* **HyperDownload Adaptation:** The `segment-manager` crate implements an asynchronous **Dynamic Work-Stealing Bisection Engine**. Rather than static ranges, workers stream through atomic checkpoints. Idle worker slots detect the largest remaining unread byte distance $\Delta = b_{\text{end}} - b_{\text{current}}$, split it in half ($\text{mid} = b_{\text{current}} + \lfloor \Delta / 2 \rfloor$), and stream the upper half in parallel, maintaining 100% bandwidth utilization.

### 1.2 Zero-Copy Direct-to-File Writes vs. Staging & Joining Delay
* **IDM Finding:** IDM writes separate chunk files into `%APPDATA%\Roaming\IDM\DwnlData\%USERNAME%\<target>_<id>\` and performs a slow, sequential concatenation write into the final destination file once all parts complete.
* **HyperDownload Adaptation:** HyperDownload eliminates this performance bottleneck. The `storage` crate instantly preallocates the entire destination file via Windows API `SetFileInformationByHandle` with `FILE_ALLOCATION_INFO` (or NTFS sparse allocation). Multiple concurrent workers write directly to their respective byte offsets into the same open file handle using non-blocking positioned writes. **When the last byte arrives, the file is already 100% assembled with zero concatenation delay.**

### 1.3 Dual Browser Bridge: Native Messaging & Local Axum Loopback
* **IDM Finding:** IDM relies on a native messaging executable (`IDMMsgHost.exe`) communicating via stdio that forwards requests over a Windows Named Pipe (`\\.\pipe\IDMNetworkMonitor`).
* **HyperDownload Adaptation:** The `browser-bridge` crate provides a unified hybrid IPC:
  1. **Native Messaging Host:** Compatible with Chrome/Firefox stdio protocol for traditional browser extension integration.
  2. **Windows Named Pipe Server:** Zero-latency IPC at `\\.\pipe\HyperDownloadIpc`.
  3. **Local Loopback Axum REST/WebSocket Server:** Running on `127.0.0.1:9145`, enabling modern Manifest V3 browser extensions, mobile companion apps, and userscripts to communicate without spawning individual bridge processes.

### 1.4 ACID SQLite State Store vs. Windows Registry
* **IDM Finding:** IDM stores all download records, segments, passwords, and logs across hundreds of subkeys under `HKCU\Software\DownloadManager\<id>\`.
* **HyperDownload Adaptation:** The `storage` crate replaces the Windows Registry with an embedded SQLite database (`rusqlite`) configured in WAL (Write-Ahead Logging) mode. This guarantees transactional integrity, microsecond queries, instant full-text search, and resilience against sudden power loss or process termination.

---

## 2. Workspace & Crate Structure

```
HyperDownload/
│
├── Cargo.toml                      # Workspace configuration & shared dependencies
├── README.md                       # Project overview & build instructions
│
├── crates/
│   ├── shared/                     # Common domain models, error taxonomy, IPC contracts
│   ├── http-client/                # Reqwest/hyper client, TLS, browser headers, capability probe
│   ├── segment-manager/            # Dynamic bisection work-stealing, range math, speed limiter
│   ├── connection-manager/         # Per-host concurrency caps (MCN), connection pooling, retry
│   ├── storage/                    # Windows disk preallocation, positioned chunk writing, SQLite
│   ├── download-engine/            # Central actor coordinator, task state machine, event bus
│   ├── queue-manager/              # Main, sync, and custom user queues, concurrency limits
│   ├── scheduler/                  # Wall-clock timers, recurring schedules, system power actions
│   ├── browser-bridge/             # Native messaging host, named pipes, Axum HTTP/WebSocket API
│   └── clipboard-monitor/          # Windows AddClipboardFormatListener, category extension router
│
├── desktop/                        # Tauri 2 Desktop Frontend
│   ├── src-tauri/                  # Tauri Rust backend, windowing, system tray, notifications
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   └── src/
│   │       └── main.rs
│   └── src/                        # React 19 + TypeScript + Tailwind CSS UI
│       ├── components/             # DownloadTable, SpeedChart, QueueDrawer, AddUrlModal
│       ├── hooks/                  # useDownloadEvents, useSpeedGraph
│       ├── App.tsx
│       └── main.tsx
│
├── browser-extension/              # Manifest V3 Extension (Chrome, Edge, Firefox, Brave)
│   ├── manifest.json
│   ├── background.js               # Link interceptor, context menu, native bridge caller
│   └── popup/                      # Quick download popup UI
│
├── tests/                          # Integration tests, loopback server tests, range edge cases
├── benchmarks/                     # Throughput benchmarks vs legacy IDM
└── docs/                           # Architecture, specifications, reverse engineering notes
```

---

## 3. Crate Responsibilities & Interfaces

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                 │
│        desktop/ (Tauri 2 + React + TS)      │      CLI (idm_cli binary)     │
└──────────────────────────────────────┬──────┴───────────────────────────────┘
                                       │ IPC / Tauri Commands
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                              BROWSER BRIDGE                                 │
│    crates/browser-bridge: Native Messaging + Named Pipe + Axum REST/WS     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Tasks / Commands
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                              DOWNLOAD ENGINE                                │
│       crates/download-engine: Coordinator Actor & Task State Machine        │
│    ┌───────────────────────────┐           ┌─────────────────────────────┐  │
│    │    crates/queue-manager   │           │      crates/scheduler       │  │
│    │ (Main, Sync, Custom Queue)│           │ (Timers, System Power API)  │  │
│    └─────────────┬─────────────┘           └──────────────┬──────────────┘  │
│                  └───────────────────┬────────────────────┘                 │
│                                      ▼                                      │
│                        crates/segment-manager                               │
│            (Dynamic Bisection Work-Stealer & Token Bucket)                  │
│                  ┌───────────────────┴───────────────────┐                  │
│                  ▼                                       ▼                  │
│       crates/connection-manager                 crates/storage              │
│       (Per-Host MCN & Reqwest)              (NTFS Direct Chunk Writer       │
│                  │                            & Embedded SQLite DB)         │
│                  ▼                                       │                  │
│         crates/http-client                               ▼                  │
│      (TLS, Range Probe, Headers)                 Disk Destination           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 `crates/shared`
* **Purpose:** Core domain primitives, serialization contracts, and error taxonomy.
* **Key Types:**
  - `DownloadId` (UUID v4 or sequential ID).
  - `DownloadStatus`: `Queued | Probing | Downloading | Paused | Completed | Failed(DownloadError)`.
  - `ByteRange`: `Range { start: u64, end: u64 }`.
  - `DownloadMetadata`: `ContentLength`, `ETag`, `LastModified`, `AcceptRanges`, `ContentType`, `FileName`.
  - `DownloadError`: Maps to IDM's internal error taxonomy:
    - `NotFound` (IDM 30053 / HTTP 404).
    - `ServerError` (IDM 30018 / HTTP 500).
    - `ResumeUnsupported` (IDM 30071 / dropped non-resumable connection).
    - `PreconditionFailed` (HTTP 412 / remote file mutated).
    - `Timeout`, `DiskFull`, `Cancelled`.

### 3.2 `crates/http-client`
* **Purpose:** High-performance HTTP/HTTPS transport.
* **Capabilities:**
  - `CapabilityProbe`: Sends `HEAD` or `GET Range: bytes=0-` to inspect server support.
  - Browser Header Injection: Accurately sets `User-Agent`, `Referer`, `Cookie`, `Sec-Fetch-Dest`.
  - TLS: Pure memory-safe Rust TLS via `rustls` with fallback to Windows SChannel.
  - Proxy Support: System proxy, HTTP `CONNECT` tunnel, SOCKS5.

### 3.3 `crates/segment-manager`
* **Purpose:** Implements dynamic binary bisection work-stealing and traffic shaping.
* **Capabilities:**
  - `SegmentWorker`: Asynchronous worker streaming an assigned byte range.
  - `WorkStealer`: Evaluates active workers; finds the worker with the maximum pending delta $\Delta = b_{\text{end}} - b_{\text{current}}$. If $\Delta \ge 512\text{ KB}$, bisects the range at midpoint $M$ and launches an idle worker on $[M + 1, b_{\text{end}}]$.
  - `SpeedLimiter`: Token-bucket rate limiter enforcing bandwidth caps across active workers via non-blocking `tokio::time::sleep`.

### 3.4 `crates/connection-manager`
* **Purpose:** Per-host connection concurrency and resiliency.
* **Capabilities:**
  - Enforces `MCN` (Maximum Connection Number) per domain (e.g. max 8 or 16).
  - Persistent TCP/TLS connection reuse via HTTP/1.1 and HTTP/2 multiplexing.
  - Exponential backoff retry engine with randomized jitter for transient network drops.

### 3.5 `crates/storage`
* **Purpose:** Disk allocation, positioned chunk writes, and ACID state management.
* **Capabilities:**
  - `DiskAllocator`: Calls Windows `SetFileInformationByHandle` with `FILE_ALLOCATION_INFO` to preallocate clusters on NTFS, eliminating fragmentation.
  - `PositionedWriter`: Concurrent asynchronous writes to explicit byte offsets in a single file handle.
  - `Database`: SQLite database (`rusqlite`) storing active downloads, segment checkpoints, queue configurations, and category rules.

### 3.6 `crates/download-engine`
* **Purpose:** Central coordinator actor.
* **Capabilities:**
  - Owns the `tokio::sync::mpsc` command channel and `broadcast` telemetry channel.
  - Coordinates the lifecycle of downloads from probing through completion.
  - Emits real-time progress events (speed, transferred bytes, active connections, ETA) to the desktop UI.

### 3.7 `crates/queue-manager`
* **Purpose:** Queue scheduling and concurrency management.
* **Capabilities:**
  - Manages Main Queue, Synchronization Queue, and user-defined custom queues.
  - Controls maximum concurrent active downloads (e.g. 1 to 5 concurrent files).
  - Prioritization, pause all, and resume all controls.

### 3.8 `crates/scheduler`
* **Purpose:** Automated calendar-based execution.
* **Capabilities:**
  - Configurable start and stop times (`HH:mm:ss`).
  - Recurring execution (daily, weekdays, specific dates).
  - Post-completion actions: Disconnect network, exit application, or trigger system shutdown via Windows `InitiateSystemShutdownExW`.

### 3.9 `crates/browser-bridge`
* **Purpose:** Multi-modal IPC for browser integration.
* **Capabilities:**
  - Chromium/Gecko Native Messaging Host: 32-bit length-prefixed JSON protocol over stdio.
  - Windows Named Pipe Server: `\\.\pipe\HyperDownloadIpc`.
  - Axum Local Loopback Server: REST & WebSocket endpoints on `127.0.0.1:9145` for extension events, userscripts, and external tools.

### 3.10 `crates/clipboard-monitor`
* **Purpose:** Clipboard URL interception and auto-categorization.
* **Capabilities:**
  - Listens to Windows clipboard updates via `AddClipboardFormatListener` / `WM_CLIPBOARDUPDATE`.
  - Evaluates clipboard text against URI schemes and downloadable file extension lists.
  - Auto-routes files into *Compressed, Documents, Music, Programs, Video* or custom directories.

---

## 4. Desktop Frontend Architecture (`desktop/`)

* **Framework:** Tauri 2 with React 19, TypeScript, and Tailwind CSS.
* **Backend (`desktop/src-tauri`):**
  - Connects directly to `download-engine` via in-memory MPSC channels.
  - Manages Windows system tray icon with context menus (Pause All, Resume All, Speed Limiter, Exit).
  - Emits native Windows 10/11 Toast notifications on download completion or failure.
  - Exposes Tauri commands (`start_download`, `pause_download`, `cancel_download`, `set_speed_limit`, `get_queues`).
* **Frontend (`desktop/src`):**
  - **`DownloadTable`:** Virtualized table displaying active, paused, and completed downloads with real-time progress bars, speed, and ETA.
  - **`SpeedChart`:** Interactive SVG/Canvas real-time throughput graph.
  - **`QueueDrawer`:** Drag-and-drop queue reordering and scheduler controls.
  - **`AddDownloadDialog`:** URL input, folder selector, category selector, connection count selector, and credentials.

---

## 5. Technology Stack & Key Dependencies

```toml
[workspace]
resolver = "2"
members = [
    "crates/shared",
    "crates/http-client",
    "crates/segment-manager",
    "crates/connection-manager",
    "crates/storage",
    "crates/download-engine",
    "crates/queue-manager",
    "crates/scheduler",
    "crates/browser-bridge",
    "crates/clipboard-monitor",
    "desktop/src-tauri"
]

[workspace.dependencies]
# Async Runtime & Networking
tokio = { version = "1.43", features = ["full"] }
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "stream", "cookies", "socks"] }
hyper = { version = "1.5", features = ["full"] }
rustls = "0.23"
axum = { version = "0.8", features = ["ws"] }
tower-http = { version = "0.6", features = ["cors", "trace"] }

# Windows System APIs
windows = { version = "0.58", features = [
    "Win32_Foundation",
    "Win32_Storage_FileSystem",
    "Win32_System_Pipes",
    "Win32_System_Shutdown",
    "Win32_System_DataExchange",
    "Win32_UI_WindowsAndMessaging",
    "Win32_Security"
] }

# Storage & Persistence
rusqlite = { version = "0.33", features = ["bundled"] }
memmap2 = "0.9"

# Concurrency & Math
governor = "0.8"        # Token-bucket rate limiting
bytes = "1.10"
futures-util = "0.3"
async-trait = "0.1"

# Serialization & CLI
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
clap = { version = "4.5", features = ["derive"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
uuid = { version = "1.13", features = ["v4", "serde"] }
thiserror = "2.0"
```

---

## 6. Implementation Milestones

1. **Phase 4.1: Workspace Scaffolding:** Scaffold root `Cargo.toml`, crate skeletons, shared types, and build scripts.
2. **Phase 4.2: Storage & Networking Core:** Implement NTFS disk preallocation, positioned chunk writer, and HTTP capability probe.
3. **Phase 4.3: Dynamic Work-Stealing Segmentation:** Implement `segment-manager` range bisection and token-bucket speed limiter.
4. **Phase 4.4: Engine Coordinator & SQLite:** Wire up `download-engine` actor, queue manager, and SQLite persistence.
5. **Phase 4.5: Browser Bridge & Clipboard:** Implement Native Messaging Host, Named Pipe IPC, Axum server, and clipboard listener.
6. **Phase 4.6: Desktop UI (Tauri 2 + React):** Connect Tauri backend to React UI with system tray, speed charts, and queue controls.
