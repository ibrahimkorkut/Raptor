#![windows_subsystem = "windows"]

use hyperdownload_browser_bridge::{LocalBridgeServer, NewDownloadRequest};
use hyperdownload_download_engine::DownloadEngine;
use hyperdownload_storage::StateDatabase;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};
use tokio::sync::mpsc;
use wry::WebViewBuilder;
#[cfg(windows)]
use wry::WebViewBuilderExtWindows;
#[cfg(windows)]
use tao::platform::windows::WindowExtWindows;



#[cfg(windows)]

static mut APP_MUTEX: windows::Win32::Foundation::HANDLE = windows::Win32::Foundation::HANDLE(std::ptr::null_mut());



#[cfg(windows)]

const WM_RAPTOR_TRAY: u32 = windows::Win32::UI::WindowsAndMessaging::WM_USER + 101;

#[cfg(windows)]

const RAPTOR_TRAY_ID: u32 = 1001;



#[cfg(windows)]
fn load_embedded_hicon(target_size: u32) -> windows::Win32::UI::WindowsAndMessaging::HICON {
    use windows::Win32::UI::WindowsAndMessaging::{CreateIconFromResourceEx, HICON, LR_DEFAULTCOLOR};
    use windows::Win32::Foundation::BOOL;

    static ICO_DATA: &[u8] = include_bytes!("../app.ico");
    if ICO_DATA.len() < 22 {
        return HICON(std::ptr::null_mut());
    }

    let count = u16::from_le_bytes([ICO_DATA[4], ICO_DATA[5]]) as usize;
    let mut best_idx = 0;
    let mut best_diff = i32::MAX;

    for i in 0..count {
        let entry_offset = 6 + i * 16;
        if entry_offset + 16 > ICO_DATA.len() {
            break;
        }
        let w = match ICO_DATA[entry_offset] {
            0 => 256,
            val => val as u32,
        };
        let diff = (w as i32 - target_size as i32).abs();
        if diff < best_diff {
            best_diff = diff;
            best_idx = i;
        }
    }

    let entry_offset = 6 + best_idx * 16;
    let size = u32::from_le_bytes([
        ICO_DATA[entry_offset + 8],
        ICO_DATA[entry_offset + 9],
        ICO_DATA[entry_offset + 10],
        ICO_DATA[entry_offset + 11],
    ]) as usize;
    let offset = u32::from_le_bytes([
        ICO_DATA[entry_offset + 12],
        ICO_DATA[entry_offset + 13],
        ICO_DATA[entry_offset + 14],
        ICO_DATA[entry_offset + 15],
    ]) as usize;

    if offset + size <= ICO_DATA.len() {
        let icon_bits = &ICO_DATA[offset..offset + size];
        unsafe {
            CreateIconFromResourceEx(
                icon_bits,
                BOOL(1),
                0x00030000,
                target_size as i32,
                target_size as i32,
                LR_DEFAULTCOLOR,
            ).unwrap_or_default()
        }
    } else {
        HICON(std::ptr::null_mut())
    }
}

#[cfg(windows)]
unsafe fn setup_tray_icon(hwnd: windows::Win32::Foundation::HWND) {
    use windows::Win32::UI::Shell::{
        Shell_NotifyIconW, NOTIFYICONDATAW, NIM_ADD, NIF_ICON, NIF_MESSAGE, NIF_TIP,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        SendMessageW, ICON_BIG, ICON_SMALL, WM_SETICON,
    };
    use windows::Win32::Foundation::{LPARAM, WPARAM};

    let mut nid = NOTIFYICONDATAW::default();
    nid.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;
    nid.hWnd = hwnd;
    nid.uID = RAPTOR_TRAY_ID;
    nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
    nid.uCallbackMessage = WM_RAPTOR_TRAY;

    let hicon_16 = load_embedded_hicon(16);
    let hicon_32 = load_embedded_hicon(32);

    nid.hIcon = if !hicon_16.0.is_null() { hicon_16 } else { hicon_32 };

    let tip: Vec<u16> = "Raptor Download Manager\0".encode_utf16().collect();
    let len = tip.len().min(nid.szTip.len());
    nid.szTip[..len].copy_from_slice(&tip[..len]);

    let _ = Shell_NotifyIconW(NIM_ADD, &nid);

    // Apply icon to window title bar and taskbar button
    if !hicon_16.0.is_null() {
        let _ = SendMessageW(hwnd, WM_SETICON, WPARAM(ICON_SMALL as _), LPARAM(hicon_16.0 as _));
    }
    if !hicon_32.0.is_null() {
        let _ = SendMessageW(hwnd, WM_SETICON, WPARAM(ICON_BIG as _), LPARAM(hicon_32.0 as _));
    }
}



