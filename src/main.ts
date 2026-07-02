import Phaser from 'phaser';
import RAPIER from '@dimforge/rapier2d-compat';
import { Application } from './application';
import { BrowserStorageProvider } from './core/BrowserStorageProvider';

import { FlipperSpike } from './spikes/flipper-feel/FlipperSpike';
import { FallFloorSpike } from './spikes/fall-floor/FallFloorSpike';
import { GameScene } from './render/scenes/GameScene';
import { BootScene } from './render/scenes/BootScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#000000',
  parent: 'game-container',
  scene: [BootScene, GameScene, FlipperSpike, FallFloorSpike],
};

async function startApp() {
  console.log('Starting PINBALLZZZ application...');

  // Ensure Rapier WASM compat is initialized globally before loading Phaser or creating Sessions
  await RAPIER.init();

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
