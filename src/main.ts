import Phaser from 'phaser';
import { Application } from './application';
import { BrowserStorageProvider } from './core/BrowserStorageProvider';

// A simple Phaser scene to verify execution and rendering
class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.add.text(512, 384, 'PINBALLZZZ', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.add.text(512, 450, 'Press Z/X for left/right flipper action soon.', {
      fontSize: '20px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#000000',
  parent: 'game-container',
  scene: [BootScene],
};

async function startApp() {
  console.log('Starting PINBALLZZZ application...');

  // Set up the default BrowserStorageProvider (Electron storage provider can be wired in later milestones)
  const storage = new BrowserStorageProvider();
  
  // Create and boot application systems (save/settings stubs)
  const appInstance = new Application(storage);
  await appInstance.boot();

  // Instantiate the Phaser Game instance
  new Phaser.Game(config);
}

window.addEventListener('DOMContentLoaded', () => {
  startApp().catch((err) => {
    console.error('Failed to bootstrap application:', err);
  });
});
