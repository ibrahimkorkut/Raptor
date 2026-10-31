# PHASE 7 — IDM BEHAVIORAL COMPARISON REPORT
**Reference Target:** Internet Download Manager 6.43 Build 16 (`idman643build16.exe` / `rea-main`)  
**Evaluated Application:** Raptor Download Manager  
**Date:** October 31, 2026  

---

## 1. Architectural & Behavioral Comparison Matrix

| Capability / Feature | Internet Download Manager (IDM) | Raptor | Behavioral Parity / Decision |
|---|---|---|---|
| **Multi-Part Acceleration** | Up to 32 connections per file | Up to 32 connections per file (default 16) | **Equivalent** — Segment acceleration operates at wire speed |
| **Dynamic Segmentation** | Splits slow connections during download | Work-stealing algorithm splits slowest active segment | **Equivalent** — Tail latency prevented via chunk stealing |
| **Pause & Resume** | Persists byte ranges in temp files | SQLite transactional state + in-place sparse preallocation | **Superior** — Raptor resumes instantly without file recomposition |
| **Disk Preallocation** | Creates `.tmp` parts and concatenates | `SetFileValidData` / sparse preallocation directly to target file | **Superior** — Eliminates IDM's slow end-of-download "Rebuilding" phase |
| **Streaming Media (YouTube)** | Hooks browser multimedia sockets, requires grabber | Native `yt-dlp` integration + FFmpeg muxing | **Superior** — Downloads full 1080p/4K adaptive streams and audio |
| **Speed Limiter** | Token bucket / sleep throttling | Async non-blocking token bucket (`SpeedLimiter`) | **Equivalent** — Smooth bandwidth pacing |
| **Desktop UI Feel** | Windows Win32 GDI classic interface | Modern Windows Desktop App (Tao + Wry WebView2) | **Modernized** — Clean native look, custom dark/light theme |
| **Context Menus** | Win32 popup menus | Custom React native-styled context menus | **Equivalent** — Browser default context menu disabled |
| **Browser Extension** | `IDMGCExt.crx` (Native Messaging) | Manifest V3 Native Messaging + HTTP bridge | **Equivalent** — Intercepts downloads & session cookies |

---

## 2. Key Behavioral Alignments

1. **Elimination of the "Rebuilding File" Delay:**
   - In IDM, each connection writes into a separate temporary file (`idm*.tmp`). When all parts finish, IDM must sequentially read and append every part into the final destination. On large files (e.g. 10 GB+), this causes heavy disk I/O and freezes the UI.
   - **Raptor:** Uses in-place preallocated file writing (`write_at` with exact byte offsets). When the last chunk arrives, the file is ALREADY 100% complete and valid immediately with zero wait time.

2. **YouTube Video & Audio Merging:**
   - IDM often downloads only 720p unless integrated with specific decoders.
   - **Raptor:** Fetches highest available video stream + audio stream, automatically merging them via FFmpeg into the user's download folder.
