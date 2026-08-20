package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

func main() {
	exePath, err := os.Executable()
	if err != nil {
		exePath, _ = filepath.Abs(".")
	}
	appDir := filepath.Dir(exePath)

	var electronApp string
	switch runtime.GOOS {
	case "windows":
		electronApp = filepath.Join(appDir, "dist-app", "DeepSeek Harness-win32-x64", "DeepSeek Harness.exe")
	case "darwin":
		electronApp = filepath.Join(appDir, "dist-app", "DeepSeek Harness-darwin-x64", "DeepSeek Harness.app", "Contents", "MacOS", "DeepSeek Harness")
		if _, err := os.Stat(electronApp); err != nil {
			electronApp = filepath.Join(appDir, "dist-app", "DeepSeek Harness-darwin-arm64", "DeepSeek Harness.app", "Contents", "MacOS", "DeepSeek Harness")
		}
	case "linux":
		electronApp = filepath.Join(appDir, "dist-app", "DeepSeek Harness-linux-x64", "DeepSeek Harness")
		if _, err := os.Stat(electronApp); err != nil {
			electronApp = filepath.Join(appDir, "dist-app", "DeepSeek Harness-linux-arm64", "DeepSeek Harness")
		}
	}

	if electronApp != "" {
		if _, err := os.Stat(electronApp); err == nil {
			cmd := exec.Command(electronApp)
			cmd.Dir = appDir
			cmd.Env = os.Environ()
			_ = cmd.Run()
			return
		}
	}

	// Fallback to npx electron
	cmd := exec.Command("npx", "electron", "apps/desktop/main.cjs")
	cmd.Dir = appDir
	cmd.Env = os.Environ()
	cmd.SysProcAttr = getSysProcAttr()
	_ = cmd.Run()
}
