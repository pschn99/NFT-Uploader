import { StorageProvider } from './core/StorageProvider';

export class SaveSystem {
  constructor(private storage: StorageProvider) {}

  async initialize(): Promise<void> {
    console.log('SaveSystem initialized stub with storage provider:', this.storage);
  }
}

export class SettingsSystem {
  constructor(private storage: StorageProvider) {}

  async initialize(): Promise<void> {
    console.log('SettingsSystem initialized stub with storage provider:', this.storage);
  }
}

export class Application {
  public saveSystem: SaveSystem;
  public settingsSystem: SettingsSystem;

  constructor(private storage: StorageProvider) {
    this.saveSystem = new SaveSystem(this.storage);
    this.settingsSystem = new SettingsSystem(this.storage);
  }

  async boot(): Promise<void> {
    console.log('Application booting...');
    await this.saveSystem.initialize();
    await this.settingsSystem.initialize();
    console.log('Application boot complete');
  }
}
