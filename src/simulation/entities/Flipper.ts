import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';

export class Flipper {
  public body: RAPIER.RigidBody;
  public joint: RAPIER.RevoluteImpulseJoint;
  public side: 'left' | 'right';
  public length = 2.4;
  public thickness = 0.25;

  private targetSpeed = 30.0; // rad/s
  private maxTorque = 3000.0;

  constructor(
    physicsWorld: PhysicsWorld,
    side: 'left' | 'right',
    x: number,
    y: number,
    minAngle = -0.45,
    maxAngle = 0.45
  ) {
    this.side = side;

    // 1. Create fixed anchor body at pivot position
    const pivotDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
    const pivotBody = physicsWorld.createRigidBody(pivotDesc);

    // 2. Create dynamic flipper body starting at its resting limit angle
    const initialAngle = side === 'left' ? minAngle : maxAngle;
    const flipperDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y)
      .setRotation(initialAngle);
    this.body = physicsWorld.createRigidBody(flipperDesc);

    // Offset the cuboid collider based on left/right pivot orientation
    const offsetX = side === 'left' ? this.length / 2 : -this.length / 2;
    const colDesc = RAPIER.ColliderDesc.cuboid(this.length / 2, this.thickness / 2)
      .setTranslation(offsetX, 0)
      .setDensity(2.0);
    physicsWorld.createCollider(colDesc, this.body);

    // 3. Connect via RevoluteJoint
    const jointDesc = RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 });
    jointDesc.limitsEnabled = true;
    jointDesc.limits = [minAngle, maxAngle];

    this.joint = physicsWorld.createImpulseJoint(jointDesc, pivotBody, this.body, true) as RAPIER.RevoluteImpulseJoint;
    this.joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
    
    // Set initial resting motor velocity (drive downwards)
    const initialRestSpeed = side === 'left' ? -this.targetSpeed : this.targetSpeed;
    this.joint.configureMotorVelocity(initialRestSpeed, this.maxTorque);
  }

  /**
   * Actuates the flipper based on input state.
   * @param isPressed - True if the flipper button is held down.
   */
  setInput(isPressed: boolean): void {
    if (this.side === 'left') {
      const speed = isPressed ? this.targetSpeed : -this.targetSpeed;
      this.joint.configureMotorVelocity(speed, this.maxTorque);
    } else {
      // For the right flipper, positive rotation swings downwards, negative velocity swings upwards.
      const speed = isPressed ? -this.targetSpeed : this.targetSpeed;
      this.joint.configureMotorVelocity(speed, this.maxTorque);
    }
  }

  getPosition(): { x: number; y: number } {
    return this.body.translation();
  }

  getRotation(): number {
    return this.body.rotation();
  }
}
