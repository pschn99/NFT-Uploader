import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from './PhysicsWorld';
import { EventBus } from './EventBus';
import { SimulationEvents } from './events';
import { PlayerState } from './session/PlayerState';
import { WorldState } from './session/WorldState';
import { Ball } from './entities/Ball';
import { Flipper } from './entities/Flipper';
import { Plunger } from './entities/Plunger';

// Milestone 2 Recovery & System imports
import { Anchor } from './entities/Anchor';
import { Bumper } from './entities/Bumper';
import { FallFloor } from './entities/FallFloor';
import { NudgeSystem } from './systems/NudgeSystem';
import { CheckpointSystem } from './systems/CheckpointSystem';
import { WinConditionSystem } from './systems/WinConditionSystem';
import { DRAIN_Y_THRESHOLD } from './constants';

export class Simulation {
  public physicsWorld: PhysicsWorld;
  public eventBus: EventBus<SimulationEvents>;
  public playerState: PlayerState;
  public worldState: WorldState;

  public ball!: Ball;
  public flippers: Flipper[] = [];
  public plunger: Plunger | null = null;
  public staticBodies: RAPIER.RigidBody[] = [];

  // Milestone 2 simulation entities
  public anchor: Anchor;
  public bumpers: Bumper[] = [];
  public fallFloors: FallFloor[] = [];
  public isWon = false;
  public elapsedTimeMs = 0;

  public frameIndex = 0;
  private rng: () => number;

  constructor(
    eventBus: EventBus<SimulationEvents>,
    playerState: PlayerState,
    worldState: WorldState,
    seed = 12345
  ) {
    this.eventBus = eventBus;
    this.playerState = playerState;
    this.worldState = worldState;
    this.rng = this.createMulberry32(seed);

    // Gravity scaled for snappy pinball feel (4x gravity Y scaling)
    this.physicsWorld = new PhysicsWorld({ x: 0, y: -9.81 * 4.0 });

    // Instantiate anchor manager
    this.anchor = new Anchor(this.physicsWorld);
  }

