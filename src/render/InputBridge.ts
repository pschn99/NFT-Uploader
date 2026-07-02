import Phaser from 'phaser';
import { InputBuffer } from '../core/InputBuffer';
import { Simulation } from '../simulation/Simulation';

export class InputBridge {
  private scene: Phaser.Scene;
  private inputBuffer: InputBuffer;
  private simulation: Simulation;

  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private arrowLeftKey!: Phaser.Input.Keyboard.Key;
  private arrowRightKey!: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene, inputBuffer: InputBuffer, simulation: Simulation) {
    this.scene = scene;
    this.inputBuffer = inputBuffer;
    this.simulation = simulation;
    this.setupListeners();
  }

  private setupListeners(): void {
    const k = this.scene.input.keyboard;
    if (!k) return;

    // Standard buttons: Z/X or Arrow keys for flippers, Space for plunger
    this.leftKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.rightKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.arrowLeftKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.arrowRightKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.spaceKey = k.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

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

    this.leftKey.on('down', pressLeft);
    this.leftKey.on('up', releaseLeft);
    this.arrowLeftKey.on('down', pressLeft);
    this.arrowLeftKey.on('up', releaseLeft);

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

    this.rightKey.on('down', pressRight);
    this.rightKey.on('up', releaseRight);
    this.arrowRightKey.on('down', pressRight);
    this.arrowRightKey.on('up', releaseRight);

    // Plunger Press / Release
    this.spaceKey.on('down', () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'plunger',
        phase: 'down'
      });
    });
    this.spaceKey.on('up', () => {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'plunger',
        phase: 'up'
      });
    });
  }

  /**
   * Polls inputs that need continuous frame-by-frame updates (like plunger charging).
   */
  update(): void {
    // If Space is held down, we register a plunger down input on every frame to simulate active charging
    if (this.spaceKey && this.spaceKey.isDown) {
      this.inputBuffer.addEntry({
        frame: this.simulation.frameIndex,
        action: 'plunger',
        phase: 'down'
      });
    }
  }

  destroy(): void {
    if (this.leftKey) this.leftKey.removeAllListeners();
    if (this.rightKey) this.rightKey.removeAllListeners();
    if (this.arrowLeftKey) this.arrowLeftKey.removeAllListeners();
    if (this.arrowRightKey) this.arrowRightKey.removeAllListeners();
    if (this.spaceKey) this.spaceKey.removeAllListeners();
  }
}
