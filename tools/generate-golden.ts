import RAPIER from '@dimforge/rapier2d-compat';
import { GameSession } from '../src/simulation/session/GameSession';
import { SectorLoader } from '../src/tower/SectorLoader';
import { InputBuffer } from '../src/core/InputBuffer';
import { ReplayHash } from '../src/replay/ReplayHash';
import { InputEntry } from '../src/types/input';
import sector00 from '../levels/campaign/sector_00.json';
import * as fs from 'fs';
import * as path from 'path';

async function generateAll() {
  console.log('Starting programmatic generation of 5 golden replays...');
  await RAPIER.init();

  const durationFrames = 1800; // 30 seconds at 60fps
  const outDir = path.resolve(__dirname, '../tests/replays');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Replay 01: Standard flipper climb
  const inputs1: InputEntry[] = [
    { frame: 5, action: 'plunger', phase: 'down' },
    ...Array.from({ length: 20 }, (_, i) => ({ frame: 6 + i, action: 'plunger' as const, phase: 'down' as const })),
    { frame: 26, action: 'plunger', phase: 'up' },
    ...Array.from({ length: 11 }, (_, i) => ({ frame: 100 + i * 150, action: 'flipper_left' as const, phase: 'down' as const })),
    ...Array.from({ length: 11 }, (_, i) => ({ frame: 115 + i * 150, action: 'flipper_left' as const, phase: 'up' as const })),
    ...Array.from({ length: 11 }, (_, i) => ({ frame: 180 + i * 150, action: 'flipper_right' as const, phase: 'down' as const })),
    ...Array.from({ length: 11 }, (_, i) => ({ frame: 195 + i * 150, action: 'flipper_right' as const, phase: 'up' as const }))
  ];

  // 2. Replay 02: High-powered plunger launch
  const inputs2: InputEntry[] = [
    { frame: 5, action: 'plunger', phase: 'down' },
    ...Array.from({ length: 30 }, (_, i) => ({ frame: 6 + i, action: 'plunger' as const, phase: 'down' as const })),
    { frame: 36, action: 'plunger', phase: 'up' },
    ...Array.from({ length: 11 }, (_, i) => ({ frame: 120 + i * 150, action: 'flipper_left' as const, phase: 'down' as const })),
    ...Array.from({ length: 11 }, (_, i) => ({ frame: 135 + i * 150, action: 'flipper_left' as const, phase: 'up' as const }))
  ];

  // 3. Replay 03: Short plunger + Nudges
  const inputs3: InputEntry[] = [
    { frame: 5, action: 'plunger', phase: 'down' },
    ...Array.from({ length: 10 }, (_, i) => ({ frame: 6 + i, action: 'plunger' as const, phase: 'down' as const })),
    { frame: 16, action: 'plunger', phase: 'up' },
    { frame: 100, action: 'nudge_left', phase: 'down' },
    { frame: 200, action: 'nudge_right', phase: 'down' },
    { frame: 300, action: 'nudge_left', phase: 'down' }
  ];

  // 4. Replay 04: Plunger + Anchor suspension
  const inputs4: InputEntry[] = [
    { frame: 5, action: 'plunger', phase: 'down' },
    ...Array.from({ length: 25 }, (_, i) => ({ frame: 6 + i, action: 'plunger' as const, phase: 'down' as const })),
    { frame: 31, action: 'plunger', phase: 'up' },
    // Anchor deploy and release
    { frame: 250, action: 'anchor', phase: 'down' },
    { frame: 310, action: 'anchor', phase: 'down' },
    // Left Flipper strokes
    { frame: 400, action: 'flipper_left', phase: 'down' },
    { frame: 415, action: 'flipper_left', phase: 'up' }
  ];

  // 5. Replay 05: Mixed flippers, anchors, nudges
  const inputs5: InputEntry[] = [
    { frame: 5, action: 'plunger', phase: 'down' },
    ...Array.from({ length: 20 }, (_, i) => ({ frame: 6 + i, action: 'plunger' as const, phase: 'down' as const })),
    { frame: 26, action: 'plunger', phase: 'up' },
    { frame: 150, action: 'nudge_right', phase: 'down' },
    { frame: 250, action: 'anchor', phase: 'down' },
    { frame: 280, action: 'nudge_left', phase: 'down' }, // Nudging breaks anchor automatically
    { frame: 400, action: 'flipper_right', phase: 'down' },
    { frame: 415, action: 'flipper_right', phase: 'up' }
  ];

  const replaySchedules = [
    { name: 'golden_01.json', inputs: inputs1 },
    { name: 'golden_02.json', inputs: inputs2 },
    { name: 'golden_03.json', inputs: inputs3 },
    { name: 'golden_04.json', inputs: inputs4 },
    { name: 'golden_05.json', inputs: inputs5 }
  ];

  for (const schedule of replaySchedules) {
    const session = new GameSession();
    
    // Load sector chunk manager
    const chunkManager = SectorLoader.load(session.simulation, sector00);

    const inputBuffer = new InputBuffer();
    inputBuffer.setAllEntries(schedule.inputs);

    const pathHistory: Array<{ x: number; y: number }> = [];

    // Simulate step loop headlessly
    for (let frame = 0; frame < durationFrames; frame++) {
      const inputsForFrame = inputBuffer.getEntriesForFrame(frame);
      
      // Update chunk loader boundaries
      if (session.simulation.ball) {
        chunkManager.update(session.simulation.ball.getPosition().y);
      }

      session.simulation.step(inputsForFrame);

      if (session.simulation.ball) {
        const pos = session.simulation.ball.getPosition();
        pathHistory.push({ x: pos.x, y: pos.y });
      }
    }

    const expectedHash = ReplayHash.calculateSequence(pathHistory);

    const replayData = {
      seed: 12345,
      durationFrames,
      inputs: schedule.inputs,
      expectedHash
    };

    const filePath = path.join(outDir, schedule.name);
    fs.writeFileSync(filePath, JSON.stringify(replayData, null, 2), 'utf8');

    console.log(`Generated: ${schedule.name}`);
    console.log(`- Expected Hash : ${expectedHash}`);
    console.log(`- Frames        : ${durationFrames}`);

    chunkManager.destroy();
    session.destroy();
  }

  console.log('All 5 golden replays successfully generated!');
}

generateAll().catch(err => {
  console.error('Programmatic golden generation failed:', err);
  process.exit(1);
});
