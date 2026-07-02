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

  // Buffer range: 40 meters around active ball Y height
  private loadRange = 40.0;

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
      const inRange = wall.y >= minY && wall.y <= maxY;
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
        // Unload wall body from simulation
        const body = this.spawnedWalls.get(idx)!;
        this.simulation.physicsWorld.removeRigidBody(body);

        // Clean from staticBodies array
        this.simulation.staticBodies = this.simulation.staticBodies.filter((b) => b !== body);
        this.spawnedWalls.delete(idx);
      }
    });
  }

  destroy(): void {
    // Unload all spawned walls on destruction
    this.spawnedWalls.forEach((body) => {
      this.simulation.physicsWorld.removeRigidBody(body);
    });
    this.spawnedWalls.clear();
    this.allWalls = [];
  }
}
