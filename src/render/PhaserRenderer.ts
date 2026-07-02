import Phaser from 'phaser';
import { Simulation } from '../simulation/Simulation';
import { PIXELS_PER_METRE } from '../simulation/constants';
import { Flipper } from '../simulation/entities/Flipper';

export class PhaserRenderer {
  private scene: Phaser.Scene;
  private simulation: Simulation;

  // Graphics objects
  private ballGraphics!: Phaser.GameObjects.Arc;
  private trailGraphics!: Phaser.GameObjects.Graphics;
  private flipperGraphicsMap = new Map<Flipper, Phaser.GameObjects.Rectangle>();
  private wallGraphics: Phaser.GameObjects.Rectangle[] = [];
  private plungerGraphics!: Phaser.GameObjects.Rectangle;
  private plungerTensionGraphics!: Phaser.GameObjects.Rectangle;

  // 8-point ball path trail variables
  private ballTrail: { x: number; y: number }[] = [];
  private maxTrailLength = 8;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
    this.setupVisuals();
  }

  private setupVisuals(): void {
    // 1. Create vector trail graphics (placed behind the ball)
    this.trailGraphics = this.scene.add.graphics();

    // 2. Create ball graphics
    const ballRadPx = this.simulation.ball.radius * PIXELS_PER_METRE;
    this.ballGraphics = this.scene.add.circle(0, 0, ballRadPx, 0xffffff);

    // 3. Create flippers graphics
    this.simulation.flippers.forEach((flipper) => {
      const wPx = flipper.length * PIXELS_PER_METRE;
      const hPx = flipper.thickness * PIXELS_PER_METRE;
      
      const rect = this.scene.add.rectangle(0, 0, wPx, hPx, 0xffffff);
      
      // Pivot is at the side of the paddle, not the center
      const originX = flipper.side === 'left' ? 0.0 : 1.0;
      rect.setOrigin(originX, 0.5);

      this.flipperGraphicsMap.set(flipper, rect);
    });

    // 4. Create plunger graphics
    if (this.simulation.plunger) {
      const p = this.simulation.plunger;
      const px = p.body.translation().x * PIXELS_PER_METRE;
      const py = 768 - (p.body.translation().y * PIXELS_PER_METRE);
      
      // Plunger physical plate
      this.plungerGraphics = this.scene.add.rectangle(
        px,
        py,
        1.0 * PIXELS_PER_METRE,
        0.2 * PIXELS_PER_METRE,
        0x555555
      );
      
      // Plunger charging bar
      this.plungerTensionGraphics = this.scene.add.rectangle(px - (0.5 * PIXELS_PER_METRE), py + 15, 0, 4, 0xffffff);
      this.plungerTensionGraphics.setOrigin(0, 0.5);
    }

    // 5. Create static walls graphics
    this.simulation.staticBodies.forEach((body) => {
      const numCol = body.numColliders();
      for (let i = 0; i < numCol; i++) {
        const col = body.collider(i);
        const pos = body.translation();
        
        // Grab half extents for cuboids
        const halfs = col.halfExtents();
        const rect = this.scene.add.rectangle(
          pos.x * PIXELS_PER_METRE,
          768 - (pos.y * PIXELS_PER_METRE),
          halfs.x * 2 * PIXELS_PER_METRE,
          halfs.y * 2 * PIXELS_PER_METRE,
          0xffffff
        );
        rect.setStrokeStyle(1, 0x333333);
        rect.setRotation(-body.rotation());
        this.wallGraphics.push(rect);
      }
    });
  }

  /**
   * Syncs the visual positions with physics simulation and draws the ball path trail.
   */
  update(): void {
    // 1. Sync Ball Position
    const ballPos = this.simulation.ball.getPosition();
    const bx = ballPos.x * PIXELS_PER_METRE;
    const by = 768 - (ballPos.y * PIXELS_PER_METRE);
    this.ballGraphics.setPosition(bx, by);

    // Save trail point
    this.ballTrail.push({ x: bx, y: by });
    if (this.ballTrail.length > this.maxTrailLength) {
      this.ballTrail.shift();
    }

    // Draw the 8-point trail lines
    this.trailGraphics.clear();
    for (let i = 0; i < this.ballTrail.length - 1; i++) {
      const p1 = this.ballTrail[i];
      const p2 = this.ballTrail[i + 1];
      
      const alpha = (i + 1) / this.ballTrail.length;
      this.trailGraphics.lineStyle(3, 0xffffff, alpha * 0.6);
      this.trailGraphics.lineBetween(p1.x, p1.y, p2.x, p2.y);
    }

    // 2. Sync Flippers
    this.simulation.flippers.forEach((flipper) => {
      const rect = this.flipperGraphicsMap.get(flipper);
      if (rect) {
        const fpos = flipper.getPosition();
        rect.setPosition(fpos.x * PIXELS_PER_METRE, 768 - (fpos.y * PIXELS_PER_METRE));
        rect.setRotation(-flipper.getRotation());
      }
    });

    // 3. Sync Plunger tension meter
    if (this.simulation.plunger && this.plungerTensionGraphics) {
      const charge = this.simulation.plunger.getCharge();
      const fullWidth = 1.0 * PIXELS_PER_METRE;
      this.plungerTensionGraphics.setSize(fullWidth * charge, 4);
    }
  }

  destroy(): void {
    this.ballGraphics.destroy();
    this.trailGraphics.destroy();
    this.flipperGraphicsMap.forEach((rect) => rect.destroy());
    this.wallGraphics.forEach((rect) => rect.destroy());
    if (this.plungerGraphics) this.plungerGraphics.destroy();
    if (this.plungerTensionGraphics) this.plungerTensionGraphics.destroy();
  }
}
