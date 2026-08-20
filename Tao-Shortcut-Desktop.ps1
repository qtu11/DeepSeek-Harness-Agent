$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$TargetFile = Join-Path (Get-Location) "DeepSeek Harness.exe"
$IcoFile = Join-Path (Get-Location) "tools\launcher\deepseek.ico"
$ShortcutFile = Join-Path $DesktopPath "DeepSeek Harness.lnk"

if (Test-Path $TargetFile) {
    $Shortcut = $WshShell.CreateShortcut($ShortcutFile)
    $Shortcut.TargetPath = $TargetFile
    $Shortcut.WorkingDirectory = (Get-Location).Path
    $Shortcut.Description = "DeepSeek Harness Desktop App"
    if (Test-Path $IcoFile) {
        $Shortcut.IconLocation = "$IcoFile,0"
    } else {
        $Shortcut.IconLocation = "$TargetFile,0"
    }
    $Shortcut.Save()
    Write-Host "[Thanh cong] Da tao Shortcut 'DeepSeek Harness' ra man hinh Desktop!" -ForegroundColor Green
} else {
    Write-Host "[Loi] Khong tim thay file DeepSeek Harness.exe trong thu muc hien tai." -ForegroundColor Red
}
