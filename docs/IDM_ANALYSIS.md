# Complete Architectural & Reverse Engineering Analysis of Internet Download Manager (IDM)

**Document Version:** 1.0.0  
**Project:** IDM REBORN — Clean-Room Functional Reimplementation in Rust  
**Subject Binary:** `idman643build16.exe` (Installer) & `IDMan.exe` (Extracted Executable)  
**Binary Version:** 6.43 Build 16 (6.43.16.2)  
**Methodology:** Clean-Room Static Disassembly, RTTI Reconstruction, Dynamic Loopback Tracing, Registry Auditing  

---

## 1. Original Application Architecture

Internet Download Manager (IDM) is built as a modular Windows desktop suite designed around a central Win32/MFC executable coordinating helper processes, browser native messaging hosts, shell extensions, and optional kernel-level packet filter drivers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER SUBSYSTEM                               │
│  Chrome / Firefox / Edge Extensions (IDMGCExt, idmmzcc, IDMEdgeExt)        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Stdio Native Messaging (Length-prefixed JSON)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    IDMMsgHost.exe (Native Messaging Host)                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Windows Named Pipe: \\.\pipe\IDMNetworkMonitor
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                         IDMan.exe (Core Application)                         │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────┐ │
│  │     CDownloaderApp     │  │     CDownloaderDlg     │  │ CDownloadQueue │ │
│  └───────────┬────────────┘  └────────────────────────┘  └───────┬────────┘ │
│              │                                                   │          │
│              ▼                                                   ▼          │
│  ┌────────────────────────┐                           ┌───────────────────┐ │
│  │    CDownload Task      │◄──────────────────────────┤   CQueuesArray    │ │
│  │  ┌───────────────────┐ │                           └───────────────────┘ │
│  │  │ CFilePart Workers │ │                                                 │
│  │  └─────────┬─────────┘ │                                                 │
│  │            ▼           │                                                 │
│  │  ┌───────────────────┐ │                                                 │
│  │  │   CSpeedLimiter   │ │                                                 │
│  │  └───────────────────┘ │                                                 │
│  │            ▼           │                                                 │
│  │  ┌───────────────────┐ │                                                 │
│  │  │  HTTPConnection   │ │                                                 │
│  │  └─────────┬─────────┘ │                                                 │
│  └────────────┼───────────┘                                                 │
└───────────────┼─────────────────────────────────────────────────────────────┘
                │
                ├──► OpenSSL (libcrypto.dll / libssl.dll) ──► HTTPS Wire
                ├──► Win32 File API (SetFilePointerEx) ──────► Disk Preallocation
                └──► Win32 Registry (Advapi32.dll) ──────────► HKCU\Software\DownloadManager
