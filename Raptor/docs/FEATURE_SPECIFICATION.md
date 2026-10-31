# Feature Specification: IDM REBORN (Rust Reimplementation)

**Document Version:** 1.0.0  
**Project:** IDM REBORN — High-Performance Clean-Room Windows Download Manager  
**Language:** Rust 2024 / 2021 Edition  
**Platform Target:** Windows 10 / 11 (x64, ARM64)  

---

## 1. Overview & Objective

`idm_reborn` is an independent, clean-room functional reimplementation of Internet Download Manager. It reproduces the verified download acceleration, multi-connection dynamic segmentation, pause/resume, queue scheduling, and browser integration of the original Windows software while upgrading the architecture to modern memory-safe Rust with asynchronous I/O and cross-browser support.

---

## 2. Core Functional Requirements

### Feature 1: HTTP, HTTPS, HTTP/2 & HTTP/3 Transport
- **Protocols Supported:** HTTP/1.1, HTTP/2, and optional HTTP/3 over QUIC.
- **TLS Security:** Modern TLS 1.2 and TLS 1.3 via `rustls` or native Windows SChannel (`native-tls`).
- **Header Fidelity:**
  - Emulates modern browser headers (`User-Agent`, `Accept`, `Accept-Language`, `Sec-Fetch-*`).
  - Passes dynamic session `Cookie` jars captured from browser requests.
  - Passes `Referer` headers to satisfy hotlinking protections.
- **Authentication:**
  - HTTP Basic & Digest Authentication.
  - Proxy Authentication (Basic, NTLM).
  - Secure credential storage.

---

### Feature 2: Multi-Connection Dynamic Segmentation & Work-Stealing
- **Initial Connection & Handshake:**
  - Executes a capability probe (`HEAD` or `GET Range: bytes=0-`) to determine `Content-Length` and verify `Accept-Ranges: bytes`.
  - If the server supports byte ranges and the file exceeds 256 KB, multi-connection acceleration is activated.
- **Configurable Connection Limits:**
  - Configurable connections per download ($N \in [1, 32]$, default 8).
  - Per-host connection throttling (`MCN`) to avoid server rate-limiting or IP bans.
- **Dynamic Bisection (Work-Stealing):**
  - When a worker connection finishes its assigned byte range and unassigned connection slots remain, the scheduler inspects all active workers.
  - It identifies the active worker with the largest remaining byte distance:
    $$\Delta = b_{\text{end}} - b_{\text{current}}$$
  - If $\Delta \ge \text{MIN\_CHUNK\_SIZE}$ (default 512 KB), the remaining range is halved:
    $$\text{mid} = \left\lfloor b_{\text{current}} + \frac{\Delta}{2} \right\rfloor$$
  - Worker 1's upper limit is set to $\text{mid}$; Worker 2 is assigned $[\text{mid} + 1, b_{\text{end}}]$.
  - Both workers continue parallel streaming without resetting established TCP sockets.

---

### Feature 3: File Preallocation & Disk I/O
- **Immediate Disk Allocation:**
  - Before writing chunks, the target file is preallocated to full size via Windows `SetFileInformationByHandle` with `FILE_ALLOCATION_INFO` (or sparse file creation).
  - Eliminates filesystem fragmentation on NTFS and SSD write amplification.
- **Direct Concurrent Block Writes:**
  - Worker threads write downloaded blocks directly into their designated byte offsets in the target file (or staging part files).
  - Uses asynchronous `tokio::fs` or memory-mapped files (`memmap2`) for zero-copy file assembly.
