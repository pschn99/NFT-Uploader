import { Application } from '../src/application';

describe('Scaffold Test', () => {
  it('should instantiate and boot the application successfully', async () => {
    // Application() now wires its own StorageProviderFactory internally.
    // In Node.js / Jest (no window), the factory returns MemoryStorageProvider.
    const app = new Application();
    await expect(app.boot()).resolves.not.toThrow();
  });
});
