import { Ball } from '../entities/Ball';
import { PlayerState } from '../session/PlayerState';
import { EventBus } from '../EventBus';
import { SimulationEvents } from '../events';

export class NudgeSystem {
  private static NUDGE_IMPULSE_X = 3.5; // Horizontal push force per TDD §5.3

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

    // Purely horizontal correction per TDD §5.3 — y component is 0
    const fx = direction === 'left' ? -this.NUDGE_IMPULSE_X : this.NUDGE_IMPULSE_X;
    ball.body.applyImpulse({ x: fx, y: 0 }, true);

    eventBus.emit('NudgeFired', {
      direction,
      chargesRemaining: playerState.nudgeCharges
    });

    return true;
  }
}
