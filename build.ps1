# Jade release build (Windows)
# Output: F:\jade-target\release\bundle\
#   msi/  -> Jade_x.x.x_x64_en-US.msi
#   nsis/ -> Jade_x.x.x_x64-setup.exe

$msvcVer = "14.44.35207"
$sdkVer  = "10.0.26100.0"

$env:LIB = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\$msvcVer\lib\x64"
    "C:\Program Files (x86)\Windows Kits\10\Lib\$sdkVer\um\x64"
    "C:\Program Files (x86)\Windows Kits\10\Lib\$sdkVer\ucrt\x64"
) -join ";"

$env:INCLUDE = @(
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\$msvcVer\include"
    "C:\Program Files (x86)\Windows Kits\10\Include\$sdkVer\ucrt"
    "C:\Program Files (x86)\Windows Kits\10\Include\$sdkVer\um"
    "C:\Program Files (x86)\Windows Kits\10\Include\$sdkVer\shared"
) -join ";"

$linkBin = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\$msvcVer\bin\HostX64\x64"
$sdkBin  = "C:\Program Files (x86)\Windows Kits\10\bin\$sdkVer\x64"
$cargo   = "$env:USERPROFILE\.cargo\bin"
$env:PATH = "$cargo;$linkBin;$sdkBin;" + $env:PATH

$env:CARGO_TARGET_DIR = "F:\jade-target"

Write-Host "[OK] MSVC env ready  (target -> F:\jade-target)" -ForegroundColor Green
Write-Host "[>>] Building Jade release package..." -ForegroundColor Cyan
Write-Host "     (first build takes ~20 min)" -ForegroundColor DarkGray

Set-Location $PSScriptRoot
npm run tauri build

if ($LASTEXITCODE -eq 0) {
    $bundleDir = "F:\jade-target\release\bundle"
    Write-Host ""
    Write-Host "[OK] Build complete!" -ForegroundColor Green
    Write-Host "     -> $bundleDir" -ForegroundColor Cyan
    if (Test-Path $bundleDir) { explorer $bundleDir }
} else {
    Write-Host "[!!] Build failed." -ForegroundColor Red
}
