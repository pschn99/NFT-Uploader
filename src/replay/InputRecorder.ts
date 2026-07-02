import { InputEntry, InputAction } from '../types/input';

export class InputRecorder {
  private recorded: InputEntry[] = [];

  /**
   * Records a user input action on the specified simulation frame.
   */
  record(frame: number, action: InputAction, phase: 'down' | 'up' | 'value', value?: number): void {
    this.recorded.push({ frame, action, phase, value });
  }

  /**
   * Retrieves all recorded inputs sorted by frame index.
   */
  getEntries(): InputEntry[] {
    // Return sorted copy
    return [...this.recorded].sort((a, b) => a.frame - b.frame);
  }

  clear(): void {
    this.recorded = [];
  }
}
