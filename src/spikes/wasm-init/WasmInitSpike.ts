import RAPIER from '@dimforge/rapier2d-compat';

async function runBenchmark() {
  console.log('WASM Load Benchmark started...');
  const start = performance.now();
  
  // Call Rapier async WASM initialization
  await RAPIER.init();
  
  const duration = performance.now() - start;
  console.log(`Rapier WASM loaded successfully in ${duration.toFixed(2)} ms`);
  
  const targetMs = 200;
  if (duration < targetMs) {
    console.log(`Verdict: SUCCESS (latency is under the ${targetMs}ms target limit)`);
  } else {
    console.log(`Verdict: WARNING (latency exceeds the ${targetMs}ms target limit)`);
  }
}

runBenchmark().catch((err) => {
  console.error('WASM Load failed:', err);
});
