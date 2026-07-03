/**
 * CreatorHUD — Creator Studio toolbar overlay.
 *
 * Fixed-position UI bar (setScrollFactor 0) containing:
 *   - Save button (Ctrl+S)
 *   - Load button (Ctrl+O)
 *   - Test Play button (T)
 *   - Export + Playability Check button
 *   - Block count indicator
 *   - Unsaved-changes indicator (● when dirty)
 *
 * Does NOT own level data — reads from CreatorGrid via provided callbacks.
 * Export delegates to PlayabilityCheck + StorageProvider (wired by CreatorScene).
 *
 * Architecture: render/ only — no simulation, no StorageProvider direct import.
 * Callbacks are injected by CreatorScene at construction time.
 */

import Phaser from 'phaser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatorHUDCallbacks {
  onSave: () => Promise<void>;
  onLoad: () => Promise<void>;
  onTestPlay: () => void;
  onExport: () => Promise<void>;
  getBlockCount: () => number;
  isModified: () => boolean;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const HUD_Y = 4;
const BTN_H = 28;
const BTN_COLORS = {
  save:     0x226622,
  load:     0x224466,
  testPlay: 0x664422,
  export:   0x662244,
  disabled: 0x444444,
};
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: '12px',
  color: '#FFFFFF',
  fontFamily: 'monospace',
};

// ---------------------------------------------------------------------------
// CreatorHUD
// ---------------------------------------------------------------------------

export class CreatorHUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private callbacks: CreatorHUDCallbacks;
  private blockCountText!: Phaser.GameObjects.Text;
  private dirtyIndicator!: Phaser.GameObjects.Text;
  private exportStatusText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, callbacks: CreatorHUDCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(100);

    this.buildHUD();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Called every frame by CreatorScene to keep status indicators current.
   */
  update(): void {
    const count = this.callbacks.getBlockCount();
    this.blockCountText.setText(`Blocks: ${count}`);
    this.dirtyIndicator.setText(this.callbacks.isModified() ? '●' : '○');
    this.dirtyIndicator.setColor(this.callbacks.isModified() ? '#FFAA00' : '#888888');
  }

  /** Shows a temporary status message next to the Export button. */
  setExportStatus(message: string, color = '#FFFFFF'): void {
    this.exportStatusText.setText(message).setColor(color);
    // Auto-clear after 4 seconds
    this.scene.time.delayedCall(4000, () => {
      if (this.exportStatusText) this.exportStatusText.setText('');
    });
  }

  destroy(): void {
    this.container.destroy();
  }

  // ---------------------------------------------------------------------------
  // Private — build
  // ---------------------------------------------------------------------------

  private buildHUD(): void {
    const { width } = this.scene.scale;

    // Background bar
    const bar = this.scene.add.rectangle(width / 2, HUD_Y + BTN_H / 2, width, BTN_H + 8, 0x111111, 0.9);
    this.container.add(bar);

    let curX = 120; // Start after palette

    // Save button
    curX = this.addButton('Save (S)', curX, BTN_COLORS.save, async () => {
      await this.callbacks.onSave();
    });

    // Load button
    curX = this.addButton('Load (O)', curX, BTN_COLORS.load, async () => {
      await this.callbacks.onLoad();
    });

    // Test Play button
    curX = this.addButton('Test Play (T)', curX, BTN_COLORS.testPlay, () => {
      this.callbacks.onTestPlay();
    });

    // Export + Playability Check button
    curX = this.addButton('Export ✓', curX, BTN_COLORS.export, async () => {
      this.setExportStatus('Running Playability Check…', '#FFFF00');
      await this.callbacks.onExport();
    });

    // Export status label
    this.exportStatusText = this.scene.add.text(curX + 8, HUD_Y + BTN_H / 2, '', { ...TEXT_STYLE, color: '#FFFF00' })
      .setOrigin(0, 0.5);
    this.container.add(this.exportStatusText);

    // Block count (right-aligned)
    this.blockCountText = this.scene.add.text(
      width - 120, HUD_Y + BTN_H / 2,
      'Blocks: 0',
      TEXT_STYLE
    ).setOrigin(0, 0.5);
    this.container.add(this.blockCountText);

    // Dirty indicator
    this.dirtyIndicator = this.scene.add.text(
      width - 24, HUD_Y + BTN_H / 2,
      '○',
      { ...TEXT_STYLE, fontSize: '18px' }
    ).setOrigin(0.5);
    this.container.add(this.dirtyIndicator);
  }

  private addButton(
    label: string,
    x: number,
    color: number,
    onClick: () => void | Promise<void>
  ): number {
    const btnW = label.length * 8 + 16;
    const btn = this.scene.add.rectangle(x + btnW / 2, HUD_Y + BTN_H / 2, btnW, BTN_H, color);
    btn.setStrokeStyle(1, 0x888888);
    btn.setInteractive({ useHandCursor: true });

    const text = this.scene.add.text(x + btnW / 2, HUD_Y + BTN_H / 2, label, TEXT_STYLE).setOrigin(0.5);

    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout',  () => btn.setAlpha(1.0));
    btn.on('pointerdown', () => { void onClick(); });

    this.container.add([btn, text]);
    return x + btnW + 6;
  }
}
