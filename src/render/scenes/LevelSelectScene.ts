import Phaser from 'phaser';
import { QUICK_PLAY_LEVELS, QuickPlayEntry } from '../../tower/QuickPlayManager';
import { SectorTransition } from '../transitions/SectorTransition';

/**
 * LevelSelectScene — a retro-styled level picker for the Quick Play layouts.
 *
 * Displays the five sample layouts as interactive cards. Selecting a card
 * transitions to GameScene with `{ quickPlayIndex: N }` data.
 *
 * Navigation: arrow keys / WASD or mouse click.
 * Back: ESC → returns to MenuScene.
 */
export class LevelSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private cards: Phaser.GameObjects.Container[] = [];

  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  private readonly CARD_WIDTH = 820;
  private readonly CARD_HEIGHT = 80;
  private readonly CARD_SPACING = 96;
  private readonly LIST_START_Y = 180;

  constructor() {
    super('LevelSelectScene');
  }

  create() {
    this.cards = [];
    this.selectedIndex = 0;
    const { width, height } = this.cameras.main;

    // --- Background gradient ---
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x06060f, 0x06060f, 0x0d0d24, 0x0d0d24, 1);
    bg.fillRect(0, 0, width, height);

    // --- Scanline overlay ---
    const scanlines = this.add.graphics();
    scanlines.lineStyle(1, 0xffffff, 0.03);
    for (let y = 0; y < height; y += 4) {
      scanlines.lineBetween(0, y, width, y);
    }

    // --- Header ---
    this.add.text(width / 2, 40, 'QUICK PLAY', {
      fontSize: '38px',
      color: '#00ffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, 82, 'Select a layout to play', {
      fontSize: '15px',
      color: '#556688',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Horizontal divider
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x00ffff, 0.35);
    divider.lineBetween(width / 2 - 380, 108, width / 2 + 380, 108);

    // --- Level cards ---
    QUICK_PLAY_LEVELS.forEach((entry: QuickPlayEntry, index: number) => {
      const cardY = this.LIST_START_Y + index * this.CARD_SPACING;
      const card = this.buildCard(entry, index, width / 2, cardY);
      this.cards.push(card);
    });

    this.updateCardHighlight();

    // --- Footer nav hints ---
    this.add.text(width / 2, height - 36, '↑↓  Navigate    ENTER  Play    ESC  Back', {
      fontSize: '13px',
      color: '#334455',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // --- Input ---
    const k = this.input.keyboard;
    if (k) {
      this.upKey      = k.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
      this.downKey    = k.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
      this.confirmKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
      this.escKey     = k.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

      // Also support WASD and SPACE
      k.addKey(Phaser.Input.Keyboard.KeyCodes.W).on('down', () => this.moveSelection(-1));
      k.addKey(Phaser.Input.Keyboard.KeyCodes.S).on('down', () => this.moveSelection(1));
      k.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => this.launchSelected());
    }

    // Fade in
    SectorTransition.fadeIn(this);
  }

  private buildCard(
    entry: QuickPlayEntry,
    index: number,
    cx: number,
    cy: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(cx, cy);

    const hw = this.CARD_WIDTH / 2;
    const hh = this.CARD_HEIGHT / 2;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a18, 0.9);
    bg.fillRoundedRect(-hw, -hh, this.CARD_WIDTH, this.CARD_HEIGHT, 6);
    container.add(bg);

    // Card border (will be updated on selection)
    const border = this.add.graphics();
    border.lineStyle(1, 0x1a2a3a, 1);
    border.strokeRoundedRect(-hw, -hh, this.CARD_WIDTH, this.CARD_HEIGHT, 6);
    container.add(border);
    (container as any)._border = border;

    // Index badge
    const badge = this.add.text(-hw + 22, 0, `${index + 1}`, {
      fontSize: '22px',
      color: '#334455',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(badge);
    (container as any)._badge = badge;

    // Icon
    const icon = this.add.text(-hw + 60, 0, entry.icon, {
      fontSize: '28px',
    }).setOrigin(0.5);
    container.add(icon);

    // Name
    const nameText = this.add.text(-hw + 100, -14, entry.name, {
      fontSize: '19px',
      color: '#ccddee',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    container.add(nameText);
    (container as any)._nameText = nameText;

    // Description
    const descText = this.add.text(-hw + 100, 14, entry.description, {
      fontSize: '12px',
      color: '#445566',
      fontFamily: 'monospace',
      wordWrap: { width: this.CARD_WIDTH - 220 },
    }).setOrigin(0, 0.5);
    container.add(descText);
    (container as any)._descText = descText;

    // Play arrow (right side)
    const arrow = this.add.text(hw - 24, 0, '▶', {
      fontSize: '18px',
      color: '#223344',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(arrow);
    (container as any)._arrow = arrow;

    // Click interaction
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-hw, -hh, this.CARD_WIDTH, this.CARD_HEIGHT),
      Phaser.Geom.Rectangle.Contains
    );
    bg.on('pointerdown', () => {
      this.selectedIndex = index;
      this.updateCardHighlight();
      this.launchSelected();
    });
    bg.on('pointerover', () => {
      if (this.selectedIndex !== index) {
        this.selectedIndex = index;
        this.updateCardHighlight();
      }
    });

    return container;
  }

  private updateCardHighlight() {
    this.cards.forEach((card, i) => {
      const isActive = i === this.selectedIndex;
      const border: Phaser.GameObjects.Graphics = (card as any)._border;
      const nameText: Phaser.GameObjects.Text = (card as any)._nameText;
      const descText: Phaser.GameObjects.Text = (card as any)._descText;
      const arrow: Phaser.GameObjects.Text = (card as any)._arrow;
      const badge: Phaser.GameObjects.Text = (card as any)._badge;

      border.clear();
      if (isActive) {
        // Active: cyan glow border
        border.lineStyle(2, 0x00ffff, 0.9);
        border.strokeRoundedRect(
          -this.CARD_WIDTH / 2, -this.CARD_HEIGHT / 2,
          this.CARD_WIDTH, this.CARD_HEIGHT, 6
        );
        nameText.setColor('#ffffff');
        descText.setColor('#7799aa');
        arrow.setColor('#00ffff');
        badge.setColor('#00ffff');

        // Subtle scale pulse
        this.tweens.add({
          targets: card,
          scaleX: 1.012,
          scaleY: 1.012,
          duration: 120,
          ease: 'Sine.easeOut',
        });
      } else {
        border.lineStyle(1, 0x1a2a3a, 1);
        border.strokeRoundedRect(
          -this.CARD_WIDTH / 2, -this.CARD_HEIGHT / 2,
          this.CARD_WIDTH, this.CARD_HEIGHT, 6
        );
        nameText.setColor('#ccddee');
        descText.setColor('#445566');
        arrow.setColor('#223344');
        badge.setColor('#334455');

        this.tweens.add({
          targets: card,
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 120,
          ease: 'Sine.easeOut',
        });
      }
    });
  }

  private moveSelection(delta: number) {
    this.selectedIndex = (this.selectedIndex + delta + QUICK_PLAY_LEVELS.length)
      % QUICK_PLAY_LEVELS.length;
    this.updateCardHighlight();
  }

  private launchSelected() {
    SectorTransition.fadeOut(this, 300, () => {
      this.scene.start('GameScene', { quickPlayIndex: this.selectedIndex });
    });
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
      this.moveSelection(-1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
      this.moveSelection(1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
      this.launchSelected();
    }
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      SectorTransition.fadeOut(this, 250, () => {
        this.scene.start('MenuScene');
      });
    }
  }
}
