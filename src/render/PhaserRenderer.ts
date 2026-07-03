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
  private dynamicGraphics!: Phaser.GameObjects.Graphics; // Renders walls, bumpers, fall floors
  
  private flipperGraphicsMap = new Map<Flipper, Phaser.GameObjects.Rectangle>();
  private bumperGraphics: Phaser.GameObjects.Arc[] = [];
  private plungerGraphics!: Phaser.GameObjects.Rectangle;
  private plungerTensionGraphics!: Phaser.GameObjects.Rectangle;

  // 8-point ball path trail variables
  private ballTrail: { x: number; y: number }[] = [];
  private maxTrailLength = 8;
  private screenHeight: number;

  constructor(scene: Phaser.Scene, simulation: Simulation) {
    this.scene = scene;
    this.simulation = simulation;
    this.screenHeight = scene.scale.height;
    this.setupVisuals();
  }

  private setupVisuals(): void {
    // 1. Create vector trail graphics (placed behind the ball)
    this.trailGraphics = this.scene.add.graphics();

    // 2. Create dynamic objects graphics overlay
    this.dynamicGraphics = this.scene.add.graphics();

    // 3. Create ball graphics
    const ballRadPx = this.simulation.ball.radius * PIXELS_PER_METRE;
    this.ballGraphics = this.scene.add.circle(0, 0, ballRadPx, 0xffffff);

    // 4. Create flippers graphics
    this.simulation.flippers.forEach((flipper) => {
      const wPx = flipper.length * PIXELS_PER_METRE;
      const hPx = flipper.thickness * PIXELS_PER_METRE;
      
      const rect = this.scene.add.rectangle(0, 0, wPx, hPx, 0xffffff);
      
      // Pivot is at the side of the paddle, not the center
      const originX = flipper.side === 'left' ? 0.0 : 1.0;
      rect.setOrigin(originX, 0.5);

      this.flipperGraphicsMap.set(flipper, rect);
    });

    // 5. Create plunger graphics
    if (this.simulation.plunger) {
      const p = this.simulation.plunger;
      const px = p.body.translation().x * PIXELS_PER_METRE;
      const py = this.screenHeight - (p.body.translation().y * PIXELS_PER_METRE);
      
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

    // 6. Create bumper graphics
    this.simulation.bumpers.forEach((bumper) => {
      const pos = bumper.getPosition();
      const px = pos.x * PIXELS_PER_METRE;
      const py = this.screenHeight - (pos.y * PIXELS_PER_METRE);
      const rad = bumper.radius * PIXELS_PER_METRE;

      const circle = this.scene.add.circle(px, py, rad, 0x222222);
      circle.setStrokeStyle(2, 0xffffff);
      this.bumperGraphics.push(circle);
    });
  }

  /**
   * Syncs the visual positions with physics simulation and draws the ball path trail.
   */
  update(): void {
    // 1. Sync Ball Position
    const ballPos = this.simulation.ball.getPosition();
    const bx = ballPos.x * PIXELS_PER_METRE;
    const by = this.screenHeight - (ballPos.y * PIXELS_PER_METRE);
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

    // 2. Clear and Redraw Dynamic Objects (Walls, Bumpers, Fall Floors)
    this.dynamicGraphics.clear();

    // Draw active walls
    this.simulation.staticBodies.forEach((body) => {
      const pos = body.translation();
      const numCol = body.numColliders();
      
      for (let i = 0; i < numCol; i++) {
        const col = body.collider(i);
        const halfs = col.halfExtents();
        
        const px = pos.x * PIXELS_PER_METRE;
        const py = this.screenHeight - (pos.y * PIXELS_PER_METRE);
        const w = halfs.x * 2 * PIXELS_PER_METRE;
        const h = halfs.y * 2 * PIXELS_PER_METRE;

        this.dynamicGraphics.lineStyle(2, 0xffffff, 1.0);
        this.dynamicGraphics.fillStyle(0x111111, 1.0);

        const rot = body.rotation();
        if (rot !== 0) {
          this.dynamicGraphics.save();
          this.dynamicGraphics.translateCanvas(px, py);
          this.dynamicGraphics.rotateCanvas(-rot);
          this.dynamicGraphics.strokeRect(-w / 2, -h / 2, w, h);
          this.dynamicGraphics.fillRect(-w / 2, -h / 2, w, h);
          this.dynamicGraphics.restore();
        } else {
          this.dynamicGraphics.strokeRect(px - w / 2, py - h / 2, w, h);
          this.dynamicGraphics.fillRect(px - w / 2, py - h / 2, w, h);
        }
      }
    });

    // Draw active fall floors
    this.simulation.fallFloors.forEach((floor) => {
      const pos = floor.getPosition();
      const px = pos.x * PIXELS_PER_METRE;
      const py = this.screenHeight - (pos.y * PIXELS_PER_METRE);
      const w = floor.halfWidth * 2 * PIXELS_PER_METRE;
      const h = floor.halfHeight * 2 * PIXELS_PER_METRE;

      const solidColor = 0xffffff;
      const ghostColor = 0x555555;
      const color = floor.isSolid() ? solidColor : ghostColor;

      this.dynamicGraphics.lineStyle(2, color, 1.0);
      this.dynamicGraphics.fillStyle(floor.isSolid() ? 0x222222 : 0x111111, 0.7);
      this.dynamicGraphics.strokeRect(px - w / 2, py - h / 2, w, h);
      this.dynamicGraphics.fillRect(px - w / 2, py - h / 2, w, h);
    });

    // 3. Sync Flippers
    this.simulation.flippers.forEach((flipper) => {
      const rect = this.flipperGraphicsMap.get(flipper);
      if (rect) {
        const fpos = flipper.getPosition();
        rect.setPosition(fpos.x * PIXELS_PER_METRE, this.screenHeight - (fpos.y * PIXELS_PER_METRE));
        rect.setRotation(-flipper.getRotation());
      }
    });

    // 4. Sync Plunger tension meter
    if (this.simulation.plunger && this.plungerTensionGraphics) {
      const charge = this.simulation.plunger.getCharge();
      const fullWidth = 1.0 * PIXELS_PER_METRE;
      this.plungerTensionGraphics.setSize(fullWidth * charge, 4);
    }
  }

  destroy(): void {
    this.ballGraphics.destroy();
    this.trailGraphics.destroy();
    this.dynamicGraphics.destroy();
    this.flipperGraphicsMap.forEach((rect) => rect.destroy());
    this.bumperGraphics.forEach((circle) => circle.destroy());
    if (this.plungerGraphics) this.plungerGraphics.destroy();
    if (this.plungerTensionGraphics) this.plungerTensionGraphics.destroy();
  }
}
