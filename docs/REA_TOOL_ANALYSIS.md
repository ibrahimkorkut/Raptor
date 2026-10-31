# REA (Reverse Engineer Anything) Tool and Environment Analysis

**Document Version:** 1.0.0  
**Project:** IDM REBORN — Clean-Room Internet Download Manager Rust Reimplementation  
**Target Binary Analyzed:** `idman643build16.exe` (SHA-256: `276aa7e4ff7682445b011ebe6ac3920e7eca6ece7d3f6723b1f1cb515164461b`)  
**Analyzed Environment:** Windows 11 x64, Node.js v22.23.2, Python 3.13.x, Rust 1.99.1  

---

## 1. Overview & Purpose

`rea` (**Reverse Engineer Anything**, package `rea-agents` v6.7.0) is a hybrid CLI toolkit and Model Context Protocol (MCP) server designed to inspect binaries, applications, and runtime behavior across architectures and platforms. Its primary design philosophy is to provide **evidence-based reverse engineering**, generating deterministic JSON/YAML/Markdown evidence bundles containing raw observations, derived facts, confidence levels, and explicit boundary limitations.

In this project, `rea` serves as the primary artifact classification and validation harness to establish clean-room specifications from original executables without copying proprietary code or violating licensing boundaries.

---

## 2. Architecture & Internals of `rea-main`

The toolkit is organized into modular layers:

```
rea-main/
├── scripts/
│   └── rea.mjs                 # Unified CLI and MCP entrypoint dispatcher
├── dist/                       # Compiled JavaScript runtime (ESM)
│   ├── cli-runtime/            # Command-line argument parsing and formatted output
│   ├── mcp/                    # MCP server implementation (stdio transport)
│   ├── domain/                 # Target classification, models, and evidence structures
│   ├── providers/              # Provider orchestration and discovery
│   └── windows/                # Windows-specific security, handle, and Job Object drivers
├── native/windows/build/
│   ├── manifest.json           # Cryptographic manifest and integrity descriptor
│   └── rea-windows-x64.node    # Node-API 8 C++ native addon for Win32 security
├── bridge/                     # External decompiler & instrumentation bridges
│   ├── ghidra/                 # Java bridge scripts (HeadlessScript, bundles)
│   ├── cutter/                 # Rizin/Cutter Python bridge
│   ├── hopper_bridge.py        # Hopper v4/v5 Python bridge
│   └── mitmproxy/              # Network capture bridge
├── docs/                       # Comprehensive capability and boundary documentation
└── package.json                # Defines 153 CLI commands and 207 MCP tools
```

### 2.1 The Windows Native Security Addon (`rea-windows-x64.node`)
On Windows hosts, REA enforces strict process and filesystem constraints:
- **Handle Protection & NTFS Reparse Controls:** Uses `OPEN_REPARSE_POINT` and `NtCreateFile` to prevent symlink/junction attacks.
- **Process Isolation via Windows Job Objects:** Processes are launched with `PROC_THREAD_ATTRIBUTE_JOB_LIST` into anonymous, non-inherited Job Objects with strict commit memory limits (`JOB_OBJECT_LIMIT_JOB_MEMORY`) and kill-on-close policies.
- **DACL Hardening:** Restricts private runtime directories and IPC pipes strictly to the current user token and `NT AUTHORITY\SYSTEM`.

---

## 3. Supported Commands, Arguments & Formats

### 3.1 Global Output Formatting
Every REA command supports consistent output filtering and formatting:
- `--format <json | toon | yaml | md | jsonl>`: Structured data output (defaults to human-readable or TOON).
- `--full-output`: Displays the complete evidence envelope including confidence, authority, limitations, and provenance links.
- `--filter-output <keys>`: Extracts specific JSON path keys (e.g. `subject,normalized_result.pe`).
- `--token-limit <n>` / `--token-offset <n>`: Token budgeting for AI agent contexts.

