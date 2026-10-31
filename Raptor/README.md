# HyperDownload ⚡

**HyperDownload** is a high-performance, clean-room reimplementation of Internet Download Manager (IDM) in modern Rust. It reproduces IDM's verified multi-connection acceleration, dynamic binary bisection work-stealing, seamless pause/resume, and browser native messaging while modernizing the architecture with async I/O, zero-copy file assembly, and cross-browser integration.

---

## 🌟 Key Features

- **Dynamic Work-Stealing Acceleration:** Eliminates static chunk boundaries. Slower connections are dynamically bisected by idle workers, ensuring 100% bandwidth saturation across 1 to 32 parallel connections.
- **Direct-to-File Zero-Copy Writes:** Preallocates full file space on NTFS instantly using Windows APIs (`FILE_ALLOCATION_INFO`). Streams write directly to designated byte offsets, **eliminating IDM's slow post-download sequential concatenation delay**.
- **Robust Pause & Resume:** Checkpoints verified byte offsets continuously into an embedded ACID SQLite database. Verifies server state on resume via `ETag` and `Last-Modified`.
- **Hybrid Browser Integration:**
  - Standard Chromium & Gecko **Native Messaging Host** over stdio.
  - Windows **Named Pipe IPC** (`\\.\pipe\HyperDownloadIpc`).
  - Embedded **Axum REST/WebSocket Bridge** on `127.0.0.1:9145` for modern Manifest V3 extensions, userscripts, and automation tools.
- **Traffic Shaping:** Token-bucket speed limiter enforcing global and per-download throughput ceilings.
- **Automated Queueing & Scheduling:** Multiple named queues (Main, Synchronization, Custom) with concurrency controls and post-completion actions (network disconnect, sleep, system shutdown).
- **Clipboard Monitoring:** Native Windows `AddClipboardFormatListener` auto-detecting copied download URLs with automatic category routing (*Compressed, Documents, Music, Programs, Video*).
- **Tauri 2 + React Desktop App:** Modern desktop GUI with real-time throughput graphs, queue drawer, and system tray integration.

---

## 🏗️ Workspace Structure

```
HyperDownload/
├── crates/
│   ├── shared/                 # Domain models, error taxonomy, IPC contracts
│   ├── http-client/            # Reqwest client, TLS, browser headers, capability probe
│   ├── segment-manager/        # Dynamic bisection work-stealing & speed limiter
│   ├── connection-manager/     # Host connection concurrency limiter (MCN) & retry engine
│   ├── storage/                # NTFS disk preallocation, positioned chunk writing, SQLite DB
│   ├── download-engine/        # Central coordinator actor & task state machine
│   ├── queue-manager/          # Queue scheduling & concurrency limits
│   ├── scheduler/              # Wall-clock timers & system power shutdown actions
│   ├── browser-bridge/         # Native messaging host, named pipes & Axum HTTP/WS server
│   └── clipboard-monitor/      # Windows clipboard listener & extension category classifier
├── desktop/                    # Tauri 2 + React + TypeScript Desktop UI
├── browser-extension/          # Manifest V3 Extension for Chrome, Edge, Firefox, Brave
├── tests/                      # Conformance & integration test suites
└── docs/                       # Technical architecture & reverse-engineering analysis
```

---

## 🚀 Quick Start

### Prerequisites
- [Rust](https://rustup.rs/) (1.75+ recommended, 2021/2024 edition)
- [Node.js](https://nodejs.org/) (v20+ or v22+)
- Windows 10 or 11 (64-bit)

### Build the Rust Workspace
```powershell
cd HyperDownload
cargo build --release
```

### Run Tests
```powershell
cargo test
```
