Stop-Process -Name 'hyperdownload-desktop', 'Raptor' -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$cert = Get-ChildItem Cert:\CurrentUser\My\2B4C70B8B755771AC957C8C786A4DBB781335F7E
if (-not $cert) {
    Write-Error "Certificate 2B4C70B8B755771AC957C8C786A4DBB781335F7E not found in Cert:\CurrentUser\My"
    exit 1
}

$srcExe = 'c:\Users\ibrahim\Desktop\faster_download_manager\Raptor\target\release\hyperdownload-desktop.exe'
$desktopExe = 'C:\Users\ibrahim\Desktop\Raptor.exe'
$releaseExe = 'c:\Users\ibrahim\Desktop\faster_download_manager\Release\Raptor.exe'

Write-Host "Signing built binary $srcExe..."
Set-AuthenticodeSignature -Certificate $cert -FilePath $srcExe

Write-Host "Copying to $desktopExe and $releaseExe..."
Copy-Item $srcExe $desktopExe -Force
Copy-Item $srcExe $releaseExe -Force

if (Test-Path 'c:\Users\ibrahim\Desktop\faster_download_manager\Release\raptor-cli.exe') {
    Set-AuthenticodeSignature -Certificate $cert -FilePath 'c:\Users\ibrahim\Desktop\faster_download_manager\Release\raptor-cli.exe'
}
if (Test-Path 'c:\Users\ibrahim\Desktop\faster_download_manager\Release\raptor-host.exe') {
    Set-AuthenticodeSignature -Certificate $cert -FilePath 'c:\Users\ibrahim\Desktop\faster_download_manager\Release\raptor-host.exe'
}

Write-Host "Compiling Inno Setup installer..."
$iscc = 'C:\Users\ibrahim\AppData\Local\Programs\Inno Setup 6\ISCC.exe'
if (-not (Test-Path $iscc)) {
    $iscc = 'C:\Users\ibrahim\AppData\Local\Programs\Antigravity IDE\resources\app\node_modules\innosetup\bin\ISCC.exe'
}

& $iscc 'c:\Users\ibrahim\Desktop\faster_download_manager\installer\Raptor_Installer.iss'

$desktopSetup = 'C:\Users\ibrahim\Desktop\Raptor_Setup.exe'
$releaseSetup = 'c:\Users\ibrahim\Desktop\faster_download_manager\Release\Setup\Raptor_Setup.exe'

if (Test-Path $releaseSetup) {
    Copy-Item $releaseSetup $desktopSetup -Force
    Write-Host "Signing installer $desktopSetup..."
    Set-AuthenticodeSignature -Certificate $cert -FilePath $desktopSetup
    Set-AuthenticodeSignature -Certificate $cert -FilePath $releaseSetup
}

Write-Host "All packaging and signing complete!"
