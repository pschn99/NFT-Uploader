import { EventBus } from '../simulation/EventBus';
import { SimulationEvents } from '../simulation/events';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private eventBus: EventBus<SimulationEvents>;

  constructor(eventBus: EventBus<SimulationEvents>) {
    this.eventBus = eventBus;
  }

  /**
   * Initializes the AudioContext on active user interaction to satisfy browser policies.
   */
  init(): void {
    if (this.ctx) return;

    // Check window environment to prevent crashing during headless CLI testing
    if (typeof window === 'undefined') return;

    const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.setupListeners();
      console.log('AudioSystem initialized.');
    }
  }

  private setupListeners(): void {
    if (!this.ctx) return;

    this.eventBus.on('FlipperStruck', () => this.playFlipperSound());
    this.eventBus.on('PlungerFired', (data) => this.playPlungerSound(data.force));
    this.eventBus.on('BallImpact', (data) => this.playImpactSound(data.impulse));
    this.eventBus.on('CheckpointReached', () => this.playCheckpointSound());
    this.eventBus.on('BallFell', () => this.playFellSound());
    this.eventBus.on('WinConditionMet', () => this.playWinSound());
  }

  private playFlipperSound(): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  private playPlungerSound(force: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200 + (force * 10), this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  private playImpactSound(impulse: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Active bumper hit utilizes high pitch chime
    const freq = impulse > 5.0 ? 880 : 440;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  private playCheckpointSound(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Upward chiptune arpeggio
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.12, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.08 + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.12);
    });
  }

  private playFellSound(): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(55, this.ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  private playWinSound(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Major chord victory fanfare
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + idx * 0.1 + 0.4);

      gain.gain.setValueAtTime(0.15, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.001, now + idx * 0.1 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.5);
    });
  }

  /**
   * Closes the audio context and releases native audio resource handles.
   */
  destroy(): void {
    if (this.ctx) {
      this.ctx.close().catch((err) => {
        console.error('AudioSystem: failed to close AudioContext:', err);
      });
      this.ctx = null;
    }
  }
}