- **Atomic Staging & Finalization:**
  - Incomplete downloads reside in a staging cache: `%APPDATA%\idm_reborn\staging\<download_id>\`.
  - Once verified, the file is atomically committed to the user's destination path using `MoveFileExW` / `std::fs::rename`.

---

### Feature 4: Pause and Resume
- **Pause Execution:**
  - Suspends socket read streams immediately.
  - Flushes in-flight memory buffers to disk.
  - Commits verified continuous byte offsets per segment to local state.
- **Validation on Resume:**
  - Queries server with conditional headers:
    - `If-Match: "<etag>"`
    - `If-Unmodified-Since: <timestamp>`
  - If server returns `412 Precondition Failed` or `200 OK` (full body), halts and prompts the user before re-downloading.
  - If valid (`206 Partial Content`), resumes each segment from its exact verified offset.

---

### Feature 5: Queue Management & Scheduling
- **Queue Hierarchy:**
  - *Main Download Queue*: Default parallel or FIFO queue.
  - *Synchronization Queue*: Periodically checks file headers for updates.
  - *Custom User Queues*: Custom named queues with independent concurrency limits.
- **Concurrency & Rate Limits:**
  - User-configurable maximum active downloads per queue (default 1 to 5).
  - Dynamic drag-and-drop prioritization.
- **Scheduler Automations:**
  - Wall-clock timer: Start at `HH:mm:ss`, stop at `HH:mm:ss`.
  - Calendar rules: Daily, weekdays, or selected days.
  - Post-queue actions:
    - Disconnect network interface.
    - Close application.
    - System sleep, hibernation, or shutdown via Windows API (`InitiateSystemShutdownExW`).

---

### Feature 6: Speed Limiting (Traffic Shaping)
- **Token-Bucket Rate Limiter:**
  - Supports global bandwidth caps and per-download speed limits (e.g., 500 KB/s, 2 MB/s).
  - Measures throughput over 100 ms sliding windows.
  - Injects asynchronous non-blocking delays (`tokio::time::sleep`) to cap socket reads to the exact specified byte rate.

---

### Feature 7: Browser Integration (Native Messaging Host)
- **Browser Compatibility:** Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, Opera, Vivaldi.
- **Native Messaging Bridge:**
  - Registered under `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.idm.reborn` (and Mozilla equivalent).
  - Communicates over `stdio` using 4-byte little-endian message framing with JSON payloads.
  - Compatible with existing extension message schemas for seamless link interception.
- **IPC Protocol:**
  - Native host bridges browser events to the main `idm_reborn` engine over Windows Named Pipes (`\\.\pipe\IdmRebornIpc`).
  - Intercepted payload includes: `url`, `referer`, `cookies`, `user_agent`, `post_data`, `suggested_filename`.

---

### Feature 8: Clipboard Monitoring
- **Clipboard Hook:**
  - Subscribes to Windows clipboard update events via `AddClipboardFormatListener` / `WM_CLIPBOARDUPDATE`.
  - Scans newly copied text for valid URI schemes (`http://`, `https://`, `ftp://`).
- **File Filter Evaluation:**
  - Compares URL file extensions against the configured download list (e.g., `.zip`, `.iso`, `.exe`, `.mp4`).
  - Prompts user with a non-intrusive download dialog when a matching URL is detected.

---

### Feature 9: Automatic Categorization & Routing
- Files are automatically routed to default directories based on file extension:
  - **Compressed (`Downloads\Compressed`):** `.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.iso`, `.zst`
  - **Documents (`Downloads\Documents`):** `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`
  - **Music (`Downloads\Music`):** `.mp3`, `.wav`, `.flac`, `.aac`, `.ogg`, `.m4a`
  - **Programs (`Downloads\Programs`):** `.exe`, `.msi`, `.bat`, `.cmd`
  - **Video (`Downloads\Video`):** `.mp4`, `.mkv`, `.avi`, `.webm`, `.mov`, `.ts`
- Users can create custom categories with custom extension patterns and destination paths.

---

### Feature 10: Video Stream Sniffing & Remuxing
- **HLS (`.m3u8`) Support:**
  - Parses Master and Media playlists.
  - Downloads `.ts` video chunks concurrently using the multi-connection engine.
  - Losslessly remuxes concatenated TS segments into a single `.mp4` container.
- **MPEG-DASH (`.mpd`) Support:**
  - Parses MPD segment templates and `sidx` ranges.
  - Downloads audio and video representations concurrently and muxes streams into MP4.

---

### Feature 11: Error Recovery & Retry Taxonomy
- **Automatic Retry Engine:**
  - Exponential backoff with jitter on transient socket errors (timeout, connection reset).
  - Configurable maximum retries (default 10).
- **Deterministic Error Taxonomy:**
  - `Error::NotFound` (404): Non-retryable; user notified immediately.
  - `Error::ServerError` (5xx): Retryable with exponential backoff.
  - `Error::PreconditionFailed` (412): Resume failed because server file changed; user prompted to restart.
  - `Error::DiskFull`: Halted with clear disk space warning.

---

### Feature 12: CLI Interface (IDM Flag Parity)
Provides full backward compatibility with IDM command-line syntax:
- `/d <URL>`: Download URL.
- `/p <PATH>`: Destination directory.
- `/f <FILENAME>`: Output file name.
- `/q`: Exit program after queue completion.
- `/h`: Hang up / disconnect connection after download.
- `/n`: Silent mode (start transfer immediately without prompting).
- `/a`: Add download to queue without starting.
- `/s`: Start queue processing.
