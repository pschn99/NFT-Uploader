import Phaser from 'phaser';
import { GameSession } from '../../simulation/session/GameSession';
import { SectorLoader, SectorData } from '../../tower/SectorLoader';
import { InputBuffer } from '../../core/InputBuffer';
import { InputBridge } from '../InputBridge';
import { PhaserRenderer } from '../PhaserRenderer';
import { CameraController } from '../CameraController';
import { ReplaySystem } from '../../replay/ReplaySystem';

// Import sector_00 from the levels folder
import sector00 from '../../../levels/campaign/sector_00.json';

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private inputBuffer!: InputBuffer;
  private inputBridge!: InputBridge;
  private visualRenderer!: PhaserRenderer;
  private cameraController!: CameraController;
  private replaySystem!: ReplaySystem;

  private debugText!: Phaser.GameObjects.Text;
  private exportKey!: Phaser.Input.Keyboard.Key;
  private resetKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('GameScene');
  }

  create() {
    // 1. Create a fresh GameSession (physics + state managers)
    this.session = new GameSession();

    // 2. Load level layout into simulation
    SectorLoader.load(this.session.simulation, sector00 as SectorData);

    // 3. Create core bridges
    this.inputBuffer = new InputBuffer();
    this.inputBridge = new InputBridge(this, this.inputBuffer, this.session.simulation);
    this.visualRenderer = new PhaserRenderer(this, this.session.simulation);
    this.cameraController = new CameraController(this.cameras.main, this.session.simulation.ball);
    this.replaySystem = new ReplaySystem(this.session);

    // 4. Debug visual HUD
    this.debugText = this.add.text(20, 20, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
      lineSpacing: 4
    }).setScrollFactor(0); // Fix to screen overlay

    // 5. Setup developer keys (P to print/save replay, R to reset ball & clear replay)
    const k = this.input.keyboard;
    if (k) {
      this.exportKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.P);
      this.resetKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    }

    console.log('Milestone 1 Sandbox Scene loaded. Press Space to charge plunger, Z/X for flippers.');
  }

  update() {
    if (!this.session) return;

    // A. Handle developer export/reset keys
    if (Phaser.Input.Keyboard.JustDown(this.exportKey)) {
      const replay = this.replaySystem.exportReplay(12345);
      console.log('=== EXPORTED REPLAY JSON ===');
      console.log(JSON.stringify(replay, null, 2));
      console.log('============================');
      // Save to localStorage
      try {
        localStorage.setItem('last_pinball_replay', JSON.stringify(replay));
        alert('Replay exported to Console and LocalStorage!');
      } catch (e) {
        console.error('Failed to write to localStorage', e);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      this.session.simulation.ball.reset(19.0, 2.0);
      this.replaySystem.clear();
      this.cameraController.reset();
      console.log('Ball reset and replay log cleared.');
    }

    // B. Input buffer bridge updates
    this.inputBridge.update();

    // C. Pull frame entries, record to ReplaySystem, and step physics
    const currentFrame = this.session.simulation.frameIndex;
    const inputsForFrame = this.inputBuffer.getEntriesForFrame(currentFrame);

    inputsForFrame.forEach((input) => {
      this.replaySystem.recordInput(input.action, input.phase, input.value);
    });

    // Step physics
    this.session.simulation.step(inputsForFrame);

    // Record ball position for path hashing
    this.replaySystem.recordStep();

    // D. Sync graphics & camera position
    this.visualRenderer.update();
    this.cameraController.update();

    // E. Render debug HUD text
    this.renderHUD();
  }

  private renderHUD(): void {
    const ball = this.session.simulation.ball;
    const pos = ball.getPosition();
    const vel = ball.getVelocity();
    const frame = this.session.simulation.frameIndex;
    const nudgeCharges = this.session.player.nudgeCharges;

    let text = `=== PINBALLZZZ VERTICAL SLICE SANDBOX ===\n`;
    text += `Controls:\n`;
    text += `- Z / Left  : Left Flipper\n`;
    text += `- X / Right : Right Flipper\n`;
    text += `- SPACE     : Charge & Launch Plunger\n`;
    text += `- R         : Reset Ball & Clear Replay\n`;
    text += `- P         : Export Replay to Console\n\n`;

    text += `=== LIVE PHYSICS HUD ===\n`;
    text += `- Simulation Frame : ${frame}\n`;
    text += `- Ball Position    : (${pos.x.toFixed(2)}m, ${pos.y.toFixed(2)}m)\n`;
    text += `- Ball Velocity    : (${vel.x.toFixed(2)}m/s, ${vel.y.toFixed(2)}m/s)\n`;
    text += `- Max Height       : ${this.session.player.maxHeight.toFixed(2)}m\n`;
    text += `- Nudge Charges    : ${nudgeCharges}\n`;
    text += `- Active Bodies    : ${this.session.simulation.physicsWorld.getBodyCount()}\n`;

    this.debugText.setText(text);
  }

  destroy() {
    this.inputBridge.destroy();
    this.visualRenderer.destroy();
    this.session.destroy();
  }
}
