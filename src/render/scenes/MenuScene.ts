import Phaser from 'phaser';
import { SectorTransition } from '../transitions/SectorTransition';

export class MenuScene extends Phaser.Scene {
  private playKey!: Phaser.Input.Keyboard.Key;
  private controlsKey!: Phaser.Input.Keyboard.Key;
  private creatorKey!: Phaser.Input.Keyboard.Key;
  private showingControls = false;

  // Visual text objects
  private titleText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private creatorPromptText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;

  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    // 1. Sleek Retro Title
    this.titleText = this.add.text(width / 2, height / 2 - 140, 'PINBALLZZZ', {
      fontSize: '64px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Simple pulse animation for title
    this.tweens.add({
      targets: this.titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 2. Campaign Play Prompt
    this.promptText = this.add.text(width / 2, height / 2 - 10, '[ PRESS SPACE TO PLAY CAMPAIGN ]', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // 2b. Quick Play Prompt
    this.add.text(width / 2, height / 2 + 34, '[ PRESS Q FOR QUICK PLAY ]', {
      fontSize: '20px',
      color: '#ffcc00',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // 2c. Creator Studio Prompt
    this.creatorPromptText = this.add.text(width / 2, height / 2 + 78, '[ PRESS E FOR CREATOR STUDIO ]', {
      fontSize: '20px',
      color: '#aaaaff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // 3. Controls Help Toggle Prompt
    this.controlsText = this.add.text(width / 2, height / 2 + 140, 'Press "C" to view controls list', {
      fontSize: '16px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // 4. Setup Input Keys
    const k = this.input.keyboard;
    if (k) {
      this.playKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.controlsKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.C);
      this.creatorKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      k.addKey(Phaser.Input.Keyboard.KeyCodes.Q).on('down', () => {
        SectorTransition.fadeOut(this, 250, () => {
          this.scene.start('LevelSelectScene');
        });
      });
    }

    // Pointer-click launches Quick Play level select
    this.input.on('pointerdown', () => {
      SectorTransition.fadeOut(this, 250, () => {
        this.scene.start('LevelSelectScene');
      });
    });

    // Fade in
    SectorTransition.fadeIn(this);
  }

  update() {
    // Space to transition and play campaign
    if (this.playKey && Phaser.Input.Keyboard.JustDown(this.playKey)) {
      SectorTransition.fadeOut(this, 250, () => {
        this.scene.start('GameScene', { sectorIndex: 0 });
      });
    }

    // E to transition to Creator Studio
    if (this.creatorKey && Phaser.Input.Keyboard.JustDown(this.creatorKey)) {
      SectorTransition.fadeOut(this, 250, () => {
        this.scene.start('CreatorScene');
      });
    }

    // C to toggle controls overlay
    if (this.controlsKey && Phaser.Input.Keyboard.JustDown(this.controlsKey)) {
      this.showingControls = !this.showingControls;
      this.updateControlsOverlay();
    }
  }

  private updateControlsOverlay(): void {
    if (this.showingControls) {
      this.titleText.setVisible(false);
      this.promptText.setVisible(false);
      this.creatorPromptText.setVisible(false);

      let text = `=== PINBALLZZZ CONTROLS ===\n\n`;
      text += `- Z / Left Arrow  : Swing Left Flipper\n`;
      text += `- X / Right Arrow : Swing Right Flipper\n`;
      text += `- SPACEBAR        : Hold to Charge Plunger, Release to Fire\n`;
      text += `- SHIFT / C Key   : Deploy Anchor (Suspends ball in space)\n`;
      text += `- A / Left Nudge  : Nudge Ball Left (Consumes charge)\n`;
      text += `- D / Right Nudge : Nudge Ball Right (Consumes charge)\n\n`;
      text += `Press "C" again to return to title menu.`;

      this.controlsText.setText(text);
      this.controlsText.setFontSize(20);
      this.controlsText.setColor('#ffffff');
      this.controlsText.setAlign('left');
    } else {
      this.titleText.setVisible(true);
      this.promptText.setVisible(true);
      this.creatorPromptText.setVisible(true);

      this.controlsText.setText('Press "C" to view controls list');
      this.controlsText.setFontSize(16);
      this.controlsText.setColor('#888888');
      this.controlsText.setAlign('center');
    }
  }
}
