import { Simulation } from '../simulation/Simulation';
import { SectorChunkManager, WallData } from './SectorChunkManager';
import { migrateToLatest, levelDataToSectorData } from '../levels/migrate';

// Re-export SectorData from LevelData so callers can import from one place.
export type { SectorData } from '../levels/LevelData';

export class SectorLoader {
  /**
   * Loads a sector from a raw JSON object (any format version).
   *
   * Runs `migrateToLatest()` before parsing so all campaign JSONs —
   * regardless of their serialized format_version — are always upgraded
   * to Format v3 before physics bodies are spawned.
   *
   * @param simulation - The active Simulation instance.
   * @param rawData    - Parsed JSON object from a campaign or user level file.
   *                     Must already be `JSON.parse`d; do not pass a string.
   */
  static load(simulation: Simulation, rawData: unknown): SectorChunkManager {
    // 1. Migrate to latest format (idempotent if already v3)
    const levelData = migrateToLatest(rawData);

    // 2. Convert v3 blocks → legacy flat-array SectorData for physics setup
    const data = levelDataToSectorData(levelData);

    // 3. Spawn ball
    simulation.setBall(data.ball.x, data.ball.y);

    // 4. Spawn plunger
    if (data.plunger) {
      simulation.addPlunger(data.plunger.x, data.plunger.y);
    }

    // 5. Spawn flippers
    data.flippers.forEach((f) => {
      simulation.addFlipper(f.side, f.x, f.y);
    });

    // 6. Spawn bumpers
    data.bumpers?.forEach((b) => {
      simulation.addBumper(b.x, b.y, b.radius ?? 0.6);
    });

    // 7. Instantiate SectorChunkManager for dynamic wall loading
    const chunkManager = new SectorChunkManager(simulation, data.walls as WallData[]);
    chunkManager.update(data.ball.y);

    return chunkManager;
  }

  /**
   * Convenience: load directly from a JSON string.
   * Parses, migrates, and loads in one call.
   */
  static loadFromJson(simulation: Simulation, json: string): SectorChunkManager {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch (err) {
      throw new Error(`SectorLoader.loadFromJson: invalid JSON — ${(err as Error).message}`);
    }
    return SectorLoader.load(simulation, raw);
  }
}
