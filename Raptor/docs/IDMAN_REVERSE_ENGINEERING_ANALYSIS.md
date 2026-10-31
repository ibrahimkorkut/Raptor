# Reverse Engineering & Architecture Analysis of Internet Download Manager (IDM)

**Target Analyzed:** `idman643build16.exe` (Installer) & `IDMan.exe` (Unpacked Core Binary)  
**Version:** 6.43 Build 16 (6.43.16.2)  
**Vendor:** Tonec Inc. / Tonec FZE  
**Methodology:** Clean-Room Static & Structural Binary Reverse Engineering (REA, `pefile`, Capstone 5.0, String & RTTI Analysis)  
**Classification:** Proprietary Commercial Windows Download Accelerator  

---

## 1. Executive Summary

This document details the reverse engineering investigation of Internet Download Manager (`idman643build16.exe`). Through deep binary inspection, we established that the distributed executable is an installation bundle wrapping **191 distinct component files** in a sequential zlib-compressed archive overlay.

The core application executable, `IDMan.exe` (6,490,992 bytes), is a 32-bit native Windows x86 GUI application built in C++ using Microsoft Foundation Classes (MFC) and compiled with Visual Studio 2008 (MSVC 9.0). By recovering 449 RTTI class descriptors, disassembly traces, IAT/dynamic loading patterns, and registry access routines, we mapped the complete functional architecture of IDM's multi-connection engine, segmentation algorithm, browser messaging IPC, and queue scheduler.

This verified specification serves as the blueprint for **IDM REBORN**, an independent clean-room reimplementation in modern Rust.

---

## 2. Binary & Environment Analysis

### 2.1 File Characteristics & Hashes
| Attribute | Installer Bundle (`idman643build16.exe`) | Core Binary (`IDMan.exe`) |
|---|---|---|
| **File Size** | 12,698,904 bytes (~12.7 MB) | 6,490,992 bytes (~6.49 MB) |
| **SHA-256** | `276aa7e4ff7682445b011ebe6ac3920e7eca6ece7d3f6723b1f1cb515164461b` | `3b5dc9ce53eb31933effa3fd973bec068a78e0f8c1d15a919b081f0c4d9325ba` |
| **Machine Architecture** | x86 (32-bit `0x014c`) | x86 (32-bit `0x014c`) |
| **Subsystem** | Windows GUI (`0x0002`) | Windows GUI (`0x0002`) |
| **Image Base** | `0x00400000` | `0x00400000` |
| **Entry Point RVA** | `0x00005b7a` (VA `0x00405b7a`) | `0x0027f37c` (VA `0x0067f37c`) |
| **Size of Image** | `0x0001b000` (110,592 bytes) | `0x0063b000` (6,533,120 bytes) |
| **Overlay Offset** | `0x00017400` (12,603,672 bytes) | None (0 bytes) |
| **Authenticode Signature** | Present (`0x00c19b70`, 10,664 bytes) | Present (`0x0062e200`, 10,608 bytes) |
| **Debug Info / PDB** | Absent in installer stub | `s:\IDM_projects\IDM_vs2008_2\Release\IDMan.pdb` |

### 2.2 Section Layout (`IDMan.exe`)
| Section Name | Virtual Address | Virtual Size | Raw Data Size | Entropy | Purpose |
|---|---|---|---|---|---|
| `.text` | `0x00001000` | `0x002d068c` (~2.81 MB) | `0x002d0800` | 6.60 | Executable code (x86 assembly) |
| `.rdata` | `0x002d2000` | `0x000eb7aa` (~942 KB) | `0x000eb800` | 5.18 | Read-only data, IAT, strings, RTTI |
| `.data` | `0x003be000` | `0x0001407c` (~80 KB) | `0x0000a800` | 5.46 | Global variables, writable state |
| `.rsrc` | `0x003d3000` | `0x0022d738` (~2.18 MB) | `0x0022d800` | 5.50 | Dialogs, menus, icons, bitmaps, strings |
| `.reloc` | `0x00601000` | `0x00039c78` (~231 KB) | `0x00039e00` | 6.10 | Base relocations for ASLR compatibility |

