export class WorldState {
  public activeSectorIndex = 0;
  public currentLevelHash = '';

  /** Vertical bounds of currently loaded physics chunks (updated by Simulation.step). */
  public minLoadedY = -Infinity;
  public maxLoadedY = Infinity;

  reset(): void {
    this.activeSectorIndex = 0;
    this.currentLevelHash = '';
    this.minLoadedY = -Infinity;
    this.maxLoadedY = Infinity;
  }
}
