import { contextBridge, ipcRenderer } from 'electron';

// Expose secure, limited APIs to the renderer process via contextBridge.
// All Electron/Node APIs must be explicitly whitelisted here; the renderer
// has contextIsolation: true and nodeIntegration: false.
contextBridge.exposeInMainWorld('electronAPI', {
  /** Flag the renderer can check to detect the Electron container. */
  isElectron: true,

  /** Host platform string (e.g. 'darwin', 'win32', 'linux'). */
  platform: process.platform,

  /**
   * Opens a native OS Save File dialog and writes JSON data to the chosen path.
   *
   * @param defaultName  Suggested filename (e.g. 'my_level.json').
   * @param data         Arbitrary data to serialise as JSON.
   * @returns            `true` on success, `false` if the user cancelled.
   */
  saveFileDialog: (defaultName: string, data: unknown): Promise<boolean> =>
    ipcRenderer.invoke('dialog:saveFile', { defaultName, data }),

  /**
   * Opens a native OS Open File dialog and returns the parsed JSON content.
   *
   * @returns Parsed JSON object, or `null` if the user cancelled or the file
   *          could not be read.
   */
  loadFileDialog: (): Promise<unknown | null> =>
    ipcRenderer.invoke('dialog:openFile'),
});