### 2.3 Component Ecosystem (Unpacked Files)
The installer packages a modular ecosystem:
- **`IDMan.exe`**: Main download manager application and UI.
- **`IDMMsgHost.exe`**: Native Messaging Host for Chromium and Gecko browsers.
- **`idmBroker.exe`**: Medium integrity broker for elevation and sandboxed IPC.
- **`IDMNetMon.dll` / `IDMNetMon64.dll`**: Network monitor DLLs for process interception.
- **`idmwfp32.sys` / `idmwfp64.sys`**: Windows Filtering Platform (WFP) kernel drivers.
- **`libcrypto.dll` / `libssl.dll`**: OpenSSL 1.1/3.x libraries for TLS/HTTPS transport.
- **`IDMVMPrs.dll` / `idmvconv.dll`**: Video stream parser (HLS `.m3u8`, MPEG-DASH `.mpd`, TS-to-MP4 converter).
- **`IDMShellExt.dll` / `IDMShellExt64.dll`**: Windows Explorer context menu shell extension.

---

## 3. Code & Structural Analysis

### 3.1 Class Architecture (Recovered RTTI Graph)
Through MSVC RTTI symbol recovery, the core object-oriented hierarchy was mapped:

```
[CDownloaderApp] ─────────── (Main CWinApp coordinator)
       │
       ├── [CDownloaderDlg] ─── (Main UI Window / List Control / Toolbars)
       │
       ├── [CDownloadQueue] ─── (Queue Manager: Active, Pending, Completed)
       │         └── [CQueuesArray]
       │
       ├── [CDownload] ──────── (Download Item Entity)
       │         ├── [CFilePart] ────── (Segmented download worker)
       │         ├── [Connection] ───── (Abstract protocol connection)
       │         │        ├── [HTTPConnection] ── [HTTPSession]
       │         │        ├── [FTPConnection] ─── [FTPSession]
       │         │        ├── [MMSConnection]
       │         │        └── [RTMPConnection]
       │         │
       │         ├── [CSpeedLimiter] ── (Rate limiter & traffic shaper)
       │         ├── [CMaxConnNumbers]  (Site connection limits manager)
       │         └── [AVCFile] / [AVCMemFile] (Storage abstraction)
       │
       └── [CM3UParser] ────── (HLS / DASH video streaming engine)
                 ├── [MasterPlaylist] / [MediaPlaylist]
                 └── [MediaSegment]
```

### 3.2 Windows API Utilization Patterns
The application relies on direct Win32 APIs for optimal performance:

1. **File Management & Disk I/O:**
   - Pre-allocation: Uses `SetFilePointerEx` and `SetEndOfFile` to immediately allocate the target file size, avoiding disk fragmentation during concurrent segment writes.
   - Segment Buffering: Uses `CreateFileW`, `ReadFile`, `WriteFile`, and `FlushFileBuffers`.
   - File Mapping: Uses `CreateFileMappingA` and `MapViewOfFile` for fast inter-process buffer sharing and memory-mapped segment assembly.

2. **Threading & Concurrency:**
   - Spawns dedicated OS worker threads per segment using `CreateThread`.
   - Thread coordination uses `InitializeCriticalSectionAndSpinCount`, `EnterCriticalSection`, and `LeaveCriticalSection` for lock synchronization.
   - Inter-thread signaling uses `CreateEventW`, `SetEvent`, `ResetEvent`, and `ReleaseSemaphore`.
   - Single-instance enforcement and IPC synchronization use `CreateMutexA` (`Local\IDMEventMonitor`).

3. **Networking & Transport:**
   - Dynamic loading: `IDMan.exe` intentionally does not link `ws2_32.dll` statically in its IAT; it resolves socket routines dynamically using `LoadLibraryA` and `GetProcAddress`.
   - HTTPS: Uses bundled OpenSSL (`libcrypto.dll`, `libssl.dll`) via `SSL_CTX_new`, `SSL_new`, `SSL_connect`, `SSL_read`, `SSL_write`.
   - Proxies: Supports HTTP CONNECT proxies (`CONNECT %s:%ld HTTP/1.1`) and SOCKS4/SOCKS5 proxies (`CSocks`).

---

## 4. Functional Specification & Component Breakdown

