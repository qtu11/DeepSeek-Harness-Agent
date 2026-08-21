import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packager from 'electron-packager';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const rceditModule = require('rcedit');
const rcedit = rceditModule.rcedit || rceditModule;

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const icoPath = path.join(ROOT_DIR, 'tools/launcher/deepseek.ico');
const pngIconPath = path.join(ROOT_DIR, 'apps/desktop/icon_256.png');

const targets = [
  { platform: 'win32', arch: 'x64', name: 'Windows x64' },
  { platform: 'darwin', arch: 'x64', name: 'macOS Intel (x64)' },
  { platform: 'darwin', arch: 'arm64', name: 'macOS Apple Silicon (arm64)' },
  { platform: 'linux', arch: 'x64', name: 'Linux x64' },
  { platform: 'linux', arch: 'arm64', name: 'Linux arm64' },
];

async function buildAll() {
  console.log('====================================================');
  console.log(' Building DeepSeek Harness Desktop Apps across OS');
  console.log(' Targets: Windows, macOS (Intel & ARM), Linux (x64 & ARM64)');
  console.log('====================================================\n');

  const outDir = path.join(ROOT_DIR, 'dist-app');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const target of targets) {
    console.log(`\n--> Packaging for ${target.name} [${target.platform}-${target.arch}]...`);
    const isWindows = target.platform === 'win32';
    const selectedIcon = isWindows ? icoPath : pngIconPath;

    try {
      const packagerOptions = {
        dir: path.join(ROOT_DIR, 'apps/desktop'),
        name: 'DeepSeek Harness',
        platform: target.platform,
        arch: target.arch,
        icon: selectedIcon,
        out: outDir,
        overwrite: true,
        dereferenceSymlinks: true,
        appBundleId: 'com.deepseek.harness.desktop',
        appCategoryType: 'public.app-category.developer-tools',
      };

      if (isWindows) {
        packagerOptions.win32metadata = {
          CompanyName: 'DeepSeek AI',
          FileDescription: 'DeepSeek Harness Desktop App',
          OriginalFilename: 'DeepSeek Harness.exe',
          ProductName: 'DeepSeek Harness',
          InternalName: 'DeepSeek Harness',
        };
      }

      const appPaths = await packager(packagerOptions);
      console.log(`[SUCCESS] Packaged ${target.name} at:`, appPaths);

      if (isWindows && appPaths && appPaths.length > 0) {
        const exePath = path.join(appPaths[0], 'DeepSeek Harness.exe');
        if (fs.existsSync(exePath)) {
          console.log('Applying PE resource icon via rcedit to:', exePath);
          try {
            await rcedit(exePath, {
              icon: icoPath,
              'version-string': {
                CompanyName: 'DeepSeek AI',
                FileDescription: 'DeepSeek Harness Desktop App',
                ProductName: 'DeepSeek Harness',
                InternalName: 'DeepSeek Harness',
                OriginalFilename: 'DeepSeek Harness.exe',
              },
            });
            console.log('PE resource icon applied successfully.');
          } catch (err) {
            console.warn('rcedit notice:', err.message);
          }
        }
      }
    } catch (err) {
      console.error(`[ERROR] Failed packaging ${target.name}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log(' All Desktop Builds Finished. Artifacts in dist-app/');
  console.log('====================================================');
}

buildAll().catch((err) => {
  console.error('Build failed with fatal error:', err);
  process.exit(1);
});
