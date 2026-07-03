/**
 * CreatorGrid — 32×32 logical grid overlay for the Creator Studio.
 *
 * Responsibilities:
 *   - Renders a faint grid overlay using Phaser Graphics (no game-state ownership).
 *   - Handles block placement on pointer drag-end with grid-cell snapping.
 *   - Handles block deletion on right-click.
 *   - Converts between grid coordinates and world-metre coordinates.
 *   - Maintains the in-memory list of `BlockEntry` objects that will be
 *     serialized into `LevelData.blocks` on save/export.
 *
 * Dependency direction: render/ → levels/ (BlockRegistry, LevelData).
 * No simulation imports. Grid state is the single source of truth for the editor.
 */

import Phaser from 'phaser';
import type { BlockEntry, BlockType } from '../../levels/LevelData';
import { getBlockDescriptor, getAllBlockDescriptors } from '../../levels/BlockRegistry';
import { GRID_CELL_METRES } from '../../simulation/constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_CELL_PX = 32; // Logical grid cell size in screen pixels
const GRID_COLOR = 0x222222;
const GRID_ALPHA = 0.4;
const BLOCK_COLORS: Record<BlockType, number> = {
  wall:            0xFFFFFF,
  flipper_left:    0x88AAFF,
  flipper_right:   0xFF8888,
  bumper_standard: 0xFFFF00,
  plunger:         0x00FFAA,
  checkpoint:      0x00FF00,
  exit:            0xFFAA00,
};

// ---------------------------------------------------------------------------
// CreatorGrid
// ---------------------------------------------------------------------------

export class CreatorGrid {
  private scene: Phaser.Scene;
  private gridGraphics: Phaser.GameObjects.Graphics;
  private blockGraphics: Phaser.GameObjects.Graphics;
  private blocks: BlockEntry[] = [];
  private selectedType: BlockType = 'wall';
  private selectedRotationIndex = 0;
  private isDragging = false;
  private hasChanges = false;

  // Grid dimensions (in cells)
  private gridCols: number;
  private gridRows: number;

  /**
   * @param scene       Phaser scene that owns this grid.
   * @param gridCols    Number of columns (default: 32 → ~20.5 m wide).
   * @param gridRows    Number of rows (default: 820 → ~524 m tall).
   */
  constructor(scene: Phaser.Scene, gridCols = 32, gridRows = 820) {
    this.scene = scene;
    this.gridCols = gridCols;
    this.gridRows = gridRows;

    this.gridGraphics  = scene.add.graphics();
    this.blockGraphics = scene.add.graphics();

    this.drawGrid();
    this.registerInputHandlers();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Returns the current block list (a copy — caller must not mutate). */
  getBlocks(): readonly BlockEntry[] {
    return [...this.blocks];
  }

  /** Replaces the entire block list (e.g. when loading a level). */
  loadBlocks(blocks: BlockEntry[]): void {
    this.blocks = [...blocks];
    this.hasChanges = false;
    this.redrawBlocks();
  }

  /** Returns true if any block has been placed/removed since last save. */
  isModified(): boolean {
    return this.hasChanges;
  }

  /** Clears the modified flag (call after save/export). */
  clearModified(): void {
    this.hasChanges = false;
  }

  /** Sets the active block type for placement. */
  selectBlockType(type: BlockType): void {
    this.selectedType = type;
    this.selectedRotationIndex = 0;
  }

  /** Cycles to the next snap angle for the active block type. */
  cycleRotation(): void {
    const desc = getBlockDescriptor(this.selectedType);
    if (desc.snapAngles.length > 0) {
      this.selectedRotationIndex = (this.selectedRotationIndex + 1) % desc.snapAngles.length;
    }
  }

  /** Converts grid cell coordinates to world-metre position. */
  static gridToMetres(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: gridX * GRID_CELL_METRES,
      y: gridY * GRID_CELL_METRES,
    };
  }

