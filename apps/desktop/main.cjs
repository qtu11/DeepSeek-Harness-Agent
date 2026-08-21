const { app, BrowserWindow, shell, dialog, nativeImage } = require('electron');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

function findRootDir() {
  const candidates = [
    __dirname,
    process.cwd(),
    path.join(process.env.USERPROFILE || '', 'Desktop', 'deepseek harness'),
    path.join(process.env.HOME || '', 'Desktop', 'deepseek harness'),
  ];

  for (const startDir of candidates) {
    if (!startDir || !fs.existsSync(startDir)) continue;
    let curr = startDir;
    for (let i = 0; i < 8; i++) {
      if (
        fs.existsSync(path.join(curr, 'apps/cli/src/bin.ts')) ||
        (fs.existsSync(path.join(curr, 'package.json')) && fs.existsSync(path.join(curr, 'pnpm-workspace.yaml')))
      ) {
        return curr;
      }
      const parent = path.dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }
  }

  return path.resolve(__dirname, '../../');
}

const ROOT_DIR = findRootDir();
const LOCAL_ICO = path.join(__dirname, 'deepseek.ico');
const LOCAL_PNG = path.join(__dirname, 'icon_256.png');
const ROOT_ICO = path.join(ROOT_DIR, 'tools/launcher/deepseek.ico');
const ROOT_PNG = path.join(ROOT_DIR, 'tools/launcher/winres/icon_256.png');

function getAppIcon() {
  if (fs.existsSync(LOCAL_ICO)) return LOCAL_ICO;
  if (fs.existsSync(LOCAL_PNG)) return LOCAL_PNG;
  if (fs.existsSync(ROOT_ICO)) return ROOT_ICO;
  if (fs.existsSync(ROOT_PNG)) return ROOT_PNG;
  return undefined;
}

const WEB_PORT = process.env.PORT || '23080';
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

let mainWindow = null;
let backendProcess = null;

// Set Application Identity
app.name = 'DeepSeek Harness';
if (process.platform === 'win32') {
  app.setAppUserModelId('com.deepseek.harness.desktop');
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

function isServerAlive(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackendIfNeeded() {
  if (await isServerAlive(WEB_URL)) {
    return;
  }

  loadEnv();
  process.env.PORT = WEB_PORT;

  const binJs = path.join(ROOT_DIR, 'apps', 'cli', 'lib', 'bin.js');
  const binTs = path.join(ROOT_DIR, 'apps', 'cli', 'src', 'bin.ts');

  if (fs.existsSync(binJs)) {
    backendProcess = spawn('node', [binJs, 'web', '--port', WEB_PORT], {
      cwd: ROOT_DIR,
      env: { ...process.env, PORT: WEB_PORT },
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    backendProcess = spawn('node', ['--import', 'tsx/esm', binTs, 'web', '--port', WEB_PORT], {
      cwd: ROOT_DIR,
      env: { ...process.env, PORT: WEB_PORT },
      stdio: 'ignore',
      windowsHide: true,
    });
  }

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });
}

function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = async () => {
      if (await isServerAlive(url)) {
        resolve(true);
      } else if (Date.now() - start < timeoutMs) {
        setTimeout(check, 300);
      } else {
        resolve(false);
      }
    };
    check();
  });
}

function createWindow() {
  const iconPath = getAppIcon();
  let appImage = undefined;
  if (iconPath) {
    try {
      appImage = nativeImage.createFromPath(iconPath);
    } catch {}
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'DeepSeek Harness',
    icon: appImage || iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
    show: false,
  });

  if (appImage && !appImage.isEmpty() && process.platform === 'win32') {
    mainWindow.setIcon(appImage);
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      if (!url.includes(`127.0.0.1:${WEB_PORT}`) && !url.includes(`localhost:${WEB_PORT}`)) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(WEB_URL);
}

app.whenReady().then(async () => {
  await startBackendIfNeeded();

  const ready = await waitForServer(WEB_URL);
  if (!ready) {
    dialog.showErrorBox(
      'Lỗi khởi động DeepSeek Harness',
      `Máy chủ không phản hồi tại ${WEB_URL}. Vui lòng kiểm tra lại môi trường.`
    );
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill();
    } catch {}
  }
  app.quit();
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill();
    } catch {}
  }
});
