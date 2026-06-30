import { Application } from '../src/application';
import { StorageProvider } from '../src/core/StorageProvider';

class MockStorage implements StorageProvider {
  async save(_key: string, _data: unknown): Promise<void> {}
  async load<T>(_key: string): Promise<T | null> {
    return null;
  }
}

describe('Scaffold Test', () => {
  it('should instantiate and boot the application successfully', async () => {
    const storage = new MockStorage();
    const app = new Application(storage);
    await expect(app.boot()).resolves.not.toThrow();
  });
});
