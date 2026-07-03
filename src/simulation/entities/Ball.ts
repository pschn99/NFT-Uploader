import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';
import { BALL_RADIUS } from '../constants';

export class Ball {
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  public radius = BALL_RADIUS; // Per TDD §5.1

  constructor(physicsWorld: PhysicsWorld, x: number, y: number, restitution = 0.5) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      .setCcdEnabled(true); // CCD is mandatory to prevent ball tunneling through thin bounds
    
    this.body = physicsWorld.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(this.radius)
      .setRestitution(restitution)
      .setDensity(1.5);
    
    this.collider = physicsWorld.createCollider(colliderDesc, this.body);
  }

  getPosition(): { x: number; y: number } {
    return this.body.translation();
  }

  getVelocity(): { x: number; y: number } {
    return this.body.linvel();
  }

  reset(x: number, y: number): void {
    this.body.setTranslation({ x, y }, true);
    this.body.setLinvel({ x: 0, y: 0 }, true);
    this.body.setAngvel(0, true);
  }
}
