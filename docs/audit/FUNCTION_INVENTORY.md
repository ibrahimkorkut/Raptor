# Raptor — Exhaustive Function Inventory

Total Functions Cataloged: **172**

| ID | Function | File | Line Range | Module | Responsibility | Status |
|---|---|---|---|---|---|---|
| `FN-0001` | `triggerDownloadToHyperDownload` | `HyperDownload/browser-extension/background.js` | 144-153 | extension | Browser extension download capture, cookie interception, native messaging bridge | `WORKING` |
| `FN-0002` | `getCookiesForUrl` | `HyperDownload/browser-extension/background.js` | 156-169 | extension | Browser extension download capture, cookie interception, native messaging bridge | `WORKING` |
| `FN-0003` | `sendToHyperDownload` | `HyperDownload/browser-extension/background.js` | 172-200 | extension | Browser extension download capture, cookie interception, native messaging bridge | `WORKING` |
| `FN-0004` | `sendNativeMessage` | `HyperDownload/browser-extension/background.js` | 201-212 | extension | Browser extension download capture, cookie interception, native messaging bridge | `WORKING` |
| `FN-0005` | `checkEngineHealth` | `HyperDownload/browser-extension/background.js` | 213-227 | extension | Browser extension download capture, cookie interception, native messaging bridge | `WORKING` |
| `FN-0006` | `safeParseUrl` | `HyperDownload/browser-extension/background.js` | 228-235 | extension | Browser extension download capture, cookie interception, native messaging bridge | `WORKING` |
| `FN-0007` | `injectStyles` | `HyperDownload/browser-extension/content.js` | 220-226 | extension | Web page media sniffer, video download button overlay | `WORKING` |
| `FN-0008` | `getMediaTitle` | `HyperDownload/browser-extension/content.js` | 229-238 | extension | Web page media sniffer, video download button overlay | `WORKING` |
| `FN-0009` | `getAvailableStreams` | `HyperDownload/browser-extension/content.js` | 241-262 | extension | Web page media sniffer, video download button overlay | `WORKING` |
| `FN-0010` | `createSnifferWidget` | `HyperDownload/browser-extension/content.js` | 265-390 | extension | Web page media sniffer, video download button overlay | `WORKING` |
| `FN-0011` | `inspectAndAttach` | `HyperDownload/browser-extension/content.js` | 393-426 | extension | Web page media sniffer, video download button overlay | `WORKING` |
| `FN-0012` | `init` | `HyperDownload/browser-extension/content.js` | 429-451 | extension | Web page media sniffer, video download button overlay | `WORKING` |
| `FN-0013` | `log_bridge` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 92-104 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0014` | `start` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 107-214 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0015` | `health_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 216-219 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0016` | `get_downloads_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 220-276 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0017` | `start_download_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 277-305 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0018` | `pause_download_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 306-319 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0019` | `resume_download_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 320-336 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0020` | `delete_download_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 337-351 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0021` | `clear_completed_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 352-366 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0022` | `add_download_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 367-395 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0023` | `get_incoming_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 396-401 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0024` | `open_folder_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 402-505 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0025` | `touch_file_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 506-518 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0026` | `get_disk_handler` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 539-547 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0027` | `get_disk_stats_for_path` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 548-629 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0028` | `get_disk_stats_for_path` | `HyperDownload/crates/browser-bridge/src/axum_server.rs` | 630-642 | browser-bridge | Local IPC REST API & static web UI distribution server (port 9145) | `WORKING` |
| `FN-0029` | `main` | `HyperDownload/crates/browser-bridge/src/bin/hyperdownload-host.rs` | 21-72 | browser-bridge | Module helper / component logic for main | `VERIFIED` |
| `FN-0030` | `write_message` | `HyperDownload/crates/browser-bridge/src/native_messaging.rs` | 28-42 | browser-bridge | Chrome/Firefox Native Messaging 32-bit LE stream encoder/decoder | `WORKING` |
| `FN-0031` | `test_native_messaging_roundtrip` | `HyperDownload/crates/browser-bridge/src/native_messaging.rs` | 55-76 | browser-bridge | Chrome/Firefox Native Messaging 32-bit LE stream encoder/decoder | `WORKING` |
| `FN-0032` | `test_native_messaging_eof` | `HyperDownload/crates/browser-bridge/src/native_messaging.rs` | 77-83 | browser-bridge | Chrome/Firefox Native Messaging 32-bit LE stream encoder/decoder | `WORKING` |
| `FN-0033` | `as_str` | `HyperDownload/crates/clipboard-monitor/src/classifier.rs` | 14-23 | clipboard-monitor | Windows clipboard text extraction and download URL regex classification | `WORKING` |
| `FN-0034` | `classify_filename` | `HyperDownload/crates/clipboard-monitor/src/classifier.rs` | 24-42 | clipboard-monitor | Windows clipboard text extraction and download URL regex classification | `WORKING` |
| `FN-0035` | `test_classify_extensions` | `HyperDownload/crates/clipboard-monitor/src/classifier.rs` | 48-59 | clipboard-monitor | Windows clipboard text extraction and download URL regex classification | `WORKING` |
| `FN-0036` | `is_downloadable_url` | `HyperDownload/crates/clipboard-monitor/src/lib.rs` | 8-14 | clipboard-monitor | Windows clipboard text extraction and download URL regex classification | `WORKING` |
| `FN-0037` | `new` | `HyperDownload/crates/connection-manager/src/pool.rs` | 16-20 | connection-manager | Per-host and global TCP connection limit tracking and concurrency management | `WORKING` |
| `FN-0038` | `can_acquire` | `HyperDownload/crates/connection-manager/src/pool.rs` | 21-26 | connection-manager | Per-host and global TCP connection limit tracking and concurrency management | `WORKING` |
| `FN-0039` | `acquire` | `HyperDownload/crates/connection-manager/src/pool.rs` | 27-41 | connection-manager | Per-host and global TCP connection limit tracking and concurrency management | `WORKING` |
| `FN-0040` | `release` | `HyperDownload/crates/connection-manager/src/pool.rs` | 42-50 | connection-manager | Per-host and global TCP connection limit tracking and concurrency management | `WORKING` |
| `FN-0041` | `drop` | `HyperDownload/crates/connection-manager/src/pool.rs` | 59-65 | connection-manager | Per-host and global TCP connection limit tracking and concurrency management | `WORKING` |
| `FN-0042` | `main` | `HyperDownload/crates/download-engine/src/bin/hyperdownload-cli.rs` | 27-111 | download-engine | Module helper / component logic for main | `VERIFIED` |
| `FN-0043` | `is_likely_video_id` | `HyperDownload/crates/download-engine/src/engine.rs` | 22-32 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0044` | `is_youtube_url` | `HyperDownload/crates/download-engine/src/engine.rs` | 33-37 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0045` | `get_yt_dlp_executable` | `HyperDownload/crates/download-engine/src/engine.rs` | 38-51 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0046` | `new` | `HyperDownload/crates/download-engine/src/engine.rs` | 71-87 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0047` | `subscribe_events` | `HyperDownload/crates/download-engine/src/engine.rs` | 88-91 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0048` | `start_download` | `HyperDownload/crates/download-engine/src/engine.rs` | 94-102 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0049` | `start_download_with_options` | `HyperDownload/crates/download-engine/src/engine.rs` | 103-164 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0050` | `resume_download` | `HyperDownload/crates/download-engine/src/engine.rs` | 167-251 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0051` | `pause_download` | `HyperDownload/crates/download-engine/src/engine.rs` | 254-289 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0052` | `cancel_download` | `HyperDownload/crates/download-engine/src/engine.rs` | 292-308 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0053` | `set_speed_limit` | `HyperDownload/crates/download-engine/src/engine.rs` | 309-318 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0054` | `get_task_status` | `HyperDownload/crates/download-engine/src/engine.rs` | 319-322 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0055` | `list_tasks` | `HyperDownload/crates/download-engine/src/engine.rs` | 323-326 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0056` | `get_all_tasks_status` | `HyperDownload/crates/download-engine/src/engine.rs` | 327-346 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0057` | `start_youtube_download` | `HyperDownload/crates/download-engine/src/engine.rs` | 347-669 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0058` | `calculate_connection_count` | `HyperDownload/crates/download-engine/src/engine.rs` | 670-681 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0059` | `spawn_pipeline` | `HyperDownload/crates/download-engine/src/engine.rs` | 682-937 | download-engine | High-level download orchestration, worker spawning, events, and yt-dlp handling | `WORKING` |
| `FN-0060` | `run_range_download` | `HyperDownload/crates/download-engine/src/worker.rs` | 20-191 | download-engine | Individual HTTP Range chunk stream reader, retries, and speed tracking | `WORKING` |
| `FN-0061` | `backoff` | `HyperDownload/crates/download-engine/src/worker.rs` | 192-202 | download-engine | Individual HTTP Range chunk stream reader, retries, and speed tracking | `WORKING` |
| `FN-0062` | `mock_file_handler` | `HyperDownload/crates/download-engine/tests/end_to_end_test.rs` | 15-55 | download-engine | Automated test verification for mock_file_handler | `VERIFIED` |
| `FN-0063` | `test_end_to_end_accelerated_download` | `HyperDownload/crates/download-engine/tests/end_to_end_test.rs` | 56-108 | download-engine | Automated test verification for test_end_to_end_accelerated_download | `VERIFIED` |
| `FN-0064` | `test_pause_and_resume_download` | `HyperDownload/crates/download-engine/tests/end_to_end_test.rs` | 109-172 | download-engine | Automated test verification for test_pause_and_resume_download | `VERIFIED` |
| `FN-0065` | `test_single_connection_fallback_when_no_range` | `HyperDownload/crates/download-engine/tests/end_to_end_test.rs` | 173-231 | download-engine | Automated test verification for test_single_connection_fallback_when_no_range | `VERIFIED` |
| `FN-0066` | `non_range_handler` | `HyperDownload/crates/download-engine/tests/end_to_end_test.rs` | 177-185 | download-engine | Automated test verification for non_range_handler | `VERIFIED` |
| `FN-0067` | `test_small_file_download` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 18-68 | download-engine | Automated test verification for test_small_file_download | `VERIFIED` |
| `FN-0068` | `test_large_file_multi_connection` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 73-145 | download-engine | Automated test verification for test_large_file_multi_connection | `VERIFIED` |
| `FN-0069` | `test_interrupted_connection_recovery` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 150-256 | download-engine | Automated test verification for test_interrupted_connection_recovery | `VERIFIED` |
| `FN-0070` | `test_invalid_urls` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 261-274 | download-engine | Automated test verification for test_invalid_urls | `VERIFIED` |
| `FN-0071` | `test_http_redirects` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 279-324 | download-engine | Automated test verification for test_http_redirects | `VERIFIED` |
| `FN-0072` | `test_http_errors` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 329-364 | download-engine | Automated test verification for test_http_errors | `VERIFIED` |
| `FN-0073` | `test_changed_remote_files` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 369-447 | download-engine | Automated test verification for test_changed_remote_files | `VERIFIED` |
| `FN-0074` | `test_disk_write_failures` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 452-480 | download-engine | Automated test verification for test_disk_write_failures | `VERIFIED` |
| `FN-0075` | `test_application_restart_persistence` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 485-567 | download-engine | Automated test verification for test_application_restart_persistence | `VERIFIED` |
| `FN-0076` | `test_concurrent_downloads` | `HyperDownload/crates/download-engine/tests/scenarios_test.rs` | 572-621 | download-engine | Automated test verification for test_concurrent_downloads | `VERIFIED` |
| `FN-0077` | `build_browser_headers` | `HyperDownload/crates/http-client/src/headers.rs` | 8-14 | http-client | HTTP request header generation, authentication (Basic), browser impersonation | `WORKING` |
| `FN-0078` | `build_headers_from_options` | `HyperDownload/crates/http-client/src/headers.rs` | 15-77 | http-client | HTTP request header generation, authentication (Basic), browser impersonation | `WORKING` |
| `FN-0079` | `simple_base64_encode` | `HyperDownload/crates/http-client/src/headers.rs` | 78-107 | http-client | HTTP request header generation, authentication (Basic), browser impersonation | `WORKING` |
| `FN-0080` | `test_simple_base64` | `HyperDownload/crates/http-client/src/headers.rs` | 112-117 | http-client | HTTP request header generation, authentication (Basic), browser impersonation | `WORKING` |
| `FN-0081` | `test_auth_headers` | `HyperDownload/crates/http-client/src/headers.rs` | 118-131 | http-client | HTTP request header generation, authentication (Basic), browser impersonation | `WORKING` |
| `FN-0082` | `new` | `HyperDownload/crates/http-client/src/probe.rs` | 16-23 | http-client | HTTP HEAD/GET server capabilities, range support, content-length, filename probing | `WORKING` |
| `FN-0083` | `probe` | `HyperDownload/crates/http-client/src/probe.rs` | 27-37 | http-client | HTTP HEAD/GET server capabilities, range support, content-length, filename probing | `WORKING` |
| `FN-0084` | `probe_with_options` | `HyperDownload/crates/http-client/src/probe.rs` | 38-183 | http-client | HTTP HEAD/GET server capabilities, range support, content-length, filename probing | `WORKING` |
| `FN-0085` | `validate_resume` | `HyperDownload/crates/http-client/src/probe.rs` | 187-266 | http-client | HTTP HEAD/GET server capabilities, range support, content-length, filename probing | `WORKING` |
| `FN-0086` | `extract_filename` | `HyperDownload/crates/http-client/src/probe.rs` | 267-291 | http-client | HTTP HEAD/GET server capabilities, range support, content-length, filename probing | `WORKING` |
| `FN-0087` | `test_extract_filename_from_url` | `HyperDownload/crates/http-client/src/probe.rs` | 298-304 | http-client | HTTP HEAD/GET server capabilities, range support, content-length, filename probing | `WORKING` |
| `FN-0088` | `test_extract_filename_from_content_disposition` | `HyperDownload/crates/http-client/src/probe.rs` | 305-315 | http-client | HTTP HEAD/GET server capabilities, range support, content-length, filename probing | `WORKING` |
| `FN-0089` | `test_extract_filename_fallback` | `HyperDownload/crates/http-client/src/probe.rs` | 316-322 | http-client | HTTP HEAD/GET server capabilities, range support, content-length, filename probing | `WORKING` |
| `FN-0090` | `new` | `HyperDownload/crates/queue-manager/src/lib.rs` | 16-23 | queue-manager | Module helper / component logic for new | `WORKING` |
| `FN-0091` | `new` | `HyperDownload/crates/queue-manager/src/lib.rs` | 32-39 | queue-manager | Module helper / component logic for new | `WORKING` |
| `FN-0092` | `add_to_queue` | `HyperDownload/crates/queue-manager/src/lib.rs` | 40-49 | queue-manager | Module helper / component logic for add_to_queue | `WORKING` |
| `FN-0093` | `default` | `HyperDownload/crates/queue-manager/src/lib.rs` | 53-55 | queue-manager | Module helper / component logic for default | `WORKING` |
| `FN-0094` | `trigger_action` | `HyperDownload/crates/scheduler/src/lib.rs` | 16-50 | scheduler | Cron-style timed download scheduling and auto-shutdown actions | `WORKING` |
| `FN-0095` | `unlimited` | `HyperDownload/crates/segment-manager/src/speed_limiter.rs` | 21-25 | segment-manager | Token-bucket download bandwidth throttling and pacing | `WORKING` |
| `FN-0096` | `with_bytes_per_sec` | `HyperDownload/crates/segment-manager/src/speed_limiter.rs` | 26-31 | segment-manager | Token-bucket download bandwidth throttling and pacing | `WORKING` |
| `FN-0097` | `set_bytes_per_sec` | `HyperDownload/crates/segment-manager/src/speed_limiter.rs` | 34-45 | segment-manager | Token-bucket download bandwidth throttling and pacing | `WORKING` |
| `FN-0098` | `is_limited` | `HyperDownload/crates/segment-manager/src/speed_limiter.rs` | 46-49 | segment-manager | Token-bucket download bandwidth throttling and pacing | `WORKING` |
| `FN-0099` | `throttle` | `HyperDownload/crates/segment-manager/src/speed_limiter.rs` | 50-59 | segment-manager | Token-bucket download bandwidth throttling and pacing | `WORKING` |
| `FN-0100` | `new` | `HyperDownload/crates/segment-manager/src/work_stealer.rs` | 16-23 | segment-manager | Dynamic segment subdivision and idle worker chunk-stealing | `WORKING` |
| `FN-0101` | `current_pos` | `HyperDownload/crates/segment-manager/src/work_stealer.rs` | 24-27 | segment-manager | Dynamic segment subdivision and idle worker chunk-stealing | `WORKING` |
| `FN-0102` | `end_pos` | `HyperDownload/crates/segment-manager/src/work_stealer.rs` | 28-31 | segment-manager | Dynamic segment subdivision and idle worker chunk-stealing | `WORKING` |
| `FN-0103` | `remaining` | `HyperDownload/crates/segment-manager/src/work_stealer.rs` | 32-41 | segment-manager | Dynamic segment subdivision and idle worker chunk-stealing | `WORKING` |
| `FN-0104` | `try_steal_chunk` | `HyperDownload/crates/segment-manager/src/work_stealer.rs` | 49-83 | segment-manager | Dynamic segment subdivision and idle worker chunk-stealing | `WORKING` |
| `FN-0105` | `test_dynamic_work_stealing` | `HyperDownload/crates/segment-manager/src/work_stealer.rs` | 89-103 | segment-manager | Dynamic segment subdivision and idle worker chunk-stealing | `WORKING` |
| `FN-0106` | `new` | `HyperDownload/crates/shared/src/models.rs` | 9-11 | shared | Module helper / component logic for new | `WORKING` |
| `FN-0107` | `default` | `HyperDownload/crates/shared/src/models.rs` | 15-17 | shared | Module helper / component logic for default | `WORKING` |
| `FN-0108` | `fmt` | `HyperDownload/crates/shared/src/models.rs` | 21-23 | shared | Module helper / component logic for fmt | `WORKING` |
| `FN-0109` | `new` | `HyperDownload/crates/shared/src/models.rs` | 34-40 | shared | Module helper / component logic for new | `WORKING` |
| `FN-0110` | `total_bytes` | `HyperDownload/crates/shared/src/models.rs` | 41-48 | shared | Module helper / component logic for total_bytes | `WORKING` |
| `FN-0111` | `remaining_bytes` | `HyperDownload/crates/shared/src/models.rs` | 49-56 | shared | Module helper / component logic for remaining_bytes | `WORKING` |
| `FN-0112` | `is_completed` | `HyperDownload/crates/shared/src/models.rs` | 57-60 | shared | Module helper / component logic for is_completed | `WORKING` |
| `FN-0113` | `try_bisect` | `HyperDownload/crates/shared/src/models.rs` | 64-75 | shared | Module helper / component logic for try_bisect | `WORKING` |
| `FN-0114` | `open` | `HyperDownload/crates/storage/src/database.rs` | 16-37 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0115` | `open_in_memory` | `HyperDownload/crates/storage/src/database.rs` | 38-46 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0116` | `init_schema` | `HyperDownload/crates/storage/src/database.rs` | 47-77 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0117` | `insert_task` | `HyperDownload/crates/storage/src/database.rs` | 78-113 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0118` | `update_progress` | `HyperDownload/crates/storage/src/database.rs` | 114-123 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0119` | `update_task_completed` | `HyperDownload/crates/storage/src/database.rs` | 124-139 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0120` | `save_segments` | `HyperDownload/crates/storage/src/database.rs` | 140-165 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0121` | `get_segments` | `HyperDownload/crates/storage/src/database.rs` | 166-189 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0122` | `get_task` | `HyperDownload/crates/storage/src/database.rs` | 190-239 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0123` | `get_task_metadata` | `HyperDownload/crates/storage/src/database.rs` | 240-259 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0124` | `list_tasks` | `HyperDownload/crates/storage/src/database.rs` | 260-308 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0125` | `delete_task` | `HyperDownload/crates/storage/src/database.rs` | 309-315 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0126` | `get_download_count` | `HyperDownload/crates/storage/src/database.rs` | 316-323 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0127` | `test_sqlite_state_persistence_and_segments` | `HyperDownload/crates/storage/src/database.rs` | 331-396 | storage | SQLite persistence for download tasks, segments, state, and metadata | `WORKING` |
| `FN-0128` | `preallocate` | `HyperDownload/crates/storage/src/prealloc.rs` | 11-51 | storage | Windows SetFileValidData / fallocate sparse or non-sparse file preallocation | `WORKING` |
| `FN-0129` | `new` | `HyperDownload/crates/storage/src/writer.rs` | 14-18 | storage | Concurrent chunk writing at exact byte offsets into target file | `WORKING` |
| `FN-0130` | `write_at` | `HyperDownload/crates/storage/src/writer.rs` | 23-49 | storage | Concurrent chunk writing at exact byte offsets into target file | `WORKING` |
| `FN-0131` | `sync_all` | `HyperDownload/crates/storage/src/writer.rs` | 50-55 | storage | Concurrent chunk writing at exact byte offsets into target file | `WORKING` |
| `FN-0132` | `main` | `HyperDownload/desktop/src-tauri/build.rs` | 2-32 | src-tauri | Module helper / component logic for main | `VERIFIED` |
| `FN-0133` | `check_single_instance` | `HyperDownload/desktop/src-tauri/src/main.rs` | 22-53 | src-tauri | Desktop window lifecycle, single-instance mutex, WebView2 initialization | `VERIFIED` |
| `FN-0134` | `ensure_webview2_loader` | `HyperDownload/desktop/src-tauri/src/main.rs` | 54-88 | src-tauri | Desktop window lifecycle, single-instance mutex, WebView2 initialization | `VERIFIED` |
| `FN-0135` | `log_native` | `HyperDownload/desktop/src-tauri/src/main.rs` | 89-101 | src-tauri | Desktop window lifecycle, single-instance mutex, WebView2 initialization | `WORKING` |
| `FN-0136` | `main` | `HyperDownload/desktop/src-tauri/src/main.rs` | 102-258 | src-tauri | Desktop window lifecycle, single-instance mutex, WebView2 initialization | `VERIFIED` |
| `FN-0137` | `showToast` | `HyperDownload/desktop/src/App.tsx` | 30-36 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0138` | `disableContextMenu` | `HyperDownload/desktop/src/App.tsx` | 42-44 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0139` | `disableBrowserKeys` | `HyperDownload/desktop/src/App.tsx` | 45-55 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0140` | `fetchTasks` | `HyperDownload/desktop/src/App.tsx` | 70-80 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0141` | `fetchDiskInfo` | `HyperDownload/desktop/src/App.tsx` | 103-114 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0142` | `handleOpenFolder` | `HyperDownload/desktop/src/App.tsx` | 122-137 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0143` | `handleOpenDownloadsFolder` | `HyperDownload/desktop/src/App.tsx` | 138-142 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0144` | `handlePause` | `HyperDownload/desktop/src/App.tsx` | 143-157 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0145` | `handleResume` | `HyperDownload/desktop/src/App.tsx` | 158-172 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0146` | `handlePauseAll` | `HyperDownload/desktop/src/App.tsx` | 173-185 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0147` | `handleDelete` | `HyperDownload/desktop/src/App.tsx` | 186-201 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0148` | `handleClearCompleted` | `HyperDownload/desktop/src/App.tsx` | 202-214 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0149` | `handleStartNewDownload` | `HyperDownload/desktop/src/App.tsx` | 215-244 | frontend | Main UI orchestrator, state polling, global event filters, modal management | `WORKING` |
| `FN-0150` | `handleSubmit` | `HyperDownload/desktop/src/components/AddDownloadModal.tsx` | 38-51 | frontend | URL insertion dialog, category assignment, destination folder selection | `WORKING` |
| `FN-0151` | `handleUrlBlur` | `HyperDownload/desktop/src/components/AddDownloadModal.tsx` | 52-70 | frontend | URL insertion dialog, category assignment, destination folder selection | `WORKING` |
| `FN-0152` | `formatBytes` | `HyperDownload/desktop/src/components/DownloadDetailPane.tsx` | 35-42 | frontend | Module helper / component logic for formatBytes | `WORKING` |
| `FN-0153` | `formatSpeed` | `HyperDownload/desktop/src/components/DownloadDetailPane.tsx` | 43-50 | frontend | Module helper / component logic for formatSpeed | `WORKING` |
| `FN-0154` | `formatSeconds` | `HyperDownload/desktop/src/components/DownloadDetailPane.tsx` | 51-63 | frontend | Module helper / component logic for formatSeconds | `WORKING` |
| `FN-0155` | `handleCopyUrl` | `HyperDownload/desktop/src/components/DownloadDetailPane.tsx` | 64-69 | frontend | Module helper / component logic for handleCopyUrl | `WORKING` |
| `FN-0156` | `getCategoryIcon` | `HyperDownload/desktop/src/components/DownloadsTable.tsx` | 47-62 | frontend | Module helper / component logic for getCategoryIcon | `WORKING` |
| `FN-0157` | `formatBytes` | `HyperDownload/desktop/src/components/DownloadsTable.tsx` | 63-70 | frontend | Module helper / component logic for formatBytes | `WORKING` |
| `FN-0158` | `formatSpeed` | `HyperDownload/desktop/src/components/DownloadsTable.tsx` | 71-78 | frontend | Module helper / component logic for formatSpeed | `WORKING` |
| `FN-0159` | `formatEta` | `HyperDownload/desktop/src/components/DownloadsTable.tsx` | 79-91 | frontend | Module helper / component logic for formatEta | `WORKING` |
| `FN-0160` | `getStatusBadge` | `HyperDownload/desktop/src/components/DownloadsTable.tsx` | 92-146 | frontend | Module helper / component logic for getStatusBadge | `WORKING` |
| `FN-0161` | `handleCreate` | `HyperDownload/desktop/src/components/QueuesView.tsx` | 47-54 | frontend | Module helper / component logic for handleCreate | `WORKING` |
| `FN-0162` | `formatBytes` | `HyperDownload/desktop/src/components/QueuesView.tsx` | 55-62 | frontend | Module helper / component logic for formatBytes | `WORKING` |
| `FN-0163` | `handleRowContextMenu` | `HyperDownload/desktop/src/components/RaptorDownloadList.tsx` | 50-60 | frontend | Main download table view, task progress, actions, context menus | `WORKING` |
| `FN-0164` | `toggleSelect` | `HyperDownload/desktop/src/components/RaptorDownloadList.tsx` | 61-69 | frontend | Main download table view, task progress, actions, context menus | `WORKING` |
| `FN-0165` | `getFileIcon` | `HyperDownload/desktop/src/components/RaptorDownloadList.tsx` | 70-79 | frontend | Main download table view, task progress, actions, context menus | `WORKING` |
| `FN-0166` | `formatSize` | `HyperDownload/desktop/src/components/RaptorDownloadList.tsx` | 85-91 | frontend | Main download table view, task progress, actions, context menus | `WORKING` |
| `FN-0167` | `formatSpeed` | `HyperDownload/desktop/src/components/RaptorDownloadList.tsx` | 92-97 | frontend | Main download table view, task progress, actions, context menus | `WORKING` |
| `FN-0168` | `formatEta` | `HyperDownload/desktop/src/components/RaptorDownloadList.tsx` | 98-105 | frontend | Main download table view, task progress, actions, context menus | `WORKING` |
| `FN-0169` | `renderRowMenu` | `HyperDownload/desktop/src/components/RaptorDownloadList.tsx` | 106-179 | frontend | Main download table view, task progress, actions, context menus | `WORKING` |
| `FN-0170` | `toggleDay` | `HyperDownload/desktop/src/components/SchedulerView.tsx` | 30-39 | frontend | Module helper / component logic for toggleDay | `WORKING` |
| `FN-0171` | `handleSave` | `HyperDownload/desktop/src/components/SchedulerView.tsx` | 40-45 | frontend | Module helper / component logic for handleSave | `WORKING` |
| `FN-0172` | `formatSpeed` | `HyperDownload/desktop/src/components/SpeedGraph.tsx` | 11-18 | frontend | Module helper / component logic for formatSpeed | `WORKING` |
