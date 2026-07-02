import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../../src/simulation/session/GameSession';
import { Anchor } from '../../src/simulation/entities/Anchor';
import { FallFloor } from '../../src/simulation/entities/FallFloor';
import { CheckpointSystem } from '../../src/simulation/systems/CheckpointSystem';
import { WinConditionSystem } from '../../src/simulation/systems/WinConditionSystem';

describe('Simulation Integration: Tiers, Platforms & Recovery', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  test('Anchor System: attach suspends the ball, detach releases it under gravity', () => {
    const session = new GameSession();
    const anchor = new Anchor(session.simulation.physicsWorld);
    
    // Set dynamic ball position
    session.simulation.setBall(10.0, 15.0);
    
    // Step once to assert it falls under normal gravity
    session.simulation.physicsWorld.step();
    const y1 = session.simulation.ball.getPosition().y;
    expect(y1).toBeLessThan(15.0);

    // Attach anchor
    anchor.attach(session.simulation.ball);
    expect(anchor.isAttached()).toBe(true);

    const posAttached = session.simulation.ball.getPosition();

    // Step physics multiple frames with anchor active
    for (let i = 0; i < 10; i++) {
      session.simulation.physicsWorld.step();
    }

    const posAfterSteps = session.simulation.ball.getPosition();
    
    // The ball must remain static at anchor pivot coordinates
    expect(posAfterSteps.x).toBeCloseTo(posAttached.x, 3);
    expect(posAfterSteps.y).toBeCloseTo(posAttached.y, 3);

    // Detach anchor
    anchor.detach();
    expect(anchor.isAttached()).toBe(false);

    // Step physics and verify ball starts falling again
    session.simulation.physicsWorld.step();
    const yAfterRelease = session.simulation.ball.getPosition().y;
    expect(yAfterRelease).toBeLessThan(posAfterSteps.y);

    anchor.detach();
    session.destroy();
  });

  test('FallFloor Solidity: solid when ball is above top boundary, ghost when below (with active physics steps)', () => {
    const session = new GameSession();
    session.simulation.setBall(10.24, 25.0); // Ball radius is 0.35
    
    // Fall floor center at Y = 20.0, halfHeight = 0.15. Top edge is 20.15
    const floor = new FallFloor(session.simulation.physicsWorld, 10.24, 20.0);
    session.simulation.fallFloors.push(floor);

    // 1. Position ball above floor (Y = 22.0)
    session.simulation.ball.reset(10.24, 22.0);
    // Explicitly update once to ensure it is solid before the first step
    floor.update(session.simulation.ball);
    expect(floor.isSolid()).toBe(true);

    // Step physics multiple frames to let it fall naturally under gravity
    for (let i = 0; i < 40; i++) {
      session.simulation.step([]);
    }

    const posCaught = session.simulation.ball.getPosition();
    const expectedCatchY = 20.15 + 0.35; // floorTopY + ballRadius
    // Ball should be resting on top of the floor
    expect(posCaught.y).toBeGreaterThanOrEqual(expectedCatchY - 0.05);
    expect(posCaught.y).toBeLessThan(21.0);

    // 2. Position ball below floor (Y = 18.0) and verify it passes straight through moving upward
    session.simulation.ball.reset(10.24, 18.0);
    floor.update(session.simulation.ball);
    expect(floor.isSolid()).toBe(false);
    
    // Give it upward velocity
    session.simulation.ball.body.setLinvel({ x: 0.0, y: 25.0 }, true);

    // Step physics to move upward through the floor
    for (let i = 0; i < 15; i++) {
      session.simulation.step([]);
    }

    const posPassed = session.simulation.ball.getPosition();
    // Ball should have successfully passed through the floor to the top
    expect(posPassed.y).toBeGreaterThan(20.5);

    session.destroy();
  });

  test('CheckpointSystem: crossing 100m refills charges and returns FallFloor', () => {
    const session = new GameSession();
    session.simulation.setBall(10.24, 5.0);

    // Simulate losing charges
    session.simulation.playerState.nudgeCharges = 1;
    session.simulation.playerState.anchorCharges = 0;
    session.simulation.playerState.lastCheckpointY = 0;

    // Move ball above 100m checkpoint
    session.simulation.ball.reset(10.24, 105.0);

    let checkpointEventFired = false;
    session.simulation.eventBus.on('CheckpointReached', (data) => {
      expect(data.checkpointY).toBe(100.0);
      expect(data.chargesRestored).toBe(2);
      checkpointEventFired = true;
    });

    const newFloor = CheckpointSystem.check(
      session.simulation.ball,
      session.simulation.playerState,
      session.simulation.eventBus,
      session.simulation.physicsWorld
    );

    // Verify checkpoint tier was saved and charges restored
    expect(checkpointEventFired).toBe(true);
    expect(session.simulation.playerState.lastCheckpointY).toBe(100.0);
    expect(session.simulation.playerState.nudgeCharges).toBe(3);
    expect(session.simulation.playerState.anchorCharges).toBe(2);

    // Verify corresponding FallFloor catch platform spawned 10m below
    expect(newFloor).not.toBeNull();
    expect(newFloor!.floorY).toBe(90.0); // 100m - 10m offset

    session.destroy();
  });

  test('WinConditionSystem: fires event when ball reaches 500m exit gate', () => {
    const session = new GameSession();
    session.simulation.setBall(10.24, 490.0);

    let winEventFired = false;
    session.simulation.eventBus.on('WinConditionMet', (data) => {
      expect(data.clearTimeMs).toBe(12345);
      winEventFired = true;
    });

    // Ball is still below 500m
    let won = WinConditionSystem.check(session.simulation.ball, session.simulation.eventBus, 12345);
    expect(won).toBe(false);
    expect(winEventFired).toBe(false);

    // Move ball above 500m
    session.simulation.ball.reset(10.24, 502.0);
    won = WinConditionSystem.check(session.simulation.ball, session.simulation.eventBus, 12345);
    expect(won).toBe(true);
    expect(winEventFired).toBe(true);

    session.destroy();
  });
});
