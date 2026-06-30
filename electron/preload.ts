import { contextBridge } from 'electron';

// Expose secure, limited APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
