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
    // Register cleanup to run when the scene is stopped/restarted
    this.events.once('shutdown', this.destroy, this);

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
    const seed = this.currentSectorIndex === -1 ? 12345 : (1000 + this.currentSectorIndex);
    this.session = new GameSession(seed);

    // 2. Load level layout and initialize chunk manager
    this.chunkManager = SectorLoader.load(this.session.simulation, levelData);

    // 3. Create core bridges
    const app = (this.game as any).appInstance;
    const settingsSystem = app?.settingsSystem;
    this.inputBuffer = new InputBuffer();
    this.inputBridge = new InputBridge(this, this.inputBuffer, this.session.simulation, settingsSystem);
    this.visualRenderer = new PhaserRenderer(this, this.session.simulation);
    this.cameraController = new CameraController(this.cameras.main, this.session.simulation.ball);
    this.replaySystem = this.session.replay;

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
    // 1. Generate a seed for this specific run (Priority 1)
    const runSeed = Math.floor(Math.random() * 1000000) || 12345;

    // Create GameSession with the run seed
    this.session = new GameSession(runSeed);

    // Spawn ball at standard position
    this.session.simulation.setBall(9.125, 2.0);

    // 2. Initialize Abyss generator starting at Y=0 with the same run seed
    this.abyssGenerator = new AbyssGenerator(this.session.simulation, runSeed, 0);
    this.abyssGenerator.update(2.0);

    // 3. Create core bridges
    const app = (this.game as any).appInstance;
    const settingsSystem = app?.settingsSystem;
    this.inputBuffer = new InputBuffer();
    this.inputBridge = new InputBridge(this, this.inputBuffer, this.session.simulation, settingsSystem);
    this.visualRenderer = new PhaserRenderer(this, this.session.simulation);
    this.cameraController = new CameraController(this.cameras.main, this.session.simulation.ball);
    this.replaySystem = this.session.replay;

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

  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private prevPadStartPressed = false;

  private togglePause() {
    if (!this.session) return;
    const sim = this.session.simulation;
    sim.isPaused = !sim.isPaused;

    if (sim.isPaused) {
      this.showPauseOverlay();
    } else {
      this.hidePauseOverlay();
    }
  }

  private showPauseOverlay() {
    if (this.pauseOverlay) {
      this.pauseOverlay.setVisible(true);
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;

    this.pauseOverlay = this.add.container(0, 0).setDepth(2000);

    // 1. Semi-transparent backing
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a0c, 0.85);
    bg.fillRect(0, 0, width, height);
    this.pauseOverlay.add(bg);

    // 2. Neon cyan frame
    const frame = this.add.graphics();
    frame.lineStyle(2, 0x00ffff, 0.7);
    frame.strokeRect(width / 2 - 200, height / 2 - 220, 400, 440);
    this.pauseOverlay.add(frame);

    // 3. Title text
    const title = this.add.text(width / 2, height / 2 - 160, 'SYSTEM PAUSED', {
      fontSize: '32px',
      color: '#00ffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);
    this.pauseOverlay.add(title);

    const subtitle = this.add.text(width / 2, height / 2 - 120, 'suspension active', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'monospace',
      align: 'center'
    }).setOrigin(0.5);
    this.pauseOverlay.add(subtitle);

    // 4. Menu buttons helper
    const createBtn = (yOffset: number, label: string, onClick: () => void) => {
      const btn = this.add.text(width / 2, height / 2 + yOffset, label, {
        fontSize: '20px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
        padding: { x: 16, y: 8 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setColor('#00ffff'));
      btn.on('pointerout', () => btn.setColor('#aaaaaa'));
      btn.on('pointerdown', onClick);

      this.pauseOverlay?.add(btn);
    };

    createBtn(-30, '[ RESUME CLIMB ]', () => this.togglePause());
    createBtn(30, '[ RESTART SECTOR ]', () => {
      this.togglePause();
      if (this.testPlayContext) {
        this.scene.start('GameScene', { creatorTestPlay: this.testPlayContext });
      } else {
        this.scene.start('GameScene', { sectorIndex: this.currentSectorIndex });
      }
    });
    createBtn(90, '[ ABORT MISSION ]', () => {
      this.togglePause();
      SectorTransition.fadeOut(this, 300, () => {
        if (this.testPlayContext) {
          this.testPlayContext.onEnd({ cleared: false });
        } else {
          this.scene.start('MenuScene');
        }
      });
    });
  }

  private hidePauseOverlay() {
    if (this.pauseOverlay) {
      this.pauseOverlay.setVisible(false);
    }
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

    // A. Handle Escape key / Gamepad Start to toggle pause (Priority 7)
    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.togglePause();
      return;
    }

    if (this.input.gamepad) {
      const pad = this.input.gamepad.pad1;
      if (pad && pad.buttons[9] && pad.buttons[9].pressed) {
        if (!this.prevPadStartPressed) {
          this.togglePause();
        }
        this.prevPadStartPressed = true;
      } else {
        this.prevPadStartPressed = false;
      }
    }

    // If simulation is paused, skip updating physics or inputs (Priority 7)
    if (this.session.simulation.isPaused) {
      this.visualRenderer.update();
      this.hud.update(this.session);
      return;
    }

    // B. Handle developer export/reset keys
    if (Phaser.Input.Keyboard.JustDown(this.exportKey)) {
      this.replaySystem.exportReplay().then((replay) => {
        console.log('=== EXPORTED REPLAY JSON ===');
        console.log(JSON.stringify(replay, null, 2));
        console.log('============================');
        try {
          localStorage.setItem('last_pinball_replay', JSON.stringify(replay));
          alert('Replay exported to Console!');
        } catch (e) {
          console.error('Failed to write to localStorage', e);
        }
      }).catch((err) => {
        console.error('Export replay error:', err);
      });
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
    if (this.inputBridge) {
      this.inputBridge.destroy();
    }
    if (this.visualRenderer) {
      this.visualRenderer.destroy();
    }
    if (this.hud) {
      this.hud.destroy();
    }
    if (this.chunkManager) {
      this.chunkManager.destroy();
      this.chunkManager = null;
    }
    if (this.abyssGenerator) {
      this.abyssGenerator.destroy();
      this.abyssGenerator = null;
    }
    if (this.audioSystem) {
      this.audioSystem.destroy();
    }
    if (this.session) {
      this.session.destroy();
    }
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy();
      this.pauseOverlay = null;
    }
  }
}
