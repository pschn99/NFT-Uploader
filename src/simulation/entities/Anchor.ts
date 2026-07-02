import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';
import { Ball } from './Ball';

export class Anchor {
  public anchorBody: RAPIER.RigidBody | null = null;
  public joint: RAPIER.ImpulseJoint | null = null;
  private physicsWorld: PhysicsWorld;

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld;
  }

  /**
   * Hooks the ball to a fixed static body created at its current coordinates.
   */
  attach(ball: Ball): void {
    if (this.anchorBody) return;

    const ballPos = ball.body.translation();

    // 1. Create a fixed anchor point at the ball's center
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(ballPos.x, ballPos.y);
    this.anchorBody = this.physicsWorld.createRigidBody(bodyDesc);

    // 2. Pin the ball to the anchor point with a revolute joint
    const jointData = RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 });
    this.joint = this.physicsWorld.createImpulseJoint(jointData, this.anchorBody, ball.body, true);
  }

  /**
   * Detaches the joint and cleans up the static anchor body from the world.
   */
  detach(): void {
    if (this.anchorBody) {
      this.physicsWorld.removeRigidBody(this.anchorBody);
      this.anchorBody = null;
      this.joint = null;
    }
  }

  /**
   * Returns true if the ball is currently anchored in space.
   */
  isAttached(): boolean {
    return this.anchorBody !== null;
  }
}
