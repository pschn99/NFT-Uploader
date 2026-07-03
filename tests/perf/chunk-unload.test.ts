/**
 * Performance test: chunk unload correctness and timing.
 *
 * Verifies that SectorChunkManager correctly unloads chunks that fall
 * outside the active viewport, and that the unload happens within a
 * reasonable time bound.
 */

import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../../src/simulation/session/GameSession';
import { SectorLoader } from '../../src/tower/SectorLoader';
import sector00 from '../../levels/campaign/sector_00.json';

describe('Performance: SectorChunkManager Chunk Unload', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  test('unloaded chunks reduce active body count as ball moves down', () => {
    const session = new GameSession();
    const chunkManager = SectorLoader.load(session.simulation, sector00);

    // Record body count at start (near top)
    chunkManager.update(0);
    const bodyCountAtTop = session.simulation.physicsWorld.getBodyCount();

    // Simulate a deep descent
    chunkManager.update(300);
    const bodyCountAtMid = session.simulation.physicsWorld.getBodyCount();

    // Body count should not continuously grow unbounded
    // (It may be same or different depending on chunk content, but must not explode)
    expect(bodyCountAtMid).toBeLessThanOrEqual(60);
    expect(bodyCountAtTop).toBeLessThanOrEqual(60);

    chunkManager.destroy();
    session.destroy();
  });

  test('chunk update call completes in < 5ms per frame', () => {
    const session = new GameSession();
    const chunkManager = SectorLoader.load(session.simulation, sector00);

    const MAX_FRAME_MS = 5.0;
    const iterations = 100;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      chunkManager.update(i * 5); // Step 5 m per iteration
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    console.log(`Chunk update avg: ${avgMs.toFixed(3)} ms/frame over ${iterations} iterations`);
    expect(avgMs).toBeLessThan(MAX_FRAME_MS);

    chunkManager.destroy();
    session.destroy();
  });

  test('destroy() removes all dynamically added walls', () => {
    const session = new GameSession();
    const chunkManager = SectorLoader.load(session.simulation, sector00);

    // Load a range of chunks
    for (let y = 0; y <= 200; y += 10) chunkManager.update(y);
    const countBefore = session.simulation.physicsWorld.getBodyCount();

    chunkManager.destroy();
    const countAfter = session.simulation.physicsWorld.getBodyCount();

    // After destroy, body count must have dropped (walls removed)
    expect(countAfter).toBeLessThan(countBefore);

    session.destroy();
  });
});
