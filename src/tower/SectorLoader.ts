import { Simulation } from '../simulation/Simulation';

export interface SectorData {
  width: number;
  height: number;
  ball: { x: number; y: number };
  plunger?: { x: number; y: number };
  flippers: Array<{ side: 'left' | 'right'; x: number; y: number }>;
  walls: Array<{ x: number; y: number; hx: number; hy: number; rotation?: number }>;
}

export class SectorLoader {
  /**
   * Spawns physics bodies and walls from sector JSON configuration data.
   */
  static load(simulation: Simulation, data: SectorData): void {
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

    // 4. Spawns boundaries, chutes, and slopes
    data.walls.forEach((w) => {
      simulation.createStaticWall(w.x, w.y, w.hx, w.hy, w.rotation || 0);
    });
  }
}
