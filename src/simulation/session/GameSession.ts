import { EventBus } from '../EventBus';
import { SimulationEvents } from '../events';
import { PlayerState } from './PlayerState';
import { WorldState } from './WorldState';
import { Simulation } from '../Simulation';
import { ReplaySystem } from '../../replay/ReplaySystem';

export class GameSession {
  public eventBus: EventBus<SimulationEvents>;
  public player: PlayerState;
  public world: WorldState;
  public simulation: Simulation;
  public replay: ReplaySystem;

  constructor(seed = 12345) {
    this.eventBus = new EventBus<SimulationEvents>();
    this.player = new PlayerState();
    this.world = new WorldState();
    this.simulation = new Simulation(this.eventBus, this.player, this.world, seed);
    this.replay = new ReplaySystem(this);
  }

  destroy(): void {
    this.simulation.destroy();
    this.eventBus.clear();
  }
}
