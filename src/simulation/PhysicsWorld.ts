import RAPIER from '@dimforge/rapier2d-compat';

export class PhysicsWorld {
  public rawWorld: RAPIER.World;

  constructor(gravity: { x: number; y: number }) {
    this.rawWorld = new RAPIER.World(gravity);
  }

  /**
   * Steps the physics simulation by a fixed timestep of 1/60 seconds.
   */
  step(): void {
    this.rawWorld.step();
  }

  /**
   * Returns the count of active rigid bodies in the world.
   */
  getBodyCount(): number {
    return this.rawWorld.bodies.len();
  }

  /**
   * Registers a rigid body in the world.
   */
  createRigidBody(desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
    return this.rawWorld.createRigidBody(desc);
  }

  /**
   * Registers a collider in the world attached to a body.
   */
  createCollider(desc: RAPIER.ColliderDesc, parent: RAPIER.RigidBody): RAPIER.Collider {
    return this.rawWorld.createCollider(desc, parent);
  }

  /**
   * Registers a joint between two bodies.
   */
  createImpulseJoint(
    desc: RAPIER.JointData,
    parent1: RAPIER.RigidBody,
    parent2: RAPIER.RigidBody,
    wakeUp = true
  ): RAPIER.ImpulseJoint {
    return this.rawWorld.createImpulseJoint(desc, parent1, parent2, wakeUp);
  }

  /**
   * Removes a rigid body and its colliders from the world.
   */
  removeRigidBody(body: RAPIER.RigidBody): void {
    this.rawWorld.removeRigidBody(body);
  }

  /**
   * Cleanup the world resources.
   */
  destroy(): void {
    this.rawWorld.free();
  }
}
