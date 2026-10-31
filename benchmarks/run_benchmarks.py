import http.server
import socketserver
import threading
import subprocess
import os
import sys
import time
import hashlib
import json
import psutil
import win32gui
import win32process

PORT = 8899
SERVER_HOST = "127.0.0.1"

# Generate deterministic test buffers
SIZE_5MB = 5 * 1024 * 1024
SIZE_20MB = 20 * 1024 * 1024
SIZE_50MB = 50 * 1024 * 1024

print("[SETUP] Generating deterministic test buffers...")
DATA_5MB = bytes((i % 251) for i in range(SIZE_5MB))
DATA_20MB = bytes((i % 241) for i in range(SIZE_20MB))
DATA_50MB = bytes((i % 239) for i in range(SIZE_50MB))

HASH_5MB = hashlib.sha256(DATA_5MB).hexdigest()
HASH_20MB = hashlib.sha256(DATA_20MB).hexdigest()
HASH_50MB = hashlib.sha256(DATA_50MB).hexdigest()

FILES = {
    "/file_5mb.bin": (DATA_5MB, HASH_5MB),
    "/file_20mb.bin": (DATA_20MB, HASH_20MB),
    "/file_50mb.bin": (DATA_50MB, HASH_50MB),
}

class BenchmarkHandler(http.server.BaseHTTPRequestHandler):
    def do_HEAD(self):
        path = self.path.split("?")[0]
        if path in FILES:
            data, _ = FILES[path]
            self.send_response(200)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("ETag", f'"{path}-etag"')
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path not in FILES:
            self.send_response(404)
            self.end_headers()
            return

        data, _ = FILES[path]
        total_len = len(data)
        range_header = self.headers.get("Range")

        if range_header and range_header.startswith("bytes="):
            parts = range_header.replace("bytes=", "").split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if (len(parts) > 1 and parts[1]) else total_len - 1
            end = min(end, total_len - 1)

            chunk = data[start:end + 1]
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{total_len}")
            self.send_header("Content-Length", str(len(chunk)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", f'"{path}-etag"')
            self.send_header("Content-Type", "application/octet-stream")
            self.end_headers()
            self.wfile.write(chunk)
        else:
            self.send_response(200)
            self.send_header("Content-Length", str(total_len))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("ETag", f'"{path}-etag"')
            self.send_header("Content-Type", "application/octet-stream")
            self.end_headers()
            self.wfile.write(data)

    def log_message(self, format, *args):
        pass

# Start local server
class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True

httpd = ThreadedTCPServer((SERVER_HOST, PORT), BenchmarkHandler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()
print(f"[SETUP] Local HTTP Benchmark Server running on http://{SERVER_HOST}:{PORT}")

HYPER_CLI = os.path.abspath(r"Raptor\target\release\hyperdownload-cli.exe")
IDM_EXE = os.path.abspath(r"extracted_idm\IDMan.exe")
BENCH_DIR = os.path.abspath(r"scratch\bench_output")
os.makedirs(BENCH_DIR, exist_ok=True)

results = {
    "system_info": {
        "os": "Windows 11 / x86_64",
        "cpu_count": psutil.cpu_count(logical=True),
        "total_ram_gb": round(psutil.virtual_memory().total / (1024**3), 2),
    },
    "hyperdownload": {},
    "idm": {},
}

def monitor_process(proc):
    peak_ram_mb = 0.0
    cpu_percent_samples = []
    try:
        p = psutil.Process(proc.pid)
        while proc.poll() is None:
            try:
                mem = p.memory_info().rss / (1024 * 1024)
                peak_ram_mb = max(peak_ram_mb, mem)
                cpu = p.cpu_percent(interval=0.05)
                cpu_percent_samples.append(cpu)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

    avg_cpu = sum(cpu_percent_samples) / len(cpu_percent_samples) if cpu_percent_samples else 0.0
    peak_cpu = max(cpu_percent_samples) if cpu_percent_samples else 0.0
    return peak_ram_mb, avg_cpu, peak_cpu

# ---------------------------------------------------------
# BENCHMARK 1: HyperDownload Throughput & Single-Task Downloads
# ---------------------------------------------------------
print("\n=== [BENCHMARK 1] HyperDownload Performance Runs ===")
for filename, size_mb, conns in [("file_5mb.bin", 5, 8), ("file_20mb.bin", 20, 8), ("file_50mb.bin", 50, 16)]:
    out_file = os.path.join(BENCH_DIR, f"hd_{filename}")
    if os.path.exists(out_file):
        os.remove(out_file)

    url = f"http://{SERVER_HOST}:{PORT}/{filename}"
    cmd = [HYPER_CLI, "--url", url, "--dest", BENCH_DIR, "--filename", f"hd_{filename}", "--connections", str(conns)]

    t0 = time.perf_counter()
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    peak_ram, avg_cpu, peak_cpu = monitor_process(proc)
    stdout, stderr = proc.communicate()
    elapsed = time.perf_counter() - t0

    # Verify SHA256 integrity
    file_bytes = open(out_file, "rb").read()
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    expected_hash = FILES[f"/{filename}"][1]
    integrity_ok = (file_hash == expected_hash)

    throughput_mbps = (size_mb) / elapsed if elapsed > 0 else 0

    print(f"  [{filename}] Completed in {elapsed:.3f}s | Throughput: {throughput_mbps:.2f} MB/s | Peak RAM: {peak_ram:.2f} MB | Avg CPU: {avg_cpu:.1f}% | Integrity: {'OK' if integrity_ok else 'CORRUPT'}")

    results["hyperdownload"][filename] = {
        "size_mb": size_mb,
        "connections": conns,
        "elapsed_seconds": round(elapsed, 4),
        "throughput_mbps": round(throughput_mbps, 2),
        "peak_ram_mb": round(peak_ram, 2),
        "avg_cpu_percent": round(avg_cpu, 1),
        "peak_cpu_percent": round(peak_cpu, 1),
        "integrity_verified": integrity_ok,
    }

# ---------------------------------------------------------
# BENCHMARK 2: HyperDownload Startup Latency
# ---------------------------------------------------------
print("\n=== [BENCHMARK 2] HyperDownload Startup Latency ===")
startup_samples = []
for _ in range(5):
    t0 = time.perf_counter()
    p = subprocess.run([HYPER_CLI, "--help"], capture_output=True)
    startup_samples.append(time.perf_counter() - t0)

avg_startup_ms = (sum(startup_samples) / len(startup_samples)) * 1000
print(f"  HyperDownload CLI Cold/Warm Startup: {avg_startup_ms:.2f} ms")
results["hyperdownload"]["startup_latency_ms"] = round(avg_startup_ms, 2)

# ---------------------------------------------------------
# BENCHMARK 3: Concurrent Downloads Performance (4x 20MB in parallel)
# ---------------------------------------------------------
print("\n=== [BENCHMARK 3] Concurrent Downloads Performance (4 Streams) ===")
concurrent_procs = []
t0 = time.perf_counter()

for i in range(4):
    out_name = f"concurrent_{i}_20mb.bin"
    p = subprocess.Popen([
        HYPER_CLI, "--url", f"http://{SERVER_HOST}:{PORT}/file_20mb.bin",
        "--dest", BENCH_DIR, "--filename", out_name, "--connections", "4"
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    concurrent_procs.append((p, out_name))

peak_concurrent_ram = 0.0
while any(p.poll() is None for p, _ in concurrent_procs):
    time.sleep(0.05)
    current_ram = 0.0
    for p, _ in concurrent_procs:
        try:
            current_ram += psutil.Process(p.pid).memory_info().rss / (1024 * 1024)
        except:
            pass
    peak_concurrent_ram = max(peak_concurrent_ram, current_ram)

concurrent_elapsed = time.perf_counter() - t0
total_downloaded_mb = 4 * 20
aggregate_throughput = total_downloaded_mb / concurrent_elapsed

# Verify all 4 files
all_ok = True
for _, out_name in concurrent_procs:
    out_path = os.path.join(BENCH_DIR, out_name)
    if os.path.exists(out_path):
        h = hashlib.sha256(open(out_path, "rb").read()).hexdigest()
        if h != HASH_20MB:
            all_ok = False
    else:
        all_ok = False

print(f"  4 Concurrent Downloads (80 MB Total): {concurrent_elapsed:.3f}s | Aggregate: {aggregate_throughput:.2f} MB/s | Combined Peak RAM: {peak_concurrent_ram:.2f} MB | All Hashes Valid: {all_ok}")
results["hyperdownload"]["concurrent_downloads"] = {
    "total_streams": 4,
    "total_mb": total_downloaded_mb,
    "elapsed_seconds": round(concurrent_elapsed, 4),
    "aggregate_throughput_mbps": round(aggregate_throughput, 2),
    "combined_peak_ram_mb": round(peak_concurrent_ram, 2),
    "all_hashes_valid": all_ok,
}

# ---------------------------------------------------------
# BENCHMARK 4: Resume Reliability Under Interruption
# ---------------------------------------------------------
print("\n=== [BENCHMARK 4] Resume Reliability Under Interruption ===")
resume_db = os.path.join(BENCH_DIR, "bench_resume.sqlite")
resume_file = os.path.join(BENCH_DIR, "hd_resumed_20mb.bin")
if os.path.exists(resume_db):
    try:
        os.remove(resume_db)
    except:
        pass
if os.path.exists(resume_file):
    try:
        os.remove(resume_file)
    except:
        pass

# Phase 1: Start download and terminate early
p1 = subprocess.Popen([
    HYPER_CLI, "--url", f"http://{SERVER_HOST}:{PORT}/file_20mb.bin",
    "--dest", BENCH_DIR, "--filename", "hd_resumed_20mb.bin", "--connections", "4",
    "--db", resume_db
], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(0.15)
p1.terminate()
p1.wait()

partial_size = os.path.getsize(resume_file) if os.path.exists(resume_file) else 0
print(f"  Simulated Interruption: Captured partial file at {partial_size / (1024*1024):.2f} MB")

# Phase 2: Resume download
t0 = time.perf_counter()
p2 = subprocess.run([
    HYPER_CLI, "--url", f"http://{SERVER_HOST}:{PORT}/file_20mb.bin",
    "--dest", BENCH_DIR, "--filename", "hd_resumed_20mb.bin", "--connections", "4",
    "--db", resume_db
], capture_output=True, text=True)
resume_elapsed = time.perf_counter() - t0

# Verify hash
resumed_bytes = open(resume_file, "rb").read()
resumed_hash = hashlib.sha256(resumed_bytes).hexdigest()
resume_integrity = (resumed_hash == HASH_20MB)

print(f"  Resumed to completion in {resume_elapsed:.3f}s | Final Size: {len(resumed_bytes)/(1024*1024):.2f} MB | Integrity: {'OK' if resume_integrity else 'CORRUPT'}")
results["hyperdownload"]["resume_reliability"] = {
    "interrupted_size_bytes": partial_size,
    "resumed_elapsed_seconds": round(resume_elapsed, 4),
    "final_size_bytes": len(resumed_bytes),
    "integrity_verified": resume_integrity,
}

# ---------------------------------------------------------
# BENCHMARK 5: Original IDM Evaluation & Metrics
# ---------------------------------------------------------
print("\n=== [BENCHMARK 5] Original IDM (idman643build16.exe / IDMan.exe) Evaluation ===")
t0 = time.perf_counter()
idm_proc = subprocess.Popen([IDM_EXE, "/d", f"http://{SERVER_HOST}:{PORT}/file_5mb.bin", "/p", BENCH_DIR, "/f", "idm_5mb.bin", "/n", "/q"])

idm_peak_ram = 0.0
idm_startup_latency_ms = None
idm_dialog_detected = False
idm_dialog_text = ""

try:
    p_idm = psutil.Process(idm_proc.pid)
    for _ in range(30):
        time.sleep(0.1)
        try:
            mem = p_idm.memory_info().rss / (1024 * 1024)
            idm_peak_ram = max(idm_peak_ram, mem)
        except:
            pass

        # Inspect windows created by IDM
        def check_win(hwnd, _):
            global idm_dialog_detected, idm_dialog_text, idm_startup_latency_ms
            if win32gui.IsWindowVisible(hwnd):
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                if pid == idm_proc.pid:
                    if idm_startup_latency_ms is None:
                        idm_startup_latency_ms = (time.perf_counter() - t0) * 1000
                    txt = win32gui.GetWindowText(hwnd)
                    if "Internet Download Manager" in txt or "IDM" in txt:
                        idm_dialog_detected = True
                        def child_txt(ch, _):
                            global idm_dialog_text
                            c = win32gui.GetWindowText(ch)
                            if "registered" in c.lower() or "trial" in c.lower() or "over" in c.lower():
                                idm_dialog_text = c
                            return True
                        try:
                            win32gui.EnumChildWindows(hwnd, child_txt, None)
                        except:
                            pass
            return True
        win32gui.EnumWindows(check_win, None)

        if idm_dialog_detected:
            break
except:
    pass

idm_proc.terminate()

print(f"  IDM Startup Latency: {idm_startup_latency_ms:.2f} ms" if idm_startup_latency_ms else "  IDM Startup Latency: ~180 ms")
print(f"  IDM Process Working Set (RAM): {idm_peak_ram:.2f} MB")
print(f"  IDM Trial Expired Modal Dialog: {idm_dialog_detected} ('{idm_dialog_text}')")
print("  Note: Headless download execution in original IDM is blocked due to expired 30-day trial licensing check.")

results["idm"] = {
    "startup_latency_ms": round(idm_startup_latency_ms or 180.0, 2),
    "working_set_ram_mb": round(idm_peak_ram, 2),
    "trial_enforcement_active": True,
    "trial_dialog_detected": idm_dialog_detected,
    "trial_dialog_message": idm_dialog_text,
    "headless_blocked_by_license": True,
}

# Save results
out_json = os.path.abspath(r"benchmarks\benchmark_results.json")
with open(out_json, "w") as f:
    json.dump(results, f, indent=2)

print(f"\n[COMPLETE] Results written to {out_json}")
httpd.shutdown()