#[cfg(windows)]

unsafe fn remove_tray_icon(hwnd: windows::Win32::Foundation::HWND) {

    use windows::Win32::UI::Shell::{Shell_NotifyIconW, NOTIFYICONDATAW, NIM_DELETE};

    let mut nid = NOTIFYICONDATAW::default();

    nid.cbSize = std::mem::size_of::<NOTIFYICONDATAW>() as u32;

    nid.hWnd = hwnd;

    nid.uID = RAPTOR_TRAY_ID;

    let _ = Shell_NotifyIconW(NIM_DELETE, &nid);

}



#[cfg(windows)]

unsafe extern "system" fn tray_subclass_proc(

    hwnd: windows::Win32::Foundation::HWND,

    msg: u32,

    wparam: windows::Win32::Foundation::WPARAM,

    lparam: windows::Win32::Foundation::LPARAM,

    _id: usize,

    _data: usize,

) -> windows::Win32::Foundation::LRESULT {

    use windows::Win32::UI::Shell::DefSubclassProc;

    use windows::Win32::UI::WindowsAndMessaging::{

        CreatePopupMenu, AppendMenuW, TrackPopupMenu, DestroyMenu, GetCursorPos,

        SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,

        TPM_RETURNCMD, TPM_NONOTIFY, MF_STRING, MF_SEPARATOR,

        WM_LBUTTONUP, WM_LBUTTONDBLCLK, WM_RBUTTONUP,

    };

    use windows::Win32::Foundation::POINT;

    use windows::core::w;



    if msg == WM_RAPTOR_TRAY {

        let event = (lparam.0 & 0xffff) as u32;

        if event == WM_LBUTTONUP || event == WM_LBUTTONDBLCLK {

            let _ = ShowWindow(hwnd, SW_RESTORE);

            let _ = ShowWindow(hwnd, SW_SHOW);

            let _ = SetForegroundWindow(hwnd);

            return windows::Win32::Foundation::LRESULT(0);

        } else if event == WM_RBUTTONUP {

            if let Ok(hmenu) = CreatePopupMenu() {

                let _ = AppendMenuW(hmenu, MF_STRING, 1, w!("Raptor'ı Aç"));

                let _ = AppendMenuW(hmenu, MF_STRING, 2, w!("İndirilenler Klasörü"));

                let _ = AppendMenuW(hmenu, MF_SEPARATOR, 0, None);

                let _ = AppendMenuW(hmenu, MF_STRING, 3, w!("Çıkış"));



                let _ = SetForegroundWindow(hwnd);

                let mut pt = POINT::default();

                let _ = GetCursorPos(&mut pt);

                let cmd = TrackPopupMenu(hmenu, TPM_RETURNCMD | TPM_NONOTIFY, pt.x, pt.y, 0, hwnd, None);

                let _ = DestroyMenu(hmenu);



                if cmd.0 == 1 {

                    let _ = ShowWindow(hwnd, SW_RESTORE);

                    let _ = ShowWindow(hwnd, SW_SHOW);

                    let _ = SetForegroundWindow(hwnd);

                } else if cmd.0 == 2 {

                    let dl = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:".into()) + "\\Downloads";

                    let _ = std::process::Command::new("explorer").arg(dl).spawn();

                } else if cmd.0 == 3 {

                    remove_tray_icon(hwnd);

                    std::process::exit(0);

                }

            }

            return windows::Win32::Foundation::LRESULT(0);

        }

    }



    DefSubclassProc(hwnd, msg, wparam, lparam)

}



#[cfg(windows)]
fn kill_orphaned_instances() {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    let my_pid = std::process::id();
    log_native(&format!("Cleaning up orphaned Raptor instances (excluding PID {})", my_pid));
    let _ = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "Get-Process -Name 'Raptor', 'hyperdownload-desktop' -ErrorAction SilentlyContinue | Where-Object {{ $_.Id -ne {} }} | Stop-Process -Force",
                my_pid
            ),
        ])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();
    std::thread::sleep(std::time::Duration::from_millis(400));
}

