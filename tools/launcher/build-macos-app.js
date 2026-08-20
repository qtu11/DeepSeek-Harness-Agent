import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));

const infoPlistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>DeepSeek Harness</string>
    <key>CFBundleDisplayName</key>
    <string>DeepSeek Harness</string>
    <key>CFBundleIdentifier</key>
    <string>com.deepseek.harness.desktop</string>
    <key>CFBundleVersion</key>
    <string>1.0.3</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.3</string>
    <key>CFBundleExecutable</key>
    <string>DeepSeek Harness</string>
    <key>CFBundleIconFile</key>
    <string>icon.png</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSRequiresAquaSystemAppearance</key>
    <false/>
    <key>CFBundleCategoryType</key>
    <string>public.app-category.developer-tools</string>
</dict>
</plist>
`;

const commandScriptContent = `#!/bin/bash
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Launch macOS native app bundle
if [ -f "$DIR/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" ]; then
    chmod +x "$DIR/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"
    open "$DIR/DeepSeek Harness.app"
else
    npx electron ../../apps/desktop/main.cjs
fi
`;

async function buildMacApp(arch) {
  const targetDirName = `DeepSeek Harness-darwin-${arch}`;
  const outDir = path.join(ROOT_DIR, 'dist-app', targetDirName);
  const appDir = path.join(outDir, 'DeepSeek Harness.app');
  const contentsDir = path.join(appDir, 'Contents');
  const macOSDir = path.join(contentsDir, 'MacOS');
  const resourcesDir = path.join(contentsDir, 'Resources');
  const appResourcesDir = path.join(resourcesDir, 'app');

  fs.mkdirSync(macOSDir, { recursive: true });
  fs.mkdirSync(appResourcesDir, { recursive: true });

  // 1. Write Info.plist
  fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlistContent, 'utf8');

  // 2. Copy launcher executable
  const launcherSource = path.join(ROOT_DIR, 'dist-app', `dsh-launcher-darwin-${arch}`);
  const targetExecutable = path.join(macOSDir, 'DeepSeek Harness');
  if (fs.existsSync(launcherSource)) {
    fs.copyFileSync(launcherSource, targetExecutable);
  }

  // 3. Copy Icon
  const iconPng = path.join(ROOT_DIR, 'tools/launcher/winres/icon_256.png');
  if (fs.existsSync(iconPng)) {
    fs.copyFileSync(iconPng, path.join(resourcesDir, 'icon.png'));
  }

  // 4. Copy Desktop App Files
  const desktopSrc = path.join(ROOT_DIR, 'apps/desktop');
  const files = ['main.cjs', 'package.json', 'deepseek.ico', 'icon_256.png'];
  for (const f of files) {
    const srcFile = path.join(desktopSrc, f);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(appResourcesDir, f));
    }
  }

  // 5. Copy DS2API binary into the package
  const ds2apiSource = path.join(ROOT_DIR, 'tools/ds2api', `ds2api-darwin-${arch === 'arm64' ? 'arm64' : 'amd64'}`);
  if (fs.existsSync(ds2apiSource)) {
    fs.copyFileSync(ds2apiSource, path.join(resourcesDir, 'ds2api'));
  }

  // 6. Write 1-Click .command launcher for macOS Finder
  fs.writeFileSync(path.join(outDir, 'DeepSeek Harness.command'), commandScriptContent, { mode: 0o755 });

  console.log(`Successfully built macOS App bundle at: ${appDir}`);
}

async function main() {
  console.log('Building macOS App Bundles (darwin-arm64 and darwin-x64)...');
  await buildMacApp('arm64');
  await buildMacApp('x64');
  console.log('All macOS App bundles created successfully!');
}

main().catch(console.error);
