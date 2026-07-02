import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../../src/simulation/session/GameSession';
import { SectorLoader, SectorData } from '../../src/tower/SectorLoader';
import sector00 from '../../levels/campaign/sector_00.json';

describe('Performance Smoke: Active Rigid Body Count Check', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  test('asserts that active rigid body count in Rapier world stays <= 50 during vertical climb chunk loading', () => {
    const session = new GameSession();
    
    // Load sector_00 and get chunk manager
    const chunkManager = SectorLoader.load(session.simulation, sector00 as SectorData);

    // Simulate vertical climb from 0m to 500m, checking body counts at 10m intervals
    for (let height = 0; height <= 500; height += 10) {
      chunkManager.update(height);
      
      const bodyCount = session.simulation.physicsWorld.getBodyCount();
      
      // Plunger, Flippers, Bumpers, Ball, and active chunk walls
      expect(bodyCount).toBeLessThanOrEqual(50);
    }

    chunkManager.destroy();
    session.destroy();
  });
});
