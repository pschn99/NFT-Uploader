import Phaser from 'phaser';
import RAPIER from '@dimforge/rapier2d-compat';
import { Application } from './application';

import { FlipperSpike } from './spikes/flipper-feel/FlipperSpike';
import { FallFloorSpike } from './spikes/fall-floor/FallFloorSpike';
import { GameScene } from './render/scenes/GameScene';
import { BootScene } from './render/scenes/BootScene';
import { MenuScene } from './render/scenes/MenuScene';
import { CreatorScene } from './render/scenes/CreatorScene';
import { LevelSelectScene } from './render/scenes/LevelSelectScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  backgroundColor: '#000000',
  parent: 'game-container',
  input: {
    gamepad: true,
    keyboard: true
  },
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, CreatorScene, FlipperSpike, FallFloorSpike],
};

async function startApp() {
  // 1. Initialise Rapier WASM before any physics bodies are created
  await RAPIER.init();

  // 2. Boot the application (StorageProviderFactory auto-detects Electron vs Browser)
  const appInstance = new Application();
  await appInstance.boot();

  // 3. Launch Phaser
  const game = new Phaser.Game(config);
  (game as any).appInstance = appInstance;
}

window.addEventListener('DOMContentLoaded', () => {
  startApp().catch((err) => {
    console.error('Failed to bootstrap application:', err);
  });
});
