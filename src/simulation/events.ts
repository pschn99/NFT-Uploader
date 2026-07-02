export interface Vec2 {
  x: number;
  y: number;
}

export interface SimulationEvents {
  BallImpact: { position: Vec2; impulse: number };
  CheckpointReached: { checkpointY: number; chargesRestored: number };
  BallFell: { fromY: number };
  AnchorTriggered: { anchorId: string; chargesRemaining: number };
  NudgeFired: { direction: 'left' | 'right'; chargesRemaining: number };
  SectorEntered: { sectorIndex: number };
  WinConditionMet: { finalPosition: Vec2; clearTimeMs: number };
  FlipperStruck: { side: 'left' | 'right'; angularVelocity: number };
  PlungerFired: { force: number };
}
