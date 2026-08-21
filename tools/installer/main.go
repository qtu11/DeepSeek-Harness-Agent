package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

//go:embed payload.zip
var payloadZip []byte

func main() {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		userProfile := os.Getenv("USERPROFILE")
		localAppData = filepath.Join(userProfile, "AppData", "Local")
	}
	installDir := filepath.Join(localAppData, "Programs", "DeepSeek Harness")

	_ = os.MkdirAll(installDir, 0755)

	// Extract payload
	if len(payloadZip) > 0 {
		reader, err := zip.NewReader(bytes.NewReader(payloadZip), int64(len(payloadZip)))
		if err == nil {
			for _, file := range reader.File {
				targetPath := filepath.Join(installDir, file.Name)
				if file.FileInfo().IsDir() {
					_ = os.MkdirAll(targetPath, file.Mode())
					continue
				}

				_ = os.MkdirAll(filepath.Dir(targetPath), 0755)

				outFile, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
				if err != nil {
					continue
				}

				rc, err := file.Open()
				if err != nil {
					outFile.Close()
					continue
				}

				_, _ = io.Copy(outFile, rc)
				outFile.Close()
				rc.Close()
			}
		}
	}

	exePath := filepath.Join(installDir, "DeepSeek Harness.exe")

	// Create Desktop & Start Menu Shortcuts
	createShortcuts(installDir, exePath)

	// Launch installed application
	cmd := exec.Command(exePath)
	cmd.Dir = installDir
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Start()
}

func createShortcuts(installDir, exePath string) {
	psScript := fmt.Sprintf(`
$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = [Environment]::GetFolderPath('Programs')

$shortcut1 = $wsh.CreateShortcut("$desktop\DeepSeek Harness.lnk")
$shortcut1.TargetPath = '%s'
$shortcut1.WorkingDirectory = '%s'
$shortcut1.IconLocation = '%s,0'
$shortcut1.Description = 'DeepSeek Harness AI Agent IDE'
$shortcut1.Save()

$shortcut2 = $wsh.CreateShortcut("$startMenu\DeepSeek Harness.lnk")
$shortcut2.TargetPath = '%s'
$shortcut2.WorkingDirectory = '%s'
$shortcut2.IconLocation = '%s,0'
$shortcut2.Description = 'DeepSeek Harness AI Agent IDE'
$shortcut2.Save()
`, exePath, installDir, exePath, exePath, installDir, exePath)

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", psScript)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	_ = cmd.Run()
}