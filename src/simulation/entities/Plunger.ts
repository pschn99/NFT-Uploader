import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';
import { Ball } from './Ball';

export class Plunger {
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;

  private charge = 0.0;
  private maxImpulse = 28.0; // Launch impulse applied to ball at full charge

  constructor(physicsWorld: PhysicsWorld, x: number, y: number) {
    // 1. Create fixed plunger block body
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    this.body = physicsWorld.createRigidBody(bodyDesc);

    // 2. Solid top collider for the ball to rest on
    const colDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.1)
      .setRestitution(0.1);
    this.collider = physicsWorld.createCollider(colDesc, this.body);
  }

  /**
   * Increases the plunger charge level.
   * @param delta - Increment value (e.g. 0.02 per frame)
   */
  chargePlunger(delta: number): void {
    this.charge = Math.min(1.0, this.charge + delta);
  }

  getCharge(): number {
    return this.charge;
  }

  /**
   * Fires the plunger. If the ball is resting on the plunger plate, applies an upward impulse.
   * Resets the charge level.
   * @returns The force/impulse value applied (or 0 if it missed).
   */
  fire(ball: Ball): number {
    const chargeApplied = this.charge;
    this.charge = 0.0;

    const ballPos = ball.body.translation();
    const plungerPos = this.body.translation();
    
    // Check if ball is positioned directly above the plunger plate
    const withinX = Math.abs(ballPos.x - plungerPos.x) <= 0.6;
    const withinY = (ballPos.y - plungerPos.y >= 0.1) && (ballPos.y - plungerPos.y <= 1.0);

    if (withinX && withinY && chargeApplied > 0.05) {
      const impulseY = this.maxImpulse * chargeApplied;
      ball.body.applyImpulse({ x: 0, y: impulseY }, true);
      return impulseY;
    }

    return 0;
  }
}