### 3.2 Key Analysis Commands
| Command | Primary Use Case | Standalone vs. Provider-Dependent |
|---|---|---|
| `inspect-artifact <path>` | Root container/PE format detection and digest verification | **Standalone** (built-in artifact graph) |
| `extract-artifact <path>` | Unpacks container archives (DMG, APK, ASAR, HAP) | **Standalone** (rejects raw PE) |
| `inspect-managed-artifact <path>` | Static PE/CLI metadata inspection (.NET) | **Standalone** (execution-free) |
| `inspect-go-binary <path>` | Extracts embedded Go runtime version, modules & build flags | **Standalone** (built-in ELF/PE parser) |
| `inspect-rust-binary <path>` | Extracts cargo-auditable dependency graph (`.dep-v0`) | **Standalone** (built-in ELF/PE parser) |
| `inspect-sqlite-database <path>` | Inspects tables, indexes, and samples from SQLite snapshots | **Standalone** (requires Node >=24) |
| `analyze <path> --provider <id>` | General binary overview, sections, imports, exports | **Requires Engine** (Ghidra, Hopper, IDA) |
| `function <path> <proc>` | Function dossier (callees, callers, stack, variables) | **Requires Engine** (Ghidra/Hopper/IDA) |
| `decompile <path> <addr>` | Generates C-like pseudocode for a given function address | **Requires Engine** (Ghidra/IDA/Kuna) |
| `instructions <path> <addr>` | Disassembles raw assembly instructions | **Requires Engine** (Ghidra/Hopper/IDA) |
| `search <path> <pattern>` | Pattern & string search across initialized memory | **Requires Engine** (Ghidra/Hopper/IDA) |
| `xrefs <path> <addr>` | Lists incoming/outgoing cross-references | **Requires Engine** (Ghidra/Hopper/IDA) |
| `capture-process` | Bounded dynamic process execution and observation | Standalone (PTY / Windows Job Object) |
| `capture-browser-scenario` | Dynamic browser interaction via Playwright | Standalone (requires Chromium) |

---

## 4. Capability Matrix for Native PE Binaries on Windows

| Analysis Dimension | REA Native Support | Required Provider / Prerequisite | Verified Workspace Status |
|---|---|---|---|
| **PE Header & Machine Detection** | Supported | Standalone (`inspect-artifact`, `inspect-managed-artifact`) | **Verified Active** (`x86 PE32`, 5 sections) |
| **Managed vs. Native Classification** | Supported | Standalone (`inspect-managed-artifact`) | **Verified Active** (Unmanaged Win32 Native) |
| **Compiler Metadata (.NET/Go/Rust)** | Supported | Standalone (`inspect-go-binary`, `inspect-rust-binary`) | **Verified Active** (Neither Go nor Rust; MSVC 2008) |
| **Deep Decompilation & CFG** | Supported | **Ghidra 12.1.x** (`GHIDRA_INSTALL_DIR`) + JDK 21+ | Configurable via Ghidra headless bridge |
| **Assembly Disassembly** | Supported | Ghidra or external disassembler | Augmented via workspace Capstone 5.0 |
| **Import / Export / Resource Tables** | Supported | Ghidra or external PE parser | Augmented via workspace `pefile` |
| **Dynamic Execution / API Monitoring** | Supported | `capture-process` / Network proxy | Standalone process sandbox available |

---

## 5. Verification on Workspace Targets

### Test 1: `idman643build16.exe` (Installer Package)
- Executed `node scripts/rea.mjs inspect-artifact ..\idman643build16.exe --format json`:
  - **Identified Format:** PE executable (`format: "pe"`).
  - **SHA-256 Digest:** `276aa7e4ff7682445b011ebe6ac3920e7eca6ece7d3f6723b1f1cb515164461b`.
  - **Size:** 12,698,904 bytes.
- Executed `node scripts/rea.mjs inspect-managed-artifact ..\idman643build16.exe --format json`:
  - **Machine:** `0x014c` (x86 32-bit PE).
  - **CLI Directory:** Absent (`status: "not-managed"`).
  - **Section Count:** 5.

### Test 2: `extracted_idm/IDMan.exe` (Core IDM Application Executable)
- Executed `node scripts/rea.mjs inspect-artifact ..\extracted_idm\IDMan.exe --format json`:
  - **Format:** PE executable (`format: "pe"`).
  - **SHA-256 Digest:** `3b5dc9ce53eb31933effa3fd973bec068a78e0f8c1d15a919b081f0c4d9325ba`.
  - **Size:** 6,490,992 bytes (~6.49 MB).
- Executed `node scripts/rea.mjs inspect-managed-artifact ..\extracted_idm\IDMan.exe --format json`:
  - Confirmed 32-bit unmanaged native C++ binary compiled with MSVC 2008 (MFC).

---

## 6. How REA Will Be Used in the Project

1. **Gatekeeper for Clean-Room Compliance:**
   - REA acts as our objective reverse engineering oracle, producing structured evidence records.
   - All reimplementation tasks will rely strictly on documented behavioural contracts, functional requirements, and protocol schemas extracted without decompiled code duplication.

2. **Integration Testing & Dynamic Capture:**
   - REA's `capture-process` and Playwright browser scenarios will be used to benchmark and verify the new Rust implementation (`idm_rebone`) against the original behavior.

3. **Hybrid Workflow:**
   - REA provides top-level evidence bundles, artifact manifests, and verification envelopes.
   - Specialized static analysis (via `pefile` and Capstone) extracts granular RTTI class layouts, string schemas, and protocol headers for architectural modeling.
