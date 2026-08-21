# Script build toan bo cac nen tang (Windows .exe, macOS .app, Linux .deb)
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   DANG BUILD TOAN BO NEN TANG: WINDOWS, MACOS, LINUX    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Tat cac tien trinh dang chay neu co
Get-Process -Name "*deepseek*", "*electron*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
taskkill /F /IM electron.exe /T 2>$null
taskkill /F /IM "DeepSeek Harness.exe" /T 2>$null
Start-Sleep -Seconds 1

# 2. Build Web & Backend Packages
Write-Host "`n[Buoc 1/5] Bien dich Packages va Web Frontend..." -ForegroundColor Yellow
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[LOI] Bien dich packages that bai!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Dong goi Windows, Linux Electron Native Apps
Write-Host "`n[Buoc 2/6] Dong goi Windows & Linux Electron Native Apps..." -ForegroundColor Yellow
node tools/launcher/build-electron-app.js

# 4. Dong goi macOS App Bundles (.app & .command)
Write-Host "`n[Buoc 3/6] Dong goi macOS App Bundles (darwin-x64, darwin-arm64)..." -ForegroundColor Yellow
node tools/launcher/build-macos-app.js

# 5. Dong goi Linux Debian (.deb) Packages
Write-Host "`n[Buoc 4/6] Dong goi Linux Debian (.deb) Packages..." -ForegroundColor Yellow
node tools/launcher/build-linux-deb.js

# 6. Bien dich Go Launcher va nen tat ca ban phat hanh (dist-release)
Write-Host "`n[Buoc 5/6] Bien dich Go Launcher va tao file Release (.zip, .deb)..." -ForegroundColor Yellow
Push-Location tools/launcher
go build -ldflags="-H windowsgui -s -w" -o "../../DeepSeek Harness.exe" .
Pop-Location
Copy-Item -Force "DeepSeek Harness.exe" "dist-release/DeepSeek-Harness-Windows.exe"
node tools/launcher/package-release-zips.js

# 7. Dong goi 1-File Standalone Setup Installer
Write-Host "`n[Buoc 6/6] Dong goi 1-File Standalone Setup Installer..." -ForegroundColor Yellow
node tools/installer/build.js

# Cap nhat Desktop Shortcut
powershell -ExecutionPolicy Bypass -File .\Tao-Shortcut-Desktop.ps1

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " [THANH CONG] DA HOAN TAT XUAT BAN CHO TOAN BO NEN TANG! " -ForegroundColor Green
Write-Host "  - Windows: dist-release/DeepSeek-Harness-v1.0.3-Windows-x64.zip va .exe" -ForegroundColor Green
Write-Host "  - macOS:   dist-release/DeepSeek-Harness-v1.0.3-macOS-*.zip (.app)" -ForegroundColor Green
Write-Host "  - Linux:   dist-release/deepseek-harness_1.0.3_*.deb va .zip" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
