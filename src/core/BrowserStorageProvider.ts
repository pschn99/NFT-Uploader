import { StorageProvider } from './StorageProvider';

export class BrowserStorageProvider implements StorageProvider {
  async save(key: string, data: unknown): Promise<void> {
    try {
      localStorage.setItem(`pinballzzz_${key}`, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  async load<T>(key: string): Promise<T | null> {
    try {
      const value = localStorage.getItem(`pinballzzz_${key}`);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
      return null;
    }
  }
}
