import Phaser from 'phaser';
import RAPIER from '@dimforge/rapier2d-compat';

export class FallFloorSpike extends Phaser.Scene {
  private rWorld!: RAPIER.World;
  private initialized = false;

  // Rigid Bodies
  private ballBody!: RAPIER.RigidBody;
  private ballGraphics!: Phaser.GameObjects.Arc;

  private floorBody!: RAPIER.RigidBody;
  private floorCollider!: RAPIER.Collider;
  private floorGraphics!: Phaser.GameObjects.Rectangle;

  // State
  private ballRadius = 0.35;
  private floorY = 5.0; // Y height of our one-way platform
  private floorHalfHeight = 0.15;
  private floorHalfWidth = 2.5;
  private ppm = 50;

  // Controls
  private keys!: {
    launchBall: Phaser.Input.Keyboard.Key;
    resetBallTop: Phaser.Input.Keyboard.Key;
  };

  private uiText!: Phaser.GameObjects.Text;
  private collisionEnabled = false;

  constructor() {
    super('FallFloorSpike');
  }

  async init() {
    try {
      console.log('Initializing Rapier WASM for Fall Floor Spike...');
      await RAPIER.init();
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

    // 1. Create Physics World (standard gravity)
    this.rWorld = new RAPIER.World({ x: 0, y: -9.81 * 3.0 });

    // 2. Setup Inputs
    const k = this.input.keyboard;
    if (!k) return;
    this.keys = {
      launchBall: k.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      resetBallTop: k.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    };

    // 3. Create Solid Ground (screen bottom border)
    const screenWidthM = 1024 / this.ppm;
    this.createStaticWall(screenWidthM / 2, 0.5, screenWidthM / 2, 0.2);

    // 4. Create one-way Fall Floor platform in the middle
    const floorX = screenWidthM / 2;
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(floorX, this.floorY);
    this.floorBody = this.rWorld.createRigidBody(floorBodyDesc);
    const floorColDesc = RAPIER.ColliderDesc.cuboid(this.floorHalfWidth, this.floorHalfHeight);
    this.floorCollider = this.rWorld.createCollider(floorColDesc, this.floorBody);

    // Start with collision disabled initially
    this.floorCollider.setCollisionGroups(0); 

    // Setup visual rectangle
    this.floorGraphics = this.add.rectangle(
      floorX * this.ppm,
      768 - (this.floorY * this.ppm),
      this.floorHalfWidth * 2 * this.ppm,
      this.floorHalfHeight * 2 * this.ppm,
      0x00ff00 // Green for platform
    );

    // 5. Create dynamic ball (spawned below the platform)
    const ballBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(screenWidthM / 2, 2.0)
      .setCcdEnabled(true);
    this.ballBody = this.rWorld.createRigidBody(ballBodyDesc);
    const ballColliderDesc = RAPIER.ColliderDesc.ball(this.ballRadius)
      .setRestitution(0.5)
      .setDensity(1.0);
    this.rWorld.createCollider(ballColliderDesc, this.ballBody);

    this.ballGraphics = this.add.circle(0, 0, this.ballRadius * this.ppm, 0xffffff);

    // 6. UI Text
    this.uiText = this.add.text(20, 20, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      lineSpacing: 4
    });
  }

  private createStaticWall(xM: number, yM: number, halfWidthM: number, halfHeightM: number) {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(xM, yM);
    const body = this.rWorld.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(halfWidthM, halfHeightM);
    this.rWorld.createCollider(colDesc, body);

    this.add.rectangle(
      xM * this.ppm,
      768 - (yM * this.ppm),
      halfWidthM * 2 * this.ppm,
      halfHeightM * 2 * this.ppm,
      0xffffff
    );
  }

  update() {
    if (!this.initialized) return;

    // Handle space to launch ball upwards
    if (Phaser.Input.Keyboard.JustDown(this.keys.launchBall)) {
      this.ballBody.setTranslation({ x: 10.24, y: 1.5 }, true);
      this.ballBody.setLinvel({ x: 0, y: 16.0 }, true); // High vertical velocity
    }

    // Handle R to reset ball at the top
    if (Phaser.Input.Keyboard.JustDown(this.keys.resetBallTop)) {
      this.ballBody.setTranslation({ x: 10.24, y: 12.0 }, true);
      this.ballBody.setLinvel({ x: 0, y: 0 }, true);
    }

    const ballPos = this.ballBody.translation();
    const ballBottomY = ballPos.y - this.ballRadius;
    const floorTopY = this.floorY + this.floorHalfHeight;

    // --- ONE-WAY PLATFORM LOGIC ---
    // Enable collision ONLY if the ball's bottom is higher than the platform's top surface.
    // We add a tiny buffer (0.02) to prevent jitter if the ball is resting exactly on it.
    if (ballBottomY >= floorTopY - 0.02) {
      this.floorCollider.setCollisionGroups(0x0001ffff); // Enable default collisions
      this.collisionEnabled = true;
      this.floorGraphics.setFillStyle(0xffffff); // White = Solid
    } else {
      this.floorCollider.setCollisionGroups(0); // Disable all collisions
      this.collisionEnabled = false;
      this.floorGraphics.setFillStyle(0x555555); // Grey = Ghost/Permeable
    }

    // Step Physics
    this.rWorld.step();

    // Render updates
    this.ballGraphics.setPosition(ballPos.x * this.ppm, 768 - (ballPos.y * this.ppm));

    this.renderText(ballPos, ballBottomY, floorTopY);
  }

  private renderText(ballPos: RAPIER.Vector, ballBottomY: number, floorTopY: number) {
    let text = `=== PINBALLZZZ FALL FLOOR SPIKE ===\n`;
    text += `Controls:\n`;
    text += `- SPACE : Spawn ball at bottom and launch UPWARDS\n`;
    text += `- R     : Spawn ball at top (falling down)\n\n`;

    text += `=== PHYSICS STATE ===\n`;
    text += `- Ball Position: (${ballPos.x.toFixed(2)}, ${ballPos.y.toFixed(2)})\n`;
    text += `- Ball Velocity Y: ${this.ballBody.linvel().y.toFixed(2)} m/s\n`;
    text += `- Ball Bottom Y: ${ballBottomY.toFixed(2)} m\n`;
    text += `- Platform Top Y: ${floorTopY.toFixed(2)} m\n\n`;

    text += `=== ONE-WAY platform status ===\n`;
    const status = this.collisionEnabled ? 'SOLID (Colliding)' : 'PERMEABLE (Ghost)';
    const color = this.collisionEnabled ? 'WHITE' : 'GREY';
    text += `- Platform State: ${status} (color: ${color})\n`;

    this.uiText.setText(text);
  }
}
