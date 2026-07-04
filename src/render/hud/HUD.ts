import Phaser from 'phaser';
import { GameSession } from '../../simulation/session/GameSession';
import { CampaignManager } from '../../tower/CampaignManager';

export class HUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private heightText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(20, 20).setScrollFactor(0);
    this.setupVisuals(scene);
  }

  private setupVisuals(scene: Phaser.Scene): void {
    // Current climbing height (bold font)
    this.heightText = scene.add.text(0, 0, 'HEIGHT: 0.00m', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    });
    this.container.add(this.heightText);

    // Active nudge/anchor slots and clear timers
    this.statsText = scene.add.text(0, 40, '', {
      fontSize: '15px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
      lineSpacing: 4
    });
    this.container.add(this.statsText);
  }

  /**
   * Refreshes text parameters with current player session state.
   */
  update(session: GameSession): void {
    const ballPos = session.simulation.ball.getPosition();
    const height = ballPos.y;
    const maxH = session.player.maxHeight;
    const nudges = session.player.nudgeCharges;
    const anchors = session.player.anchorCharges;
    const checkpoint = session.player.lastCheckpointY;
    const timeSec = (session.simulation.elapsedTimeMs / 1000).toFixed(1);

    this.heightText.setText(`HEIGHT: ${height.toFixed(2)}m  (max: ${maxH.toFixed(2)}m)`);

    // Render slots using retro glyph symbols
    const nudgeSlots = '✦ '.repeat(nudges) + '✧ '.repeat(3 - nudges);
    const anchorSlots = '⬢ '.repeat(anchors) + '⬡ '.repeat(2 - anchors);

    const sectorIndex = (this.scene as any).currentSectorIndex ?? 0;
    const titleCard = CampaignManager.getTitleCard(sectorIndex);
    const headerTitle = sectorIndex === -1
      ? 'TEST PLAY RUN'
      : (sectorIndex >= 6 ? 'THE ABYSS ∞' : `CAMPAIGN RUN: ${titleCard.name.toUpperCase()}`);

    let stats = `=== ${headerTitle} ===\n`;
    stats += `- Run Time       : ${timeSec}s\n`;
    stats += `- Nudge Slots    : ${nudgeSlots}\n`;
    stats += `- Anchor Slots   : ${anchorSlots}\n`;
    stats += `- Checkpoint Tier: ${checkpoint.toFixed(0)}m\n`;

    if (session.simulation.anchor.isAttached()) {
      stats += `- Suspension     : [ ANCHOR DEPLOYED ] (Press Shift/C to release)\n`;
    } else {
      stats += `- Suspension     : [ GRAVITY ACTIVE ]\n`;
    }

    if (session.simulation.isWon) {
      stats += `\n🎉 TOWER CLIMB CLEARED! WINNER! 🎉`;
    }

    this.statsText.setText(stats);
  }

  destroy(): void {
    this.container.destroy();
  }
}
