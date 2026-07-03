/**
 * SaveSystem — manages campaign progression and player unlocks.
 *
 * Persists save data via `StorageProvider` under the key `'save'`.
 * Designed as a forward-compatible schema: new fields are added with defaults
 * so existing saves are not broken on game updates.
 *
 * Dependency direction: `src/save/` → `StorageProvider` only.
 * No Phaser, no simulation imports.
 */

import type { StorageProvider } from '../core/StorageProvider';

// ---------------------------------------------------------------------------
// Save data schema
// ---------------------------------------------------------------------------

export interface SectorProgress {
  /** Whether this sector has been cleared at least once. */
  cleared: boolean;
  /** Last known checkpoint Y (virtual metres) within this sector — used for respawn. */
  lastCheckpointY: number;
}

export interface SaveData {
  /** Index of the highest sector the player has reached (0 = The Lobby). */
  highestSectorReached: number;
  /** Per-sector progress keyed by sector index (0–5, or higher for Abyss). */
  sectorProgress: Record<number, SectorProgress>;
  /** Ball skin IDs that have been unlocked by the player. */
  unlockedSkins: string[];
  /** Personal best height reached in the Abyss (virtual metres below Sector 5 end). */
  abyssPersonalBest: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SAVE: Readonly<SaveData> = Object.freeze({
  highestSectorReached: 0,
  sectorProgress: {},
  unlockedSkins: ['default'],
  abyssPersonalBest: 0,
});

// ---------------------------------------------------------------------------
// SaveSystem
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'save';

export class SaveSystem {
  private storage: StorageProvider;
  private _data: SaveData = { ...DEFAULT_SAVE, sectorProgress: {}, unlockedSkins: ['default'] };

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  /** Loads persisted save data from storage. Missing fields receive defaults. */
  async initialize(): Promise<void> {
    const saved = await this.storage.load<Partial<SaveData>>(STORAGE_KEY);
    if (saved) {
      this._data = {
        highestSectorReached: saved.highestSectorReached ?? DEFAULT_SAVE.highestSectorReached,
        sectorProgress: saved.sectorProgress ?? {},
        unlockedSkins: saved.unlockedSkins ?? DEFAULT_SAVE.unlockedSkins,
        abyssPersonalBest: saved.abyssPersonalBest ?? DEFAULT_SAVE.abyssPersonalBest,
      };
    }
  }

  /** Returns a read-only view of the current save data. */
  get data(): Readonly<SaveData> {
    return this._data;
  }

  /** Records that a sector has been reached (but not necessarily cleared). */
  async recordSectorReached(sectorIndex: number): Promise<void> {
    if (sectorIndex > this._data.highestSectorReached) {
      this._data.highestSectorReached = sectorIndex;
    }
    if (!this._data.sectorProgress[sectorIndex]) {
      this._data.sectorProgress[sectorIndex] = { cleared: false, lastCheckpointY: 0 };
    }
    await this.persist();
  }

  /** Records that a sector has been cleared. */
  async recordSectorCleared(sectorIndex: number): Promise<void> {
    this._data.sectorProgress[sectorIndex] = {
      ...(this._data.sectorProgress[sectorIndex] ?? { lastCheckpointY: 0 }),
      cleared: true,
    };
    await this.persist();
  }

  /** Updates the last checkpoint Y for a sector (for mid-sector respawn). */
  async recordCheckpoint(sectorIndex: number, checkpointY: number): Promise<void> {
    const current = this._data.sectorProgress[sectorIndex] ?? { cleared: false, lastCheckpointY: 0 };
    if (checkpointY > current.lastCheckpointY) {
      this._data.sectorProgress[sectorIndex] = { ...current, lastCheckpointY: checkpointY };
      await this.persist();
    }
  }

  /** Unlocks a ball skin by ID if not already unlocked. */
  async unlockSkin(skinId: string): Promise<void> {
    if (!this._data.unlockedSkins.includes(skinId)) {
      this._data.unlockedSkins = [...this._data.unlockedSkins, skinId];
      await this.persist();
    }
  }

  /** Updates the Abyss personal best if the new depth exceeds the record. */
  async updateAbyssPersonalBest(depthM: number): Promise<void> {
    if (depthM > this._data.abyssPersonalBest) {
      this._data.abyssPersonalBest = depthM;
      await this.persist();
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async persist(): Promise<void> {
    await this.storage.save(STORAGE_KEY, this._data);
  }
}
