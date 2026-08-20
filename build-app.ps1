# Script build toan bo DeepSeek Harness App
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   DANG BUILD DEEPSEEK HARNESS STANDALONE   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Tat cac tien trinh dang chay neu co
taskkill /F /IM electron.exe /T 2>$null
taskkill /F /IM "DeepSeek Harness.exe" /T 2>$null
Start-Sleep -Seconds 1

# 2. Build Web & Backend Packages
Write-Host "`n[Buoc 1/3] Bien dich Packages va Web Frontend..." -ForegroundColor Yellow
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[LOI] Bien dich packages that bai!" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 3. Dong goi Electron Native App
Write-Host "`n[Buoc 2/3] Dong goi Electron Native App..." -ForegroundColor Yellow
node tools/launcher/build-electron-app.js

# 4. Bien dich file khoi chay Go Launcher (Khong console den)
Write-Host "`n[Buoc 3/3] Bien dich Go Launcher (DeepSeek Harness.exe)..." -ForegroundColor Yellow
go build -ldflags="-H windowsgui -s -w" -o "DeepSeek Harness.exe" ./tools/launcher/main.go ./tools/launcher/proc_windows.go

# 5. Cap nhat Desktop Shortcut
powershell -ExecutionPolicy Bypass -File .\Tao-Shortcut-Desktop.ps1

Write-Host "`n=============================================" -ForegroundColor Green
Write-Host " [THANH CONG] DA BUILD XONG DEEPSEEK HARNESS " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
