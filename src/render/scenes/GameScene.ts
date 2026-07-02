import Phaser from 'phaser';
import { GameSession } from '../../simulation/session/GameSession';
import { SectorLoader, SectorData } from '../../tower/SectorLoader';
import { InputBuffer } from '../../core/InputBuffer';
import { InputBridge } from '../InputBridge';
import { PhaserRenderer } from '../PhaserRenderer';
import { CameraController } from '../CameraController';
import { ReplaySystem } from '../../replay/ReplaySystem';
import { HUD } from '../hud/HUD';
import { SectorTransition } from '../transitions/SectorTransition';
import { SectorChunkManager } from '../../tower/SectorChunkManager';
import { AudioSystem } from '../../audio/AudioSystem';

// Import sector_00 from the levels folder
import sector00 from '../../../levels/campaign/sector_00.json';

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private inputBuffer!: InputBuffer;
  private inputBridge!: InputBridge;
  private visualRenderer!: PhaserRenderer;
  private cameraController!: CameraController;
  private replaySystem!: ReplaySystem;
  
  // Milestone 2 HUD, Chunk, and Audio components
  private hud!: HUD;
  private chunkManager!: SectorChunkManager;
  private audioSystem!: AudioSystem;

  private exportKey!: Phaser.Input.Keyboard.Key;
  private resetKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private winQueued = false;

  constructor() {
    super('GameScene');
  }

  create() {
    // 1. Play fade-in transition
    SectorTransition.fadeIn(this);

    // 2. Create a fresh GameSession (physics + state managers)
    this.session = new GameSession();

    // 3. Load level layout and initialize chunk manager
    this.chunkManager = SectorLoader.load(this.session.simulation, sector00 as SectorData);

    // 4. Create core bridges
    this.inputBuffer = new InputBuffer();
    this.inputBridge = new InputBridge(this, this.inputBuffer, this.session.simulation);
    this.visualRenderer = new PhaserRenderer(this, this.session.simulation);
    this.cameraController = new CameraController(this.cameras.main, this.session.simulation.ball);
    this.replaySystem = new ReplaySystem(this.session);

    // 5. Instantiate HUD overlay
    this.hud = new HUD(this);

    // 6. Setup developer & control keys
    const k = this.input.keyboard;
    if (k) {
      this.exportKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.P);
      this.resetKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.escapeKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    // 7. Instantiate and wire AudioSystem
    this.audioSystem = new AudioSystem(this.session.simulation.eventBus);
    this.input.once('pointerdown', () => this.audioSystem.init());
    this.input.keyboard?.once('keydown', () => this.audioSystem.init());

    this.winQueued = false;

    console.log('Milestone 2 Game Sandbox Scene loaded.');
  }

  update() {
    if (!this.session) return;

    // Handle win condition transition
    if (this.session.simulation.isWon) {
      if (!this.winQueued) {
        this.winQueued = true;
        this.inputBridge.destroy(); // Disable further inputs

        this.time.delayedCall(3000, () => {
          SectorTransition.fadeOut(this, 800, () => {
            this.scene.start('MenuScene');
          });
        });
      }
      this.visualRenderer.update();
      this.hud.update(this.session);
      return;
    }

    // A. Handle Escape key to return to menu
    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      SectorTransition.fadeOut(this, 300, () => {
        this.scene.start('MenuScene');
      });
      return;
    }

    // B. Handle developer export/reset keys
    if (Phaser.Input.Keyboard.JustDown(this.exportKey)) {
      const replay = this.replaySystem.exportReplay(12345);
      console.log('=== EXPORTED REPLAY JSON ===');
      console.log(JSON.stringify(replay, null, 2));
      console.log('============================');
      try {
        localStorage.setItem('last_pinball_replay', JSON.stringify(replay));
        alert('Replay exported to Console!');
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

    // C. Input buffer bridge updates
    this.inputBridge.update();

    // D. Pull frame entries, record to ReplaySystem, and step physics
    const currentFrame = this.session.simulation.frameIndex;
    const inputsForFrame = this.inputBuffer.getEntriesForFrame(currentFrame);

    inputsForFrame.forEach((input) => {
      this.replaySystem.recordInput(input.action, input.phase, input.value);
    });

    // Update chunk manager with current ball height before physics step
    if (this.session.simulation.ball) {
      this.chunkManager.update(this.session.simulation.ball.getPosition().y);
    }

    // Step physics
    this.session.simulation.step(inputsForFrame);

    // Record ball position for path hashing
    this.replaySystem.recordStep();

    // E. Sync graphics, camera, and HUD
    this.visualRenderer.update();
    this.cameraController.update();
    this.hud.update(this.session);
  }

  destroy() {
    if (this.inputBridge) this.inputBridge.destroy();
    if (this.visualRenderer) this.visualRenderer.destroy();
    if (this.hud) this.hud.destroy();
    if (this.chunkManager) this.chunkManager.destroy();
    if (this.session) this.session.destroy();
  }
}
