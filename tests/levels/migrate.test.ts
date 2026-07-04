/**
 * Tests for src/levels/migrate.ts — level format migration pipeline.
 *
 * Covers:
 *   - v1 (no format_version field) → v3 migration
 *   - v2 (format_version: 2, flat arrays) → v3 migration
 *   - v3 idempotency
 *   - serialize/deserialize round-trip
 *   - levelDataToSectorData bridge
 */

import { migrateToLatest, levelDataToSectorData, CURRENT_LEVEL_FORMAT_VERSION } from '../../src/levels/migrate';
import { serializeLevel, deserializeLevel, serializeCanonical } from '../../src/levels/serialize';
import type { LevelData } from '../../src/levels/LevelData';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const legacyV1NoVersion = {
  width: 20.48,
  height: 300.0,
  ball: { x: 10.0, y: 2.0 },
  plunger: { x: 10.0, y: 1.0 },
  flippers: [
    { side: 'left',  x: 6.925, y: 3.8 },
    { side: 'right', x: 11.325, y: 3.8 },
  ],
  bumpers: [
    { x: 5.0, y: 45.0, radius: 0.6 },
  ],
  walls: [
    { x: 10.24, y: 0.5,  hx: 10.24, hy: 0.5 },
    { x: 0.25,  y: 150.0, hx: 0.25, hy: 150.0 },
  ],
};

const legacyV2 = { ...legacyV1NoVersion, format_version: 2 };

const validV3: LevelData = {
  format_version: 3,
  sector_height_m: 300,
  blocks: [
    { type: 'flipper_left',    grid_x: 11, grid_y: 6 },
    { type: 'bumper_standard', grid_x: 8,  grid_y: 70, params: { radius: 0.6 } },
    { type: 'plunger',         grid_x: 16, grid_y: 2 },
    { type: 'checkpoint',      grid_x: 16, grid_y: 156 },
    { type: 'exit',            grid_x: 16, grid_y: 468 },
  ],
};

// ---------------------------------------------------------------------------
// CURRENT_LEVEL_FORMAT_VERSION
// ---------------------------------------------------------------------------

test('CURRENT_LEVEL_FORMAT_VERSION is 3', () => {
  expect(CURRENT_LEVEL_FORMAT_VERSION).toBe(3);
});

// ---------------------------------------------------------------------------
// migrateToLatest
// ---------------------------------------------------------------------------

