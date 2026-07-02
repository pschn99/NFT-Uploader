import { StorageProvider } from './StorageProvider';
import { BrowserStorageProvider } from './BrowserStorageProvider';

export class StorageProviderFactory {
  /**
   * Factory method to return the correct StorageProvider.
   * If running in a headless/Node.js environment, returns a MemoryStorageProvider.
   * If running in Electron/Browser, returns a BrowserStorageProvider.
   */
  static create(): StorageProvider {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return new MemoryStorageProvider();
    }
    return new BrowserStorageProvider();
  }
}

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
