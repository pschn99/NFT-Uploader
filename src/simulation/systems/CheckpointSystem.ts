import { Ball } from '../entities/Ball';
import { PlayerState } from '../session/PlayerState';
import { EventBus } from '../EventBus';
import { SimulationEvents } from '../events';
import { FallFloor } from '../entities/FallFloor';
import { PhysicsWorld } from '../PhysicsWorld';
import { CHECKPOINT_INTERVAL_METRES, FALL_FLOOR_OFFSET_METRES } from '../constants';

// Play area center per AGENTS.md §3 (excluding plunger lane)
const PLAY_AREA_CENTRE_X = 9.125;

export class CheckpointSystem {
  /**
   * Tracks ball climbing height to trigger checkpoints every 100m.
   * Restores player charges and returns a new FallFloor if a threshold is crossed.
   */
  static check(
    ball: Ball,
    playerState: PlayerState,
    eventBus: EventBus<SimulationEvents>,
    physicsWorld: PhysicsWorld,
    floorX = PLAY_AREA_CENTRE_X
  ): FallFloor | null {
    const ballPos = ball.body.translation();

    // Checkpoints are indexed by 100m vertical tiers
    const currentTier = Math.floor(ballPos.y / CHECKPOINT_INTERVAL_METRES);
    const expectedCheckpointY = currentTier * CHECKPOINT_INTERVAL_METRES;

    if (expectedCheckpointY > 0 && expectedCheckpointY > playerState.lastCheckpointY) {
      const restoredNudges = 3 - playerState.nudgeCharges;
      
      playerState.lastCheckpointY = expectedCheckpointY;
      playerState.nudgeCharges = 3;
      playerState.anchorCharges = 2;

      // Create one-way catch floor 10m below checkpoint height
      const floorY = expectedCheckpointY - FALL_FLOOR_OFFSET_METRES;

      const fallFloor = new FallFloor(physicsWorld, floorX, floorY);

      eventBus.emit('CheckpointReached', {
        checkpointY: expectedCheckpointY,
        chargesRestored: restoredNudges
      });

      return fallFloor;
    }

    return null;
  }
}
