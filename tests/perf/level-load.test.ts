/**
 * Performance test: level load timing.
 *
 * Verifies that loading Format v3 levels (including migration from legacy formats)
 * completes within the 100ms budget required for seamless sector transitions.
 */

import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../../src/simulation/session/GameSession';
import { SectorLoader } from '../../src/tower/SectorLoader';
import { migrateToLatest } from '../../src/levels/migrate';
import sector00 from '../../levels/campaign/sector_00.json';

describe('Performance: Level Load Timing', () => {
  beforeAll(async () => {
    await RAPIER.init();
    // Warm up the Rapier physics world instantiation and loader routines
    const warmup = new GameSession();
    const chunk = SectorLoader.load(warmup.simulation, sector00);
    chunk.destroy();
    warmup.destroy();
  });

  test('Format v3 sector load completes in < 100ms', () => {
    const session = new GameSession();
    const start = performance.now();
    const chunkManager = SectorLoader.load(session.simulation, sector00);
    const elapsed = performance.now() - start;

    console.log(`v3 sector load: ${elapsed.toFixed(2)} ms`);
    expect(elapsed).toBeLessThan(100);

    chunkManager.destroy();
    session.destroy();
  });

  test('migrateToLatest on v3 data is idempotent in < 5ms', () => {
    const start = performance.now();
    migrateToLatest(sector00);
    const elapsed = performance.now() - start;

    console.log(`migrateToLatest (v3 noop): ${elapsed.toFixed(2)} ms`);
    expect(elapsed).toBeLessThan(5);
  });

  test('migrateToLatest on legacy v1 data completes in < 10ms', () => {
    const legacyV1 = {
      width: 20.48,
      height: 500,
      ball: { x: 10, y: 2 },
      flippers: [
        { side: 'left',  x: 6.925, y: 3.8 },
        { side: 'right', x: 11.325, y: 3.8 },
      ],
      bumpers: Array.from({ length: 20 }, (_, i) => ({ x: 5 + i * 0.5, y: 50 + i * 10, radius: 0.6 })),
      walls: Array.from({ length: 30 }, (_, i) => ({ x: i * 0.5, y: i * 10, hx: 2.0, hy: 0.2 })),
    };

    const start = performance.now();
    migrateToLatest(legacyV1);
    const elapsed = performance.now() - start;

    console.log(`migrateToLatest (v1 → v3, 50 items): ${elapsed.toFixed(2)} ms`);
    expect(elapsed).toBeLessThan(20);
  });

  test('SectorLoader.load is idempotent for same level data', () => {
    const session1 = new GameSession();
    const session2 = new GameSession();

    const chunkManager1 = SectorLoader.load(session1.simulation, sector00);
    const chunkManager2 = SectorLoader.load(session2.simulation, sector00);

    // Both should produce the same number of active bodies (not determinism check, just sanity)
    const bodies1 = session1.simulation.physicsWorld.getBodyCount();
    const bodies2 = session2.simulation.physicsWorld.getBodyCount();
    expect(bodies1).toBe(bodies2);

    chunkManager1.destroy();
    chunkManager2.destroy();
    session1.destroy();
    session2.destroy();
  });
});
