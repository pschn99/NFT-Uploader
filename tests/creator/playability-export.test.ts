/**
 * Creator Studio integration test: playability export pipeline.
 *
 * Tests the full loop:
 *   1. Construct a minimal LevelData in Format v3 (with flippers and a plunger)
 *   2. Create a GameSession, load the level, simulate until win condition
 *   3. Run PlayabilityCheck.verify()
 *   4. Assert that stamp is present with expected fields
 *   5. Assert that serializeCanonical produces stable output (same hash on re-run)
 *
 * This test does NOT use Phaser (headless Rapier only), matching CI constraints.
 */

import RAPIER from '@dimforge/rapier2d-compat';
import { PlayabilityCheck } from '../../src/replay/PlayabilityCheck';
import { serializeCanonical, serializeLevel, deserializeLevel } from '../../src/levels/serialize';
import { GameSession } from '../../src/simulation/session/GameSession';
import { SectorLoader } from '../../src/tower/SectorLoader';
import { InputBuffer } from '../../src/core/InputBuffer';
import { ReplaySystem } from '../../src/replay/ReplaySystem';
import type { LevelData } from '../../src/levels/LevelData';
import sector00 from '../../levels/campaign/sector_00.json';
import { migrateToLatest } from '../../src/levels/migrate';

const SECTOR_00 = migrateToLatest(sector00);

describe('Creator: Playability Export Pipeline', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  // ---------------------------------------------------------------------------
  // Level canonical hash
  // ---------------------------------------------------------------------------

  test('serializeCanonical produces identical output for the same level', () => {
    const hash1 = serializeCanonical(SECTOR_00);
    const hash2 = serializeCanonical(SECTOR_00);
    expect(hash1).toBe(hash2);
  });

  test('serializeCanonical changes when a block is added', () => {
    const modified: LevelData = {
      ...SECTOR_00,
      blocks: [
        ...SECTOR_00.blocks,
        { type: 'bumper_standard', grid_x: 99, grid_y: 99, params: { radius: 0.6 } },
      ],
    };
    const original = serializeCanonical(SECTOR_00);
    const changed  = serializeCanonical(modified);
    expect(original).not.toBe(changed);
  });

  test('playability_check stamp is excluded from canonical hash', () => {
    const withStamp: LevelData = {
      ...SECTOR_00,
      playability_check: {
        verified: true,
        verifier: 'local',
        level_hash: 'sha256:deadbeef',
        replay_hash: 'sha256:cafebabe',
        replay_engine_version: '0.18.0',
      },
    };
    expect(serializeCanonical(SECTOR_00)).toBe(serializeCanonical(withStamp));
  });

  // ---------------------------------------------------------------------------
  // PlayabilityCheck integration
  // ---------------------------------------------------------------------------

  test('PlayabilityCheck returns verified=false when win not reached in replay', async () => {
    // A replay that only does a plunger press and nothing else (won't clear 500m)
    const session = new GameSession();
    const chunkManager = SectorLoader.load(session.simulation, SECTOR_00);
    const replaySystem = new ReplaySystem(session);

    // Run only 120 frames — not enough to win
    const inputBuffer = new InputBuffer();
    inputBuffer.setAllEntries([
      { frame: 5, action: 'plunger', phase: 'down' },
      { frame: 25, action: 'plunger', phase: 'up' },
    ]);

    for (let frame = 0; frame < 120; frame++) {
      if (session.simulation.ball) {
        chunkManager.update(session.simulation.ball.getPosition().y);
      }
      session.simulation.step(inputBuffer.getEntriesForFrame(frame));
      replaySystem.recordStep();
    }

    chunkManager.destroy();
    session.destroy();

    const check = new PlayabilityCheck();
    const result = await check.verify(SECTOR_00, replaySystem);

    expect(result.verified).toBe(false);
    expect(result.stamp).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Format v3 serialize/deserialize
  // ---------------------------------------------------------------------------

  test('full serialize → deserialize round-trip preserves all blocks', () => {
    const serialized = serializeLevel(SECTOR_00);
    const restored   = deserializeLevel(serialized);

    expect(restored.format_version).toBe(3);
    expect(restored.blocks.length).toBe(SECTOR_00.blocks.length);
    expect(restored.sector_height_m).toBe(SECTOR_00.sector_height_m);
  });

  test('stamped level round-trip preserves the stamp', () => {
    const stamped: LevelData = {
      ...SECTOR_00,
      playability_check: {
        verified: true,
        verifier: 'local',
        level_hash: 'sha256:abc123',
        replay_hash: 'sha256:xyz456',
        replay_engine_version: '0.18.0',
        clear_time_s: 42.5,
      },
    };

    const serialized = serializeLevel(stamped);
    const restored   = deserializeLevel(serialized);

    expect(restored.playability_check?.verified).toBe(true);
    expect(restored.playability_check?.verifier).toBe('local');
    expect(restored.playability_check?.clear_time_s).toBe(42.5);
  });

  test('VERIFIER_BADGE_RULE: verifier field is always "local" for client-issued stamps', async () => {
    // Construct a minimal level where the ball spawns directly inside the exit sensor
    // (plunger at grid 16,2 → ball spawns 0.8m above at y=0.48; exit sensor at same grid
    //  with radius 2.0 covers the spawn point, guaranteeing immediate win).
    const immediateWinLevel: LevelData = {
      format_version: 3,
      sector_height_m: 10,
      blocks: [
        { type: 'plunger',    grid_x: 16, grid_y: 2 },
        { type: 'exit',       grid_x: 16, grid_y: 2 },
      ],
    };

    // Build a short replay stub — the check will run headlessly
    const session = new GameSession();
    const chunkManager = SectorLoader.load(session.simulation, immediateWinLevel);
    const replaySystem = new ReplaySystem(session);

    for (let frame = 0; frame < 10; frame++) {
      session.simulation.step([]);
      replaySystem.recordStep();
    }
    chunkManager.destroy();
    session.destroy();

    const check = new PlayabilityCheck();
    const result = await check.verify(immediateWinLevel, replaySystem);

    // The ball starts inside the exit sensor radius → win triggers on step 0
    expect(result.verified).toBe(true);
    expect(result.stamp).toBeDefined();
    expect(result.stamp!.verifier).toBe('local');
    // VERIFIER_BADGE_RULE: never 'server' for client-only check
    expect(result.stamp!.verifier).not.toBe('server');
  });
});