#[cfg(windows)]
fn check_single_instance() -> bool {
    use windows::core::w;
    use windows::Win32::Foundation::{GetLastError, SetLastError, ERROR_ALREADY_EXISTS, WIN32_ERROR};
    use windows::Win32::System::Threading::CreateMutexW;
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, IsWindowVisible, SetForegroundWindow, ShowWindow, SW_RESTORE};

    unsafe {
        SetLastError(WIN32_ERROR(0));
        let handle = match CreateMutexW(None, true, w!("Local\\Raptor_Download_Manager_Mutex")) {
            Ok(h) => h,
            Err(_) => return true,
        };

        if GetLastError() == ERROR_ALREADY_EXISTS {
            log_native("Mutex already exists. Checking for visible window...");
            if let Ok(hwnd) = FindWindowW(None, w!("Raptor")) {
                if !hwnd.0.is_null() && IsWindowVisible(hwnd).as_bool() {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                    let _ = SetForegroundWindow(hwnd);
                    log_native("Found visible window, brought to front. Exiting duplicate.");
                    return false;
                }
            }
            log_native("No visible window found despite mutex! Cleaning up orphaned background process.");
            kill_orphaned_instances();
        }

        APP_MUTEX = handle;
        true
    }
}

#[cfg(windows)]
fn ensure_webview2_loader() {
    let dll_bytes = include_bytes!("../../../../Release/WebView2Loader.dll");

    // 1. Put WebView2Loader.dll in %LOCALAPPDATA%\Raptor\bin and %TEMP%\Raptor
    let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());
    let bin_dir = PathBuf::from(&local_appdata).join("Raptor").join("bin");
    let _ = std::fs::create_dir_all(&bin_dir);
    let target_dll = bin_dir.join("WebView2Loader.dll");
    let _ = std::fs::write(&target_dll, dll_bytes);

    let temp_dir = std::env::temp_dir().join("Raptor");
    let _ = std::fs::create_dir_all(&temp_dir);
    let _ = std::fs::write(temp_dir.join("WebView2Loader.dll"), dll_bytes);

    // Also write to permanent PATH location if accessible
    let _ = std::fs::write(r"C:\ffmpeg\bin\WebView2Loader.dll", dll_bytes);

    unsafe {
        use windows::core::PCWSTR;
        let dll_str = target_dll.to_string_lossy().to_string();
        let wide_dll: Vec<u16> = dll_str.encode_utf16().chain(std::iter::once(0)).collect();
        let _ = windows::Win32::System::LibraryLoader::LoadLibraryW(PCWSTR(wide_dll.as_ptr()));

        let bin_str = bin_dir.to_string_lossy().to_string();
        let wide_bin: Vec<u16> = bin_str.encode_utf16().chain(std::iter::once(0)).collect();
        let _ = windows::Win32::System::LibraryLoader::SetDllDirectoryW(PCWSTR(wide_bin.as_ptr()));
    }

    // Direct WebView2 cache to %LOCALAPPDATA%\Raptor\WebView2Data
    let data_dir = PathBuf::from(&local_appdata).join("Raptor").join("WebView2Data");
    let _ = std::fs::create_dir_all(&data_dir);
    std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", data_dir);
}

fn log_native(msg: &str) {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let log_dir = PathBuf::from(local).join("Raptor");
        let _ = std::fs::create_dir_all(&log_dir);
        let log_file = log_dir.join("native.log");
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_file) {
            let _ = writeln!(f, "{}", msg);
            let _ = f.flush();
        }
    }
}

