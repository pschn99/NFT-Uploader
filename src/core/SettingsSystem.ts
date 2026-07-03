/**
 * SettingsSystem — manages user preferences (keybindings, audio, display).
 *
 * Persists settings via `StorageProvider` under the key `'settings'`.
 * Uses a typed `Settings` interface; defaults are applied for any missing fields
 * so the schema is forward-compatible with new settings added in later versions.
 *
 * Dependency direction: `src/core/` → `StorageProvider` only (no Phaser, no simulation).
 */

import type { StorageProvider } from './StorageProvider';

// ---------------------------------------------------------------------------
// Settings schema
// ---------------------------------------------------------------------------

export interface KeyBindings {
  flipperLeft:  string;
  flipperRight: string;
  plunger:      string;
  nudgeLeft:    string;
  nudgeRight:   string;
  anchor:       string;
  pause:        string;
}

export interface Settings {
  /** Keyboard binding map. Action name → key code string. */
  keyBindings: KeyBindings;
  /** Master audio volume 0.0–1.0. */
  masterVolume: number;
  /** Music volume 0.0–1.0 (relative to master). */
  musicVolume: number;
  /** SFX volume 0.0–1.0 (relative to master). */
  sfxVolume: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  keyBindings: {
    flipperLeft:  'KeyZ',
    flipperRight: 'KeyX',
    plunger:      'Space',
    nudgeLeft:    'KeyA',
    nudgeRight:   'KeyD',
    anchor:       'KeyS',
    pause:        'Escape',
  },
  masterVolume: 1.0,
  musicVolume:  0.8,
  sfxVolume:    1.0,
});

// ---------------------------------------------------------------------------
// SettingsSystem
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'settings';

export class SettingsSystem {
  private storage: StorageProvider;
  private _settings: Settings = { ...DEFAULT_SETTINGS, keyBindings: { ...DEFAULT_SETTINGS.keyBindings } };

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  /** Loads persisted settings from storage, applying defaults for missing fields. */
  async initialize(): Promise<void> {
    const saved = await this.storage.load<Partial<Settings>>(STORAGE_KEY);
    if (saved) {
      this._settings = this.merge(DEFAULT_SETTINGS, saved);
    }
  }

  /** Returns a copy of the current settings (read-only to callers). */
  get settings(): Readonly<Settings> {
    return this._settings;
  }

  /** Updates one or more settings fields and persists immediately. */
  async update(patch: Partial<Settings>): Promise<void> {
    this._settings = this.merge(this._settings, patch);
    await this.storage.save(STORAGE_KEY, this._settings);
  }

  /** Resets all settings to defaults and persists. */
  async reset(): Promise<void> {
    this._settings = { ...DEFAULT_SETTINGS, keyBindings: { ...DEFAULT_SETTINGS.keyBindings } };
    await this.storage.save(STORAGE_KEY, this._settings);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private merge(base: Settings, patch: Partial<Settings>): Settings {
    return {
      keyBindings: { ...base.keyBindings, ...(patch.keyBindings ?? {}) },
      masterVolume: patch.masterVolume ?? base.masterVolume,
      musicVolume:  patch.musicVolume  ?? base.musicVolume,
      sfxVolume:    patch.sfxVolume    ?? base.sfxVolume,
    };
  }
}
