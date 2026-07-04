import { Ball } from '../entities/Ball';
import { EventBus } from '../EventBus';
import { SimulationEvents } from '../events';

export interface ExitSensor {
  x: number;
  y: number;
  radius: number;
}

export class WinConditionSystem {
  /**
   * Checks if the ball reached the top exit gate of the current sector.
   * Compares the ball's overlap with circular exit sensors (Priority 10),
   * falling back to the target vertical height boundary check if no sensors are loaded.
   */
  static check(
    ball: Ball,
    exitSensors: ExitSensor[],
    eventBus: EventBus<SimulationEvents>,
    elapsedTimeMs: number,
    winHeightMetres = 500.0
  ): boolean {
    const ballPos = ball.body.translation();
    const ballRadius = ball.radius;

    // 1. Check overlap with circular exit sensors from level data (Priority 10)
    if (exitSensors.length > 0) {
      for (const sensor of exitSensors) {
        const dist = Math.hypot(ballPos.x - sensor.x, ballPos.y - sensor.y);
        if (dist <= ballRadius + sensor.radius) {
          eventBus.emit('WinConditionMet', {
            finalPosition: { x: ballPos.x, y: ballPos.y },
            clearTimeMs: elapsedTimeMs
          });
          return true;
        }
      }
      return false;
    }

    // 2. Fallback to vertical boundary check if no exit sensors exist
    if (ballPos.y >= winHeightMetres) {
      eventBus.emit('WinConditionMet', {
        finalPosition: { x: ballPos.x, y: ballPos.y },
        clearTimeMs: elapsedTimeMs
      });
      return true;
    }
    return false;
  }
}
