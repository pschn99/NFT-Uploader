import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';
import { Ball } from './Ball';

export class Bumper {
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  public radius: number;
  private pushForce = 8.0; // Added momentum impulse when ball hits bumper

  constructor(physicsWorld: PhysicsWorld, x: number, y: number, radius = 0.6) {
    this.radius = radius;

    // Create fixed circular bumper body
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    this.body = physicsWorld.createRigidBody(bodyDesc);

    // Circle collider with restitution to help bounce
    const colDesc = RAPIER.ColliderDesc.ball(radius)
      .setRestitution(1.1);
    this.collider = physicsWorld.createCollider(colDesc, this.body);
  }

  /**
   * Resolves bumper hit detection manually to guarantee 100% replay determinism.
   * If ball is touching, applies a radial push impulse away from bumper center.
   * @returns True if a hit was resolved.
   */
  resolveHit(ball: Ball): boolean {
    const ballPos = ball.body.translation();
    const bumperPos = this.body.translation();

    const dx = ballPos.x - bumperPos.x;
    const dy = ballPos.y - bumperPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Collision check with epsilon buffer
    if (dist <= this.radius + ball.radius + 0.05) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);

      // Apply force along collision normal
      ball.body.applyImpulse({ x: nx * this.pushForce, y: ny * this.pushForce }, true);
      return true;
    }

    return false;
  }

  getPosition(): { x: number; y: number } {
    return this.body.translation();
  }
}
