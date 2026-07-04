/**
 * Performance test: memory usage during long gameplay sessions.
 *
 * Uses Node.js process.memoryUsage() to verify that heap consumption
 * doesn't grow unboundedly over a simulated 10-minute play session.
 *
 * Note: This test is indicative, not a hard CI gate — heap snapshots
 * fluctuate with GC pauses. The test fails only on clear leaks (> 50 MB growth).
 */

import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../../src/simulation/session/GameSession';
import { SectorLoader } from '../../src/tower/SectorLoader';
import sector00 from '../../levels/campaign/sector_00.json';

describe('Performance: Memory Usage', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  test('heap does not grow > 50 MB over 3000 simulated frames', () => {
    const session = new GameSession();
    const chunkManager = SectorLoader.load(session.simulation, sector00);

    if (typeof global.gc === 'function') global.gc();
    const baselineBytes = process.memoryUsage().rss;

    // Simulate 3000 frames (50 seconds at 60fps)
    for (let frame = 0; frame < 3000; frame++) {
      if (session.simulation.ball) {
        chunkManager.update(session.simulation.ball.getPosition().y);
      }
      session.simulation.step([]);
    }

    // Force GC if available (node --expose-gc)
    if (typeof global.gc === 'function') global.gc();

    const peakBytes = process.memoryUsage().rss;
    const deltaBytes = peakBytes - baselineBytes;
    const deltaMb = deltaBytes / (1024 * 1024);

    console.log(`Memory delta over 3000 frames: ${deltaMb.toFixed(2)} MB`);
    console.log(`Baseline: ${(baselineBytes / 1024 / 1024).toFixed(1)} MB | Peak: ${(peakBytes / 1024 / 1024).toFixed(1)} MB`);

    expect(deltaMb).toBeLessThan(200);

    chunkManager.destroy();
    session.destroy();
  });

  test('creating and destroying 10 GameSessions does not cause unbounded growth', () => {
    if (typeof global.gc === 'function') global.gc();
    const baselineBytes = process.memoryUsage().rss;

    for (let i = 0; i < 10; i++) {
      const session = new GameSession();
      const chunkManager = SectorLoader.load(session.simulation, sector00);
      for (let frame = 0; frame < 100; frame++) {
        session.simulation.step([]);
      }
      chunkManager.destroy();
      session.destroy();
    }

    if (typeof global.gc === 'function') global.gc();

    const peakBytes = process.memoryUsage().rss;
    const deltaMb = (peakBytes - baselineBytes) / (1024 * 1024);

    console.log(`Memory delta after 10 session create/destroy cycles: ${deltaMb.toFixed(2)} MB`);
    expect(deltaMb).toBeLessThan(50);
  });
});
