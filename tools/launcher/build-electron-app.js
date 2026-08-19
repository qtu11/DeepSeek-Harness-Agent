import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packager from 'electron-packager';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const rcedit = require('rcedit');

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const iconPath = path.join(ROOT_DIR, 'tools/launcher/deepseek.ico');

async function buildApp() {
  console.log('Building Electron Desktop App for DeepSeek Harness...');
  const appPaths = await packager({
    dir: path.join(ROOT_DIR, 'apps/desktop'),
    name: 'DeepSeek Harness',
    platform: 'win32',
    arch: 'x64',
    icon: iconPath,
    out: path.join(ROOT_DIR, 'dist-app'),
    overwrite: true,
    asar: false,
    prune: false,
    win32metadata: {
      CompanyName: 'DeepSeek AI',
      FileDescription: 'DeepSeek Harness Desktop App',
      OriginalFilename: 'DeepSeek Harness.exe',
      ProductName: 'DeepSeek Harness',
      InternalName: 'DeepSeek Harness',
    }
  });

  const exePath = path.join(appPaths[0], 'DeepSeek Harness.exe');
  console.log('Applying PE resource icon via rcedit to:', exePath);
  try {
    await rcedit(exePath, {
      icon: iconPath,
      'version-string': {
        CompanyName: 'DeepSeek AI',
        FileDescription: 'DeepSeek Harness Desktop App',
        ProductName: 'DeepSeek Harness',
        InternalName: 'DeepSeek Harness',
        OriginalFilename: 'DeepSeek Harness.exe',
      }
    });
    console.log('PE resource icon applied successfully.');
  } catch (err) {
    console.warn('rcedit notice:', err.message);
  }

  console.log('Build completed at:', appPaths);
}

buildApp().catch(console.error);
