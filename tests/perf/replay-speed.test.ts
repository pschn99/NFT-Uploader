import RAPIER from '@dimforge/rapier2d-compat';
import { ReplayRunner } from '../../src/replay/ReplayRunner';
import * as fs from 'fs';
import * as path from 'path';

describe('Performance Smoke: Replay Resimulation Speed Check', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  test('asserts that 1800 frame (30 seconds) headless simulation executes in < 10 seconds', async () => {
    const replayPath = path.resolve(__dirname, '../replays/golden_01.json');
    expect(fs.existsSync(replayPath)).toBe(true);

    const replayData = JSON.parse(fs.readFileSync(replayPath, 'utf8'));

    const start = performance.now();
    const result = await ReplayRunner.run(replayData);
    const durationMs = performance.now() - start;

    expect(result.success).toBe(true);
    expect(result.framesSimulated).toBe(1800);
    
    // Performance assertion: re-simulation resolves under 10,000 milliseconds
    console.log(`Perf Speed: Headless re-simulation took ${durationMs.toFixed(2)} ms for 1800 frames`);
    expect(durationMs).toBeLessThan(10000);
  });
});
