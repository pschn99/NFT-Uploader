import { Simulation } from '../simulation/Simulation';
import RAPIER from '@dimforge/rapier2d-compat';

export interface WallData {
  x: number;
  y: number;
  hx: number;
  hy: number;
  rotation?: number;
}

export class SectorChunkManager {
  private simulation: Simulation;
  private allWalls: WallData[] = [];
  
  // Maps wall index in allWalls array to spawned physics rigid body
  private spawnedWalls = new Map<number, RAPIER.RigidBody>();

  // Buffer range: 120 meters around active ball Y height (covers a reasonable portion of the sector)
  private loadRange = 120.0;

  constructor(simulation: Simulation, walls: WallData[]) {
    this.simulation = simulation;
    this.allWalls = walls;
  }

  /**
   * Evaluates the ball height and dynamically loads/unloads wall physics colliders.
   */
  update(ballY: number): void {
    const minY = ballY - this.loadRange;
    const maxY = ballY + this.loadRange;

    this.allWalls.forEach((wall, idx) => {
      // Check if the wall's vertical span overlaps the active load range
      const inRange = (wall.y - wall.hy <= maxY) && (wall.y + wall.hy >= minY);
      const isSpawned = this.spawnedWalls.has(idx);

      if (inRange && !isSpawned) {
        // Spawn wall body in simulation
        const body = this.simulation.createStaticWall(
          wall.x,
          wall.y,
          wall.hx,
          wall.hy,
          wall.rotation || 0
        );
        this.spawnedWalls.set(idx, body);
      } else if (!inRange && isSpawned) {
        // Unload wall body from simulation via proper API (TDD §1 principle)
        const body = this.spawnedWalls.get(idx)!;
        this.simulation.removeStaticBody(body);
        this.spawnedWalls.delete(idx);
      }
    });
  }

  destroy(): void {
    // Unload all spawned walls on destruction via proper API
    this.spawnedWalls.forEach((body) => {
      this.simulation.removeStaticBody(body);
    });
    this.spawnedWalls.clear();
    this.allWalls = [];
  }
}