  /** Converts world-metre position to nearest grid cell. */
  static metresToGrid(x: number, y: number): { gridX: number; gridY: number } {
    return {
      gridX: Math.round(x / GRID_CELL_METRES),
      gridY: Math.round(y / GRID_CELL_METRES),
    };
  }

  /** Cleans up Phaser objects when the editor is destroyed. */
  destroy(): void {
    this.gridGraphics.destroy();
    this.blockGraphics.destroy();
  }

  // ---------------------------------------------------------------------------
  // Private — rendering
  // ---------------------------------------------------------------------------

  private drawGrid(): void {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, GRID_COLOR, GRID_ALPHA);

    // Vertical lines
    for (let col = 0; col <= this.gridCols; col++) {
      const x = col * GRID_CELL_PX;
      this.gridGraphics.lineBetween(x, 0, x, this.gridRows * GRID_CELL_PX);
    }

    // Horizontal lines
    for (let row = 0; row <= this.gridRows; row++) {
      const y = row * GRID_CELL_PX;
      this.gridGraphics.lineBetween(0, y, this.gridCols * GRID_CELL_PX, y);
    }
  }

  private redrawBlocks(): void {
    this.blockGraphics.clear();
    for (const block of this.blocks) {
      this.drawBlock(block);
    }
  }

  private drawBlock(block: BlockEntry): void {
    const color = BLOCK_COLORS[block.type] ?? 0xFFFFFF;
    const px = block.grid_x * GRID_CELL_PX;
    const py = block.grid_y * GRID_CELL_PX;
    this.blockGraphics.fillStyle(color, 0.85);
    this.blockGraphics.fillRect(px + 1, py + 1, GRID_CELL_PX - 2, GRID_CELL_PX - 2);
  }

  // ---------------------------------------------------------------------------
  // Private — input
  // ---------------------------------------------------------------------------

  private registerInputHandlers(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.removeBlockAt(pointer);
      } else {
        this.isDragging = true;
        this.placeBlockAt(pointer);
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && !pointer.rightButtonDown()) {
        this.placeBlockAt(pointer);
      }
    });

    this.scene.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  private worldToGrid(pointer: Phaser.Input.Pointer): { gridX: number; gridY: number } {
    // Account for camera scroll
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;
    return {
      gridX: Math.floor(worldX / GRID_CELL_PX),
      gridY: Math.floor(worldY / GRID_CELL_PX),
    };
  }

  private placeBlockAt(pointer: Phaser.Input.Pointer): void {
    const { gridX, gridY } = this.worldToGrid(pointer);

    // Bounds check
    if (gridX < 0 || gridX >= this.gridCols || gridY < 0 || gridY >= this.gridRows) return;

    // Don't place duplicate of same type at same cell
    const existing = this.blocks.findIndex((b) => b.grid_x === gridX && b.grid_y === gridY);
    if (existing !== -1) {
      if (this.blocks[existing].type === this.selectedType) return;
      // Replace with new type
      this.blocks.splice(existing, 1);
    }

    const newBlock: BlockEntry = {
      type: this.selectedType,
      grid_x: gridX,
      grid_y: gridY,
    };

    const desc = getBlockDescriptor(this.selectedType);
    if (desc.snapAngles.length > 0 && this.selectedRotationIndex > 0) {
      newBlock.rotation_index = this.selectedRotationIndex;
    }

    this.blocks.push(newBlock);
    this.hasChanges = true;
    this.redrawBlocks();
  }

  private removeBlockAt(pointer: Phaser.Input.Pointer): void {
    const { gridX, gridY } = this.worldToGrid(pointer);
    const before = this.blocks.length;
    this.blocks = this.blocks.filter((b) => !(b.grid_x === gridX && b.grid_y === gridY));
    if (this.blocks.length !== before) {
      this.hasChanges = true;
      this.redrawBlocks();
    }
  }
}

/** Returns all block descriptor info for the palette (re-exported for convenience). */
export { getAllBlockDescriptors };
