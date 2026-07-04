import { AudioSystem } from '../../src/audio/AudioSystem';
import { EventBus } from '../../src/simulation/EventBus';
import { SimulationEvents } from '../../src/simulation/events';

describe('AudioSystem Headless Behaviour', () => {
  test('does not throw when initialized or destroyed in headless node environment', () => {
    const eventBus = new EventBus<SimulationEvents>();
    const audio = new AudioSystem(eventBus);

    // Should return early and not crash on missing browser window/AudioContext
    expect(() => audio.init()).not.toThrow();

    // Event handlers can be triggered safely without audio context
    expect(() => {
      eventBus.emit('FlipperStruck', { side: 'left', angularVelocity: 30 });
      eventBus.emit('PlungerFired', { force: 15 });
      eventBus.emit('BallImpact', { position: { x: 0, y: 0 }, impulse: 5 });
      eventBus.emit('CheckpointReached', { checkpointY: 100, chargesRestored: 3 });
      eventBus.emit('BallFell', { fromY: 50 });
      eventBus.emit('WinConditionMet', { finalPosition: { x: 0, y: 500 }, clearTimeMs: 12000 });
    }).not.toThrow();

    // Cleanup should exit cleanly
    expect(() => audio.destroy()).not.toThrow();
  });
});
