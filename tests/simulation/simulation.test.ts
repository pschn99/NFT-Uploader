import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../../src/simulation/session/GameSession';

describe('Simulation Engine Unit Tests', () => {
  beforeAll(async () => {
    // Initialise WASM module before run
    await RAPIER.init();
  });

  it('should actuate flippers correctly on input', () => {
    const session = new GameSession();
    const flipper = session.simulation.addFlipper('left', 5.0, 5.0);
    
    // Initial angle is close to resting min limit (-0.45 rad)
    expect(flipper.getRotation()).toBeCloseTo(-0.45, 1);

    // Input press down
    session.simulation.step([{ action: 'flipper_left', phase: 'down' }]);
    
    // Step forward 15 frames (1/4 second)
    for (let i = 0; i < 15; i++) {
      session.simulation.step([]);
    }

    // Flipper rotation should swing upwards towards max angle limit (0.45)
    expect(flipper.getRotation()).toBeGreaterThan(-0.1);
    session.destroy();
  });

  it('should prevent CCD ball tunneling at high speed', () => {
    const session = new GameSession();
    
    // Create static thin floor: Y=1.0, hx=5.0, hy=0.1
    session.simulation.createStaticWall(10.0, 1.0, 5.0, 0.1);

    // Spawn ball right above it at Y=2.0
    session.simulation.setBall(10.0, 2.0);

    // Apply high downward velocity: -60 m/s
    // In a single step of 1/60s, a non-CCD body travels 1.0 meter.
    // Gap to wall surface is Y=2.0 -> Y=1.1 (0.9m). The ball would bypass it.
    session.simulation.ball.body.setLinvel({ x: 0, y: -60.0 }, true);

    // Step physics
    session.simulation.step([]);

    const ballPos = session.simulation.ball.getPosition();

    // The ball must NOT tunnel through. Its bottom must remain above the floor line.
    const ballBottomY = ballPos.y - session.simulation.ball.radius;
    expect(ballBottomY).toBeGreaterThanOrEqual(1.0); // Bounced off or stopped by surface
    session.destroy();
  });
});
