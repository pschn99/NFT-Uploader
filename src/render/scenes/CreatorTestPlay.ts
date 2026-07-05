/**
 * CreatorTestPlay — Test Play mode for Creator Studio.
 *
 * Workflow:
 *   1. `launch(levelData)` — snapshots the current `LevelData`, creates a
 *      `GameSession` from it via `SectorLoader.load()`, and starts `GameScene`
 *      in test-play mode.
 *   2. While running, `GameScene` behaves normally (physics, input, audio).
 *   3. On win, drain, or Escape: `GameScene` emits `testPlayEnded` and calls
 *      `CreatorTestPlay.restore()`.
 *   4. `restore()` destroys the session and transitions back to `CreatorScene`.
 *
 * Architecture: render/ → simulation/ (GameSession), levels/ (LevelData).
 * `CreatorScene` owns this object; it does not own a session itself.
 */

import Phaser from 'phaser';
import type { LevelData } from '../../levels/LevelData';
import { ReplaySystem } from '../../replay/ReplaySystem';

// ---------------------------------------------------------------------------
// Test Play event key (Phaser scene data communication)
// ---------------------------------------------------------------------------

/** Key used to pass test-play context from CreatorScene to GameScene. */
export const TEST_PLAY_DATA_KEY = 'creatorTestPlay';

/** Data shape passed to GameScene when launching in test-play mode. */
export interface TestPlayContext {
  levelData: LevelData;
  onEnd: (result: TestPlayResult) => void;
}

export interface TestPlayResult {
  cleared: boolean;
  /** If the level was cleared, this contains the recorded replay data. */
  replaySystem?: ReplaySystem;
}

// ---------------------------------------------------------------------------
// CreatorTestPlay
// ---------------------------------------------------------------------------

export class CreatorTestPlay {
  private scene: Phaser.Scene;
  private levelSnapshot: LevelData | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Launches a test-play session for the given level data.
   *
   * Snapshots `levelData` so that any subsequent editor changes do not affect
   * the running session. Transitions to `GameScene` in test-play mode.
   *
   * @param levelData   Current editor state to test.
   * @param onEnd       Callback invoked when the player exits test play.
   */
  launch(levelData: LevelData, onEnd: (result: TestPlayResult) => void): void {
    // Take a deep snapshot to insulate the session from future editor edits
    this.levelSnapshot = JSON.parse(JSON.stringify(levelData)) as LevelData;

    // Pass context to GameScene via scene data
    const context: TestPlayContext = {
      levelData: this.levelSnapshot,
      onEnd: (result) => {
        this.restore();
        onEnd(result);
      },
    };

    // Start GameScene in test-play mode (passing context as launch data)
    this.scene.scene.launch('GameScene', { [TEST_PLAY_DATA_KEY]: context });
    this.scene.scene.sleep('CreatorScene');
  }

  /**
   * Restores editor mode: stops the test-play session and resumes CreatorScene.
   * Safe to call multiple times (idempotent).
   */
  restore(): void {
    this.levelSnapshot = null;
    this.scene.scene.stop('GameScene');
    this.scene.scene.wake('CreatorScene');
  }

  destroy(): void {
    this.restore();
  }
}
