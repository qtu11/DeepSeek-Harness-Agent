import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const distApp = path.join(ROOT_DIR, 'dist-app');
const distRelease = path.join(ROOT_DIR, 'dist-release');
const tempDebDir = path.join(ROOT_DIR, 'dist-app', 'temp-deb');

fs.mkdirSync(distRelease, { recursive: true });

/**
 * Creates an ar archive buffer from file entries (Debian package standard format).
 * Each header is 60 bytes:
 * - File identifier (16 chars, padded with space and trailing `/`)
 * - File modification timestamp (12 chars decimal)
 * - Owner ID (6 chars)
 * - Group ID (6 chars)
 * - File mode (8 chars octal)
 * - File size in bytes (10 chars decimal)
 * - Ending characters (`\x60\x0A`)
 */
function createArArchive(files) {
  const chunks = [Buffer.from('!<arch>\n', 'ascii')];

  for (const f of files) {
    const name = f.name;
    const nameField = (name.length <= 15 ? name + '/' : name).padEnd(16, ' ');
    const mtime = Math.floor(Date.now() / 1000).toString().padEnd(12, ' ');
    const uid = '0'.padEnd(6, ' ');
    const gid = '0'.padEnd(6, ' ');
    const mode = '100644'.padEnd(8, ' ');
    const size = f.content.length.toString().padEnd(10, ' ');
    const header = Buffer.from(nameField + mtime + uid + gid + mode + size + '`\n', 'ascii');

    chunks.push(header);
    chunks.push(f.content);
    // If odd length, pad 1 newline byte
    if (f.content.length % 2 !== 0) {
      chunks.push(Buffer.from('\n', 'ascii'));
    }
  }

  return Buffer.concat(chunks);
}

function calculateDirSizeKb(dirPath) {
  let sizeBytes = 0;
  function walk(curr) {
    const entries = fs.readdirSync(curr, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(curr, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile()) {
        sizeBytes += fs.statSync(full).size;
      }
    }
  }
  walk(dirPath);
  return Math.ceil(sizeBytes / 1024);
}

async function buildDeb(arch, debArch) {
  const linuxDirName = `DeepSeek Harness-linux-${arch}`;
  const linuxAppDir = path.join(distApp, linuxDirName);

  if (!fs.existsSync(linuxAppDir)) {
    console.warn(`[Skip] ${linuxDirName} does not exist. Run build-multiplatform-apps.js first.`);
    return;
  }

  console.log(`Building Debian .deb package for Linux (${debArch})...`);
  const stageDir = path.join(tempDebDir, debArch);
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });

  const controlStage = path.join(stageDir, 'control-dir');
  const dataStage = path.join(stageDir, 'data-dir');
  fs.mkdirSync(controlStage, { recursive: true });
  fs.mkdirSync(dataStage, { recursive: true });

  // 1. Setup opt/deepseek-harness
  const optAppDir = path.join(dataStage, 'opt', 'deepseek-harness');
  fs.mkdirSync(optAppDir, { recursive: true });
  fs.cpSync(linuxAppDir, optAppDir, { recursive: true });

  // 2. Setup usr/bin launcher
  const binDir = path.join(dataStage, 'usr', 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const launcherScript = `#!/bin/sh\nexec "/opt/deepseek-harness/DeepSeek Harness" "$@"\n`;
  fs.writeFileSync(path.join(binDir, 'deepseek-harness'), launcherScript, { mode: 0o755 });

  // 3. Setup desktop application entry
  const appEntryDir = path.join(dataStage, 'usr', 'share', 'applications');
  fs.mkdirSync(appEntryDir, { recursive: true });
  const desktopEntry = `[Desktop Entry]
Name=DeepSeek Harness
GenericName=AI Agent IDE
Comment=Autonomous AI Coding Agent & Full-Stack Development Platform
Exec=/usr/bin/deepseek-harness %U
Icon=deepseek-harness
Type=Application
StartupNotify=true
Terminal=false
Categories=Development;IDE;Programming;
Keywords=deepseek;agent;ai;coding;harness;
`;
  fs.writeFileSync(path.join(appEntryDir, 'deepseek-harness.desktop'), desktopEntry, 'utf8');

  // 4. Setup icon
  const iconDir = path.join(dataStage, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps');
  fs.mkdirSync(iconDir, { recursive: true });
  const iconPng = path.join(ROOT_DIR, 'tools/launcher/winres/icon_256.png');
  if (fs.existsSync(iconPng)) {
    fs.copyFileSync(iconPng, path.join(iconDir, 'deepseek-harness.png'));
  }

  // 5. Build control file
  const installedSizeKb = calculateDirSizeKb(dataStage);
  const controlContent = `Package: deepseek-harness
Version: 1.0.3
Section: devel
Priority: optional
Architecture: ${debArch}
Maintainer: DeepSeek AI <support@deepseek.com>
Installed-Size: ${installedSizeKb}
Depends: gconf2, gconf-service, libgtk-3-0, libnotify4, libnss3, libxss1, libasound2, libsecret-1-0 | libsecret-1-0-dbg
Description: DeepSeek Harness Desktop
 Autonomous AI Coding Agent & System Architecture Platform.
 Features DeepThink reasoning, AST graph mapping, local runtime, and multi-agent coordination.
`;
  fs.writeFileSync(path.join(controlStage, 'control'), controlContent.replace(/\r\n/g, '\n'), 'utf8');

  // 6. Create control.tar.gz and data.tar.gz via tar
  const controlTarGz = path.join(stageDir, 'control.tar.gz');
  const dataTarGz = path.join(stageDir, 'data.tar.gz');

  execSync(`tar -czf "${controlTarGz}" -C "${controlStage}" .`, { stdio: 'pipe' });
  execSync(`tar -czf "${dataTarGz}" -C "${dataStage}" .`, { stdio: 'pipe' });

  // 7. Assemble ar .deb file
  const debianBinary = Buffer.from('2.0\n', 'ascii');
  const controlContentBuf = fs.readFileSync(controlTarGz);
  const dataContentBuf = fs.readFileSync(dataTarGz);

  const debBuf = createArArchive([
    { name: 'debian-binary', content: debianBinary },
    { name: 'control.tar.gz', content: controlContentBuf },
    { name: 'data.tar.gz', content: dataContentBuf },
  ]);

  const debFileName = `deepseek-harness_1.0.3_${debArch}.deb`;
  const destDeb = path.join(distRelease, debFileName);
  fs.writeFileSync(destDeb, debBuf);

  console.log(`[Success] Created Debian package: ${debFileName} (${(debBuf.length / 1024 / 1024).toFixed(2)} MB) in dist-release/`);

  // Cleanup temp stage
  fs.rmSync(stageDir, { recursive: true, force: true });
}

async function main() {
  await buildDeb('x64', 'amd64');
  await buildDeb('arm64', 'arm64');
  if (fs.existsSync(tempDebDir)) {
    fs.rmSync(tempDebDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[Error building .deb]:', err);
  process.exit(1);
});
