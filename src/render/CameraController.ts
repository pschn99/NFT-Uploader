import Phaser from 'phaser';
import { Ball } from '../simulation/entities/Ball';
import { PIXELS_PER_METRE } from '../simulation/constants';

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;
  private ball: Ball;

  private scrollY = 0;
  private screenHeight: number;
  private topThreshold = 250;    // Pixels from top of screen before scrolling up
  private bottomThreshold: number; // Pixels from top of screen before scrolling down

  constructor(camera: Phaser.Cameras.Scene2D.Camera, ball: Ball) {
    this.camera = camera;
    this.ball = ball;
    this.screenHeight = camera.height;
    this.bottomThreshold = this.screenHeight - 250;
    this.camera.setScroll(0, 0);
  }

  /**
   * Updates camera scroll position to follow the ball vertical coordinate.
   */
  update(): void {
    if (!this.ball) return;

    const ballPos = this.ball.getPosition();
    const ballScreenY = this.screenHeight - (ballPos.y * PIXELS_PER_METRE);

    // Get current Y relative to camera scroll
    const relativeY = ballScreenY - this.scrollY;

    if (relativeY < this.topThreshold) {
      // Scroll up (negative scroll offset)
      this.scrollY += (relativeY - this.topThreshold);
    } else if (relativeY > this.bottomThreshold) {
      // Scroll down (closer to 0)
      this.scrollY += (relativeY - this.bottomThreshold);
    }

    // Clamping camera so it doesn't scroll below the bottom ground boundary
    if (this.scrollY > 0) {
      this.scrollY = 0;
    }

    this.camera.setScroll(0, this.scrollY);
  }

  getScrollY(): number {
    return this.scrollY;
  }

  reset(): void {
    this.scrollY = 0;
    this.camera.setScroll(0, 0);
  }
}
