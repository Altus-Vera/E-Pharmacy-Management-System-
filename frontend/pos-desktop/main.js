const { app, BrowserWindow, Menu, ipcMain } = require('electron');
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

// ── Silent receipt printing ───────────────────────────────────────────────────
// Prints straight to the receipt printer (no Windows print dialog), like a till.
// Printer: RECEIPT_PRINTER env var (exact name as in Windows "Printers & scanners"), otherwise the Windows default printer.
ipcMain.handle('list-printers', async () => {
  const list = await mainWindow.webContents.getPrintersAsync();
  return list.map((p) => ({ name: p.name, isDefault: p.isDefault }));
});

ipcMain.handle('print-receipt', async (_e, html) => {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const printers = await win.webContents.getPrintersAsync();
    const wanted = process.env.RECEIPT_PRINTER;
    const device = (wanted && printers.find((p) => p.name === wanted)) || printers.find((p) => p.isDefault);
    if (!device) return { ok: false, error: 'No printer is installed' };
    return await new Promise((resolve) => {
      win.webContents.print(
        { silent: true, printBackground: false, deviceName: device.name, margins: { marginType: 'none' } },
        (ok, reason) => resolve(ok ? { ok: true, printer: device.name } : { ok: false, error: reason, printer: device.name })
      );
    });
  } finally {
    setTimeout(() => win.destroy(), 500);
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
