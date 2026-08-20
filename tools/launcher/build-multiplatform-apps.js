import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packager from 'electron-packager';
import fs from 'node:fs';

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const iconIco = path.join(ROOT_DIR, 'tools/launcher/deepseek.ico');
const iconPng = path.join(ROOT_DIR, 'tools/launcher/winres/icon_256.png');

async function buildPlatform(platform, arch) {
  console.log(`Packaging DeepSeek Harness for ${platform}-${arch}...`);
  try {
    const appPaths = await packager({
      dir: path.join(ROOT_DIR, 'apps/desktop'),
      name: 'DeepSeek Harness',
      platform,
      arch,
      icon: platform === 'win32' ? iconIco : iconPng,
      out: path.join(ROOT_DIR, 'dist-app'),
      overwrite: true,
      asar: false,
      prune: false,
      appBundleId: 'com.deepseek.harness.desktop',
      appCategoryType: 'public.app-category.developer-tools',
      win32metadata: {
        CompanyName: 'DeepSeek AI',
        FileDescription: 'DeepSeek Harness Desktop App',
        OriginalFilename: 'DeepSeek Harness.exe',
        ProductName: 'DeepSeek Harness',
        InternalName: 'DeepSeek Harness',
      },
    });
    console.log(`Successfully packaged ${platform}-${arch} at:`, appPaths[0]);
    return appPaths[0];
  } catch (err) {
    console.error(`Failed to package ${platform}-${arch}:`, err.message);
    throw err;
  }
}

async function main() {
  const targets = [
    { platform: 'linux', arch: 'x64' },
    { platform: 'linux', arch: 'arm64' },
    { platform: 'darwin', arch: 'x64' },
    { platform: 'darwin', arch: 'arm64' },
  ];

  for (const target of targets) {
    await buildPlatform(target.platform, target.arch);
  }

  console.log('All multiplatform builds completed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
