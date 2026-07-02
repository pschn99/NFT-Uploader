import { Simulation } from '../simulation/Simulation';
import { SectorChunkManager, WallData } from './SectorChunkManager';

export interface SectorData {
  width: number;
  height: number;
  ball: { x: number; y: number };
  plunger?: { x: number; y: number };
  flippers: Array<{ side: 'left' | 'right'; x: number; y: number }>;
  bumpers?: Array<{ x: number; y: number; radius?: number }>;
  walls: WallData[];
}

export class SectorLoader {
  /**
   * Spawns physics bodies and returns a SectorChunkManager for walls.
   */
  static load(simulation: Simulation, data: SectorData): SectorChunkManager {
    // 1. Spawns ball
    simulation.setBall(data.ball.x, data.ball.y);

    // 2. Spawns plunger
    if (data.plunger) {
      simulation.addPlunger(data.plunger.x, data.plunger.y);
    }

    // 3. Spawns left and right flippers
    data.flippers.forEach((f) => {
      simulation.addFlipper(f.side, f.x, f.y);
    });

    // 4. Spawns bumpers
    data.bumpers?.forEach((b) => {
      simulation.addBumper(b.x, b.y, b.radius || 0.6);
    });

    // 5. Instantiate and return SectorChunkManager
    const chunkManager = new SectorChunkManager(simulation, data.walls);
    chunkManager.update(data.ball.y);

    return chunkManager;
  }
}
