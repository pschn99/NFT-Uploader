export type InputAction =
  | 'flipper_left'
  | 'flipper_right'
  | 'plunger'
  | 'nudge_left'
  | 'nudge_right'
  | 'anchor'
  | 'pause';

export type InputPhase = 'down' | 'up' | 'value';

export interface InputEntry {
  /**
   * The physics simulation frame number on which this input occurred.
   */
  frame: number;

  /**
   * The action triggered (e.g. left flipper, nudge, etc.)
   */
  action: InputAction;

  /**
   * Input interaction phase.
   * - 'down': Key/button pressed
   * - 'up': Key/button released
   * - 'value': Analog range change (e.g. analog plunger pull value)
   */
  phase: InputPhase;

  /**
   * Optional numerical value, e.g., representing the depth of plunger pull (0.0 to 1.0).
   */
  value?: number;
}
