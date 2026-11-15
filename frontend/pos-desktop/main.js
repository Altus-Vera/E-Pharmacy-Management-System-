const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');

require('events').EventEmitter.defaultMaxListeners = 50;

const POS_URL = 'http://localhost:5120';
const RETRY_INTERVAL = 2000;
const MAX_RETRIES = 30;

let mainWindow;
let retryCount = 0;
let loaded = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'AltusVera Pharmacy POS',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#1a1a2e',
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Show loading screen immediately
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));

  // Start polling for the POS dev server
  pollForServer();
}

function pollForServer() {
  if (loaded) return;

  if (retryCount >= MAX_RETRIES) {
    if (!loaded) {
      mainWindow.loadFile(path.join(__dirname, 'offline.html'));
    }
    return;
  }

  retryCount++;

  const req = http.get(POS_URL, (res) => {
    res.resume(); // consume response so socket closes cleanly
    if (!loaded) {
      loaded = true;
      mainWindow.loadURL(POS_URL);
    }
  });

  req.on('error', () => {
    // Server not ready yet — retry after interval
    setTimeout(pollForServer, RETRY_INTERVAL);
  });

  // Treat timeout as not-ready; destroy without triggering error handler
  req.setTimeout(1500, () => {
    req.off('error', () => {}); // remove default listener
    req.on('error', () => {}); // suppress the destroy-induced error
    req.destroy();
    setTimeout(pollForServer, RETRY_INTERVAL);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
