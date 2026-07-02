export class PlayerState {
  public currentHeight = 0; // Current ball height in physics meters
  public maxHeight = 0;     // Highest point reached in the current run
  public lastCheckpointY = 0; // Height of the last crossed checkpoint
  public nudgeCharges = 3;   // Charges available for nudge corrections
  public anchorCharges = 2;  // Anchors placement charges

  reset(): void {
    this.currentHeight = 0;
    this.maxHeight = 0;
    this.lastCheckpointY = 0;
    this.nudgeCharges = 3;
    this.anchorCharges = 2;
  }
}
