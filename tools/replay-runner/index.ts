import { ReplayRunner } from '../../src/replay/ReplayRunner';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: npx ts-node tools/replay-runner/index.ts <path-to-file-or-dir>');
    process.exit(1);
  }

  const targetPath = path.resolve(args[0]);
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: File or directory not found at ${targetPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(targetPath);
  let filesToRun: string[] = [];

  if (stats.isDirectory()) {
    filesToRun = fs.readdirSync(targetPath)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(targetPath, f))
      .sort(); // Run in alphabetical order
  } else {
    filesToRun = [targetPath];
  }

  if (filesToRun.length === 0) {
    console.log('No JSON replay files found to verify.');
    process.exit(0);
  }

  console.log(`Running verification for ${filesToRun.length} replay file(s)...`);
  let hasFailed = false;

  for (const file of filesToRun) {
    console.log(`\n-----------------------------------------`);
    console.log(`Loading replay file: ${path.basename(file)}`);
    const content = fs.readFileSync(file, 'utf8');
    const replay = JSON.parse(content);

    console.log('Starting headless physics re-simulation...');
    const result = await ReplayRunner.run(replay);

    console.log('=== REPLAY RESULTS ===');
    console.log(`- Total Frames Simulated : ${result.framesSimulated}`);
    console.log(`- Expected Hash          : ${result.expectedHash}`);
    console.log(`- Actual Hash            : ${result.actualHash}`);

    if (result.success) {
      console.log(`✅ SUCCESS: ${path.basename(file)} is deterministic (hashes match perfectly).`);
    } else {
      console.error(`❌ FAILURE: ${path.basename(file)} simulation drift detected.`);
      hasFailed = true;
    }
  }

  console.log(`\n-----------------------------------------`);
  if (hasFailed) {
    console.error('Replay CI Verification: FAILED');
    process.exit(1);
  } else {
    console.log('Replay CI Verification: ALL PASSED');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Fatal runner execution error:', e);
  process.exit(1);
});
