use std::process::Command;

fn main() {
    #[cfg(windows)]
    {
        println!("cargo:rerun-if-changed=app.rc");
        println!("cargo:rerun-if-changed=app.ico");
        println!("cargo:rerun-if-changed=icon_128.rgba");
        println!("cargo:rerun-if-changed=icon_32.png");
        println!("cargo:rerun-if-changed=icon_16.png");

        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let rc_file = format!("{}/app.rc", manifest_dir);
        let out_dir = std::env::var("OUT_DIR").unwrap();
        let obj_file = format!("{}/app.o", out_dir);

        let mingw_bin = "C:\\Users\\ibrahim\\AppData\\Local\\Microsoft\\WinGet\\Packages\\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\\mingw64\\bin\\windres.exe";
        let windres_cmd = if std::path::Path::new(mingw_bin).exists() {
            mingw_bin
        } else {
            "windres"
        };

        let status = Command::new(windres_cmd)
            .args(["-i", &rc_file, "-O", "coff", "-o", &obj_file])
            .status();

        if let Ok(s) = status {
            if s.success() {
                println!("cargo:rustc-link-arg={}", obj_file);
            }
        }
    }
}
