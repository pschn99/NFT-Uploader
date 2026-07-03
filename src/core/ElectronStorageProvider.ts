/**
 * ElectronStorageProvider — StorageProvider implementation for the Electron container.
 *
 * Uses `window.electronAPI` (exposed via contextBridge in preload.ts) for:
 *   - Persistent key/value storage via localStorage (same as BrowserStorageProvider)
 *   - Native OS file dialogs for Creator Studio level save/load
 *
 * The file dialog methods (`saveFileDialog`, `loadFileDialog`) delegate to
 * the main-process IPC handlers (`dialog:saveFile`, `dialog:openFile`) that
 * are registered in `electron/main.ts`.
 *
 * If `window.electronAPI` is unavailable (e.g. running in a browser during
 * dev without Electron), this provider falls back gracefully to localStorage
 * for key/value operations and no-ops for file dialogs.
 */

import type { StorageProvider } from './StorageProvider';

// Type declaration for the contextBridge API shape exposed by preload.ts.
// This mirrors the object in `contextBridge.exposeInMainWorld('electronAPI', { ... })`.
interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  saveFileDialog(defaultName: string, data: unknown): Promise<boolean>;
  loadFileDialog(): Promise<unknown | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export class ElectronStorageProvider implements StorageProvider {
  // ---------------------------------------------------------------------------
  // Key/value storage (same as BrowserStorageProvider — uses localStorage)
  // ---------------------------------------------------------------------------

  async save(key: string, data: unknown): Promise<void> {
    try {
      localStorage.setItem(`pinballzzz_${key}`, JSON.stringify(data));
    } catch (err) {
      console.error(`ElectronStorageProvider.save("${key}") failed:`, err);
      throw err;
    }
  }

  async load<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(`pinballzzz_${key}`);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`ElectronStorageProvider.load("${key}") failed:`, err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Native file dialogs — delegate to main-process IPC via contextBridge
  // ---------------------------------------------------------------------------

  /**
   * Opens a native OS Save File dialog and writes JSON data to the chosen path.
   * Returns `true` on success, `false` if the user cancelled.
   */
  async saveFileDialog(defaultName: string, data: unknown): Promise<boolean> {
    if (!window.electronAPI?.saveFileDialog) {
      console.warn('ElectronStorageProvider: saveFileDialog not available (not in Electron?)');
      return false;
    }
    return window.electronAPI.saveFileDialog(defaultName, data);
  }

  /**
   * Opens a native OS Open File dialog and returns the parsed JSON content.
   * Returns `null` if the user cancelled or the file could not be read.
   */
  async loadFileDialog(): Promise<unknown | null> {
    if (!window.electronAPI?.loadFileDialog) {
      console.warn('ElectronStorageProvider: loadFileDialog not available (not in Electron?)');
      return null;
    }
    return window.electronAPI.loadFileDialog();
  }
}