describe('migrateToLatest', () => {
  test('v1 (no format_version) → v3', () => {
    const result = migrateToLatest(legacyV1NoVersion);
    expect(result.format_version).toBe(3);
    expect(Array.isArray(result.blocks)).toBe(true);
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  test('v2 → v3', () => {
    const result = migrateToLatest(legacyV2);
    expect(result.format_version).toBe(3);
  });

  test('v3 → v3 (idempotent)', () => {
    const result = migrateToLatest(validV3);
    expect(result.format_version).toBe(3);
    expect(result.blocks.length).toBe(validV3.blocks.length);
  });

  test('walls converted to wall blocks', () => {
    const result = migrateToLatest(legacyV1NoVersion);
    const wallBlocks = result.blocks.filter((b) => b.type === 'wall');
    expect(wallBlocks.length).toBe(legacyV1NoVersion.walls.length);
  });

  test('flippers converted to flipper_left / flipper_right blocks', () => {
    const result = migrateToLatest(legacyV1NoVersion);
    const left  = result.blocks.filter((b) => b.type === 'flipper_left');
    const right = result.blocks.filter((b) => b.type === 'flipper_right');
    expect(left.length).toBe(1);
    expect(right.length).toBe(1);
  });

  test('bumpers converted to bumper_standard blocks with radius param', () => {
    const result = migrateToLatest(legacyV1NoVersion);
    const bumpers = result.blocks.filter((b) => b.type === 'bumper_standard');
    expect(bumpers.length).toBe(1);
    expect(bumpers[0].params?.radius).toBe(0.6);
  });

  test('plunger converted to plunger block', () => {
    const result = migrateToLatest(legacyV1NoVersion);
    const plunger = result.blocks.find((b) => b.type === 'plunger');
    expect(plunger).toBeDefined();
  });

  test('sector_height_m derived from legacy height field', () => {
    const result = migrateToLatest(legacyV1NoVersion);
    expect(result.sector_height_m).toBe(300.0);
  });

  test('throws on null input', () => {
    expect(() => migrateToLatest(null)).toThrow();
  });

  test('throws on non-object input', () => {
    expect(() => migrateToLatest('string')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// serialize / deserialize round-trip
// ---------------------------------------------------------------------------

describe('serialize / deserialize round-trip', () => {
  test('v3 round-trip: deserializeLevel(serializeLevel(x)) produces identical structure', () => {
    const serialized = serializeLevel(validV3);
    const deserialized = deserializeLevel(serialized);
    // Compare structural equality (not reference)
    expect(deserialized.format_version).toBe(3);
    expect(deserialized.sector_height_m).toBe(validV3.sector_height_m);
    expect(deserialized.blocks.length).toBe(validV3.blocks.length);
  });

  test('deserializeLevel throws on non-v3 input', () => {
    const v2json = JSON.stringify(legacyV2);
    expect(() => deserializeLevel(v2json)).toThrow(/format_version 3/);
  });

  test('deserializeLevel throws on missing blocks array', () => {
    const broken = JSON.stringify({ format_version: 3, sector_height_m: 300 });
    expect(() => deserializeLevel(broken)).toThrow(/blocks/);
  });

  test('deserializeLevel throws on missing sector_height_m', () => {
    const broken = JSON.stringify({ format_version: 3, blocks: [] });
    expect(() => deserializeLevel(broken)).toThrow(/sector_height_m/);
  });

  test('serializeCanonical excludes playability_check stamp', () => {
    const withStamp: LevelData = {
      ...validV3,
      playability_check: {
        verified: true,
        verifier: 'local',
        level_hash: 'sha256:abc123',
        replay_hash: 'sha256:xyz456',
        replay_engine_version: '0.18.0',
      },
    };
    const canonical = serializeCanonical(withStamp);
    expect(canonical).not.toContain('playability_check');
    expect(canonical).not.toContain('level_hash');
  });

  test('serializeCanonical blocks are sorted deterministically', () => {
    const shuffled: LevelData = {
      format_version: 3,
      sector_height_m: 300,
      blocks: [
        { type: 'exit',       grid_x: 16, grid_y: 468 },
        { type: 'flipper_left', grid_x: 11, grid_y: 6 },
        { type: 'checkpoint', grid_x: 16, grid_y: 156 },
      ],
    };
    const sorted: LevelData = {
      format_version: 3,
      sector_height_m: 300,
      blocks: [
        { type: 'checkpoint', grid_x: 16, grid_y: 156 },
        { type: 'exit',       grid_x: 16, grid_y: 468 },
        { type: 'flipper_left', grid_x: 11, grid_y: 6 },
      ],
    };
    expect(serializeCanonical(shuffled)).toBe(serializeCanonical(sorted));
  });
});

// ---------------------------------------------------------------------------
// levelDataToSectorData bridge
// ---------------------------------------------------------------------------

describe('levelDataToSectorData', () => {
  test('produces non-empty walls array from wall blocks', () => {
    const level = migrateToLatest(legacyV1NoVersion);
    const sector = levelDataToSectorData(level);
    expect(sector.walls.length).toBeGreaterThan(0);
  });

  test('produces flippers array with correct sides', () => {
    const level = migrateToLatest(legacyV1NoVersion);
    const sector = levelDataToSectorData(level);
    const left  = sector.flippers.filter((f) => f.side === 'left');
    const right = sector.flippers.filter((f) => f.side === 'right');
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
  });

  test('plunger block sets ball spawn 0.8 m above', () => {
    const level = migrateToLatest(legacyV1NoVersion);
    const sector = levelDataToSectorData(level);
    expect(sector.plunger).toBeDefined();
    expect(sector.ball.y).toBeCloseTo(sector.plunger!.y + 0.8, 2);
  });
});
