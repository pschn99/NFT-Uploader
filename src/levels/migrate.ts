/**
 * Level format migration pipeline — Format v1/v2 → Format v3.
 *
 * `migrateToLatest` is the single public entry point. `SectorLoader` calls
 * it before parsing any level JSON, so all campaign files and user-created
 * levels are always upgraded to the current schema before use.
 *
 * Migration strategy for legacy campaign JSONs (pre-v3):
 *   - Legacy JSONs have flat `walls[]`, `flippers[]`, `bumpers[]` arrays.
 *   - v3 unifies everything under a `blocks[]` array with `type`, `grid_x`,
 *     `grid_y`, `rotation_index`, and optional `params`.
 *   - World-metre coordinates are converted to grid cells using
 *     `GRID_CELL_METRES = 0.64 m`.
 *
 * Format version history:
 *   v1 — initial flat arrays, no format_version field (treated as version 1).
 *   v2 — added format_version field; still flat arrays.
 *   v3 — unified blocks[], format_version: 3, sector_height_m field.
 */

import type {
  LevelData,
  BlockEntry,
  LegacyWallEntry,
  LegacyFlipperEntry,
  LegacyBumperEntry,
} from './LevelData';
import { GRID_CELL_METRES } from '../simulation/constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENT_FORMAT_VERSION = 3;

// Flipper snap angles (radians). Index into this array → rotation_index.
// 0 = resting angle left/right, subsequent entries are preset angles.
const FLIPPER_SNAP_ANGLES_RAD = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, -Math.PI / 6];

// ---------------------------------------------------------------------------
// Helpers: metres ↔ grid
// ---------------------------------------------------------------------------

function metresToGrid(metres: number): number {
  return Math.round(metres / GRID_CELL_METRES);
}

// ---------------------------------------------------------------------------
// V2 → V3: unified blocks array
// ---------------------------------------------------------------------------

interface LegacyV2Data {
  format_version?: number;
  width?: number;
  height?: number;
  sector_height_m?: number;
  ball?: { x: number; y: number };
  plunger?: { x: number; y: number };
  flippers?: LegacyFlipperEntry[];
  bumpers?: LegacyBumperEntry[];
  walls?: LegacyWallEntry[];
  blocks?: BlockEntry[];
  checkpoints?: number[];
}

function migrateV2toV3(data: LegacyV2Data): LevelData {
  const blocks: BlockEntry[] = [...(data.blocks ?? [])];

  // Convert legacy walls → 'wall' blocks
  for (const wall of data.walls ?? []) {
    blocks.push({
      type: 'wall',
      grid_x: metresToGrid(wall.x),
      grid_y: metresToGrid(wall.y),
      params: {
        hx: wall.hx,
        hy: wall.hy,
        ...(wall.rotation !== undefined ? { rotation: wall.rotation } : {}),
      },
    });
  }

  // Convert legacy flippers → 'flipper_left' / 'flipper_right' blocks
  for (const flipper of data.flippers ?? []) {
    blocks.push({
      type: flipper.side === 'left' ? 'flipper_left' : 'flipper_right',
      grid_x: metresToGrid(flipper.x),
      grid_y: metresToGrid(flipper.y),
      rotation_index: 0,
    });
  }

  // Convert legacy bumpers → 'bumper_standard' blocks
  for (const bumper of data.bumpers ?? []) {
    blocks.push({
      type: 'bumper_standard',
      grid_x: metresToGrid(bumper.x),
      grid_y: metresToGrid(bumper.y),
      ...(bumper.radius !== undefined ? { params: { radius: bumper.radius } } : {}),
    });
  }

  // Convert legacy plunger
  if (data.plunger) {
    blocks.push({
      type: 'plunger',
      grid_x: metresToGrid(data.plunger.x),
      grid_y: metresToGrid(data.plunger.y),
    });
  }

  // Derive sector_height_m: prefer explicit field, fall back to legacy `height`.
  const sector_height_m = data.sector_height_m ?? data.height ?? 500;

  return {
    format_version: 3,
    sector_height_m,
    checkpoints: data.checkpoints,
    blocks,
  };
}

// ---------------------------------------------------------------------------
// V1 → V2: add format_version field (all other structure identical)
// ---------------------------------------------------------------------------

function migrateV1toV2(data: LegacyV2Data): LegacyV2Data {
  return { ...data, format_version: 2 };
}

