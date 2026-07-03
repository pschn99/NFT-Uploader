import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';
import { Ball } from './Ball';
import { FALL_FLOOR_ACTIVE_DURATION_MS } from '../constants';

// Collision groups per M0.5 spike verdict (Relative Height Position Filtering)
const DEFAULT_COLLISION_GROUP = 0x0001ffff;
const DISABLED_COLLISION_GROUP = 0x00000000;

export class FallFloor {
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  
  public floorY: number;
  public halfWidth: number;
  public halfHeight: number;
  private collisionEnabled = true;

  // 2-second active duration timer per TDD §5.5
  private createdAtMs: number;
  private activeDurationMs: number;
  private expired = false;

  constructor(
    physicsWorld: PhysicsWorld,
    x: number,
    y: number,
    halfWidth = 2.5,
    halfHeight = 0.15,
    createdAtMs = 0,
    activeDurationMs = FALL_FLOOR_ACTIVE_DURATION_MS
  ) {
    this.floorY = y;
    this.halfWidth = halfWidth;
    this.halfHeight = halfHeight;
    this.createdAtMs = createdAtMs;
    this.activeDurationMs = activeDurationMs;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    this.body = physicsWorld.createRigidBody(bodyDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight);
    this.collider = physicsWorld.createCollider(colDesc, this.body);

    // Start disabled — becomes solid only when ball is above
    this.collider.setCollisionGroups(DISABLED_COLLISION_GROUP);
  }

  /**
   * Toggles solidity using Relative Height Position Filtering per M0.5 spike verdict.
   * The floor is solid only when the ball's bottom edge is above the floor's top edge.
   * This approach was chosen over velocity-based filtering to prevent tunneling/ejection glitches.
   */
  update(ball: Ball, currentMs: number): void {
    // Check if the fall floor has expired (2-second active duration)
    if (!this.expired && currentMs - this.createdAtMs >= this.activeDurationMs) {
      this.expired = true;
      this.collider.setCollisionGroups(DISABLED_COLLISION_GROUP);
      this.collisionEnabled = false;
      return;
    }

    if (this.expired) return;

    const ballPos = ball.body.translation();
    const ballRadius = ball.radius;

    // Relative Height Position Filtering per spike verdict:
    // Solid if ball's bottom edge is above the floor's top edge (with 0.02m tolerance)
    const ballBottomY = ballPos.y - ballRadius;
    const floorTopY = this.floorY + this.halfHeight;

    if (ballBottomY >= floorTopY - 0.02) {
      this.collider.setCollisionGroups(DEFAULT_COLLISION_GROUP);
      this.collisionEnabled = true;
    } else {
      this.collider.setCollisionGroups(DISABLED_COLLISION_GROUP);
      this.collisionEnabled = false;
    }
  }

  isSolid(): boolean {
    return this.collisionEnabled;
  }

  isExpired(): boolean {
    return this.expired;
  }

  getPosition(): { x: number; y: number } {
    return this.body.translation();
  }
}
