# Raptor Native Messaging Host Registration Script (Chrome, Edge & Brave)
param(
    [string]$HostExePath = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Determine host executable path
if ([string]::IsNullOrWhiteSpace($HostExePath)) {
    $PotentialPaths = @(
        (Join-Path $ScriptDir "..\target\release\raptor-host.exe"),
        (Join-Path $ScriptDir "..\target\release\hyperdownload-host.exe"),
        (Join-Path $ScriptDir "raptor-host.exe"),
        (Join-Path $ScriptDir "..\raptor-host.exe"),
        (Join-Path $ScriptDir "hyperdownload-host.exe")
    )
    foreach ($p in $PotentialPaths) {
        if (Test-Path $p) {
            $HostExePath = (Resolve-Path $p).Path
            break
        }
    }
}

if ([string]::IsNullOrWhiteSpace($HostExePath) -or -not (Test-Path $HostExePath)) {
    $HostExePath = (Join-Path $ScriptDir "raptor-host.exe")
    Write-Host "[WARNING] raptor-host.exe not found at target locations. Defaulting manifest path to: $HostExePath" -ForegroundColor Yellow
} else {
    Write-Host "[INFO] Using host binary at: $HostExePath" -ForegroundColor Green
}

# 2. Generate manifests (both com.raptor.native and legacy com.hyperdownload.native)
$ManifestNames = @("com.raptor.native", "com.hyperdownload.native")
foreach ($mName in $ManifestNames) {
    $ManifestPath = Join-Path $ScriptDir "$mName.json"
    $ManifestContent = @{
        name = $mName
        description = "Raptor Download Manager High-Performance Native Messaging Host"
        path = $HostExePath
        type = "stdio"
        allowed_origins = @(
            "chrome-extension://knldjmfmopnpolahpmmgbagdohdnhkik/",
            "chrome-extension://*"
        )
    } | ConvertTo-Json -Depth 5

    Set-Content -Path $ManifestPath -Value $ManifestContent -Encoding UTF8
    Write-Host "[INFO] Updated manifest at: $ManifestPath" -ForegroundColor Green

    # 3. Register for Google Chrome
    $ChromeRegKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$mName"
    if (-not (Test-Path $ChromeRegKey)) {
        New-Item -Path $ChromeRegKey -Force | Out-Null
    }
    Set-ItemProperty -Path $ChromeRegKey -Name "(Default)" -Value $ManifestPath

    # 4. Register for Microsoft Edge
    $EdgeRegKey = "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$mName"
    if (-not (Test-Path $EdgeRegKey)) {
        New-Item -Path $EdgeRegKey -Force | Out-Null
    }
    Set-ItemProperty -Path $EdgeRegKey -Name "(Default)" -Value $ManifestPath

    # 5. Register for Brave
    $BraveRegKey = "HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\$mName"
    if (-not (Test-Path $BraveRegKey)) {
        New-Item -Path $BraveRegKey -Force | Out-Null
    }
    Set-ItemProperty -Path $BraveRegKey -Name "(Default)" -Value $ManifestPath
}

Write-Host "`nRaptor browser integration registration complete!" -ForegroundColor Green