  /**
   * Deterministic RNG generator (mulberry32). Never use Math.random() in the simulation.
   */
  private createMulberry32(seed: number): () => number {
    let s = seed;
    return () => {
      let t = (s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Returns a deterministic random number between 0 and 1.
   */
  random(): number {
    return this.rng();
  }

  /**
   * Spawns or resets the ball at the given coordinates.
   */
  setBall(x: number, y: number): void {
    if (this.ball) {
      this.ball.reset(x, y);
    } else {
      this.ball = new Ball(this.physicsWorld, x, y);
    }
  }

  /**
   * Adds a left or right flipper to the physics simulation.
   */
  addFlipper(side: 'left' | 'right', x: number, y: number): Flipper {
    const flipper = new Flipper(this.physicsWorld, side, x, y);
    this.flippers.push(flipper);
    return flipper;
  }

  /**
   * Registers the launch plunger mechanism.
   */
  addPlunger(x: number, y: number): Plunger {
    const plunger = new Plunger(this.physicsWorld, x, y);
    this.plunger = plunger;
    return plunger;
  }

  /**
   * Adds an active circular bumper to the simulation.
   */
  addBumper(x: number, y: number, radius = 0.6): Bumper {
    const bumper = new Bumper(this.physicsWorld, x, y, radius);
    this.bumpers.push(bumper);
    return bumper;
  }

  /**
   * Adds a dynamic one-way checkpoint catch floor.
   */
  addFallFloor(x: number, y: number, hw = 2.5, hh = 0.15): FallFloor {
    const floor = new FallFloor(this.physicsWorld, x, y, hw, hh);
    this.fallFloors.push(floor);
    return floor;
  }

  /**
   * Spawns a solid boundary wall.
   */
  createStaticWall(x: number, y: number, hx: number, hy: number, rotation = 0): RAPIER.RigidBody {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y).setRotation(rotation);
    const body = this.physicsWorld.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(hx, hy);
    this.physicsWorld.createCollider(colDesc, body);
    this.staticBodies.push(body);
    return body;
  }

  /**
   * Removes a static body from the physics world and the staticBodies array.
   * Used by SectorChunkManager and AbyssGenerator for proper chunk cleanup.
   */
  removeStaticBody(body: RAPIER.RigidBody): void {
    this.physicsWorld.removeRigidBody(body);
    this.staticBodies = this.staticBodies.filter((b) => b !== body);
  }

  /**
   * Simulates a single frame step.
   * Executes inputs for the current frame, steps Rapier, updates heights, and processes resets.
   */
  step(inputs: { action: string; phase: string; value?: number }[]): void {
    if (this.isWon) return;

    // 1. Process inputs for this frame
    inputs.forEach((input) => {
      // Toggle Anchor Suspend
      if (input.action === 'anchor') {
        if (input.phase === 'down') {
          if (this.anchor.isAttached()) {
            this.anchor.detach();
          } else if (this.playerState.anchorCharges > 0) {
            this.playerState.anchorCharges--;
            this.anchor.attach(this.ball);
            this.eventBus.emit('AnchorTriggered', {
              anchorId: `a_${this.frameIndex}`,
              chargesRemaining: this.playerState.anchorCharges
            });
          }
        }
      }

      // Nudge Actions (break anchor suspension automatically)
      if (input.action === 'nudge_left' && input.phase === 'down') {
        if (this.anchor.isAttached()) {
          this.anchor.detach();
        }
        NudgeSystem.nudge(this.ball, this.playerState, this.eventBus, 'left');
      }

      if (input.action === 'nudge_right' && input.phase === 'down') {
        if (this.anchor.isAttached()) {
          this.anchor.detach();
        }
        NudgeSystem.nudge(this.ball, this.playerState, this.eventBus, 'right');
      }

      // Flipper Action (breaks anchor suspension automatically on stroke)
      if (input.action === 'flipper_left') {
        const leftFlippers = this.flippers.filter((f) => f.side === 'left');
        leftFlippers.forEach((f) => f.setInput(input.phase === 'down'));
        if (input.phase === 'down') {
          // Read actual angular velocity from the flipper body per TDD §6
          const angVel = leftFlippers.length > 0 ? leftFlippers[0].body.angvel() : 30.0;
          this.eventBus.emit('FlipperStruck', { side: 'left', angularVelocity: angVel });
          if (this.anchor.isAttached()) {
            this.anchor.detach();
          }
        }
      }
      
      if (input.action === 'flipper_right') {
        const rightFlippers = this.flippers.filter((f) => f.side === 'right');
        rightFlippers.forEach((f) => f.setInput(input.phase === 'down'));
        if (input.phase === 'down') {
          // Read actual angular velocity from the flipper body per TDD §6
          const angVel = rightFlippers.length > 0 ? rightFlippers[0].body.angvel() : -30.0;
          this.eventBus.emit('FlipperStruck', { side: 'right', angularVelocity: angVel });
          if (this.anchor.isAttached()) {
            this.anchor.detach();
          }
        }
      }

      if (input.action === 'plunger') {
        if (this.plunger) {
          if (input.phase === 'down') {
            this.plunger.chargePlunger(0.05); // Charges 5% per frame
          } else if (input.phase === 'up') {
            const force = this.plunger.fire(this.ball);
            if (force > 0) {
              this.eventBus.emit('PlungerFired', { force });
              if (this.anchor.isAttached()) {
                this.anchor.detach();
              }
            }
          }
        }
      }
    });

    // 2. Step the Rapier physics world
    this.physicsWorld.step();
    this.frameIndex++;
    // Fixed 1/60s timestep per TDD §9 — exactly 1000/60 ms per step
    this.elapsedTimeMs += 1000 / 60;

    // 3. Resolve active bumper colliders collision bounce impulses
    if (this.ball) {
      this.bumpers.forEach((bumper) => {
        const hit = bumper.resolveHit(this.ball);
        if (hit) {
          this.eventBus.emit('BallImpact', {
            position: this.ball.getPosition(),
            impulse: 8.0
          });
        }
      });
    }

    // 4. Update one-way catch floors (pass current time for 2-second active duration)
    this.fallFloors.forEach((floor) => {
      floor.update(this.ball, this.elapsedTimeMs);
    });

    // 5. Height metrics tracking & drain detection
    if (this.ball) {
      const pos = this.ball.getPosition();
      this.playerState.currentHeight = pos.y;
      
      if (pos.y > this.playerState.maxHeight) {
        this.playerState.maxHeight = pos.y;
      }

      // Check checkpoints crossing
      const newFloor = CheckpointSystem.check(this.ball, this.playerState, this.eventBus, this.physicsWorld);
      if (newFloor) {
        this.fallFloors.push(newFloor);
      }

      // Check exit win condition height clearance
      const won = WinConditionSystem.check(this.ball, this.eventBus, this.elapsedTimeMs);
      if (won) {
        this.isWon = true;
      }

      // Drain check: reset to last checkpoint if ball falls below vertical bounds (TDD §7.2)
      if (pos.y < DRAIN_Y_THRESHOLD) {
        const fallenY = pos.y;
        if (this.anchor.isAttached()) {
          this.anchor.detach();
        }
        // Reset ball at checkpoint Y + 2m (dropping down safely)
        this.ball.reset(10.24, this.playerState.lastCheckpointY + 2.0);
        this.eventBus.emit('BallFell', { fromY: fallenY });
      }
    }
  }

  destroy(): void {
    this.physicsWorld.destroy();
    this.staticBodies = [];
    this.flippers = [];
    this.bumpers = [];
    this.fallFloors = [];
    this.anchor.detach();
    this.plunger = null;
  }
}
