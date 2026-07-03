import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';

export class Flipper {
  public body: RAPIER.RigidBody;
  public joint: RAPIER.RevoluteImpulseJoint;
  public side: 'left' | 'right';
  public length = 1.6;
  public thickness = 0.25;
  
  public minAngle: number;
  public maxAngle: number;

  private stiffness = 2000.0;
  private damping = 50.0;
  
  private targetSpeed = 45.0; // rad/s stroke velocity
  private velocityDamping = 300.0; // high gain for arcade-like snappy solenoid flips

  constructor(
    physicsWorld: PhysicsWorld,
    side: 'left' | 'right',
    x: number,
    y: number,
    minAngle = -0.45,
    maxAngle = 0.45
  ) {
    this.side = side;
    this.minAngle = minAngle;
    this.maxAngle = maxAngle;

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
    this.joint = physicsWorld.createImpulseJoint(jointDesc, pivotBody, this.body, true) as RAPIER.RevoluteImpulseJoint;
    
    // Explicitly configure joint limits and motor models on the dynamic joint
    this.joint.setLimits(minAngle, maxAngle);
    this.joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
    
    // Set initial position motor target to resting limit
    this.joint.configureMotorPosition(initialAngle, this.stiffness, this.damping);
  }

  /**
   * Actuates the flipper based on input state.
   * - Solenoid-power velocity control for active flips.
   * - Stable position-lock for resting state.
   */
  setInput(isPressed: boolean): void {
    this.body.wakeUp();
    if (isPressed) {
      // Solenoid swing up: constant high torque and angular velocity
      const speed = this.side === 'left' ? this.targetSpeed : -this.targetSpeed;
      this.joint.configureMotorVelocity(speed, this.velocityDamping);
    } else {
      // Rest/Holding position return
      const target = this.side === 'left' ? this.minAngle : this.maxAngle;
      this.joint.configureMotorPosition(target, this.stiffness, this.damping);
    }
  }

  getPosition(): { x: number; y: number } {
    return this.body.translation();
  }

  getRotation(): number {
    return this.body.rotation();
  }
}
