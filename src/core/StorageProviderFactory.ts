import { StorageProvider } from './StorageProvider';
import { BrowserStorageProvider } from './BrowserStorageProvider';
import { ElectronStorageProvider } from './ElectronStorageProvider';

export class StorageProviderFactory {
  /**
   * Returns the correct StorageProvider for the current runtime environment:
   *
   * - **Electron** (`window.electronAPI.isElectron === true`):
   *   `ElectronStorageProvider` — uses localStorage + native file dialogs.
   * - **Browser** (window + localStorage available, but no Electron):
   *   `BrowserStorageProvider` — uses localStorage only.
   * - **Headless / Node.js** (no window, e.g. Jest / replay-runner):
   *   `MemoryStorageProvider` — in-memory only, no persistence.
   */
  static create(): StorageProvider {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      // Headless / Node.js (tests, replay-runner)
      return new MemoryStorageProvider();
    }

    if ((window as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron) {
      // Running inside the Electron shell
      return new ElectronStorageProvider();
    }

    // Browser / dev server without Electron
    return new BrowserStorageProvider();
  }
}

// ---------------------------------------------------------------------------
// MemoryStorageProvider — headless fallback (Node.js / Jest)
// ---------------------------------------------------------------------------

class MemoryStorageProvider implements StorageProvider {
  private storage: Record<string, string> = {};

  async save(key: string, data: unknown): Promise<void> {
    this.storage[key] = JSON.stringify(data);
  }

  async load<T>(key: string): Promise<T | null> {
    const val = this.storage[key];
    if (!val) return null;
    return JSON.parse(val) as T;
  }
}

