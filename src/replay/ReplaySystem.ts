import { GameSession } from '../simulation/session/GameSession';
import { InputRecorder } from './InputRecorder';
import { ReplayHash } from './ReplayHash';
import { InputEntry, InputAction } from '../types/input';

export interface ReplayData {
  seed: number;
  durationFrames: number;
  inputs: InputEntry[];
  expectedHash: string;
}

export class ReplaySystem {
  private session: GameSession;
  private recorder: InputRecorder;
  private pathHistory: Array<{ x: number; y: number }> = [];

  constructor(session: GameSession) {
    this.session = session;
    this.recorder = new InputRecorder();
  }

  /**
   * Records an input action on the current frame index.
   */
  recordInput(action: InputAction, phase: 'down' | 'up' | 'value', value?: number): void {
    const frame = this.session.simulation.frameIndex;
    this.recorder.record(frame, action, phase, value);
  }

  /**
   * Saves the ball coordinate at the end of the physics frame step to generate the path hash.
   */
  recordStep(): void {
    if (this.session.simulation.ball) {
      const pos = this.session.simulation.ball.getPosition();
      this.pathHistory.push({ x: pos.x, y: pos.y });
    }
  }

  /**
   * Compiles the recorded inputs, duration, and coordinates history into the export format.
   */
  exportReplay(seed = 12345): ReplayData {
    const inputs = this.recorder.getEntries();
    const hash = ReplayHash.calculateSequence(this.pathHistory);

    return {
      seed,
      durationFrames: this.session.simulation.frameIndex,
      inputs,
      expectedHash: hash
    };
  }

  clear(): void {
    this.recorder.clear();
    this.pathHistory = [];
  }
}
