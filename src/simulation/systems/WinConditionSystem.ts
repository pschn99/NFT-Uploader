import { Ball } from '../entities/Ball';
import { EventBus } from '../EventBus';
import { SimulationEvents } from '../events';

export class WinConditionSystem {
  /**
   * Checks if the ball reached the top exit gate of the current sector.
   * Uses a configurable win height (from level data) instead of a hardcoded constant.
   */
  static check(
    ball: Ball,
    eventBus: EventBus<SimulationEvents>,
    elapsedTimeMs: number,
    winHeightMetres = 500.0
  ): boolean {
    const ballPos = ball.body.translation();
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
