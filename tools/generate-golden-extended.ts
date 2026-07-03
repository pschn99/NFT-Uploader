/**
 * generate-golden-extended.ts
 * Generates golden_06.json through golden_30.json (25 additional replays).
 *
 * Each replay uses a unique input pattern (seeded variation of plunger power,
 * alternating flipper timing, nudge sequences, anchor usage).
 * All replays are 1800 frames (30 s) against sector_00.
 *
 * Run: TS_NODE_PROJECT=tsconfig.json npx ts-node --compiler-options '{"module":"commonjs"}' tools/generate-golden-extended.ts
 */

import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../src/simulation/session/GameSession';
import { SectorLoader } from '../src/tower/SectorLoader';
import { InputBuffer } from '../src/core/InputBuffer';
import { ReplayHash } from '../src/replay/ReplayHash';
import { InputEntry, InputAction } from '../src/types/input';
import sector00 from '../levels/campaign/sector_00.json';
import * as fs from 'fs';
import * as path from 'path';

const DURATION_FRAMES = 1800;
const OUT_DIR = path.resolve(__dirname, '../tests/replays');
const START_INDEX = 6;
const END_INDEX = 30;

// ---------------------------------------------------------------------------
// Simple seeded RNG for varied input generation (mulberry32)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Input generators — each produces a different play pattern
// ---------------------------------------------------------------------------

const FLIPPER_PATTERNS = ['left_heavy', 'right_heavy', 'alternating', 'simultaneous', 'burst'] as const;
type Pattern = typeof FLIPPER_PATTERNS[number];

function generateInputs(seed: number, replayIndex: number): InputEntry[] {
  const rng = mulberry32(seed);
  const inputs: InputEntry[] = [];

  // --- Plunger (varied power: 5–40 frames held)
  const plungerStart = 5;
  const plungerHold  = 5 + Math.floor(rng() * 36); // 5–40
  for (let f = plungerStart; f <= plungerStart + plungerHold; f++) {
    inputs.push({ frame: f, action: 'plunger', phase: 'down' });
  }
  inputs.push({ frame: plungerStart + plungerHold + 1, action: 'plunger', phase: 'up' });

  // --- Flipper pattern (determined by replay index mod 5)
  const pattern: Pattern = FLIPPER_PATTERNS[replayIndex % FLIPPER_PATTERNS.length];

  const baseFrame = plungerStart + plungerHold + 60;
  const interval  = 60 + Math.floor(rng() * 90); // 60–150 frames between presses

  switch (pattern) {
    case 'left_heavy': {
      for (let i = 0; i < 12; i++) {
        const f = baseFrame + i * interval;
        if (f + 15 < DURATION_FRAMES) {
          inputs.push({ frame: f,      action: 'flipper_left', phase: 'down' });
          inputs.push({ frame: f + 15, action: 'flipper_left', phase: 'up'   });
        }
      }
      break;
    }
    case 'right_heavy': {
      for (let i = 0; i < 12; i++) {
        const f = baseFrame + i * interval;
        if (f + 15 < DURATION_FRAMES) {
          inputs.push({ frame: f,      action: 'flipper_right', phase: 'down' });
          inputs.push({ frame: f + 15, action: 'flipper_right', phase: 'up'   });
        }
      }
      break;
    }
    case 'alternating': {
      for (let i = 0; i < 14; i++) {
        const f      = baseFrame + i * (interval / 2);
        const action: InputAction = i % 2 === 0 ? 'flipper_left' : 'flipper_right';
        if (f + 12 < DURATION_FRAMES) {
          inputs.push({ frame: Math.floor(f),      action, phase: 'down' });
          inputs.push({ frame: Math.floor(f) + 12, action, phase: 'up'   });
        }
      }
      break;
    }
    case 'simultaneous': {
      for (let i = 0; i < 8; i++) {
        const f = baseFrame + i * interval;
        if (f + 20 < DURATION_FRAMES) {
          inputs.push({ frame: f,      action: 'flipper_left',  phase: 'down' });
          inputs.push({ frame: f,      action: 'flipper_right', phase: 'down' });
          inputs.push({ frame: f + 20, action: 'flipper_left',  phase: 'up'   });
          inputs.push({ frame: f + 20, action: 'flipper_right', phase: 'up'   });
        }
      }
      break;
    }
    case 'burst': {
      // Short rapid bursts
      for (let i = 0; i < 6; i++) {
        const f = baseFrame + i * 200;
        for (let b = 0; b < 5; b++) {
          const bf = f + b * 8;
          const action: InputAction = b % 2 === 0 ? 'flipper_left' : 'flipper_right';
          if (bf + 6 < DURATION_FRAMES) {
            inputs.push({ frame: bf,     action, phase: 'down' });
            inputs.push({ frame: bf + 6, action, phase: 'up'   });
          }
        }
      }
      break;
    }
  }

  // --- Optional nudge (for roughly 1/3 of replays)
  if (rng() < 0.33) {
    const nudgeFrame = 300 + Math.floor(rng() * 600);
    const nudgeAction: InputAction = rng() < 0.5 ? 'nudge_left' : 'nudge_right';
    if (nudgeFrame < DURATION_FRAMES) {
      inputs.push({ frame: nudgeFrame, action: nudgeAction, phase: 'down' });
    }
  }

  // Sort by frame ascending (required by InputBuffer)
  inputs.sort((a, b) => a.frame - b.frame);
  return inputs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function generateExtended() {
  console.log(`Generating golden_${String(START_INDEX).padStart(2, '0')}.json → golden_${String(END_INDEX).padStart(2, '0')}.json ...`);
  await RAPIER.init();

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let succeeded = 0;
  let failed    = 0;

  for (let idx = START_INDEX; idx <= END_INDEX; idx++) {
    const seed   = idx * 31337 + 42; // Unique seed per replay
    const inputs = generateInputs(seed, idx - START_INDEX);
    const name   = `golden_${String(idx).padStart(2, '0')}.json`;

    try {
      const session      = new GameSession();
      const chunkManager = SectorLoader.load(session.simulation, sector00);
      const inputBuffer  = new InputBuffer();
      inputBuffer.setAllEntries(inputs);

      const pathHistory: Array<{ x: number; y: number }> = [];

      for (let frame = 0; frame < DURATION_FRAMES; frame++) {
        if (session.simulation.ball) {
          chunkManager.update(session.simulation.ball.getPosition().y);
        }
        session.simulation.step(inputBuffer.getEntriesForFrame(frame));
        if (session.simulation.ball) {
          const pos = session.simulation.ball.getPosition();
          pathHistory.push({ x: pos.x, y: pos.y });
        }
      }

      const expectedHash = ReplayHash.calculateSequence(pathHistory);
      const replayData   = { seed: 12345, durationFrames: DURATION_FRAMES, inputs, expectedHash };

      fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(replayData, null, 2), 'utf8');
      console.log(`  ✅ ${name}  hash=${expectedHash}  inputs=${inputs.length}`);
      succeeded++;

      chunkManager.destroy();
      session.destroy();
    } catch (err) {
      console.error(`  ❌ ${name}  ERROR: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${succeeded} generated, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

generateExtended().catch(err => {
  console.error('Generator failed:', err);
  process.exit(1);
});
