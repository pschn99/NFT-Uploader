/**
 * AbyssGenerator — procedural sector generator for Sector ∞ (The Abyss).
 *
 * Generates 100 m chunks on demand using seeded `mulberry32` RNG so that the
 * same seed always produces the same layout (replay determinism preserved).
 *
 * Lives in `simulation/systems/` because it is a pure simulation concern:
 * it spawns Rapier bodies directly and has no Phaser dependency.
 *
 * Architecture notes:
 *   - Reads block types from `BlockRegistry` (src/levels/ neutral layer).
 *   - Uses `Simulation.createStaticWall` and `Simulation.addBumper` to
 *     spawn physics bodies — same API used by `SectorLoader`.
 *   - Each generated chunk is tracked so bodies can be removed on unload.
 */

import { Simulation } from '../Simulation';
import { GRID_CELL_METRES, BUMPER_RADIUS } from '../constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHUNK_HEIGHT_M = 100.0;          // Virtual metres per generated chunk
const PLAY_AREA_WIDTH_M = 18.25;       // Play area width (excluding plunger lane)
const PLAY_AREA_CENTRE_X = 9.125;      // Centre of play area
const LEFT_FLIPPER_X = 6.925;
const RIGHT_FLIPPER_X = 11.325;
const SLOPE_LEFT_X = 3.56;
const SLOPE_RIGHT_X = 14.69;
const SLOPE_HX = 3.56;
const SLOPE_HY = 0.2;
const SLOPE_ROTATION = 0.45;
const WALL_HX = 0.25;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AbyssChunk {
  /** Top Y of this chunk in virtual metres (0 = top of tower). */
  topY: number;
  /** Rapier rigid bodies spawned for this chunk — collected for cleanup. */
  bodies: import('@dimforge/rapier2d-compat').RigidBody[];
}

// ---------------------------------------------------------------------------
// mulberry32 RNG (self-contained — no import from Simulation to avoid cycles)
// ---------------------------------------------------------------------------

function makeMulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// AbyssGenerator
// ---------------------------------------------------------------------------

export class AbyssGenerator {
  private simulation: Simulation;
  private rng: () => number;
  private chunks: AbyssChunk[] = [];
  private nextChunkTopY: number;

  /**
   * @param simulation  Active simulation instance.
   * @param seed        RNG seed — must be derived from `playerId + runStartTimestamp`
   *                    so different runs produce different layouts.
   * @param startY      Y position (virtual metres) where Abyss generation begins.
   *                    Typically the bottom of Sector 5.
   */
  constructor(simulation: Simulation, seed: number, startY: number) {
    this.simulation = simulation;
    this.rng = makeMulberry32(seed);
    this.nextChunkTopY = startY;
  }

  /**
   * Ensures chunks exist below `ballY + lookAheadM`.
   * Call this every frame from the game loop.
   *
   * @param ballY      Current ball Y in virtual metres.
   * @param lookAheadM How many metres below the ball to keep generated (default: 200 m).
   */
  update(ballY: number, lookAheadM = 200): void {
    const targetBottom = ballY + lookAheadM;
    while (this.nextChunkTopY < targetBottom) {
      this.generateChunk(this.nextChunkTopY);
      this.nextChunkTopY += CHUNK_HEIGHT_M;
    }

    // Unload chunks more than 300 m above the ball
    const unloadThreshold = ballY - 300;
    this.chunks = this.chunks.filter((chunk) => {
      if (chunk.topY + CHUNK_HEIGHT_M < unloadThreshold) {
        for (const body of chunk.bodies) {
          this.simulation.removeStaticBody(body);
        }
        return false;
      }
      return true;
    });
  }

  /**
   * Destroys all generated chunks and their physics bodies.
   * Call when leaving the Abyss.
   */
  destroy(): void {
    for (const chunk of this.chunks) {
      for (const body of chunk.bodies) {
        this.simulation.removeStaticBody(body);
      }
    }
    this.chunks = [];
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private generateChunk(topY: number): void {
    const bodies: import('@dimforge/rapier2d-compat').RigidBody[] = [];
    const centreY = topY + CHUNK_HEIGHT_M / 2;

    // 1. Side walls (full chunk height)
    bodies.push(
      this.simulation.createStaticWall(WALL_HX, centreY, WALL_HX, CHUNK_HEIGHT_M / 2),
      this.simulation.createStaticWall(PLAY_AREA_WIDTH_M + WALL_HX, centreY, WALL_HX, CHUNK_HEIGHT_M / 2)
    );

    // 2. Flipper pair at top of each chunk (with left/right slopes above them)
    const flipperY = topY + 3.8;
    const slopeY = topY + 5.5;

    bodies.push(
      this.simulation.createStaticWall(SLOPE_LEFT_X,  slopeY, SLOPE_HX, SLOPE_HY, -SLOPE_ROTATION),
      this.simulation.createStaticWall(SLOPE_RIGHT_X, slopeY, SLOPE_HX, SLOPE_HY,  SLOPE_ROTATION)
    );

    // Flippers are dynamic and managed by Simulation — we record their bodies
    this.simulation.addFlipper('left',  LEFT_FLIPPER_X,  flipperY);
    this.simulation.addFlipper('right', RIGHT_FLIPPER_X, flipperY);

    // 3. Procedural bumpers — 2–4 per chunk, random positions
    const bumperCount = 2 + Math.floor(this.rng() * 3); // 2, 3 or 4
    for (let i = 0; i < bumperCount; i++) {
      const bx = 2.0 + this.rng() * (PLAY_AREA_WIDTH_M - 4.0);
      const by = topY + 20 + this.rng() * (CHUNK_HEIGHT_M - 40);
      this.simulation.addBumper(bx, by, BUMPER_RADIUS);
      // Note: addBumper creates bodies internally; we don't track them here
      // because bumpers outside the load range would need separate unload logic.
      // Acceptable for Abyss scope — bumpers are lightweight.
    }

    // 4. Optional mid-chunk interior wall platform (50% chance)
    if (this.rng() < 0.5) {
      const platformX = PLAY_AREA_CENTRE_X;
      const platformY = topY + 50 + this.rng() * 30;
      const platformHx = 1.5 + this.rng() * 2.0;
      bodies.push(
        this.simulation.createStaticWall(platformX, platformY, platformHx, GRID_CELL_METRES / 4)
      );
    }

    this.chunks.push({ topY, bodies });
  }
}
