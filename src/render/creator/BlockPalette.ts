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
import { drawBlock } from '../BlockRenderer';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PALETTE_X = 8;
const PALETTE_Y = 60;
const SWATCH_W = 110;
const SWATCH_H = 36;
const SWATCH_GAP = 4;
const MINI_PPM = 11;       // ppm for the inline shape thumbnail
const ICON_SIZE = 28;      // pixel box reserved for the icon on the left
const SELECTED_COLOR = 0x1a2a44;
const DEFAULT_COLOR = 0x1a1a1a;
const SELECTED_STROKE = 0x4477FF;
const DEFAULT_STROKE = 0x444444;
const TEXT_COLOR = '#DDDDDD';
const ROTATE_HINT_COLOR = '#AAAAFF';

// ---------------------------------------------------------------------------
// BlockPalette
// ---------------------------------------------------------------------------

export class BlockPalette {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private swatches:    Map<BlockType, Phaser.GameObjects.Rectangle> = new Map();
  private labels:      Map<BlockType, Phaser.GameObjects.Text>      = new Map();
  private miniGraphics: Map<BlockType, Phaser.GameObjects.Graphics> = new Map();
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
      0x0d0d0d, 0.92
    );
    panel.setStrokeStyle(1, 0x333333);
    this.container.add(panel);

    // Block swatches
    descriptors.forEach((desc, i) => {
      const y  = PALETTE_Y + 10 + i * (SWATCH_H + SWATCH_GAP);
      const x  = PALETTE_X + SWATCH_W / 2;

      // Swatch background rectangle
      const rect = this.scene.add.rectangle(x, y + SWATCH_H / 2, SWATCH_W, SWATCH_H, DEFAULT_COLOR);
      rect.setStrokeStyle(1, DEFAULT_STROKE);
      rect.setInteractive({ useHandCursor: true });

      // Mini shape preview (left side of swatch)
      const miniGfx = this.scene.add.graphics();
      const iconCx = PALETTE_X + ICON_SIZE / 2;
      const iconCy = y + SWATCH_H / 2;
      drawBlock({
        gfx:      miniGfx,
        type:     desc.type,
        cx:       iconCx,
        cy:       iconCy,
        ppm:      MINI_PPM,
        rotation: 0,
        context:  'palette',
      });
      this.miniGraphics.set(desc.type, miniGfx);

      // Label (right of icon)
      const labelX = PALETTE_X + ICON_SIZE + 4;
      const label = this.scene.add.text(
        labelX, y + SWATCH_H / 2,
        desc.label,
        { fontSize: '10px', color: TEXT_COLOR, fontFamily: 'monospace' }
      ).setOrigin(0, 0.5);

      // Rotate hint badge for flipper types
      if (desc.snapAngles.length > 0) {
        this.scene.add.text(
          PALETTE_X + SWATCH_W - 2, y + 2,
          '↻',
          { fontSize: '9px', color: ROTATE_HINT_COLOR, fontFamily: 'monospace' }
        ).setOrigin(1, 0);
      }

      rect.on('pointerdown', () => {
        this.setSelected(desc.type);
        this.onSelect(desc.type);
      });

      rect.on('pointerover', () => {
        if (desc.type !== this.selectedType) rect.setFillStyle(0x252525);
      });
      rect.on('pointerout', () => {
        if (desc.type !== this.selectedType) rect.setFillStyle(DEFAULT_COLOR);
      });

      this.container.add([rect, miniGfx, label]);
      this.swatches.set(desc.type, rect);
      this.labels.set(desc.type, label);
    });

    // Highlight the default selected type
    this.updateSwatchColors(this.selectedType);
  }

  private updateSwatchColors(newType: BlockType): void {
    for (const [type, rect] of this.swatches.entries()) {
      const selected = type === newType;
      rect.setFillStyle(selected ? SELECTED_COLOR : DEFAULT_COLOR);
      rect.setStrokeStyle(1, selected ? SELECTED_STROKE : DEFAULT_STROKE);
    }
  }
}
