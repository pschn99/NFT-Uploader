import { Ball } from '../entities/Ball';
import { PlayerState } from '../session/PlayerState';
import { EventBus } from '../EventBus';
import { SimulationEvents } from '../events';

export class NudgeSystem {
  private static NUDGE_IMPULSE_X = 3.5; // Horizontal push force
  private static NUDGE_IMPULSE_Y = 0.8; // Minor vertical lift to break friction

  /**
   * Applies nudge momentum in the specified direction.
   * @returns True if the nudge was successful, false if there are no charges left.
   */
  static nudge(
    ball: Ball,
    playerState: PlayerState,
    eventBus: EventBus<SimulationEvents>,
    direction: 'left' | 'right'
  ): boolean {
    if (playerState.nudgeCharges <= 0) {
      return false;
    }

    playerState.nudgeCharges--;

    const fx = direction === 'left' ? -this.NUDGE_IMPULSE_X : this.NUDGE_IMPULSE_X;
    ball.body.applyImpulse({ x: fx, y: this.NUDGE_IMPULSE_Y }, true);

    eventBus.emit('NudgeFired', {
      direction,
      chargesRemaining: playerState.nudgeCharges
    });

    return true;
  }
}
