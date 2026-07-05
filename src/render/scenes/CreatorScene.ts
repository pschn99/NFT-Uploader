/**
 * CreatorScene — top-level Phaser scene for the Creator Studio MVP.
 *
 * Orchestrates:
 *   - `CreatorGrid` — block placement, deletion, grid rendering
 *   - `BlockPalette` — sidebar block type selection
 *   - `CreatorHUD` — toolbar (Save, Load, Test Play, Export)
 *   - `CreatorTestPlay` — snapshot → run → restore cycle
 *   - `PlayabilityCheck` — headless re-sim for export stamping
 *   - `StorageProvider` — file dialog I/O via ElectronStorageProvider
 *
 * Keyboard shortcuts:
 *   - Ctrl+S : Save
 *   - Ctrl+O : Load
 *   - T       : Test Play
 *   - R       : Rotate selected block type (cycle snap angles)
 *   - Esc     : Return to menu
 *
 * Dependency direction: render/ → levels/, replay/, core/ (StorageProvider).
 * No direct simulation imports (those are mediated by SectorLoader and GameSession).
 */

import Phaser from 'phaser';
import { CreatorGrid } from '../creator/CreatorGrid';
import { BlockPalette } from '../creator/BlockPalette';
import { CreatorHUD } from '../creator/CreatorHUD';
import { CreatorTestPlay } from './CreatorTestPlay';
import { PlayabilityCheck } from '../../replay/PlayabilityCheck';
import { StorageProviderFactory } from '../../core/StorageProviderFactory';
import { migrateToLatest } from '../../levels/migrate';
import { serializeLevel } from '../../levels/serialize';
import type { LevelData } from '../../levels/LevelData';
import type { StorageProvider } from '../../core/StorageProvider';
import { SectorTransition } from '../transitions/SectorTransition';

// ---------------------------------------------------------------------------
// Default new level template
// ---------------------------------------------------------------------------

function newLevelTemplate(): LevelData {
  return {
    format_version: 3,
    name: 'Untitled Level',
    author_id: 'local',
    sector_height_m: 500,
    blocks: [],
  };
}

// ---------------------------------------------------------------------------
// CreatorScene
// ---------------------------------------------------------------------------

export class CreatorScene extends Phaser.Scene {
  private grid!: CreatorGrid;
  private palette!: BlockPalette;
  private hud!: CreatorHUD;
  private testPlay!: CreatorTestPlay;
  private storage!: StorageProvider;

  private currentLevel: LevelData = newLevelTemplate();
  private lastTestPlayReplay: import('../../replay/ReplaySystem').ReplaySystem | null = null;

  constructor() {
    super({ key: 'CreatorScene' });
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    this.storage = StorageProviderFactory.create();

    // Vertical-scrolling camera (grid is very tall)
    this.cameras.main.setBounds(0, 0, 32 * 32, 820 * 32);

    // Sub-components
    this.grid    = new CreatorGrid(this);
    this.palette = new BlockPalette(this, (type) => this.grid.selectBlockType(type));
    this.testPlay = new CreatorTestPlay(this);

    this.hud = new CreatorHUD(this, {
      onSave:       () => this.handleSave(),
      onLoad:       () => this.handleLoad(),
      onTestPlay:   () => this.handleTestPlay(),
      onExport:     () => this.handleExport(),
      getBlockCount: () => this.grid.getBlocks().length,
      isModified:   () => this.grid.isModified(),
    });

    this.registerKeyboardShortcuts();

    // Background colour
    this.cameras.main.setBackgroundColor('#050505');

    // Camera scroll via arrow keys / WASD (editor navigation)
    const cursors = this.input.keyboard?.createCursorKeys();
    this.events.on('update', () => {
       if (cursors?.up.isDown)    this.cameras.main.scrollY -= 8;
       if (cursors?.down.isDown)  this.cameras.main.scrollY += 8;
    });

    // Fade in
    SectorTransition.fadeIn(this);
  }

  update(): void {
    this.hud.update();
  }

  destroy(): void {
    this.grid?.destroy();
    this.palette?.destroy();
    this.hud?.destroy();
    this.testPlay?.destroy();
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  private registerKeyboardShortcuts(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    // Ctrl+S — Save
    kb.on('keydown-S', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) { event.preventDefault(); void this.handleSave(); }
    });

    // Ctrl+O — Load
    kb.on('keydown-O', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) { event.preventDefault(); void this.handleLoad(); }
    });

    // T — Test Play
    kb.on('keydown-T', () => this.handleTestPlay());

    // R — Rotate selected block
    kb.on('keydown-R', () => this.grid.cycleRotation());

    // Escape — back to menu
    kb.on('keydown-ESC', () => this.scene.start('MenuScene'));
  }

  // ---------------------------------------------------------------------------
  // HUD callbacks
  // ---------------------------------------------------------------------------

  private async handleSave(): Promise<void> {
    this.syncLevelFromGrid();
    const json = serializeLevel(this.currentLevel);

    const savedOk = await this.storage.saveFileDialog?.(
      `${this.currentLevel.name ?? 'level'}.json`,
      JSON.parse(json)
    );

    if (savedOk) {
      this.grid.clearModified();
      this.hud.setExportStatus('Saved ✓', '#00FF88');
    } else if (savedOk === false) {
      // User cancelled — not an error
    }
  }

  private async handleLoad(): Promise<void> {
    const rawData = await this.storage.loadFileDialog?.();
    if (!rawData) return;

    try {
      const levelData = migrateToLatest(rawData);
      this.currentLevel = levelData;
      this.grid.loadBlocks(levelData.blocks);
      this.hud.setExportStatus(`Loaded: ${levelData.name ?? 'level'}`, '#00AAFF');
    } catch (err) {
      this.hud.setExportStatus(`Load failed: ${(err as Error).message}`, '#FF4444');
    }
  }

  private handleTestPlay(): void {
    this.syncLevelFromGrid();
    this.testPlay.launch(this.currentLevel, (result) => {
      if (result.cleared && result.replaySystem) {
        this.lastTestPlayReplay = result.replaySystem;
        this.hud.setExportStatus('Level cleared! Export to stamp ✓', '#00FF88');
      } else {
        this.lastTestPlayReplay = null;
      }
    });
  }

  private async handleExport(): Promise<void> {
    // Must have a recorded clear to export
    if (!this.lastTestPlayReplay) {
      this.hud.setExportStatus('Complete a Test Play first', '#FF4444');
      return;
    }

    this.syncLevelFromGrid();

    // VERIFIER_BADGE_RULE: Only 'local' verifier is stamped here.
    // UI must never display a Clear Badge for verifier: 'local'.
    const check = new PlayabilityCheck();
    const result = await check.verify(this.currentLevel, this.lastTestPlayReplay);

    if (!result.verified) {
      this.hud.setExportStatus('Playability Check failed', '#FF4444');
      return;
    }

    // Stamp the level JSON
    this.currentLevel = { ...this.currentLevel, playability_check: result.stamp };

    const json = serializeLevel(this.currentLevel);
    const savedOk = await this.storage.saveFileDialog?.(
      `${this.currentLevel.name ?? 'level'}.json`,
      JSON.parse(json)
    );

    if (savedOk) {
      this.grid.clearModified();
      this.hud.setExportStatus('Exported & verified (local) ✓', '#00FF88');
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** Syncs the current block list from the grid into `currentLevel`. */
  private syncLevelFromGrid(): void {
    this.currentLevel = {
      ...this.currentLevel,
      blocks: [...this.grid.getBlocks()],
    };
  }
}
