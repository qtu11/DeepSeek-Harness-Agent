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

# 3. Dong goi Windows Electron Native App
Write-Host "`n[Buoc 2/5] Dong goi Windows Electron Native App..." -ForegroundColor Yellow
node tools/launcher/build-electron-app.js

# 4. Dong goi Multi-platform (Linux x64/arm64) & macOS .app bundles
Write-Host "`n[Buoc 3/5] Dong goi Linux x64/arm64 va macOS .app bundles..." -ForegroundColor Yellow
node tools/launcher/build-multiplatform-apps.js
node tools/launcher/build-macos-app.js

# 5. Dong goi Linux Debian (.deb) Packages
Write-Host "`n[Buoc 4/5] Dong goi Linux Debian (.deb) Packages..." -ForegroundColor Yellow
node tools/launcher/build-linux-deb.js

# 6. Bien dich Go Launcher va nen tat ca ban phat hanh (dist-release)
Write-Host "`n[Buoc 5/5] Bien dich Go Launcher va tao file Release (.zip, .exe, .deb)..." -ForegroundColor Yellow
Push-Location tools/launcher
go build -ldflags="-H windowsgui -s -w" -o "../../DeepSeek Harness.exe" .
Pop-Location
Copy-Item -Force "DeepSeek Harness.exe" "dist-release/DeepSeek-Harness-Windows.exe"
node tools/launcher/package-release-zips.js

# Cap nhat Desktop Shortcut
powershell -ExecutionPolicy Bypass -File .\Tao-Shortcut-Desktop.ps1

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " [THANH CONG] DA HOAN TAT XUAT BAN CHO TOAN BO NEN TANG! " -ForegroundColor Green
Write-Host "  - Windows: dist-release/DeepSeek-Harness-v1.0.3-Windows-x64.zip va .exe" -ForegroundColor Green
Write-Host "  - macOS:   dist-release/DeepSeek-Harness-v1.0.3-macOS-*.zip (.app)" -ForegroundColor Green
Write-Host "  - Linux:   dist-release/deepseek-harness_1.0.3_*.deb va .zip" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
