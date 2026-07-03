import Phaser from 'phaser';

export class SectorTransition {
  /**
   * Performs a full-screen inversion effect per GDD §7:
   * Brief white flash on black, then back — followed by a one-line title card.
   */
  static fadeIn(scene: Phaser.Scene, duration = 600, callback?: () => void): void {
    // White flash on black (inversion effect per GDD §7)
    scene.cameras.main.flash(duration, 255, 255, 255);
    scene.cameras.main.fadeIn(duration, 0, 0, 0);
    if (callback) {
      scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, callback);
    }
  }

  /**
   * Fades the camera viewport from transparent to solid black.
   */
  static fadeOut(scene: Phaser.Scene, duration = 600, callback?: () => void): void {
    scene.cameras.main.fadeOut(duration, 0, 0, 0);
    if (callback) {
      scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, callback);
    }
  }

  /**
   * Shows a one-line title card during sector transition per GDD §7.
   * Returns the title container for cleanup.
   */
  static showTitleCard(scene: Phaser.Scene, name: string, tagline: string): Phaser.GameObjects.Container {
    const { width, height } = scene.cameras.main;
    const overlay = scene.add.container(0, 0).setScrollFactor(0).setDepth(200);

    const bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    const title = scene.add.text(width / 2, height / 2 - 40, name, {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const sub = scene.add.text(width / 2, height / 2 + 30, tagline, {
      fontSize: '20px',
      color: '#aaaaaa',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    overlay.add([bg, title, sub]);

    // Auto-fade after 2 seconds
    scene.tweens.add({
      targets: overlay,
      alpha: 0,
      delay: 2000,
      duration: 1000,
      onComplete: () => {
        overlay.destroy();
      }
    });

    return overlay;
  }
}
