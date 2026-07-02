import Phaser from 'phaser';
import RAPIER from '@dimforge/rapier2d-compat';

export class FlipperSpike extends Phaser.Scene {
  private rWorld!: RAPIER.World;
  private initialized = false;

  // Bodies & Joint References
  private ballBody!: RAPIER.RigidBody;
  private ballGraphics!: Phaser.GameObjects.Arc;

  private leftFlipperBody!: RAPIER.RigidBody;
  private leftFlipperJoint!: RAPIER.RevoluteImpulseJoint;
  private leftFlipperGraphics!: Phaser.GameObjects.Rectangle;

  private rightFlipperBody!: RAPIER.RigidBody;
  private rightFlipperJoint!: RAPIER.RevoluteImpulseJoint;
  private rightFlipperGraphics!: Phaser.GameObjects.Rectangle;

  // Visual Boundary Elements
  private borders: Phaser.GameObjects.Rectangle[] = [];

  // Tuning Parameters
  private gravityY = -9.81 * 4.0; // Pushed gravity for fast vertical arcade feel
  private motorSpeed = 30.0;     // Radians per second
  private maxTorque = 3000.0;     // Max motor force
  private ballRestitution = 0.5;  // Bounciness

  // Controls
  private keys!: {
    leftFlipper: Phaser.Input.Keyboard.Key;
    rightFlipper: Phaser.Input.Keyboard.Key;
    leftAlt: Phaser.Input.Keyboard.Key;
    rightAlt: Phaser.Input.Keyboard.Key;
    resetBall: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  // Metrics
  private currentParameterIndex = 0;
  private parameterList: Array<{
    name: string;
    key: 'gravityY' | 'motorSpeed' | 'maxTorque' | 'ballRestitution';
    min: number;
    max: number;
    step: number;
  }> = [
    { name: 'Gravity Y', key: 'gravityY', min: -100, max: 0, step: 2 },
    { name: 'Motor Speed', key: 'motorSpeed', min: 5, max: 80, step: 5 },
    { name: 'Max Torque', key: 'maxTorque', min: 100, max: 10000, step: 200 },
    { name: 'Ball Restitution', key: 'ballRestitution', min: 0.0, max: 1.0, step: 0.05 }
  ];

  private leftFlipperFlipping = false;
  private leftFlipStartTime = 0;
  private leftFlipLatency = 0; // ms to reach upper limit

  // UI Text GameObjects
  private textUI!: Phaser.GameObjects.Text;
  private ppm = 50; // Pixels Per Metre

  constructor() {
    super('FlipperSpike');
  }

  async init() {
    try {
      console.log('Initializing Rapier WASM...');
      await RAPIER.init();
      console.log('Rapier WASM loaded successfully!');
      this.initialized = true;
    } catch (err) {
      console.error('Failed to load Rapier WASM:', err);
    }
  }

  create() {
    if (!this.initialized) {
      this.add.text(512, 384, 'Error Initializing Rapier WASM.\nCheck console logs.', {
        fontSize: '24px',
        color: '#ff0000',
        fontFamily: 'monospace',
        align: 'center'
      }).setOrigin(0.5);
      return;
    }

    // 1. Create Rapier Physics World
    const gravity = { x: 0.0, y: this.gravityY };
    this.rWorld = new RAPIER.World(gravity);

    // 2. Setup Keyboard Inputs
    const k = this.input.keyboard;
    if (!k) {
      console.error('Phaser keyboard input plugin is not available');
      return;
    }
    this.keys = {
      leftFlipper: k.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      rightFlipper: k.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      leftAlt: k.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      rightAlt: k.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      resetBall: k.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      up: k.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: k.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: k.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: k.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    // 3. Create Solid Static Bounds (using PPM = 50)
    // World bounds: width 1024px = 20.48m, height 768px = 15.36m.
    const screenWidthM = 1024 / this.ppm;
    const screenHeightM = 768 / this.ppm;

    // Floor
    this.createStaticWall(screenWidthM / 2, 0.5, screenWidthM / 2, 0.2);
    // Ceiling
    this.createStaticWall(screenWidthM / 2, screenHeightM - 0.5, screenWidthM / 2, 0.2);
    // Left Wall
    this.createStaticWall(0.5, screenHeightM / 2, 0.2, screenHeightM / 2);
    // Right Wall
    this.createStaticWall(screenWidthM - 0.5, screenHeightM / 2, 0.2, screenHeightM / 2);

    // Left funnel/gutter (sloped)
    this.createStaticWall(4.0, 5.0, 5.0, 0.15, -0.4);
    // Right funnel/gutter (sloped)
    this.createStaticWall(screenWidthM - 4.0, 5.0, 5.0, 0.15, 0.4);

    // 4. Create Flippers
    // Left Flipper pivot: (8.0, 2.5)
    // Right Flipper pivot: (screenWidthM - 8.0, 2.5)
    const flipperLengthM = 2.4;
    const flipperThicknessM = 0.25;

    // --- LEFT FLIPPER ---
    const leftPivotX = 7.8;
    const leftPivotY = 2.5;
    
    // Create static anchor body at pivot
    const leftPivotBody = this.rWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(leftPivotX, leftPivotY));
    
    // Create dynamic flipper body
    const leftFlipperBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(leftPivotX, leftPivotY);
    this.leftFlipperBody = this.rWorld.createRigidBody(leftFlipperBodyDesc);
    
    // Add shape offset so local origin is the left pivot edge
    const leftColDesc = RAPIER.ColliderDesc.cuboid(flipperLengthM / 2, flipperThicknessM / 2)
      .setTranslation(flipperLengthM / 2, 0)
      .setDensity(2.0);
    this.rWorld.createCollider(leftColDesc, this.leftFlipperBody);

    // Link via RevoluteJoint
    const leftJointDesc = RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 });
    leftJointDesc.limitsEnabled = true;
    leftJointDesc.limits = [-0.45, 0.45]; // Limit rotation around [-25 deg, 25 deg]
    this.leftFlipperJoint = this.rWorld.createImpulseJoint(leftJointDesc, leftPivotBody, this.leftFlipperBody, true) as RAPIER.RevoluteImpulseJoint;
    this.leftFlipperJoint.configureMotorModel(RAPIER.MotorModel.ForceBased);

