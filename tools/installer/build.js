import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const winZip = path.join(ROOT_DIR, 'dist-release', 'DeepSeek-Harness-v1.0.3-Windows-x64.zip');
const installerDir = path.join(ROOT_DIR, 'tools', 'installer');
const payloadZip = path.join(installerDir, 'payload.zip');
const distRelease = path.join(ROOT_DIR, 'dist-release');

fs.mkdirSync(distRelease, { recursive: true });

console.log('1. Preparing payload from Windows release zip...');
if (!fs.existsSync(winZip)) {
  throw new Error(`Windows zip not found at: ${winZip}`);
}
fs.copyFileSync(winZip, payloadZip);

console.log('2. Compiling 1-File Standalone Setup Installer (Go with embedded payload)...');
const destExe = path.join(distRelease, 'DeepSeek-Harness-Setup-v1.0.3-Windows-x64.exe');
const rootExe = path.join(ROOT_DIR, 'DeepSeek-Harness-Setup.exe');
const releaseExe = path.join(distRelease, 'DeepSeek-Harness-Setup.exe');

execSync(`go build -ldflags="-H windowsgui -s -w" -o "${destExe}" ./tools/installer/main.go`, { cwd: ROOT_DIR, stdio: 'inherit' });

fs.copyFileSync(destExe, rootExe);
fs.copyFileSync(destExe, releaseExe);

if (fs.existsSync(payloadZip)) {
  fs.unlinkSync(payloadZip);
}

const stats = fs.statSync(destExe);
console.log(`\n[SUCCESS] Created 1-File Windows Setup Installer:`);
console.log(` - ${destExe} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
console.log(` - ${rootExe}`);
console.log(` - ${releaseExe}`);
