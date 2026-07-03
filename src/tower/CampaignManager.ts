/**
 * CampaignManager — sector ordering and transition management.
 *
 * Owns the ordered list of campaign sector JSON file paths and the
 * in-memory loaded sector data. Provides methods for:
 *   - Loading a sector by index (any format version — migrateToLatest is called)
 *   - Advancing to the next sector (with title card data)
 *   - Detecting the Abyss transition (after sector 5)
 *
 * Lives in src/tower/ — neutral to both render and simulation.
 * Does NOT spawn physics bodies (that's SectorLoader's job).
 *
 * Architecture: tower/ → levels/ (migrate, LevelData). No Phaser imports.
 */

import type { LevelData } from '../levels/LevelData';
import { migrateToLatest } from '../levels/migrate';

// ---------------------------------------------------------------------------
// Campaign sector manifest (in order)
// ---------------------------------------------------------------------------

const CAMPAIGN_SECTORS: string[] = [
  'sector_00', // The Lobby
  'sector_01', // The Shaft
  'sector_02', // The Bumper Garden
  'sector_03', // The Plunger Vault
  'sector_04', // The Negative Space
  'sector_05', // The Storm
];

export const TOTAL_CAMPAIGN_SECTORS = CAMPAIGN_SECTORS.length;
export const ABYSS_SECTOR_INDEX = TOTAL_CAMPAIGN_SECTORS; // 6 and beyond

// ---------------------------------------------------------------------------
// Title card metadata (shown on sector transition)
// ---------------------------------------------------------------------------

export interface SectorTitleCard {
  sectorIndex: number;
  name: string;
  tagline: string;
}

const SECTOR_TITLE_CARDS: SectorTitleCard[] = [
  { sectorIndex: 0, name: 'Sector 0',     tagline: 'The Lobby' },
  { sectorIndex: 1, name: 'Sector 1',     tagline: 'The Shaft' },
  { sectorIndex: 2, name: 'Sector 2',     tagline: 'The Bumper Garden' },
  { sectorIndex: 3, name: 'Sector 3',     tagline: 'The Plunger Vault' },
  { sectorIndex: 4, name: 'Sector 4',     tagline: 'The Negative Space' },
  { sectorIndex: 5, name: 'Sector 5',     tagline: 'The Storm' },
  { sectorIndex: 6, name: 'The Abyss ∞',  tagline: 'How deep can you fall?' },
];

// ---------------------------------------------------------------------------
// CampaignManager
// ---------------------------------------------------------------------------

export class CampaignManager {
  /** Maps sector index → dynamically imported LevelData (cached after first load). */
  private cache: Map<number, LevelData> = new Map();

  /**
   * Returns the campaign sector name at the given index.
   * Throws for out-of-range indices beyond the Abyss boundary.
   */
  static getSectorName(index: number): string {
    return index < TOTAL_CAMPAIGN_SECTORS
      ? CAMPAIGN_SECTORS[index]
      : `abyss`;
  }

  /**
   * Returns whether a sector index is within the fixed campaign.
   * Indices >= TOTAL_CAMPAIGN_SECTORS indicate the Abyss.
   */
  static isCampaignSector(index: number): boolean {
    return index >= 0 && index < TOTAL_CAMPAIGN_SECTORS;
  }

  /** Returns true if the player has advanced past all campaign sectors. */
  static isAbyssEntry(index: number): boolean {
    return index >= ABYSS_SECTOR_INDEX;
  }

  /**
   * Returns the title card metadata for a given sector index.
   * Falls back to an Abyss title card for any index beyond sector 5.
   */
  static getTitleCard(sectorIndex: number): SectorTitleCard {
    return (
      SECTOR_TITLE_CARDS.find((tc) => tc.sectorIndex === sectorIndex) ??
      SECTOR_TITLE_CARDS[SECTOR_TITLE_CARDS.length - 1]
    );
  }

  /**
   * Loads a campaign sector by index, migrating to Format v3 if needed.
   * Results are cached so subsequent calls are synchronous.
   *
   * @param index  0–5 for campaign sectors. Throws for Abyss indices.
   */
  async loadSector(index: number): Promise<LevelData> {
    if (!CampaignManager.isCampaignSector(index)) {
      throw new Error(
        `CampaignManager.loadSector: index ${index} is outside the campaign (0–${TOTAL_CAMPAIGN_SECTORS - 1}). Use AbyssGenerator for the Abyss.`
      );
    }

    if (this.cache.has(index)) {
      return this.cache.get(index)!;
    }

    const name = CAMPAIGN_SECTORS[index];

    // Dynamic import — Vite bundles JSON files as ES modules
    const raw = await import(`../../levels/campaign/${name}.json`);
    const levelData = migrateToLatest(raw.default ?? raw);
    this.cache.set(index, levelData);
    return levelData;
  }

  /** Clears the sector cache (for testing or memory management). */
  clearCache(): void {
    this.cache.clear();
  }
}
