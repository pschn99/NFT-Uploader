/**
 * PINBALLZZZ Level Data Types — Format v3
 *
 * Format v3 unified all block types under a single `blocks[]` array.
 * Prior formats used flat `walls[]`, `flippers[]`, `bumpers[]` arrays.
 * Use `migrateToLatest()` from `migrate.ts` before parsing any persisted JSON.
 */

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

export type BlockType =
  | 'wall'
  | 'flipper_left'
  | 'flipper_right'
  | 'bumper_standard'
  | 'plunger'
  | 'checkpoint'
  | 'exit';

export interface BlockEntry {
  /** Block type key — maps to BlockRegistry for collider shapes. */
  type: BlockType;
  /** Grid column (32 px logical grid). */
  grid_x: number;
  /** Grid row (32 px logical grid). */
  grid_y: number;
  /**
   * Index into the block's `snapAngles` array (from BlockRegistry).
   * Defaults to 0 if omitted. Only meaningful for flipper blocks.
   */
  rotation_index?: number;
  /**
   * Arbitrary metadata for parameterised blocks (e.g. bumper radius).
   * Optional; omit when defaults are acceptable.
   */
  params?: Record<string, number | string | boolean>;
}

// ---------------------------------------------------------------------------
// Playability Check stamp
// ---------------------------------------------------------------------------

export interface PlayabilityCheckStamp {
  verified: boolean;
  /** 'local' = client Playability Check (v1.0). 'server' = Verified Clear Check (v1.1+). */
  verifier: 'local' | 'server';
  /** SHA-256 of canonical level JSON (blocks sorted, stamp field excluded). */
  level_hash: string;
  /** Fixed-point position hash of ball at win condition. */
  replay_hash: string;
  /** Rapier engine version used during verification — replays are invalidated on version bump. */
  replay_engine_version: string;
  /** Seconds taken by the author to clear the level. */
  clear_time_s?: number;
}

// ---------------------------------------------------------------------------
// Level Data (Format v3)
// ---------------------------------------------------------------------------

export interface LevelData {
  format_version: 3;
  /** Display name — optional, used in Creator Studio and campaign title cards. */
  name?: string;
  /** Steam user ID or 'campaign' for bundled levels. */
  author_id?: string;
  /** Sector height in virtual metres. */
  sector_height_m: number;
  /** Explicit checkpoint positions (virtual metres from top). Auto-placed every 100 m if omitted. */
  checkpoints?: number[];
  /** All blocks in the level. Order is not meaningful; BlockRegistry determines physics shape. */
  blocks: BlockEntry[];
  /**
   * Playability Check stamp — populated on successful export.
   * Absent on new / unsaved levels.
   */
  playability_check?: PlayabilityCheckStamp;
}

// ---------------------------------------------------------------------------
// Legacy SectorData — used by SectorLoader for backward compatibility
// ---------------------------------------------------------------------------

/**
 * Legacy flat-array shape used by SectorLoader and all campaign JSONs prior to Format v3.
 * Retained as the internal parse target so SectorLoader doesn't need a full rewrite.
 * `migrateToLatest()` + `levelDataToSectorData()` bridge the two representations.
 */
export interface LegacyWallEntry {
  x: number;
  y: number;
  hx: number;
  hy: number;
  rotation?: number;
}

export interface LegacyFlipperEntry {
  side: 'left' | 'right';
  x: number;
  y: number;
}

export interface LegacyBumperEntry {
  x: number;
  y: number;
  radius?: number;
}

export interface SectorData {
  width: number;
  height: number;
  ball: { x: number; y: number };
  plunger?: { x: number; y: number };
  flippers: LegacyFlipperEntry[];
  bumpers?: LegacyBumperEntry[];
  walls: LegacyWallEntry[];
}
