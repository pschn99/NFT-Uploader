export class WorldState {
  public activeSectorIndex = 0;
  public currentLevelHash = '';

  reset(): void {
    this.activeSectorIndex = 0;
    this.currentLevelHash = '';
  }
}