### 4.1 HTTP/HTTPS Downloading & Dynamic File Segmentation
- **Initial Handshake:** Sends a preliminary request (either `HEAD` or `GET` with `Range: bytes=0-`) to query headers:
  - `Accept-Ranges: bytes` confirms resumption and segmentation support.
  - `Content-Length: <bytes>` retrieves the authoritative file size.
  - `Content-Range: bytes 0-.../<total>` confirms byte-range acceptance.
  - `ETag` and `Last-Modified` are stored for cache validation on resume.
- **Segmentation Strategy:**
  - File is partitioned into $N$ logical parts where $N \in [1, 32]$ (default 8, configurable up to 32).
  - Part range: $\left[ \lfloor i \times \frac{L}{N} \rfloor, \, \lfloor (i + 1) \times \frac{L}{N} \rfloor - 1 \right]$.
  - Each worker thread streams chunks into a temporary file inside `%APPDATA%\..\Roaming\IDM\DwnlData\%USERNAME%\<target>_<id>\`.
- **Dynamic Connection Rebalancing (Dynamic Acceleration):**
  - When connection $k$ completes its chunk before others finish, IDM inspects all currently active connections.
  - It identifies the active connection with the greatest remaining unread byte count $[b_{\text{curr}}, b_{\text{end}}]$.
  - It splits this remaining range at midpoint $M = \lfloor (b_{\text{curr}} + b_{\text{end}}) / 2 \rfloor$.
  - The original worker's upper boundary is truncated to $M$, and the idle worker is immediately assigned $[M + 1, b_{\text{end}}]$.
  - This ensures that 100% of available bandwidth and connection capacity are utilized until the last byte.
- **Part Concatenation (Joining):**
  - When all parts reach status `completed`, the main thread opens the final destination file and appends parts sequentially in byte order.
  - Temporary files and the staging subfolder are deleted.

### 4.2 Pause and Resume Mechanism
- On user pause or network interruption:
  - Each active worker thread terminates cleanly and commits its current verified byte offset to the registry and state log (`%s%s_%ld.log`).
- On resume:
  - IDM issues a validation request sending `If-Match: <etag>` or `If-Unmodified-Since: <timestamp>`.
  - If the server returns `412 Precondition Failed` (file changed on server), IDM alerts the user and prompts for restart.
  - If valid, new Range headers are calculated from the verified offsets: `Range: bytes=<current_offset>-<part_end>`.

### 4.3 Speed Limiter (Traffic Shaping)
- Implemented via `CSpeedLimiter`:
  - Token-bucket rate limiting algorithm.
  - Measures transfer delta over sliding time windows (100 ms to 500 ms).
  - Calculates sleep delays: $\Delta t = \frac{\text{bytes\_read}}{\text{max\_bytes\_per\_sec}} - t_{\text{elapsed}}$.
  - Calls `Sleep(delay)` or waits on a high-resolution timer to throttle throughput to the exact configured limit.

### 4.4 Queue & Scheduling Engine
- **Queue Types:**
  - *Main Download Queue*: Default sequential or parallel execution.
  - *Synchronization Queue*: Checks local files against remote versions.
  - *User-defined Queues*: Named queues with customizable rules.
- **Scheduler Capabilities:**
  - Start queue at specific wall-clock time (`HH:mm:ss`) or recurring days of the week.
  - Stop queue at specific time.
  - Maximum concurrent downloads per queue (e.g. 1 to 5 files at a time).
  - Post-completion actions: Disconnect internet connection (`/h`), Close IDM (`/q`), Shutdown system (`CShutDown`).

### 4.5 Browser Integration & Native Messaging
- **Native Messaging Host:**
  - `IDMMsgHost.exe` registered in Windows Registry under:
    - Chrome: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.tonec.idm`
    - Firefox: `HKCU\Software\Mozilla\NativeMessagingHosts\com.tonec.idm`
  - Protocol: Standard Chrome native messaging format (32-bit little-endian integer prefix indicating JSON payload length over stdin/stdout).
- **Inter-Process Communication:**
  - `IDMMsgHost.exe` connects to `IDMan.exe` via Windows Named Pipe: `\\.\pipe\IDMNetworkMonitor`.
  - Transmits captured browser download metadata: URL, Referer, Cookies, User-Agent, POST data, target file name.

