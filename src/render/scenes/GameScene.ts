import Phaser from 'phaser';
import { GameSession } from '../../simulation/session/GameSession';
import { SectorLoader } from '../../tower/SectorLoader';
import { InputBuffer } from '../../core/InputBuffer';
import { InputBridge } from '../InputBridge';
import { PhaserRenderer } from '../PhaserRenderer';
import { CameraController } from '../CameraController';
import { ReplaySystem } from '../../replay/ReplaySystem';
import { HUD } from '../hud/HUD';
import { SectorTransition } from '../transitions/SectorTransition';
import { SectorChunkManager } from '../../tower/SectorChunkManager';
import { AudioSystem } from '../../audio/AudioSystem';
import { CampaignManager, ABYSS_SECTOR_INDEX } from '../../tower/CampaignManager';
import { TestPlayContext } from './CreatorTestPlay';
import { AbyssGenerator } from '../../simulation/systems/AbyssGenerator';
import { LevelData } from '../../levels/LevelData';

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private inputBuffer!: InputBuffer;
  private inputBridge!: InputBridge;
  private visualRenderer!: PhaserRenderer;
  private cameraController!: CameraController;
  private replaySystem!: ReplaySystem;
  
  // Milestone 2 HUD, Chunk, and Audio components
  private hud!: HUD;
  private chunkManager: SectorChunkManager | null = null;
  private audioSystem!: AudioSystem;
  private abyssGenerator: AbyssGenerator | null = null;

  private exportKey!: Phaser.Input.Keyboard.Key;
  private resetKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private winQueued = false;

  private testPlayContext: TestPlayContext | null = null;
  private currentSectorIndex = 0;
  private campaignManager = new CampaignManager();

  constructor() {
    super('GameScene');
  }

  init(data?: { creatorTestPlay?: TestPlayContext; sectorIndex?: number }) {
    if (data && data.creatorTestPlay) {
      this.testPlayContext = data.creatorTestPlay;
      this.currentSectorIndex = -1;
    } else {
      this.testPlayContext = null;
      this.currentSectorIndex = data?.sectorIndex ?? 0;
    }
  }

  create() {
    // 1. Play fade-in transition
    SectorTransition.fadeIn(this);

    // 2. Setup developer & control keys
    const k = this.input.keyboard;
    if (k) {
      this.exportKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.P);
      this.resetKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.escapeKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    this.winQueued = false;
    this.chunkManager = null;
    this.abyssGenerator = null;

    // 3. Load appropriate level data dynamically
    if (this.testPlayContext) {
      this.setupSimulation(this.testPlayContext.levelData);
    } else if (this.currentSectorIndex >= ABYSS_SECTOR_INDEX) {
      this.setupAbyssSimulation();
    } else {
      void this.loadCampaignSector(this.currentSectorIndex);
    }
  }

  private async loadCampaignSector(index: number) {
    try {
      const levelData = await this.campaignManager.loadSector(index);
      this.setupSimulation(levelData);
    } catch (err) {
      console.error('Failed to load campaign sector:', err);
      this.scene.start('MenuScene');
    }
  }

  private setupSimulation(levelData: LevelData) {
    // 1. Create a fresh GameSession (physics + state managers)
    this.session = new GameSession();

    // 2. Load level layout and initialize chunk manager
    this.chunkManager = SectorLoader.load(this.session.simulation, levelData);

    // 3. Create core bridges
    this.inputBuffer = new InputBuffer();
    this.inputBridge = new InputBridge(this, this.inputBuffer, this.session.simulation);
    this.visualRenderer = new PhaserRenderer(this, this.session.simulation);
    this.cameraController = new CameraController(this.cameras.main, this.session.simulation.ball);
    this.replaySystem = new ReplaySystem(this.session);

    // 4. Instantiate HUD overlay
    this.hud = new HUD(this);

    // 5. Instantiate and wire AudioSystem
    this.audioSystem = new AudioSystem(this.session.simulation.eventBus);
    this.input.once('pointerdown', () => this.audioSystem?.init());
    this.input.keyboard?.once('keydown', () => this.audioSystem?.init());

    // 6. Show title card and camera flash (per GDD §7: full-screen inversion + title card)
    const card = CampaignManager.getTitleCard(this.currentSectorIndex);
    SectorTransition.showTitleCard(this, card.name, card.tagline);
    SectorTransition.fadeIn(this);

    console.log(`Campaign simulation loaded: ${levelData.name} (Sector ${this.currentSectorIndex})`);
  }

  private setupAbyssSimulation() {
    // 1. Create GameSession
    this.session = new GameSession();

    // Spawn ball at standard position
    this.session.simulation.setBall(9.125, 2.0);

    // 2. Initialize Abyss generator starting at Y=0
    this.abyssGenerator = new AbyssGenerator(this.session.simulation, Date.now(), 0);
    this.abyssGenerator.update(2.0);

    // 3. Create core bridges
    this.inputBuffer = new InputBuffer();
    this.inputBridge = new InputBridge(this, this.inputBuffer, this.session.simulation);
    this.visualRenderer = new PhaserRenderer(this, this.session.simulation);
    this.cameraController = new CameraController(this.cameras.main, this.session.simulation.ball);
    this.replaySystem = new ReplaySystem(this.session);

    // 4. Instantiate HUD overlay
    this.hud = new HUD(this);

    // 5. Instantiate and wire AudioSystem
    this.audioSystem = new AudioSystem(this.session.simulation.eventBus);
    this.input.once('pointerdown', () => this.audioSystem?.init());
    this.input.keyboard?.once('keydown', () => this.audioSystem?.init());

    // 6. Show title card and camera flash (per GDD §7: full-screen inversion + title card)
    const card = CampaignManager.getTitleCard(this.currentSectorIndex);
    SectorTransition.showTitleCard(this, card.name, card.tagline);
    SectorTransition.fadeIn(this);

    console.log('Abyss simulation loaded.');
  }

  update() {
    if (!this.session) return;

    // Handle win condition transition
    if (this.session.simulation.isWon) {
      if (!this.winQueued) {
        this.winQueued = true;
        if (this.inputBridge) this.inputBridge.destroy(); // Disable further inputs

        this.time.delayedCall(3000, () => {
          SectorTransition.fadeOut(this, 800, () => {
            if (this.testPlayContext) {
              this.testPlayContext.onEnd({ cleared: true, replaySystem: this.replaySystem });
            } else {
              // Progression & next sector wiring
              const nextSectorIndex = this.currentSectorIndex + 1;
              const app = (this.game as any).appInstance;
              if (app && app.saveSystem) {
                app.saveSystem.recordSectorCleared(this.currentSectorIndex).catch((err: any) => {
                  console.error('Failed to record sector clear:', err);
                });
                app.saveSystem.recordSectorReached(nextSectorIndex).catch((err: any) => {
                  console.error('Failed to record sector reached:', err);
                });
              }

              if (CampaignManager.isCampaignSector(nextSectorIndex)) {
                this.scene.start('GameScene', { sectorIndex: nextSectorIndex });
              } else {
                // All campaign sectors cleared! Go to the Abyss!
                this.scene.start('GameScene', { sectorIndex: ABYSS_SECTOR_INDEX });
              }
            }
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
        if (this.testPlayContext) {
          this.testPlayContext.onEnd({ cleared: false });
        } else {
          this.scene.start('MenuScene');
        }
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
    if (this.inputBridge) this.inputBridge.update();

    // D. Pull frame entries, record to ReplaySystem, and step physics
    const currentFrame = this.session.simulation.frameIndex;
    const inputsForFrame = this.inputBuffer.getEntriesForFrame(currentFrame);

    inputsForFrame.forEach((input) => {
      this.replaySystem.recordInput(input.action, input.phase, input.value);
    });

    // Update chunk manager / abyss generator with current ball height before physics step
    if (this.session.simulation.ball) {
      const ballY = this.session.simulation.ball.getPosition().y;
      if (this.chunkManager) {
        this.chunkManager.update(ballY);
      }
      if (this.abyssGenerator) {
        this.abyssGenerator.update(ballY);
        // Persist Abyss PB depth
        const app = (this.game as any).appInstance;
        if (app && app.saveSystem) {
          app.saveSystem.updateAbyssPersonalBest(ballY).catch((err: any) => {
            console.error('Failed to update Abyss PB:', err);
          });
        }
      }
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
    if (this.abyssGenerator) this.abyssGenerator.destroy();
    if (this.audioSystem) this.audioSystem.destroy();
    if (this.session) this.session.destroy();
  }
}