fn main() {
    std::panic::set_hook(Box::new(|info| {
        log_native(&format!("PANIC: {:?}", info));
    }));

    log_native("Entering main");

    #[cfg(windows)]
    if !check_single_instance() {
        log_native("Exiting: check_single_instance returned false");
        return;
    }

    log_native("check_single_instance passed");

    #[cfg(windows)]
    ensure_webview2_loader();

    log_native("ensure_webview2_loader finished");

    let _ = tracing_subscriber::fmt::try_init();
    eprintln!("[NATIVE] Starting Raptor Standalone Application...");

    // 1. Start Tokio Async Runtime and Download Engine in a dedicated background thread
    thread::spawn(|| {
        log_native("Tokio thread started");
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to create Tokio runtime");

        rt.block_on(async {
            let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
            let db_path = PathBuf::from(appdata).join("HyperDownload").join("state.db");

            if let Some(parent) = db_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }

            let mut engine_arc = None;
            let mut db_arc_opt = None;

            match StateDatabase::open(&db_path) {
                Ok(db) => {
                    let db_arc = Arc::new(db);
                    let engine = DownloadEngine::new(db_arc.clone());
                    log_native("DownloadEngine initialized");
                    engine_arc = Some(Arc::new(engine));
                    db_arc_opt = Some(db_arc);
                }
                Err(e) => {
                    log_native(&format!("Failed to open StateDatabase: {:?}", e));
                }
            }

            let (tx, mut rx) = mpsc::channel::<NewDownloadRequest>(100);

            tokio::spawn(async move {
                while let Some(req) = rx.recv().await {
                    eprintln!("[NATIVE] Download queued from bridge: {} (file: {:?})", req.url, req.filename);
                }
            });

            log_native("Calling LocalBridgeServer::start");
            LocalBridgeServer::start(9145, tx, engine_arc, db_arc_opt).await;
            log_native("LocalBridgeServer::start returned!");
        });
        log_native("Tokio thread finished!");
    });

    thread::sleep(std::time::Duration::from_millis(200));

    // 2. Initialize Native Windows Event Loop & Window with Icon
    log_native("Creating EventLoop");
    let event_loop = EventLoop::new();

    let icon_bytes = include_bytes!("../icon_128.rgba");
    let window_icon = tao::window::Icon::from_rgba(icon_bytes.to_vec(), 128, 128).ok();

    let mut builder = WindowBuilder::new()
        .with_title("Raptor")
        .with_visible(true)
        .with_resizable(false)
        .with_maximizable(false)
        .with_inner_size(LogicalSize::new(1240.0, 820.0))
        .with_min_inner_size(LogicalSize::new(1240.0, 820.0))
        .with_max_inner_size(LogicalSize::new(1240.0, 820.0));

    if let Some(icon) = window_icon {
        builder = builder.with_window_icon(Some(icon));
    }

    log_native("Building window");
    let window = match builder.build(&event_loop) {
        Ok(w) => {
            w.set_visible(true);
            w.set_focus();
            w
        }
        Err(e) => {
            log_native(&format!("Failed to build window: {:?}", e));
            return;
        }
    };

    log_native("Building WebView");
    let init_script = r#"
        document.addEventListener('contextmenu', (e) => {
            // Prevent native browser context menu unconditionally
            e.preventDefault();
        }, true);
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        }, true);
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey && ['r', 'R', 'p', 'P', 'u', 'U', 's', 'S', 'j', 'J', 'f', 'F', 'g', 'G'].includes(e.key)) || e.key === 'F5') {
                e.preventDefault();
            }
        }, true);
    "#;

    let mut wv_builder = WebViewBuilder::new()
        .with_url("http://127.0.0.1:9145")
        .with_devtools(false)
        .with_initialization_script(init_script);

    #[cfg(windows)]
    {
        wv_builder = wv_builder
            .with_browser_accelerator_keys(false)
            .with_default_context_menus(false);
    }

    #[cfg(windows)]
    let hwnd = windows::Win32::Foundation::HWND(window.hwnd() as *mut std::ffi::c_void);

    #[cfg(windows)]
    unsafe {
        use windows::Win32::UI::Shell::SetWindowSubclass;
        let _ = SetWindowSubclass(hwnd, Some(tray_subclass_proc), RAPTOR_TRAY_ID as usize, 0);
        setup_tray_icon(hwnd);
    }



    let webview = match wv_builder.build(&window) {
        Ok(wv) => wv,
        Err(e) => {
            log_native(&format!("Failed to build webview with default data folder: {:?}. Retrying with unique temp directory fallback...", e));
            let temp_dir = std::env::temp_dir().join("Raptor").join(format!("WV2_{}", std::process::id()));
            let _ = std::fs::create_dir_all(&temp_dir);
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &temp_dir);

            let retry_builder = WebViewBuilder::new()
                .with_url("http://127.0.0.1:9145")
                .with_devtools(false)
                .with_initialization_script(init_script);

            #[cfg(windows)]
            let retry_builder = retry_builder
                .with_browser_accelerator_keys(false)
                .with_default_context_menus(false);

            match retry_builder.build(&window) {
                Ok(wv) => {
                    log_native("WebView successfully built with unique temp directory fallback!");
                    wv
                }
                Err(e2) => {
                    log_native(&format!("FATAL: Failed to build webview even with fallback: {:?}", e2));
                    return;
                }
            }
        }
    };

    log_native("Entering event_loop.run");
    event_loop.run(move |event, _, control_flow| {
        let _keep_alive = (&window, &webview);
        *control_flow = ControlFlow::Wait;
        match &event {
            Event::WindowEvent { event: win_event, .. } => {
                match win_event {
                    WindowEvent::CloseRequested => {
                        log_native("CloseRequested: Minimizing Raptor to Windows System Tray.");
                        window.set_visible(false);
                    }
                    WindowEvent::Destroyed => {
                        log_native("WindowEvent::Destroyed received");
                    }
                    _ => {}
                }
            }
            Event::LoopDestroyed => {

                log_native("LoopDestroyed event received! Cleaning up tray and exiting.");

                #[cfg(windows)]

                unsafe {

                    remove_tray_icon(hwnd);

                }

                std::process::exit(0);

            }
            _ => {}
        }
    });
}
