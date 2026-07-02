import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';
import { Ball } from './Ball';

export class FallFloor {
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  
  public floorY: number;
  public halfWidth: number;
  public halfHeight: number;
  private defaultGroups: number;
  private collisionEnabled = true;

  constructor(physicsWorld: PhysicsWorld, x: number, y: number, halfWidth = 2.5, halfHeight = 0.15) {
    this.floorY = y;
    this.halfWidth = halfWidth;
    this.halfHeight = halfHeight;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    this.body = physicsWorld.createRigidBody(bodyDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight);
    this.collider = physicsWorld.createCollider(colDesc, this.body);

    // Retrieve default groups assigned by Rapier
    this.defaultGroups = this.collider.collisionGroups();
  }

  /**
   * Toggles solidity based on whether the ball's center is above the platform
   * and the ball is not moving upward. This prevents penetration jitter.
   */
  update(ball: Ball): void {
    const ballPos = ball.body.translation();
    const ballVel = ball.body.linvel();

    // Solid if ball is above the platform center line and not moving upward quickly
    if (ballPos.y >= this.floorY - 0.1 && ballVel.y <= 0.1) {
      this.collider.setCollisionGroups(this.defaultGroups);
      this.collisionEnabled = true;
    } else {
      this.collider.setCollisionGroups(0);
      this.collisionEnabled = false;
    }
  }

  isSolid(): boolean {
    return this.collisionEnabled;
  }

  getPosition(): { x: number; y: number } {
    return this.body.translation();
  }
}
