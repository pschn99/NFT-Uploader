import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from './PhysicsWorld';
import { EventBus } from './EventBus';
import { SimulationEvents } from './events';
import { PlayerState } from './session/PlayerState';
import { WorldState } from './session/WorldState';
import { Ball } from './entities/Ball';
import { Flipper } from './entities/Flipper';
import { Plunger } from './entities/Plunger';

export class Simulation {
  public physicsWorld: PhysicsWorld;
  public eventBus: EventBus<SimulationEvents>;
  public playerState: PlayerState;
  public worldState: WorldState;

  public ball!: Ball;
  public flippers: Flipper[] = [];
  public plunger: Plunger | null = null;
  public staticBodies: RAPIER.RigidBody[] = [];

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

    // Pushed gravity for fast vertical arcade feel (4x gravity Y scaling)
    this.physicsWorld = new PhysicsWorld({ x: 0, y: -9.81 * 4.0 });
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
   * Simulates a single frame step.
   * Executes inputs for the current frame, steps Rapier, updates heights, and processes resets.
   */
  step(inputs: { action: string; phase: string; value?: number }[]): void {
    // 1. Process inputs for this frame
    inputs.forEach((input) => {
      if (input.action === 'flipper_left') {
        const leftFlippers = this.flippers.filter((f) => f.side === 'left');
        leftFlippers.forEach((f) => f.setInput(input.phase === 'down'));
        if (input.phase === 'down') {
          this.eventBus.emit('FlipperStruck', { side: 'left', angularVelocity: 30.0 });
        }
      }
      
      if (input.action === 'flipper_right') {
        const rightFlippers = this.flippers.filter((f) => f.side === 'right');
        rightFlippers.forEach((f) => f.setInput(input.phase === 'down'));
        if (input.phase === 'down') {
          this.eventBus.emit('FlipperStruck', { side: 'right', angularVelocity: -30.0 });
        }
      }

      if (input.action === 'plunger') {
        if (this.plunger) {
          if (input.phase === 'down') {
            // Charging plunger
            this.plunger.chargePlunger(0.05); // Charges 5% per frame
          } else if (input.phase === 'up') {
            // Release plunger
            const force = this.plunger.fire(this.ball);
            if (force > 0) {
              this.eventBus.emit('PlungerFired', { force });
            }
          }
        }
      }
    });

    // 2. Step the Rapier physics world
    this.physicsWorld.step();
    this.frameIndex++;

    // 3. Height metrics tracking & drain detection
    if (this.ball) {
      const pos = this.ball.getPosition();
      this.playerState.currentHeight = pos.y;
      
      if (pos.y > this.playerState.maxHeight) {
        this.playerState.maxHeight = pos.y;
      }

      // Drain check: reset to last checkpoint if ball falls below vertical bounds
      if (pos.y < -1.5) {
        const fallenY = pos.y;
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
    this.plunger = null;
  }
}
