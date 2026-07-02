import Phaser from 'phaser';

export class SectorTransition {
  /**
   * Fades the camera viewport from solid black to fully transparent.
   */
  static fadeIn(scene: Phaser.Scene, duration = 600, callback?: () => void): void {
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
}
