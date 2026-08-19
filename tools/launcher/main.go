package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

func main() {
	exePath, err := os.Executable()
	if err != nil {
		exePath, _ = filepath.Abs(".")
	}
	appDir := filepath.Dir(exePath)

	electronApp := filepath.Join(appDir, "dist-app", "DeepSeek Harness-win32-x64", "DeepSeek Harness.exe")

	if _, err := os.Stat(electronApp); err == nil {
		cmd := exec.Command(electronApp)
		cmd.Dir = appDir
		cmd.Env = os.Environ()
		_ = cmd.Run()
		return
	}

	// Fallback to npx electron
	cmd := exec.Command("npx", "electron", "apps/desktop/main.cjs")
	cmd.Dir = appDir
	cmd.Env = os.Environ()
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000,
	}
	_ = cmd.Run()
}
