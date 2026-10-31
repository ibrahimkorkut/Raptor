@echo off
set "PATH=C:\Users\ibrahim\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin;%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "c:\Users\ibrahim\Desktop\faster_download_manager\Raptor"
cargo build --release -p hyperdownload-desktop
