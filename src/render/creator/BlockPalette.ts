/**
 * BlockPalette — Creator Studio sidebar palette UI.
 *
 * Renders all registered block types from `BlockRegistry` as clickable
 * swatches in a vertical sidebar. Handles active selection state and
 * communicates back to `CreatorScene` via a selection callback.
 *
 * Architecture: render/ → levels/ (BlockRegistry). No simulation imports.
 */

import Phaser from 'phaser';
import type { BlockType } from '../../levels/LevelData';
import { getAllBlockDescriptors } from '../../levels/BlockRegistry';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PALETTE_X = 8;
const PALETTE_Y = 60;
const SWATCH_W = 100;
const SWATCH_H = 30;
const SWATCH_GAP = 4;
const SELECTED_COLOR = 0x4477FF;
const DEFAULT_COLOR = 0x333333;
const BORDER_COLOR = 0x888888;
const TEXT_COLOR = '#FFFFFF';
const ROTATE_HINT_COLOR = '#AAAAFF';

// ---------------------------------------------------------------------------
// BlockPalette
// ---------------------------------------------------------------------------

export class BlockPalette {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private swatches: Map<BlockType, Phaser.GameObjects.Rectangle> = new Map();
  private labels:   Map<BlockType, Phaser.GameObjects.Text>      = new Map();
  private selectedType: BlockType = 'wall';
  private onSelect: (type: BlockType) => void;

  constructor(scene: Phaser.Scene, onSelect: (type: BlockType) => void) {
    this.scene = scene;
    this.onSelect = onSelect;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0); // Fixed to screen — does not scroll with camera

    this.buildPalette();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Sets the active block type (e.g. from an external keyboard shortcut). */
  setSelected(type: BlockType): void {
    this.updateSwatchColors(type);
    this.selectedType = type;
  }

  getSelected(): BlockType {
    return this.selectedType;
  }

  destroy(): void {
    this.container.destroy();
  }

  // ---------------------------------------------------------------------------
  // Private — build
  // ---------------------------------------------------------------------------

  private buildPalette(): void {
    const descriptors = getAllBlockDescriptors();

    // Background panel
    const panelH = descriptors.length * (SWATCH_H + SWATCH_GAP) + 20;
    const panel = this.scene.add.rectangle(
      PALETTE_X + SWATCH_W / 2, PALETTE_Y + panelH / 2,
      SWATCH_W + 8, panelH,
      0x111111, 0.85
    );
    this.container.add(panel);

    // Block swatches
    descriptors.forEach((desc, i) => {
      const y = PALETTE_Y + 10 + i * (SWATCH_H + SWATCH_GAP);
      const x = PALETTE_X + SWATCH_W / 2;

      const rect = this.scene.add.rectangle(x, y + SWATCH_H / 2, SWATCH_W, SWATCH_H, DEFAULT_COLOR);
      rect.setStrokeStyle(1, BORDER_COLOR);
      rect.setInteractive({ useHandCursor: true });

      const label = this.scene.add.text(
        x, y + SWATCH_H / 2,
        desc.label,
        { fontSize: '11px', color: TEXT_COLOR, fontFamily: 'monospace' }
      ).setOrigin(0.5);

      // Rotate hint for flipper types
      if (desc.snapAngles.length > 0) {
        this.scene.add.text(
          x + SWATCH_W / 2 - 2, y + 2,
          '↻',
          { fontSize: '9px', color: ROTATE_HINT_COLOR, fontFamily: 'monospace' }
        ).setOrigin(1, 0);
      }

      rect.on('pointerdown', () => {
        this.setSelected(desc.type);
        this.onSelect(desc.type);
      });

      rect.on('pointerover', () => {
        if (desc.type !== this.selectedType) rect.setFillStyle(0x444444);
      });
      rect.on('pointerout', () => {
        if (desc.type !== this.selectedType) rect.setFillStyle(DEFAULT_COLOR);
      });

      this.container.add([rect, label]);
      this.swatches.set(desc.type, rect);
      this.labels.set(desc.type, label);
    });

    // Highlight the default selected type
    this.updateSwatchColors(this.selectedType);
  }

  private updateSwatchColors(newType: BlockType): void {
    for (const [type, rect] of this.swatches.entries()) {
      rect.setFillStyle(type === newType ? SELECTED_COLOR : DEFAULT_COLOR);
    }
  }
}
