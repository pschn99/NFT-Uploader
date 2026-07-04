import Phaser from 'phaser';
import { InputBuffer } from '../core/InputBuffer';
import { Simulation } from '../simulation/Simulation';
import { SettingsSystem, DEFAULT_SETTINGS } from '../core/SettingsSystem';

// Map from Phaser key code strings to Phaser.Input.Keyboard.KeyCodes
const KEY_CODE_MAP: Record<string, number> = {
  'KeyZ': Phaser.Input.Keyboard.KeyCodes.Z,
  'KeyX': Phaser.Input.Keyboard.KeyCodes.X,
  'Space': Phaser.Input.Keyboard.KeyCodes.SPACE,
  'KeyA': Phaser.Input.Keyboard.KeyCodes.A,
  'KeyD': Phaser.Input.Keyboard.KeyCodes.D,
  'KeyS': Phaser.Input.Keyboard.KeyCodes.S,
  'ArrowLeft': Phaser.Input.Keyboard.KeyCodes.LEFT,
  'ArrowRight': Phaser.Input.Keyboard.KeyCodes.RIGHT,
  'ArrowDown': Phaser.Input.Keyboard.KeyCodes.DOWN,
  'Escape': Phaser.Input.Keyboard.KeyCodes.ESC,
};

export class InputBridge {
  private scene: Phaser.Scene;
  private inputBuffer: InputBuffer;
  private simulation: Simulation;
  private settingsSystem: SettingsSystem | null;

  // Bound key objects for cleanup
  private boundKeys: Phaser.Input.Keyboard.Key[] = [];

  // Gamepad state tracking to detect button press transitions
  private prevPadState = {
    flipperLeft: false,
    flipperRight: false,
    plunger: false,
    anchor: false,
    nudgeLeft: false,
    nudgeRight: false,
    pause: false,
  };

  constructor(
    scene: Phaser.Scene,
    inputBuffer: InputBuffer,
    simulation: Simulation,
    settingsSystem?: SettingsSystem
  ) {
    this.scene = scene;
    this.inputBuffer = inputBuffer;
    this.simulation = simulation;
    this.settingsSystem = settingsSystem ?? null;
    this.setupListeners();
  }

  private getKeyCode(keyName: string): number {
    return KEY_CODE_MAP[keyName] ?? Phaser.Input.Keyboard.KeyCodes.Z;
  }

