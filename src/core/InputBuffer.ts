import { InputEntry } from '../types/input';

export class InputBuffer {
  private entries: InputEntry[] = [];

  /**
   * Adds a new input entry to the buffer.
   */
  addEntry(entry: InputEntry): void {
    this.entries.push(entry);
    // Keep entries sorted by frame
    this.entries.sort((a, b) => a.frame - b.frame);
  }

  /**
   * Retrieves all input entries registered for the specific frame
   * and removes them from the buffer to prevent unbounded growth.
   */
  getEntriesForFrame(frame: number): InputEntry[] {
    const matching = this.entries.filter((entry) => entry.frame === frame);
    // Remove consumed entries to prevent memory leak (TDD: "fixed-step input queue")
    this.entries = this.entries.filter((entry) => entry.frame > frame);
    return matching;
  }

  /**
   * Clears the entire input buffer.
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Retrieves the raw list of all recorded input entries.
   */
  getAllEntries(): InputEntry[] {
    return [...this.entries];
  }

  /**
   * Loads a complete set of input entries (e.g. when playing back a replay).
   */
  setAllEntries(entries: InputEntry[]): void {
    this.entries = [...entries];
    this.entries.sort((a, b) => a.frame - b.frame);
  }
}
