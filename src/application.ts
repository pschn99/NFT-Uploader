/**
 * Application — composition root for PINBALLZZZ.
 *
 * Owns the single shared `StorageProvider` instance and creates all
 * top-level systems (SettingsSystem, SaveSystem). `GameSession` is created
 * and destroyed per run, not here.
 *
 * Architecture: Application → StorageProvider, SettingsSystem, SaveSystem.
 * No Phaser, no simulation imports — those live in render/ and simulation/.
 */

import { StorageProviderFactory } from './core/StorageProviderFactory';
import { SettingsSystem } from './core/SettingsSystem';
import { SaveSystem } from './save/SaveSystem';
import type { StorageProvider } from './core/StorageProvider';

export class Application {
  public readonly storage: StorageProvider;
  public readonly settingsSystem: SettingsSystem;
  public readonly saveSystem: SaveSystem;

  constructor() {
    this.storage = StorageProviderFactory.create();
    this.settingsSystem = new SettingsSystem(this.storage);
    this.saveSystem = new SaveSystem(this.storage);
  }

  /** Initialise all persistent systems. Must be awaited before showing any UI. */
  async boot(): Promise<void> {
    await Promise.all([
      this.settingsSystem.initialize(),
      this.saveSystem.initialize(),
    ]);
  }
}

