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

    this.boundKeys = [flipperLeftKey, flipperRightKey, plungerKey, nudgeLeftKey, nudgeRightKey, anchorKey];

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

    // Plunger Release
    plungerKey.on('up', () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'plunger',
        phase: 'up'
      });
    });

    // Anchor deploy toggle (default: S / Down Arrow per GDD §6)
    anchorKey.on('down', () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'anchor',
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
   * Polls inputs that need continuous frame-by-frame updates (like plunger charging).
   */
  update(): void {
    if (this.boundKeys.length >= 3 && this.boundKeys[2].isDown) {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'plunger',
        phase: 'down'
      });
    }
  }

  destroy(): void {
    this.boundKeys.forEach((key) => key.removeAllListeners());
    this.boundKeys = [];
  }
}
