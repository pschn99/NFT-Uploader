/**
 * PlayabilityCheck — client-side level verification (Local v1.0).
 *
 * Accepts a `LevelData` and a recorded `ReplaySystem` replay. Re-simulates
 * the inputs headlessly in a fresh Rapier world (no Phaser, no audio).
 * If the win condition is reached, stamps the level JSON with:
 *
 *   playability_check: {
 *     verified: true,
 *     verifier: 'local',     // VERIFIER_BADGE_RULE: never shown as Clear Badge
 *     level_hash,            // SHA-256 of canonical JSON (blocks sorted, stamp excluded)
 *     replay_hash,           // Fixed-point position hash at win condition
 *     replay_engine_version, // Rapier version — invalidated on version bump
 *   }
 *
 * If the level was not cleared, returns `{ verified: false }`.
 *
 * Architecture: replay/ → simulation/, levels/. No Phaser imports.
 */

import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../simulation/session/GameSession';
import { SectorLoader } from '../tower/SectorLoader';
import { InputBuffer } from '../core/InputBuffer';
import { ReplayHash } from './ReplayHash';
import { serializeCanonical } from '../levels/serialize';
import type { LevelData, PlayabilityCheckStamp } from '../levels/LevelData';
import type { ReplaySystem } from './ReplaySystem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayabilityCheckResult {
  verified: boolean;
  /** Only present when verified === true. */
  stamp?: PlayabilityCheckStamp;
}

// ---------------------------------------------------------------------------
// PlayabilityCheck
// ---------------------------------------------------------------------------

export class PlayabilityCheck {
  /**
   * Re-simulates the recorded replay against the given level.
   *
   * @param levelData     The level to verify (Format v3).
   * @param replaySystem  The recorded `ReplaySystem` from a completed test-play session.
   * @returns             `{ verified: true, stamp }` on success, `{ verified: false }` otherwise.
   */
  async verify(levelData: LevelData, replaySystem: ReplaySystem): Promise<PlayabilityCheckResult> {
    // Rapier must be initialized before creating a world
    await RAPIER.init();

    const replayData = await replaySystem.exportReplay();
    if (!replayData) {
      return { verified: false };
    }

    // 1. Create a fresh isolated GameSession — headless, no Phaser
    const session = new GameSession(replayData.seed);

    // 2. Load the level into the simulation
    const chunkManager = SectorLoader.load(session.simulation, levelData);

    // 3. Replay inputs
    const inputBuffer = new InputBuffer();
    inputBuffer.setAllEntries(replayData.inputs);

    let winReached = false;
    let winPosition: { x: number; y: number } | null = null;
    let clearTimeMs = 0;

    // Subscribe to win event before running
    session.simulation.eventBus.on('WinConditionMet', (data) => {
      winReached = true;
      winPosition = data.finalPosition;
      clearTimeMs = data.clearTimeMs;
    });

    for (let frame = 0; frame < replayData.durationFrames; frame++) {
      if (session.simulation.ball) {
        chunkManager.update(session.simulation.ball.getPosition().y);
      }

      const inputs = inputBuffer.getEntriesForFrame(frame);
      session.simulation.step(inputs);

      if (winReached) break;
    }

    // 4. Teardown
    chunkManager.destroy();
    session.destroy();

    if (!winReached || !winPosition) {
      return { verified: false };
    }

    // 5. Build stamp
    const replayHash = ReplayHash.calculate(winPosition);
    const levelHash = await this.computeLevelHash(levelData);
    const engineVersion = this.getEngineVersion();

    const stamp: PlayabilityCheckStamp = {
      verified: true,
      verifier: 'local', // VERIFIER_BADGE_RULE: 'local' never shown as Clear Badge
      level_hash: levelHash,
      replay_hash: replayHash,
      replay_engine_version: engineVersion,
      clear_time_s: parseFloat((clearTimeMs / 1000).toFixed(3)),
    };

    return { verified: true, stamp };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------


  private async computeLevelHash(levelData: LevelData): Promise<string> {
    const canonical = serializeCanonical(levelData);
    // SHA-256 hash per TDD §9
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private getEngineVersion(): string {
    // Rapier version is pinned in package.json
    // Return the known version for this build
    return '0.12.0';
  }
}
