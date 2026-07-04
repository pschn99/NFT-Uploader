/**
 * replay-runner/index.ts — Parallel headless replay verification tool using worker_threads.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' tools/replay-runner/index.ts <path-to-file-or-dir> [--concurrency N]
 *
 * Options:
 *   --concurrency N   Maximum number of replays verified in parallel (default: 4).
 *                     Set to 1 to run sequentially for easier debugging.
 *
 * Exit code 0 = all replays passed. Exit code 1 = any failure or fatal error.
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface RunRecord {
  file: string;
  success: boolean;
  expectedHash: string;
  actualHash: string;
  framesSimulated: number;
  durationMs: number;
  error?: string;
}

if (!isMainThread) {
  // ---------------------------------------------------------------------------
  // Worker Thread Execution (Priority 12)
  // ---------------------------------------------------------------------------
  const file = workerData.file;
  const start = Date.now();

  // Async imports so Rapier and ReplayRunner can be initialized inside the thread
  Promise.all([
    import('@dimforge/rapier2d-compat'),
    import('../../src/replay/ReplayRunner')
  ]).then(async ([RAPIER, { ReplayRunner }]) => {
    try {
      await RAPIER.default.init();
      const content = fs.readFileSync(file, 'utf8');
      const replay = JSON.parse(content);
      const result = await ReplayRunner.run(replay);

      const record: RunRecord = {
        file,
        success: result.success,
        expectedHash: result.expectedHash,
        actualHash: result.actualHash,
        framesSimulated: result.framesSimulated,
        durationMs: Date.now() - start,
      };
      parentPort?.postMessage({ success: true, record });
    } catch (err) {
      const record: RunRecord = {
        file,
        success: false,
        expectedHash: '—',
        actualHash: '—',
        framesSimulated: 0,
        durationMs: Date.now() - start,
        error: (err as Error).message,
      };
      parentPort?.postMessage({ success: false, record });
    }
  }).catch((err) => {
    const record: RunRecord = {
      file,
      success: false,
      expectedHash: '—',
      actualHash: '—',
      framesSimulated: 0,
      durationMs: Date.now() - start,
      error: 'Worker bootstrap error: ' + (err as Error).message,
    };
    parentPort?.postMessage({ success: false, record });
  });

} else {
  // ---------------------------------------------------------------------------
  // Main Thread Execution
  // ---------------------------------------------------------------------------
  const args = process.argv.slice(2);
  if (args.length < 1 || args[0].startsWith('--')) {
    console.error('Usage: ts-node tools/replay-runner/index.ts <path-to-file-or-dir> [--concurrency N]');
    process.exit(1);
  }

  const targetPath = path.resolve(args[0]);
  const concArgIdx = args.indexOf('--concurrency');
  const CONCURRENCY = concArgIdx !== -1 ? parseInt(args[concArgIdx + 1], 10) || 4 : 4;

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Path not found: ${targetPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(targetPath);
  let filesToRun: string[];

  if (stats.isDirectory()) {
    filesToRun = fs.readdirSync(targetPath)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(targetPath, f))
      .sort();
  } else {
    filesToRun = [targetPath];
  }

  if (filesToRun.length === 0) {
    console.log('No JSON replay files found to verify.');
    process.exit(0);
  }

  console.log(`\n🔁 Replay CI — ${filesToRun.length} replay(s) | concurrency: ${CONCURRENCY} (worker_threads)`);
  console.log('─'.repeat(60));

  function runOneInWorker(file: string): Promise<RunRecord> {
    return new Promise((resolve) => {
      // Spawn worker thread running the same ts file compiled by ts-node (Priority 12)
      const worker = new Worker(__filename, {
        workerData: { file },
        execArgv: /\.ts$/.test(__filename) ? ['-r', 'ts-node/register'] : [],
        env: {
          ...process.env,
          TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs"}'
        }
      });

      worker.on('message', (msg) => {
        resolve(msg.record);
      });

      worker.on('error', (err) => {
        resolve({
          file,
          success: false,
          expectedHash: '—',
          actualHash: '—',
          framesSimulated: 0,
          durationMs: 0,
          error: 'Thread crash: ' + err.message,
        });
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          resolve({
            file,
            success: false,
            expectedHash: '—',
            actualHash: '—',
            framesSimulated: 0,
            durationMs: 0,
            error: `Thread exited with code: ${code}`,
          });
        }
      });
    });
  }

  async function main() {
    const wallStart = Date.now();
    const results: RunRecord[] = [];

    // Split into batches of CONCURRENCY
    for (let i = 0; i < filesToRun.length; i += CONCURRENCY) {
      const batch = filesToRun.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(runOneInWorker));
      results.push(...batchResults);

      // Print batch progress immediately
      for (const r of batchResults) {
        const base = path.basename(r.file);
        const icon = r.success ? '✅' : '❌';
        const hash = r.success ? `hash=${r.actualHash}` : `expected=${r.expectedHash} got=${r.actualHash}`;
        const ms = `${r.durationMs}ms`;
        const err = r.error ? ` ERR: ${r.error}` : '';
        console.log(`${icon}  ${base.padEnd(28)} frames=${r.framesSimulated} ${hash} [${ms}]${err}`);
      }
    }

    const totalMs = Date.now() - wallStart;
    const passed = results.filter((r) => r.success).length;
    const failed = results.length - passed;

    console.log('─'.repeat(60));
    console.log(`Total: ${results.length} | ✅ ${passed} passed | ❌ ${failed} failed | wall-time: ${totalMs}ms`);

    if (failed > 0) {
      console.error('\nReplay CI: FAILED');
      process.exit(1);
    } else {
      console.log('\nReplay CI: ALL PASSED ✅');
      process.exit(0);
    }
  }

  main().catch((err) => {
    console.error('Fatal runner error:', err);
    process.exit(1);
  });
}
