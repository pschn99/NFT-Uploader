import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../simulation/session/GameSession';
import { SectorLoader, SectorData } from '../tower/SectorLoader';
import { InputBuffer } from '../core/InputBuffer';
import { ReplayHash } from './ReplayHash';
import { ReplayData } from './ReplaySystem';
import sector00 from '../../levels/campaign/sector_00.json';

export interface RunnerResult {
  success: boolean;
  expectedHash: string;
  actualHash: string;
  framesSimulated: number;
}

export class ReplayRunner {
  /**
   * Headlessly runs a simulation using the recorded inputs and verifies the path coordinates hash.
   */
  static async run(replay: ReplayData): Promise<RunnerResult> {
    // 1. Ensure Rapier WASM compat is initialized
    await RAPIER.init();

    // 2. Instantiate GameSession with saved seed
    const session = new GameSession(replay.seed);

    // 3. Load same sector_00 level layout and get chunkManager
    const chunkManager = SectorLoader.load(session.simulation, sector00 as SectorData);

    // 4. Setup InputBuffer with replay inputs
    const inputBuffer = new InputBuffer();
    inputBuffer.setAllEntries(replay.inputs);

    const pathHistory: Array<{ x: number; y: number }> = [];

    // 5. Execute frames headlessly
    for (let frame = 0; frame < replay.durationFrames; frame++) {
      const inputs = inputBuffer.getEntriesForFrame(frame);
      
      if (session.simulation.ball) {
        chunkManager.update(session.simulation.ball.getPosition().y);
      }

      session.simulation.step(inputs);

      if (session.simulation.ball) {
        const pos = session.simulation.ball.getPosition();
        pathHistory.push({ x: pos.x, y: pos.y });
      }
    }

    // 6. Compute path hash and compare
    const actualHash = ReplayHash.calculateSequence(pathHistory);
    const success = actualHash === replay.expectedHash;

    // Clean up
    chunkManager.destroy();
    session.destroy();

    return {
      success,
      expectedHash: replay.expectedHash,
      actualHash,
      framesSimulated: replay.durationFrames
    };
  }
}
