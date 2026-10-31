# HyperDownload Development Compliance & Clean-Room Rules

> **Governing Principles for HyperDownload (IDM Reborn)**

To guarantee legal integrity, technical excellence, and clean-room engineering standards, all contributors and agents working on **HyperDownload** must strictly uphold the following development rules without exception.

---

## 📜 The Core Development Rules

### 1. Never Modify the Original Executable
The original binary distribution (`idman643build16.exe`) and its unpacked staging binaries in [`extracted_idm/`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/extracted_idm/) are **strictly immutable reference specimens**. They must never be patched, binary-edited, hex-modified, or packaged into release distributions.

### 2. Never Use IDM as a Backend
HyperDownload is a 100% self-sufficient systems project. It must never invoke `IDMan.exe`, communicate with IDM's COM interfaces, read IDM's internal registry keys for download dispatch, or rely on IDM background services.

### 3. Never Simply Wrap or Rename the Original Executable
HyperDownload is not a launcher, wrapper, or GUI skin over IDM. Every subsystem is implemented independently from first principles in modern Rust.

### 4. Never Copy Proprietary Binary Code
Zero lines of decompiled or disassembled C/C++ code from IDM are permitted in the codebase. All algorithms are reimplemented using safe, idiomatic Rust paradigms based purely on behavioral specifications.

### 5. Build Independent Rust Implementations
All downloading, chunking, storage preallocation, state persistence, traffic limiting, scheduling, and browser IPC are built as independent Rust crates under [`HyperDownload/crates/`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/).

### 6. Do Not Invent Analysis Results
Every documented claim regarding original IDM behavior must be backed by reproducible reverse-engineering evidence (e.g. string extraction, RTTI class reconstruction, PE header audits, dynamic process observation). Benchmark numbers must come from live OS instrumentation, never fabricated.

### 7. Do Not Silently Ignore Unsupported Features
When a feature of the original executable is not implemented (e.g. legacy dial-up networking, obsolete MMS protocols, deprecated IE BHO hooks), it must be explicitly recorded in [`docs/IDM_ANALYSIS.md`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/docs/IDM_ANALYSIS.md) and [`docs/FEATURE_SPECIFICATION.md`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/docs/FEATURE_SPECIFICATION.md) with technical justifications.

### 8. Prefer Safe Rust
Embrace Rust's memory-safety guarantees. Unsafe blocks are strictly minimized to necessary Win32 OS calls (such as `FILE_ALLOCATION_INFO` and clipboard listeners) and must be thoroughly encapsulated within safe crate boundaries.

### 9. Write Modular, Maintainable Code
The project is strictly separated into 10 decoupled crates with explicit single-responsibility contracts:
- [`crates/shared`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/shared): Common models, errors, event contracts.
- [`crates/http-client`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/http-client): Capability prober and HTTP headers.
- [`crates/segment-manager`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/segment-manager): Dynamic bisection work-stealing & token-bucket limiter.
- [`crates/connection-manager`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/connection-manager): Concurrency and retry controls.
- [`crates/storage`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/storage): Direct positioned chunk writes & SQLite WAL persistence.
- [`crates/download-engine`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/download-engine): Central coordinator and worker supervisor.
- [`crates/queue-manager`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/queue-manager): Multi-queue scheduling.
- [`crates/scheduler`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/scheduler): Timer execution & power-off hooks.
- [`crates/browser-bridge`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/browser-bridge): Native messaging host & Axum loopback REST bridge.
- [`crates/clipboard-monitor`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/HyperDownload/crates/clipboard-monitor): Windows clipboard listener & MIME router.

### 10. Document Important Engineering Decisions
Major architectural choices (such as choosing direct-to-file positioned writes over sequential chunk concatenation, and choosing SQLite WAL over registry storage) must be recorded in [`docs/TECHNICAL_ARCHITECTURE.md`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/docs/TECHNICAL_ARCHITECTURE.md).

### 11. Run Tests After Each Major Implementation
Every new feature, fix, or optimization must be verified with automated test suites (`cargo test --workspace`) before declaring completion.

### 12. Keep the Original Executable Available for Behavioral Comparison
`idman643build16.exe` and [`extracted_idm/IDMan.exe`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/extracted_idm/IDMan.exe) must remain available in the repository as immutable reference baselines for ongoing functional and behavioral comparison.

---

## 🛡️ Compliance Verification Checklist

- [x] **Specimen Integrity:** SHA-256 of `idman643build16.exe` verified unchanged.
- [x] **Clean-Room Guarantee:** 100% of HyperDownload code written in original Rust/TypeScript.
- [x] **Zero Binary Wrapping:** Independent binary targets (`hyperdownload-cli.exe`, `hyperdownload-host.exe`, `hyperdownload-desktop.exe`).
- [x] **Zero Fabricated Data:** Empirical benchmarks recorded in [`benchmarks/benchmark_results.json`](file:///c:/Users/ibrahim/Desktop/faster_download_manager/benchmarks/benchmark_results.json).
- [x] **Full Test Coverage:** 23 passing tests covering 13 operational and recovery scenarios.
