/**
 * QuickPlayManager — loads and catalogs the sample/sandbox level layouts.
 *
 * Mirrors the CampaignManager API so GameScene can load quick-play levels
 * the same way it loads campaign sectors (dynamic import → migrateToLatest).
 *
 * Lives in src/tower/ — neutral to both render and simulation.
 * Does NOT spawn physics bodies (that's SectorLoader's job).
 *
 * Architecture: tower/ → levels/ (migrate, LevelData). No Phaser imports.
 */

import type { LevelData } from '../levels/LevelData';
import { migrateToLatest } from '../levels/migrate';

// ---------------------------------------------------------------------------
// Quick-play level manifest (matches files in levels/sandbox/)
// ---------------------------------------------------------------------------

export interface QuickPlayEntry {
  /** Filename without extension, relative to levels/sandbox/. */
  file: string;
  /** Display name shown in the level-select UI. */
  name: string;
  /** Short description shown on the level-select card. */
  description: string;
  /** Emoji icon used in the UI card. */
  icon: string;
}

export const QUICK_PLAY_LEVELS: QuickPlayEntry[] = [
  {
    file: 'classic_pinball',
    name: 'Classic Pinball',
    description: 'Twin flippers, twin slingshots, triangle pop bumpers. The archetypal layout.',
    icon: '🎯',
  },
  {
    file: 'dropbank_spinner',
    name: 'Drop Bank & Spinner',
    description: 'Two drop-target banks plus a center spinner. Tests target state and reset groups.',
    icon: '🎰',
  },
  {
    file: 'minimal_sandbox',
    name: 'Minimal Sandbox',
    description: 'Bare-bones: gravity, walls, and flippers only. Great for core physics testing.',
    icon: '🧪',
  },
  {
    file: 'orbit_loops',
    name: 'Orbit Loops',
    description: 'Left and right orbit channels loop around the bumpers. One-way gate physics.',
    icon: '🔄',
  },
  {
    file: 'widebody_stress',
    name: 'Widebody Stress',
    description: 'Dense bumper field + upper flipper. Stress-tests many simultaneous physics bodies.',
    icon: '💥',
  },
  {
    file: 'basic_em',
    name: 'Basic EM',
    description: 'Classic electro-mechanical layout: three large bumpers, twin slingshots, inner target rails.',
    icon: '⚡',
  },
];

// ---------------------------------------------------------------------------
// QuickPlayManager
// ---------------------------------------------------------------------------

export class QuickPlayManager {
  /** Maps level index → LevelData (cached after first load). */
  private cache: Map<number, LevelData> = new Map();

  /** Total number of quick-play levels available. */
  static get total(): number {
    return QUICK_PLAY_LEVELS.length;
  }

  /** Returns the QuickPlayEntry metadata for a given index. */
  static getEntry(index: number): QuickPlayEntry {
    if (index < 0 || index >= QUICK_PLAY_LEVELS.length) {
      throw new Error(`QuickPlayManager.getEntry: index ${index} out of range`);
    }
    return QUICK_PLAY_LEVELS[index];
  }

  /**
   * Loads a quick-play level by index, migrating to Format v3 if needed.
   * Results are cached so subsequent calls are synchronous.
   */
  async loadLevel(index: number): Promise<LevelData> {
    if (index < 0 || index >= QUICK_PLAY_LEVELS.length) {
      throw new Error(
        `QuickPlayManager.loadLevel: index ${index} out of range (0–${QUICK_PLAY_LEVELS.length - 1})`
      );
    }

    if (this.cache.has(index)) {
      return this.cache.get(index)!;
    }

    const entry = QUICK_PLAY_LEVELS[index];

    // Dynamic import — Vite bundles JSON files as ES modules
    const raw = await import(`../../levels/sandbox/${entry.file}.json`);
    const levelData = migrateToLatest(raw.default ?? raw);
    levelData.name = entry.name; // Ensure display name is set
    this.cache.set(index, levelData);
    return levelData;
  }

  /** Clears the level cache (for testing or memory management). */
  clearCache(): void {
    this.cache.clear();
  }
}