```

### Component Breakdown
1. **`IDMan.exe` (Core Process):** 32-bit GUI executable compiled with Microsoft Visual Studio 2008 (MSVC 9.0) using Microsoft Foundation Classes (MFC). Serves as UI controller, scheduler, state keeper, and download orchestrator.
2. **`IDMMsgHost.exe` (Browser Bridge):** Lightweight command-line utility invoked by Chrome, Firefox, or Edge. Implements the Chromium Native Messaging protocol over stdio and forwards intercepted download tasks to `IDMan.exe` via named pipes.
3. **`idmBroker.exe` (Privilege/Elevation Broker):** Medium-integrity helper process used to negotiate elevation when integrating with protected system components or browser installations.
4. **`IDMNetMon.dll` / `IDMNetMon64.dll` & `idmwfp32.sys` / `idmwfp64.sys`:** Network monitoring library and Windows Filtering Platform (WFP) kernel drivers used to sniff and intercept HTTP streams directly from network sockets.
5. **`libcrypto.dll` & `libssl.dll`:** Packaged OpenSSL dynamic runtime used for TLS/HTTPS handshakes and encrypted transfer pipelines.
6. **`IDMVMPrs.dll` & `idmvconv.dll`:** Video parser and remuxer engine capable of parsing HLS (`.m3u8`) playlists and MPEG-DASH (`.mpd`) segment indexes, joining fragments into standard MP4 containers.

---

## 2. Binary Analysis Findings

### 2.1 File Characteristics & Section Anatomy
- **Installer Container (`idman643build16.exe`):**
  - Size: 12,698,904 bytes (~12.7 MB)
  - SHA-256: `276aa7e4ff7682445b011ebe6ac3920e7eca6ece7d3f6723b1f1cb515164461b`
  - PE Size: 110,592 bytes (stub executable)
  - Overlay Size: 12,603,672 bytes starting at offset `0x00017400`
  - Overlay Structure: Proprietary sequential archive containing 191 component files compressed with zlib. Each stream consists of:
    `[UncompressedSize: u32][CompressedSize: u32][FILETIMEs: 24 bytes][ZlibCompressedStream]`
- **Main Executable (`IDMan.exe`):**
  - Size: 6,490,992 bytes (~6.49 MB)
  - SHA-256: `3b5dc9ce53eb31933effa3fd973bec068a78e0f8c1d15a919b081f0c4d9325ba`
  - Machine: `0x014c` (x86 32-bit PE)
  - Subsystem: `0x0002` (Windows GUI)
  - Image Base: `0x00400000`
  - Entry Point: RVA `0x0027f37c` (VA `0x0067f37c`)
  - Subsystem Version: 5.0 (Windows 2000 compatibility)
  - PDB Symbol Path: `s:\IDM_projects\IDM_vs2008_2\Release\IDMan.pdb`
  - Authenticode Signature: WinCertificate directory at offset `0x0062e200` (10,608 bytes)

### 2.2 Section Headers (`IDMan.exe`)
| Section | Virtual Address | Virtual Size | Raw Size | Entropy | Characteristics | Purpose |
|---|---|---|---|---|---|---|
| `.text` | `0x00001000` | `0x002d068c` | `0x002d0800` | 6.60 | `0x60000020` | Executable machine code |
| `.rdata`| `0x002d2000` | `0x000eb7aa` | `0x000eb800` | 5.18 | `0x40000040` | Read-only data, IAT, RTTI |
| `.data` | `0x003be000` | `0x0001407c` | `0x0000a800` | 5.46 | `0xc0000040` | Initialized global variables |
| `.rsrc` | `0x003d3000` | `0x0022d738` | `0x0022d800` | 5.50 | `0x40000040` | Dialogs, menus, icons, bitmaps |
| `.reloc`| `0x00601000` | `0x00039c78` | `0x00039e00` | 6.10 | `0x42000040` | Relocation table for ASLR |

---

## 3. Important Functions & Object Model

Analysis of MSVC RTTI structures revealed **449 C++ classes**. The primary functional classes and their responsibilities are:

| Class Name | Namespace / Base | Functional Responsibility |
|---|---|---|
| `CDownloaderApp` | `CWinApp` | Main application lifecycle, single-instance mutex initialization, command-line routing |
| `CDownloaderDlg` | `CDialog` | Primary window dialog, list control rendering, speed graphs, menu dispatch |
| `CDownload` | `CObject` | Central download entity containing state, metadata, transfer stats, and part lists |
| `CFilePart` | `CObject` | Worker unit managing a single connection, byte range, staging file, and stream read loop |
| `CDownloadQueue` | `CObject` | Queue coordinator managing active downloads, queue order, limits, and completion actions |
| `CQueuesArray` | `CArray` | Container managing multiple named queues (Main Queue, Synchronization Queue, Custom) |
| `CSpeedLimiter` | `CObject` | Traffic shaper enforcing transfer rate limits via token-bucket delay calculations |
| `CMaxConnNumbers` | `CObject` | Host connection throttling manager tracking per-domain concurrency limits (`MCN`) |
| `HTTPConnection` | `Connection` | HTTP/HTTPS socket handler, header serializer, chunked transfer reader, keep-alive pool |
| `HTTPSession` | `CObject` | Higher-level session state managing cookies, authentication headers, and redirects |
| `FTPConnection` | `Connection` | FTP client supporting active and passive (`PASV`) data channels and resume commands |
| `CSocks` | `CObject` | SOCKS4/SOCKS5 proxy client supporting authentication and upstream tunnel negotiation |
| `CInetConnector` | `CObject` | DNS resolution and connection establishing worker with timeout fallback |
| `CM3UParser` | `CObject` | HLS video manifest parser evaluating master playlists, variants, and segment URLs |
| `CSidxParser` | `CObject` | MPEG-DASH Index parser extracting byte ranges for chunked media streams |
| `CShutDown` | `CObject` | System power manager executing sleep, hibernate, or shutdown upon queue completion |

---

## 4. Windows API Usage Patterns

### 4.1 Storage & File Management
- **Disk Space Preallocation:** Upon receiving `Content-Length`, IDM issues:
  ```c
  HANDLE hFile = CreateFileW(stagingPath, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
  LARGE_INTEGER liSize;
  liSize.QuadPart = totalFileSize;
  SetFilePointerEx(hFile, liSize, NULL, FILE_BEGIN);
  SetEndOfFile(hFile);
  ```
  *Benefit:* Physically allocates contiguous disk clusters upfront, preventing drive fragmentation during concurrent multi-part writes.
- **Direct Segment Writing:** Worker threads write received packets using `WriteFile`. Memory-mapped files (`CreateFileMappingA`, `MapViewOfFile`) are selectively utilized for fast in-memory assembly of small segments.
- **Atomic Renaming:** Once all parts are joined, the finished file is moved to its destination folder via `MoveFileExW` with `MOVEFILE_COPY_ALLOWED | MOVEFILE_REPLACE_EXISTING`.

### 4.2 Threading & Concurrency Synchronization
- **Thread Spawning:** Uses `CreateThread` for download part workers rather than the Windows Thread Pool, giving IDM direct control over thread priorities via `SetThreadPriority`.
- **Critical Sections:** Uses `InitializeCriticalSectionAndSpinCount` with high spin counts on memory buffers to minimize expensive kernel transition context switches.
- **Event Signaling:** Worker completion and pause requests communicate with the main coordinator thread via `CreateEventW`, `SetEvent`, and `WaitForSingleObject` / `WaitForMultipleObjects`.

### 4.3 Dynamic API Resolution
To avoid static import dependencies and evade aggressive security hooks:
- Network libraries (`ws2_32.dll`) and OpenSSL modules (`libcrypto.dll`, `libssl.dll`) are loaded dynamically at runtime via `LoadLibraryA` / `GetProcAddress`.
- Windows Registry interactions use direct `Advapi32.dll` calls (`RegOpenKeyExA`, `RegQueryValueExA`, `RegSetValueExA`, `RegCreateKeyExA`).

---

## 5. Networking Architecture

### 5.1 Protocol Support
- **HTTP/1.0 & HTTP/1.1:** Full support for persistent connections (`Connection: keep-alive`), range requests (`Range: bytes=start-end`), and chunked transfer decoding (`Transfer-Encoding: chunked`).
- **HTTPS:** Managed via bundled OpenSSL runtime calling `SSL_CTX_new`, `SSL_new`, `SSL_connect`, `SSL_read`, and `SSL_write`.
- **Proxy Protocols:**
  - HTTP Proxy: Supports `CONNECT host:port HTTP/1.1` tunneling for HTTPS.
  - SOCKS4 / SOCKS4A / SOCKS5: Authenticated socket proxies (`CSocks`).
  - Automatic Proxy Configuration: Parses PAC (Proxy Auto-Config) scripts via `ProxyPac` helper routines.

### 5.2 Header Management
IDM serializes requests with full browser fidelity:
- User-Agent emulation (`Mozilla/5.0 ...`).
- Referer and Cookie preservation from browser interceptions.
- Explicit Range headers for segments: `Range: bytes=%I64d-%I64d`.

---

## 6. Download Segmentation & Dynamic Acceleration

### 6.1 Range Verification Handshake
1. Sends an initial `HEAD` or preliminary `GET` request.
2. Checks response headers:
   - `Accept-Ranges: bytes` or `Content-Range` confirms range support.
   - `Content-Length` indicates file size. If missing, IDM falls back to a single unsegmented connection.
   - `ETag` and `Last-Modified` are cached to guard against remote file mutation.

### 6.2 Dynamic Binary Bisection (Work-Stealing)
Empirical dynamic testing on `127.0.0.1:8888` revealed the exact segmentation algorithm:
1. **Initial Partitioning:** The file is divided into initial logical chunks based on the configured maximum connection number $N$ ($N \in [1, 32]$, default 8).
2. **Work-Stealing Acceleration:**
   - Instead of static pre-allocated blocks, worker threads dynamically steal bytes from slower connections.
   - When Connection $A$ completes its assigned range while Connection $B$ is still transferring a large byte range $[b_{\text{curr}}, b_{\text{end}}]$, IDM computes the midpoint:
     $$M = \left\lfloor \frac{b_{\text{curr}} + b_{\text{end}}}{2} \right\rfloor$$
   - Connection $B$'s ceiling is truncated to $M$.
   - Idle Connection $A$ immediately issues a request for:
     ```http
     GET /file HTTP/1.1
     Range: bytes=(M + 1)-b_end
     ```
   - This ensures 100% of available network connection slots remain saturated until the final byte is downloaded.

### 6.3 Staging Directory & Joining
- Chunks are written into temporary staging files in:
  `%APPDATA%\Roaming\IDM\DwnlData\%USERNAME%\<filename>_<id>\`
- An accompaniment state file (`<filename>_<id>.log`) records active part offsets.
- When all threads complete, IDM opens the primary file and appends parts sequentially.

---

## 7. Resume & Pause Implementation

- **On Pause:**
  1. Signals worker threads to halt socket reads via synchronization events.
  2. Workers flush pending buffers and write current confirmed byte offsets to the registry (`HKCU\Software\DownloadManager\<id>\Downloaded`) and the log file.
  3. Sockets are gracefully closed.
- **On Resume:**
  1. Issues validation request:
     ```http
     GET /file HTTP/1.1
     Range: bytes=0-0
     If-Match: "etag_value"
     If-Unmodified-Since: Wed, 21 Oct 2026 07:28:00 GMT
     ```
  2. If the server returns `412 Precondition Failed` or `200 OK` (ignoring Range), IDM warns the user that the remote file has changed.
  3. If valid (`206 Partial Content`), resumes each uncompleted segment starting at `current_offset`:
     `Range: bytes=current_offset-part_end`.

---

## 8. Queue Management & Scheduling

- **Queue Architecture:**
  - `CQueuesArray` holds definitions for `Queue 0` (Main Queue), `Queue 1` (Synchronization Queue), and custom user-created queues.
  - Each queue maintains an ordered list of download item IDs (`queueID`).
- **Concurrency Bounds:**
  - Configurable maximum simultaneous downloads per queue (default 1). Subsequent files wait in `Queued` state until an active download finishes.
- **Scheduler Timers:**
  - Uses Windows multimedia timers (`timeSetEvent`) or standard window timers (`SetTimer`) to evaluate scheduled start and stop times.
  - Supports periodic schedules (daily, weekdays, specific times).
- **Completion Triggers:**
  - Disconnect modem / network (`/h`).
  - Close IDM application (`/q`).
  - Execute system shutdown / sleep via `InitiateSystemShutdownExW` or `SetSystemPowerState`.

---

## 9. Browser Integration & IPC

- **Native Messaging Integration:**
  - Registered under `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.tonec.idm` and `HKCU\Software\Mozilla\NativeMessagingHosts\com.tonec.idm`.
  - Chromium/Firefox spawn `IDMMsgHost.exe`.
  - Communication protocol: Standard 4-byte little-endian message length prefix followed by UTF-8 JSON.
- **Inter-Process Communication:**
  - `IDMMsgHost.exe` connects to `IDMan.exe` using the Windows Named Pipe:
    `\\.\pipe\IDMNetworkMonitor`
  - Transmits captured link data: target URL, HTTP Referer, Cookies, User-Agent, POST payload, and browser window handle.

---

## 10. Error Handling & Internal State Codes

Empirical dynamic testing mapped IDM's internal error taxonomy:

| Scenario | Server Response | IDM Internal Code (`dwnlrs`) | Registry Status | Observed Behavior |
|---|---|---|---|---|
| **Resource Missing** | `HTTP 404 Not Found` | `30053` | `0` (Error) | Halts immediately without retrying; displays error dialog with server headers. |
| **Server Crash** | `HTTP 500 Server Error` | `30018` | `0` (Error) | Halts transfer; logs server error details. |
| **Premature Disconnect** | Socket drop after partial transfer | `30071` | `0` (Error) | Records bytes transferred; halts if server lacks `Accept-Ranges`. |
| **Socket Timeout** | No packet response | Internal timer | `0` (Error) | Automatically retries up to configured retry limit (default 10 retries). |

---

## 11. Confirmed Findings vs. Assumptions

| Feature / Mechanism | Initial Assumption | Confirmed Finding |
|---|---|---|
| **Installer Format** | Standard Inno Setup or NSIS archive | **Proprietary Zlib Archive:** Uses custom 32-byte header with Windows FILETIMEs and raw zlib streams packing 191 files. |
| **Core Architecture** | Modern C++ with multi-threading | **MSVC 2008 / MFC:** 32-bit x86 C++ application using MFC classes (`CDownloaderApp`, `CDownload`). |
| **Segmentation Scheme** | Fixed-size block allocation | **Dynamic Bisection Work-Stealing:** Threads steal the upper half of the slowest running worker's remaining byte range. |
| **Disk Allocation** | Incremental file growth | **Immediate Preallocation:** Uses `SetFilePointerEx` + `SetEndOfFile` to reserve disk clusters before writing data. |
| **Browser IPC** | Windows WM_COPYDATA / Shared Memory | **Named Pipes:** Chrome/Firefox native messaging host bridges stdio to `\\.\pipe\IDMNetworkMonitor`. |
| **Persistence Layer** | SQLite or XML configuration | **Windows Registry:** All downloads, queues, and settings live under `HKCU\Software\DownloadManager\<id>\`. |

---

## 12. Analysis Limitations

1. **Kernel Filter Driver (`idmwfp.sys`):** Kernel driver inspection was restricted to metadata analysis. Full driver reversing was omitted as clean-room Rust implementation relies on modern application-level browser integration rather than custom kernel network drivers.
2. **Proprietary Registration Validation:** Trial evaluation routines and licensing algorithms were intentionally excluded to preserve clean-room legal integrity.
3. **Legacy Protocols (MMS / RTSP):** While RTTI references `MMSConnection` and `RTMPConnection`, modern reimplementation will focus on HTTP/1.1, HTTP/2, HTTP/3, and HTTPS.