// ---------------------------------------------------------------------------
// Migration registry
// ---------------------------------------------------------------------------

type MigrationFn = (data: unknown) => unknown;

const migrations: Record<number, MigrationFn> = {
  1: (d) => migrateV1toV2(d as LegacyV2Data),
  2: (d) => migrateV2toV3(d as LegacyV2Data),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upgrades any level data object to `LevelData` (Format v3).
 *
 * - Accepts a parsed JSON object (i.e. already `JSON.parse`d).
 * - Automatically detects missing `format_version` and treats it as v1.
 * - Idempotent: if already at v3, returns the input unchanged.
 * - Throws if the migration chain stalls or produces an invalid version.
 *
 * @example
 * const raw = JSON.parse(fs.readFileSync('sector_00.json', 'utf-8'));
 * const level = migrateToLatest(raw);
 */
export function migrateToLatest(data: unknown): LevelData {
  if (typeof data !== 'object' || data === null) {
    throw new Error('migrateToLatest: input must be a non-null object');
  }

  let current = data as LegacyV2Data;

  // Treat missing format_version as v1 (pre-versioned campaign JSONs).
  if (current.format_version === undefined || current.format_version === null) {
    current = { ...current, format_version: 1 };
  }

  // Narrow: format_version is now definitely a number.
  let version = current.format_version as number;

  let safety = 0;
  while (version < CURRENT_FORMAT_VERSION && safety++ < 20) {
    const migrate = migrations[version];
    if (!migrate) {
      throw new Error(`migrateToLatest: no migration from version ${version}`);
    }
    current = migrate(current) as LegacyV2Data;
    version = (current.format_version as number);
  }

  if (version !== CURRENT_FORMAT_VERSION) {
    throw new Error(
      `migrateToLatest: migration stalled at version ${version} (expected ${CURRENT_FORMAT_VERSION})`
    );
  }

  return current as unknown as LevelData;
}

/**
 * Returns the current (latest) format version number.
 * Exported for use in tests and version-bump audits.
 */
export const CURRENT_LEVEL_FORMAT_VERSION = CURRENT_FORMAT_VERSION;

// ---------------------------------------------------------------------------
// Utility: LevelData (v3) → legacy SectorData shape for SectorLoader
// ---------------------------------------------------------------------------

import type { SectorData } from './LevelData';

/**
 * Converts a Format v3 `LevelData` object back into the legacy `SectorData`
 * shape that `SectorLoader` currently expects.
 *
 * This bridge keeps `SectorLoader` unchanged while allowing the rest of the
 * codebase to work with Format v3 natively. It will be removed when
 * `SectorLoader` is updated to consume `LevelData` directly.
 */
export function levelDataToSectorData(level: LevelData): SectorData {
  const walls: LegacyWallEntry[] = [];
  const flippers: LegacyFlipperEntry[] = [];
  const bumpers: LegacyBumperEntry[] = [];
  let ball: { x: number; y: number } = { x: 9.125, y: 2.0 }; // default centre
  let plunger: { x: number; y: number } | undefined;

  for (const block of level.blocks) {
    const x = block.grid_x * GRID_CELL_METRES;
    const y = block.grid_y * GRID_CELL_METRES;

    switch (block.type) {
      case 'wall':
        walls.push({
          x,
          y,
          hx: (block.params?.hx as number) ?? GRID_CELL_METRES / 2,
          hy: (block.params?.hy as number) ?? GRID_CELL_METRES / 2,
          rotation: (block.params?.rotation as number) ?? undefined,
        });
        break;
      case 'flipper_left':
        flippers.push({ side: 'left', x, y });
        break;
      case 'flipper_right':
        flippers.push({ side: 'right', x, y });
        break;
      case 'bumper_standard':
        bumpers.push({ x, y, radius: (block.params?.radius as number) ?? 0.6 });
        break;
      case 'plunger':
        plunger = { x, y };
        // Ball spawns 0.8 m above plunger by convention
        ball = { x, y: y - 0.8 };
        break;
      case 'checkpoint':
      case 'exit':
        // Handled by CheckpointSystem / WinConditionSystem — not a static body
        break;
      default:
        // Unknown block type — skip silently for forward compatibility
        break;
    }
  }

  return {
    width: 20.48, // Standard tower width
    height: level.sector_height_m,
    ball,
    plunger,
    flippers,
    bumpers,
    walls,
  };
}

export { FLIPPER_SNAP_ANGLES_RAD };