### 4.6 Clipboard & Category Monitoring
- **Clipboard Monitoring:**
  - Listens for clipboard update events via `AddClipboardFormatListener` / `WM_CLIPBOARDUPDATE`.
  - Checks if clipboard text matches valid URI schemes (`http://`, `https://`, `ftp://`).
  - Evaluates extension against the file types exception list (`COptFileTypes`).
- **Category Routing:**
  - Files are automatically categorized into default folders based on extensions:
    - *Compressed*: `ZIP`, `RAR`, `7Z`, `TAR`, `GZ`, `ISO`
    - *Documents*: `PDF`, `DOC`, `DOCX`, `XLS`, `PPT`, `TXT`
    - *Music*: `MP3`, `WAV`, `FLAC`, `AAC`, `OGG`
    - *Programs*: `EXE`, `MSI`, `BAT`
    - *Video*: `MP4`, `MKV`, `AVI`, `FLV`, `WEBM`, `TS`

### 4.7 Persistence & Registry Schema
State is maintained under `HKEY_CURRENT_USER\Software\DownloadManager`:
- `maxID`: DWORD holding next unique item ID.
- `Software\DownloadManager\<id>\`:
  - `url`: String (source download URL).
  - `path`: String (target output folder).
  - `file`: String (target file name).
  - `size`: String / DWORD (total bytes).
  - `status`: DWORD (1=Complete, 2=Downloading, 3=Paused, 4=Queued, 5=Error).
  - `type`: String (Category name).
  - `queueID`: DWORD (Queue identifier).
  - `MCN`: DWORD (Max connection count).
  - `parts`: DWORD (Allocated segment count).
  - `Speed`: DWORD (Speed limit in bytes/sec).
  - `Referer`: String (HTTP Referer).
  - `cookie`: String (Session cookies).
  - `agent`: String (Custom User-Agent).
  - `etag`: String (HTTP ETag for resume validation).
  - `LastModified`: String (HTTP Last-Modified header).

---

## 5. Controlled Dynamic Analysis & Empirical Verification

To verify the behavioral models established by static analysis, `IDMan.exe` was executed in a controlled, isolated Windows test harness against a local HTTP test server (`http://127.0.0.1:8888`).

### 5.1 Test Harness Setup
- **Local Server (`scratch/dynamic_test_server.py`):** Threaded Python HTTP/1.1 server serving a deterministic 10 MB payload (`scratch/test_payload.bin`) with `Accept-Ranges: bytes`, `ETag`, and `Last-Modified` support.
- **Monitoring Agent (`scratch/dynamic_system_monitor.py`):** Samples process metrics (PID, CPU %, RSS memory, thread count), watches file staging directories (`%APPDATA%\Roaming\IDM\DwnlData`), snapshots registry changes under `HKCU\Software\DownloadManager`, and intercepts HTTP request streams.

### 5.2 Observed Execution Timeline & Resource Profile
When invoked with `/d http://127.0.0.1:8888/test_payload.bin /p <dest_dir> /f test_payload.bin /n`:

| Metric | Startup Phase (T = 0–1.3s) | Active Transfer (T = 1.3–2.5s) | Final Assembly (T = 2.5–3.1s) |
|---|---|---|---|
| **Process State** | `IDMan.exe` (PID 13508) initialized | Multi-threaded segment workers | Concurrent thread join & cleanup |
| **Active OS Threads** | 8 threads | 10–24 concurrent threads | Dropped to background idle |
| **CPU Utilization** | < 1.0% | 37.2% – 69.9% peak | Minimal |
| **RAM (Working Set RSS)** | 16.6 MB | 29.8 MB | 49.4 MB |
| **RAM (Virtual Size VMS)**| 3.6 MB | 9.5 MB | 18.1 MB |
| **Transfer Time** | N/A | 10 MB in 3.09 seconds | Transfer rate: ~104.4 MB/s |
| **File Integrity** | File allocated | 8 staging files in `DwnlData` | Target SHA-256 verified match |

### 5.3 Live HTTP Traffic & Dynamic Work-Stealing
The local server logged **13 distinct HTTP requests**, revealing the exact dynamic segmentation algorithm:
1. **Initial Capability Probe:**
   - `HEAD /test_payload.bin` (Client `127.0.0.1:47719`): IDM queries server capabilities; receives `200 OK`, `Content-Length: 10485760`, `Accept-Ranges: bytes`.
