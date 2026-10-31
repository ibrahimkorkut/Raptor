@echo off
setlocal
echo ========================================================
echo HyperDownload Native Messaging Host Registration (Windows)
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0register_native_host.ps1"
if %ERRORLEVEL% equ 0 (
    echo.
    echo Registration succeeded! Press any key to exit.
) else (
    echo.
    echo Registration failed with error code %ERRORLEVEL%.
)
pause
