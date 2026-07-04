import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../PhysicsWorld';
import { Ball } from './Ball';
import { EventBus } from '../EventBus';
import { SimulationEvents } from '../events';

export interface ActiveAnchor {
  id: string;
  x: number;
  y: number;
  body: RAPIER.RigidBody;
  radius: number;
  catchesRemaining: number;
  cooldownSteps: number;
}

export class Anchor {
  public activeAnchors: ActiveAnchor[] = [];
  public heldBall: Ball | null = null;
  public holdStepsRemaining = 0;
  
  private physicsWorld: PhysicsWorld;
  private eventBus: EventBus<SimulationEvents>;
  private anchorRadius = 2.5; // reaches 2.5m into the playfield

  constructor(physicsWorld: PhysicsWorld, eventBus: EventBus<SimulationEvents>) {
    this.physicsWorld = physicsWorld;
    this.eventBus = eventBus;
  }

  /**
   * Deploys a new wall anchor based on the ball's current position (Priority 5).
   */
  deploy(ball: Ball, frameIndex: number): void {
    const ballPos = ball.body.translation();
    
    // Determine nearest wall (0.0 or 18.25)
    const anchorX = ballPos.x < 9.125 ? 0.0 : 18.25;
    const anchorY = ballPos.y;
    const id = `anchor_${frameIndex}_${Math.floor(Math.random() * 1000)}`;

    // Limit to max 2 active anchors (FIFO queue)
    if (this.activeAnchors.length >= 2) {
      const oldest = this.activeAnchors.shift();
      if (oldest) {
        this.physicsWorld.removeRigidBody(oldest.body);
      }
    }

    // Create a static Rapier body with a circular sensor collider
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(anchorX, anchorY);
    const body = this.physicsWorld.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.ball(this.anchorRadius).setSensor(true);
    this.physicsWorld.createCollider(colliderDesc, body);

    this.activeAnchors.push({
      id,
      x: anchorX,
      y: anchorY,
      body,
      radius: this.anchorRadius,
      catchesRemaining: 3,
      cooldownSteps: 0,
    });
  }

  /**
   * Updates hold timers and collision checks for active anchors (Priority 5).
   * Runs inside the physics step (substepped).
   */
  step(ball: Ball): void {
    const ballPos = ball.body.translation();

    // 1. Update cooldowns
    for (const anchor of this.activeAnchors) {
      if (anchor.cooldownSteps > 0) {
        anchor.cooldownSteps--;
      }
    }

    // 2. Handle active hold
    if (this.heldBall) {
      if (this.holdStepsRemaining > 0) {
        this.holdStepsRemaining--;
        // Lock velocity to 0 while held
        this.heldBall.body.setLinvel({ x: 0, y: 0 }, true);
        this.heldBall.body.setAngvel(0, true);
      } else {
        this.release();
      }
      return;
    }

    // 3. Collision overlap check (only if not already held)
    for (let i = this.activeAnchors.length - 1; i >= 0; i--) {
      const anchor = this.activeAnchors[i];
      if (anchor.cooldownSteps > 0) continue;

      const dist = Math.hypot(ballPos.x - anchor.x, ballPos.y - anchor.y);
      if (dist <= ball.radius + anchor.radius) {
        // Trigger catch! (Priority 5)
        this.heldBall = ball;
        // 0.4s hold. At 240Hz physics rate, 0.4s is exactly 96 steps.
        this.holdStepsRemaining = 96;

        // Change ball body type to kinematic so standard forces (like gravity) are ignored
        ball.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        ball.body.setLinvel({ x: 0, y: 0 }, true);
        ball.body.setAngvel(0, true);

        // Snap ball position to the anchor's vertical coordinate, keeping it near the wall
        ball.body.setTranslation({ x: anchor.x === 0 ? ball.radius : (18.25 - ball.radius), y: anchor.y }, true);

        anchor.catchesRemaining--;
        this.eventBus.emit('AnchorTriggered', {
          anchorId: anchor.id,
          chargesRemaining: anchor.catchesRemaining,
        });

        // Add 1.0s cooldown (240 steps at 240Hz) after catch to avoid immediate re-catch
        anchor.cooldownSteps = 240;

        // If depleted, remove it immediately
        if (anchor.catchesRemaining <= 0) {
          this.activeAnchors.splice(i, 1);
          this.physicsWorld.removeRigidBody(anchor.body);
        }
        break; // Only catch once per step
      }
    }
  }

  /**
   * Releases the held ball (Priority 5).
   */
  release(): void {
    if (this.heldBall) {
      this.heldBall.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      this.heldBall = null;
      this.holdStepsRemaining = 0;
    }
  }

  /**
   * Returns true if the ball is currently caught/suspended.
   */
  isAttached(): boolean {
    return this.heldBall !== null;
  }

  /**
   * Cleans up all anchors and releases hold.
   */
  destroy(): void {
    this.release();
    for (const anchor of this.activeAnchors) {
      this.physicsWorld.removeRigidBody(anchor.body);
    }
    this.activeAnchors = [];
  }
}
