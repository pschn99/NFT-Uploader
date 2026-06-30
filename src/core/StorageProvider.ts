export interface StorageProvider {
  /**
   * Saves data associated with the given key.
   */
  save(key: string, data: unknown): Promise<void>;

  /**
   * Loads data associated with the given key. Returns null if not found.
   */
  load<T>(key: string): Promise<T | null>;

  /**
   * Opens an OS-native save file dialog to export level data to a specific file.
   * Only applicable when running inside the Electron shell.
   */
  saveFileDialog?(defaultName: string, data: unknown): Promise<boolean>;

  /**
   * Opens an OS-native open file dialog to import level data.
   * Only applicable when running inside the Electron shell.
   */
  loadFileDialog?(): Promise<unknown | null>;
}