    // Setup Left Phaser Visual Object
    this.leftFlipperGraphics = this.add.rectangle(0, 0, flipperLengthM * this.ppm, flipperThicknessM * this.ppm, 0xffffff).setOrigin(0, 0.5);

    // --- RIGHT FLIPPER ---
    const rightPivotX = screenWidthM - 7.8;
    const rightPivotY = 2.5;
    
    // Static anchor body
    const rightPivotBody = this.rWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(rightPivotX, rightPivotY));

    // Dynamic body
    const rightFlipperBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(rightPivotX, rightPivotY);
    this.rightFlipperBody = this.rWorld.createRigidBody(rightFlipperBodyDesc);

    // Shape offset so local origin is the right pivot edge (extends left on local -X axis)
    const rightColDesc = RAPIER.ColliderDesc.cuboid(flipperLengthM / 2, flipperThicknessM / 2)
      .setTranslation(-flipperLengthM / 2, 0)
      .setDensity(2.0);
    this.rWorld.createCollider(rightColDesc, this.rightFlipperBody);

    // Joint
    const rightJointDesc = RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 });
    rightJointDesc.limitsEnabled = true;
    rightJointDesc.limits = [-0.45, 0.45];
    this.rightFlipperJoint = this.rWorld.createImpulseJoint(rightJointDesc, rightPivotBody, this.rightFlipperBody, true) as RAPIER.RevoluteImpulseJoint;
    this.rightFlipperJoint.configureMotorModel(RAPIER.MotorModel.ForceBased);

    // Setup Right Phaser Visual Object
    this.rightFlipperGraphics = this.add.rectangle(0, 0, flipperLengthM * this.ppm, flipperThicknessM * this.ppm, 0xffffff).setOrigin(1, 0.5);

    // 5. Create dynamic ball
    const ballRadius = 0.35;
    const ballBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(screenWidthM / 2, 9.0)
      .setCcdEnabled(true);
    this.ballBody = this.rWorld.createRigidBody(ballBodyDesc);
    const ballColliderDesc = RAPIER.ColliderDesc.ball(ballRadius)
      .setRestitution(this.ballRestitution)
      .setDensity(1.5);
    this.rWorld.createCollider(ballColliderDesc, this.ballBody);

    // Setup Ball Phaser Visual Object
    this.ballGraphics = this.add.circle(0, 0, ballRadius * this.ppm, 0xffffff);

    // 6. Setup text overlay
    this.textUI = this.add.text(20, 20, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      lineSpacing: 4
    });

    // 7. Initial configuration applying default motor parameters
    this.updateMotorProperties();
  }

  private createStaticWall(xM: number, yM: number, halfWidthM: number, halfHeightM: number, rotationRad = 0) {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(xM, yM).setRotation(rotationRad);
    const body = this.rWorld.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(halfWidthM, halfHeightM);
    this.rWorld.createCollider(colDesc, body);

    // Visual rectangle representation
    const rect = this.add.rectangle(
      xM * this.ppm,
      768 - (yM * this.ppm),
      halfWidthM * 2 * this.ppm,
      halfHeightM * 2 * this.ppm,
      0xffffff
    );
    rect.setRotation(-rotationRad);
    this.borders.push(rect);
  }

  private updateMotorProperties() {
    this.leftFlipperJoint.configureMotorVelocity(0.0, this.maxTorque);
    this.rightFlipperJoint.configureMotorVelocity(0.0, this.maxTorque);
  }

  update(time: number) {
    if (!this.initialized) return;

    // Handle parameter adjustments
    this.handleKeyboardMenu();

    // Physics Loop Input Actions
    this.handleFlipperInputs(time);

    // Reset ball position
    if (Phaser.Input.Keyboard.JustDown(this.keys.resetBall)) {
      this.resetBall();
    }

    // Step physics simulation (fixed 1/60s step)
    this.rWorld.step();

    // Sync Phaser elements position and rotation with Rapier body status
    // 1. Ball
    const bPos = this.ballBody.translation();
    this.ballGraphics.setPosition(bPos.x * this.ppm, 768 - (bPos.y * this.ppm));

    // Fall containment: Auto reset if ball drops below play boundaries
    if (bPos.y < -1.0) {
      this.resetBall();
    }

    // 2. Left Flipper
    const leftPivot = this.leftFlipperBody.translation();
    this.leftFlipperGraphics.setPosition(leftPivot.x * this.ppm, 768 - (leftPivot.y * this.ppm));
    this.leftFlipperGraphics.setRotation(-this.leftFlipperBody.rotation());

    // 3. Right Flipper
    const rightPivot = this.rightFlipperBody.translation();
    this.rightFlipperGraphics.setPosition(rightPivot.x * this.ppm, 768 - (rightPivot.y * this.ppm));
    this.rightFlipperGraphics.setRotation(-this.rightFlipperBody.rotation());

    // Check flipper rotation metrics
    const leftAngle = this.leftFlipperBody.rotation();
    if (this.leftFlipperFlipping && leftAngle >= 0.44) { // Close to max angle limits (0.45)
      this.leftFlipLatency = time - this.leftFlipStartTime;
      this.leftFlipperFlipping = false; // Stop measuring until next click
    }

    // Update screen UI text output
    this.renderUIText();
  }

  private handleFlipperInputs(time: number) {
    // Left Flipper activation: Z or arrow Left
    if (this.keys.leftFlipper.isDown || this.keys.leftAlt.isDown) {
      if (!this.leftFlipperFlipping && this.leftFlipperBody.rotation() <= -0.4) {
        this.leftFlipperFlipping = true;
        this.leftFlipStartTime = time;
      }
      this.leftFlipperJoint.configureMotorVelocity(this.motorSpeed, this.maxTorque);
    } else {
      this.leftFlipperFlipping = false;
      this.leftFlipperJoint.configureMotorVelocity(-this.motorSpeed, this.maxTorque);
    }

    // Right Flipper activation: X or arrow Right
    if (this.keys.rightFlipper.isDown || this.keys.rightAlt.isDown) {
      // Rotating clockwise is negative velocity for right flipper to flip upward
      this.rightFlipperJoint.configureMotorVelocity(-this.motorSpeed, this.maxTorque);
    } else {
      this.rightFlipperJoint.configureMotorVelocity(this.motorSpeed, this.maxTorque);
    }
  }

  private handleKeyboardMenu() {
    // Menu Up/Down to navigate
    if (Phaser.Input.Keyboard.JustDown(this.keys.up)) {
      this.currentParameterIndex = (this.currentParameterIndex - 1 + this.parameterList.length) % this.parameterList.length;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
      this.currentParameterIndex = (this.currentParameterIndex + 1) % this.parameterList.length;
    }

    // Menu Left/Right to adjust values
    const paramObj = this.parameterList[this.currentParameterIndex];
    let valueChanged = false;

    const key = paramObj.key;
    if (Phaser.Input.Keyboard.JustDown(this.keys.left)) {
      const currentVal = this[key];
      this[key] = Math.max(paramObj.min, currentVal - paramObj.step);
      valueChanged = true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.right)) {
      const currentVal = this[key];
      this[key] = Math.min(paramObj.max, currentVal + paramObj.step);
      valueChanged = true;
    }

    if (valueChanged) {
      if (paramObj.key === 'gravityY') {
        this.rWorld.gravity = { x: 0, y: this.gravityY };
      } else if (paramObj.key === 'motorSpeed' || paramObj.key === 'maxTorque') {
        this.updateMotorProperties();
      } else if (paramObj.key === 'ballRestitution') {
        // Find existing ball collider and update bounciness/restitution properties
        const num = this.ballBody.numColliders();
        for (let i = 0; i < num; i++) {
          this.ballBody.collider(i).setRestitution(this.ballRestitution);
        }
      }
    }
  }

  private resetBall() {
    this.ballBody.setTranslation({ x: 10.24, y: 10.0 }, true);
    this.ballBody.setLinvel({ x: 0, y: 0 }, true);
    this.ballBody.setAngvel(0, true);
  }

  private renderUIText() {
    let text = `=== PINBALLZZZ FLIPPER FEEL SPIKE ===\n`;
    text += `Controls:\n`;
    text += `- Z / Arrow Left  : Flip Left Flipper\n`;
    text += `- X / Arrow Right : Flip Right Flipper\n`;
    text += `- SPACE           : Reset Ball Position\n\n`;

    text += `=== MOTOR PARAMETERS (UP/DOWN to select, A/D to tune) ===\n`;
    this.parameterList.forEach((param, idx) => {
      const isSelected = idx === this.currentParameterIndex;
      const val = this[param.key];
      const bullet = isSelected ? ` > ` : `   `;
      const valFormatted = typeof val === 'number' ? val.toFixed(2) : String(val);
      text += `${bullet}[${idx}] ${param.name}: ${valFormatted}\n`;
    });
    text += `\n`;

    text += `=== LIVE METRICS ===\n`;
    const latencyStr = this.leftFlipLatency > 0 ? `${this.leftFlipLatency.toFixed(1)} ms` : 'Waiting for flip...';
    let rating = 'Calculating...';
    if (this.leftFlipLatency > 0) {
      if (this.leftFlipLatency <= 16.7) {
        rating = '5/5 - EXCELLENT (<= 1 frame)';
      } else if (this.leftFlipLatency <= 33.3) {
        rating = '4/5 - GOOD (<= 2 frames)';
      } else if (this.leftFlipLatency <= 50.0) {
        rating = '3/5 - PASSABLE';
      } else {
        rating = '2/5 - INSUFFICIENT';
      }
    }
    
    text += `- Flipper Transit Latency: ${latencyStr}\n`;
    text += `- Subjective Feel Rating : ${rating}\n`;
    text += `- Current Ball Position  : (${this.ballBody.translation().x.toFixed(2)}, ${this.ballBody.translation().y.toFixed(2)})\n`;
    text += `- Simulation Body Count  : ${this.rWorld.bodies.len()} (Rapier)\n`;

    this.textUI.setText(text);
  }
}
