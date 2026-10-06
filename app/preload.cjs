'use strict';
// No bridge is exposed to the website. Only the bundled connection screen can retry.
if (process.isMainFrame && location.protocol === 'file:' && location.pathname.endsWith('/offline.html')) {
  const {contextBridge, ipcRenderer} = require('electron');
  contextBridge.exposeInMainWorld('santaConnection', Object.freeze({retry: () => ipcRenderer.invoke('santa:retry')}));
}