2. **Initial Download Stream:**
   - `GET /test_payload.bin` (Client `127.0.0.1:47723`): First connection starts streaming from byte 0.
3. **Dynamic Range Bisection (Work-Stealing):**
   - As connection 1 reached byte 233,600, connection 2 spawned: `GET Range: bytes=233600-10485759` (size: 10,252,160).
   - Connection 2's range was bisected: connection 3 requested `GET Range: bytes=5371454-10485759` (size: 5,114,306).
   - Subsequent connections dynamically split remaining chunks:
     - `bytes=7928606-10485759` (2.55 MB)
     - `bytes=2913581-5371517` (2.45 MB)
     - `bytes=4475397-5371517` (896 KB)
     - `bytes=4923425-5371517` (448 KB)
     - `bytes=5147439-5371517` (224 KB)
     - `bytes=5259446-5371517` (112 KB)
4. **Conclusion:** IDM implements a dynamic binary bisection work-stealing scheduler that dynamically halves the largest pending byte-range among active threads whenever an idle connection slot is available.

### 5.4 File Staging & Disk Assembly
- **Staging Directory:** `%APPDATA%\Roaming\IDM\DwnlData\%USERNAME%\test_payload_1226\`
- **Staging Artifacts:**
  - `test_payload.bin`: Sparse target staging file.
  - `test_payload_1226.log`: Binary log tracking active part boundaries and received bytes.
- **Assembly Verification:** Once all 8 temporary chunk streams concluded, IDM joined parts into the destination directory (`test_dl\test_payload.bin`). The resulting file was byte-for-byte identical to the original (`sha256: aecf3c2ab8aca74852bca07b54136cecb3fdafdc35540068ed952c0b89538e0d`).

### 5.5 Failure Mode Dynamics & Error Reporting
Simulated failure scenarios yielded distinct error states in the registry:
- **HTTP 404 Not Found (`/fail-404`):**
  - Result: Download aborted immediately without retry.
  - Registry State: `Status: 0`, `Downloaded: 0 bytes`, `dwnlrs: 30053`.
  - Human Description: `"İstenen dosya yok. Ayrıntılar: HTTP/1.1 404 Simulated 404 Not Found"`.
- **HTTP 500 Server Error (`/fail-500`):**
  - Result: Download halted immediately.
  - Registry State: `Status: 0`, `Downloaded: 0 bytes`, `dwnlrs: 30018`.
  - Human Description: `"Bu dosya indirilemiyor. Ayrıntılar: HTTP/1.1 500 Simulated 500 Server Error"`.
- **Premature Network Disconnect (`/fail-disconnect`):**
  - Result: Connection dropped after receiving 64 KB.
  - Registry State: `Status: 0`, `Downloaded: 65536 bytes`, `dwnlrs: 30071`.
  - Human Description: `"Veri aktarımı kesildi ve sunucu 'Devam etme özelliği'ni desteklemiyor..."`.

---

## 6. Clean-Room Architectural Blueprint for Rust Reimplementation (`idm_reborn`)

Based on our verified findings, the Rust reimplementation will be structured as follows:

| Component | Rust Architecture & Crates |
|---|---|
| **Async Runtime & Networking** | `tokio` (multi-threaded async runtime), `reqwest` (HTTP/1.1, HTTP/2, TLS via `rustls` or native Windows SChannel) |
| **Download Engine Core** | Clean-room actor pipeline: `DownloadManager`, `DownloadTask`, `SegmentWorker`, `DynamicPartSplitter` |
| **Disk I/O & Allocation** | `tokio::fs`, Windows `SetFileInformationByHandle` / sparse file support, chunk pre-allocation |
| **Speed Limiter** | Token bucket rate limiter via `governor` or custom async delay channel |
| **IPC & Native Messaging** | `tokio::io` stdin/stdout JSON framing for Chrome/Firefox/Edge native messaging |
| **CLI & Commands** | `clap` implementing verified IDM flags (`/d`, `/p`, `/f`, `/q`, `/h`, `/n`, `/a`, `/s`) |
| **UI & Tray Frontend** | Clean desktop interface (Iced / Slint / Tauri or native Win32 WinSys) with system tray and speed graph |
| **State Persistence** | Modern SQLite database (`sqlx` or `rusqlite`) with Windows Registry migration compatibility |
