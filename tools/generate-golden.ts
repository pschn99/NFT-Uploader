import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../src/simulation/session/GameSession';
import { SectorLoader } from '../src/tower/SectorLoader';
import { InputBuffer } from '../src/core/InputBuffer';
import { ReplayHash } from '../src/replay/ReplayHash';
import { InputEntry } from '../src/types/input';
import sector00 from '../levels/campaign/sector_00.json';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('Generating golden_01 replay programmatically in workspace...');
  await RAPIER.init();

  const seed = 12345;
  const session = new GameSession(seed);

  // Load level layout
  SectorLoader.load(session.simulation, sector00 as any);

  // Define structured inputs to charge & fire plunger, and flap flippers
  const inputs: InputEntry[] = [
    // Charge plunger from frame 5 to 25, then release at 26
    { frame: 5, action: 'plunger', phase: 'down' },
    ...Array.from({ length: 20 }, (_, i) => ({ frame: 6 + i, action: 'plunger' as const, phase: 'down' as const })),
    { frame: 26, action: 'plunger', phase: 'up' },

    // Flipper strokes
    { frame: 100, action: 'flipper_left', phase: 'down' },
    { frame: 115, action: 'flipper_left', phase: 'up' },

    { frame: 180, action: 'flipper_right', phase: 'down' },
    { frame: 195, action: 'flipper_right', phase: 'up' },

    { frame: 300, action: 'flipper_left', phase: 'down' },
    { frame: 315, action: 'flipper_left', phase: 'up' },

    { frame: 450, action: 'flipper_right', phase: 'down' },
    { frame: 465, action: 'flipper_right', phase: 'up' },

    { frame: 600, action: 'flipper_left', phase: 'down' },
    { frame: 615, action: 'flipper_left', phase: 'up' },

    { frame: 750, action: 'flipper_right', phase: 'down' },
    { frame: 765, action: 'flipper_right', phase: 'up' },

    { frame: 900, action: 'flipper_left', phase: 'down' },
    { frame: 915, action: 'flipper_left', phase: 'up' },

    { frame: 1050, action: 'flipper_right', phase: 'down' },
    { frame: 1065, action: 'flipper_right', phase: 'up' },

    { frame: 1200, action: 'flipper_left', phase: 'down' },
    { frame: 1215, action: 'flipper_left', phase: 'up' },

    { frame: 1350, action: 'flipper_right', phase: 'down' },
    { frame: 1365, action: 'flipper_right', phase: 'up' },

    { frame: 1500, action: 'flipper_left', phase: 'down' },
    { frame: 1515, action: 'flipper_left', phase: 'up' },

    { frame: 1650, action: 'flipper_right', phase: 'down' },
    { frame: 1665, action: 'flipper_right', phase: 'up' }
  ];

  const inputBuffer = new InputBuffer();
  inputBuffer.setAllEntries(inputs);

  const pathHistory: Array<{ x: number; y: number }> = [];
  const durationFrames = 1800; // 30 seconds at 60fps

  // Step physics and track path coordinates
  for (let frame = 0; frame < durationFrames; frame++) {
    const inputsForFrame = inputBuffer.getEntriesForFrame(frame);
    session.simulation.step(inputsForFrame);

    if (session.simulation.ball) {
      const pos = session.simulation.ball.getPosition();
      pathHistory.push({ x: pos.x, y: pos.y });
    }
  }

  // Calculate deterministic coordinate path hash
  const expectedHash = ReplayHash.calculateSequence(pathHistory);

  const replayData = {
    seed,
    durationFrames,
    inputs,
    expectedHash
  };

  const targetDir = path.resolve(__dirname, '../tests/replays');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFile = path.join(targetDir, 'golden_01.json');
  fs.writeFileSync(targetFile, JSON.stringify(replayData, null, 2), 'utf8');

  console.log(`Successfully generated and wrote golden replay to ${targetFile}`);
  console.log(`- Expected Hash: ${expectedHash}`);
  console.log(`- Frames: ${durationFrames}`);
  session.destroy();
}

main().catch(console.error);
