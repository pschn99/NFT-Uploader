import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.add.text(512, 384, 'PINBALLZZZ', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.add.text(512, 450, 'Click anywhere or Press SPACE to play sandbox', {
      fontSize: '20px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.input.on('pointerdown', () => this.scene.start('GameScene'));
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => {
      this.scene.start('GameScene');
    });
  }
}