  private setupListeners(): void {
    const k = this.scene.input.keyboard;
    if (!k) return;

    // Read keybindings from SettingsSystem (per GDD §6: "All actions remappable")
    const bindings = this.settingsSystem?.settings?.keyBindings ?? DEFAULT_SETTINGS.keyBindings;

    // Create keys from settings
    const flipperLeftKey = k.addKey(this.getKeyCode(bindings.flipperLeft));
    const flipperRightKey = k.addKey(this.getKeyCode(bindings.flipperRight));
    const plungerKey = k.addKey(this.getKeyCode(bindings.plunger));
    const nudgeLeftKey = k.addKey(this.getKeyCode(bindings.nudgeLeft));
    const nudgeRightKey = k.addKey(this.getKeyCode(bindings.nudgeRight));
    const anchorKey = k.addKey(this.getKeyCode(bindings.anchor));
    const pauseKey = k.addKey(this.getKeyCode(bindings.pause));

    this.boundKeys = [flipperLeftKey, flipperRightKey, plungerKey, nudgeLeftKey, nudgeRightKey, anchorKey, pauseKey];

    // Left Flipper Press / Release
    const pressLeft = () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'flipper_left',
        phase: 'down'
      });
    };
    const releaseLeft = () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'flipper_left',
        phase: 'up'
      });
    };

    flipperLeftKey.on('down', pressLeft);
    flipperLeftKey.on('up', releaseLeft);

    // Bind Arrow Left as secondary default flipper control
    const leftArrowKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.boundKeys.push(leftArrowKey);
    leftArrowKey.on('down', pressLeft);
    leftArrowKey.on('up', releaseLeft);

    // Right Flipper Press / Release
    const pressRight = () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'flipper_right',
        phase: 'down'
      });
    };
    const releaseRight = () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'flipper_right',
        phase: 'up'
      });
    };

    flipperRightKey.on('down', pressRight);
    flipperRightKey.on('up', releaseRight);

    // Bind Arrow Right as secondary default flipper control
    const rightArrowKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.boundKeys.push(rightArrowKey);
    rightArrowKey.on('down', pressRight);
    rightArrowKey.on('up', releaseRight);

    // Plunger Release
    plungerKey.on('up', () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'plunger',
        phase: 'up'
      });
    });

    // Anchor deploy toggle (default: S / Down Arrow per GDD §6, also Shift/C per MenuScene help)
    const triggerAnchor = () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'anchor',
        phase: 'down'
      });
    };
    anchorKey.on('down', triggerAnchor);

    const shiftKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    const cKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.boundKeys.push(shiftKey, cKey);
    shiftKey.on('down', triggerAnchor);
    cKey.on('down', triggerAnchor);

    // Pause toggle (default: Escape per GDD §6)
    pauseKey.on('down', () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'pause',
        phase: 'down'
      });
    });

    // Nudges (default: A -> Left Nudge, D -> Right Nudge per GDD §6)
    nudgeLeftKey.on('down', () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'nudge_left',
        phase: 'down'
      });
    });

    nudgeRightKey.on('down', () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'nudge_right',
        phase: 'down'
      });
    });
  }

  /**
   * Polls inputs that need continuous frame-by-frame updates (like plunger charging and Gamepad controls).
   */
  update(): void {
    // 1. Keyboard Plunger continuous charge check
    if (this.boundKeys.length >= 3 && this.boundKeys[2].isDown) {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'plunger',
        phase: 'down'
      });
    }

    // 2. Poll standard gamepad inputs (D-Pad, L2/R2, L1/R1, stick) per TDD §13
    this.updateGamepad();
  }

  private updateGamepad(): void {
    if (!this.scene.input.gamepad) return;

    // Get the first active pad
    const pad = this.scene.input.gamepad.pad1;
    if (!pad) return;

    const frame = this.simulation.frameIndex;

    // Standard Mapping (L2=button 6, R2=button 7, L1=button 4, R1=button 5, Cross/A=button 0, Square/X=button 2, Options/Start=button 9)
    const flipperLeft = pad.buttons[6]?.pressed || pad.left || pad.leftStick.x < -0.3;
    const flipperRight = pad.buttons[7]?.pressed || pad.right || pad.leftStick.x > 0.3;
    const plunger = pad.buttons[0]?.pressed || pad.down;
    const anchor = pad.buttons[2]?.pressed || pad.up;
    const nudgeLeft = pad.buttons[4]?.pressed;
    const nudgeRight = pad.buttons[5]?.pressed;
    const pause = pad.buttons[9]?.pressed;

    // Flipper Left state change
    if (flipperLeft && !this.prevPadState.flipperLeft) {
      this.inputBuffer.addEntry({ frame, action: 'flipper_left', phase: 'down' });
    } else if (!flipperLeft && this.prevPadState.flipperLeft) {
      this.inputBuffer.addEntry({ frame, action: 'flipper_left', phase: 'up' });
    }

    // Flipper Right state change
    if (flipperRight && !this.prevPadState.flipperRight) {
      this.inputBuffer.addEntry({ frame, action: 'flipper_right', phase: 'down' });
    } else if (!flipperRight && this.prevPadState.flipperRight) {
      this.inputBuffer.addEntry({ frame, action: 'flipper_right', phase: 'up' });
    }

    // Plunger Charge/Fire
    if (plunger) {
      this.inputBuffer.addEntry({ frame, action: 'plunger', phase: 'down' });
    } else if (!plunger && this.prevPadState.plunger) {
      this.inputBuffer.addEntry({ frame, action: 'plunger', phase: 'up' });
    }

    // Anchor Toggle
    if (anchor && !this.prevPadState.anchor) {
      this.inputBuffer.addEntry({ frame, action: 'anchor', phase: 'down' });
    }

    // Pause Toggle
    if (pause && !this.prevPadState.pause) {
      this.inputBuffer.addEntry({ frame, action: 'pause', phase: 'down' });
    }

    // Nudges
    if (nudgeLeft && !this.prevPadState.nudgeLeft) {
      this.inputBuffer.addEntry({ frame, action: 'nudge_left', phase: 'down' });
    }
    if (nudgeRight && !this.prevPadState.nudgeRight) {
      this.inputBuffer.addEntry({ frame, action: 'nudge_right', phase: 'down' });
    }

    // Save states
    this.prevPadState = {
      flipperLeft,
      flipperRight,
      plunger,
      anchor,
      nudgeLeft,
      nudgeRight,
      pause,
    };
  }

  destroy(): void {
    this.boundKeys.forEach((key) => key.removeAllListeners());
    this.boundKeys = [];
  }
}
