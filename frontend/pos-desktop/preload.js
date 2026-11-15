const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  /** Print receipt HTML silently to the receipt printer (no dialog). */
  printReceipt: (html) => ipcRenderer.invoke('print-receipt', html),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
});
