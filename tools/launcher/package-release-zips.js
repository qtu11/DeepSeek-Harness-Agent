import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const distApp = path.join(ROOT_DIR, 'dist-app');
const distRelease = path.join(ROOT_DIR, 'dist-release');

fs.mkdirSync(distRelease, { recursive: true });

const targets = [
  { folder: 'DeepSeek Harness-win32-x64', zip: 'DeepSeek-Harness-v1.0.3-Windows-x64.zip' },
  { folder: 'DeepSeek Harness-linux-x64', zip: 'DeepSeek-Harness-v1.0.3-Linux-x64.zip' },
  { folder: 'DeepSeek Harness-linux-arm64', zip: 'DeepSeek-Harness-v1.0.3-Linux-arm64.zip' },
  { folder: 'DeepSeek Harness-darwin-x64', zip: 'DeepSeek-Harness-v1.0.3-macOS-x64.zip' },
  { folder: 'DeepSeek Harness-darwin-arm64', zip: 'DeepSeek-Harness-v1.0.3-macOS-arm64.zip' },
];

for (const t of targets) {
  const src = path.join(distApp, t.folder);
  const dest = path.join(distRelease, t.zip);

  if (fs.existsSync(src)) {
    console.log(`Compressing ${t.folder} -> ${t.zip}...`);
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
    try {
      execSync(cmd, { stdio: 'inherit' });
      if (fs.existsSync(dest)) {
        console.log(`Updated ${t.zip} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(2)} MB)`);
      }
    } catch (err) {
      console.warn(`Warning compressing ${t.folder}:`, err.message);
    }
  }
}

console.log('All release archives successfully updated in dist-release!');
