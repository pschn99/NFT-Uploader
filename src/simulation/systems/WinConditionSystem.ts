import { Ball } from '../entities/Ball';
import { EventBus } from '../EventBus';
import { SimulationEvents } from '../events';

export class WinConditionSystem {
  public static WIN_HEIGHT_METRES = 500.0; // Tower height threshold

  /**
   * Checks if the ball reached the top exit gate of Sector 0.
   */
  static check(
    ball: Ball,
    eventBus: EventBus<SimulationEvents>,
    elapsedTimeMs: number
  ): boolean {
    const ballPos = ball.body.translation();
    if (ballPos.y >= this.WIN_HEIGHT_METRES) {
      eventBus.emit('WinConditionMet', {
        finalPosition: { x: ballPos.x, y: ballPos.y },
        clearTimeMs: elapsedTimeMs
      });
      return true;
    }
    return false;
  }
}
