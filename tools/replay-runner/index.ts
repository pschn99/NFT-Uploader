import { ReplayRunner } from '../../src/replay/ReplayRunner';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: npx ts-node tools/replay-runner/index.ts <path-to-replay.json>');
    process.exit(1);
  }

  const file = path.resolve(args[0]);
  if (!fs.existsSync(file)) {
    console.error(`Error: File not found at ${file}`);
    process.exit(1);
  }

  console.log(`Loading replay file: ${file}`);
  const content = fs.readFileSync(file, 'utf8');
  const replay = JSON.parse(content);

  console.log('Starting headless physics re-simulation...');
  const result = await ReplayRunner.run(replay);

  console.log('\n=== REPLAY RESULTS ===');
  console.log(`- Total Frames Simulated : ${result.framesSimulated}`);
  console.log(`- Expected Hash          : ${result.expectedHash}`);
  console.log(`- Actual Hash            : ${result.actualHash}`);

  if (result.success) {
    console.log('✅ SUCCESS: Replay is deterministic (hashes match perfectly).');
    process.exit(0);
  } else {
    console.error('❌ FAILURE: Simulation drift detected (hashes do not match).');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal runner execution error:', e);
  process.exit(1);
});
