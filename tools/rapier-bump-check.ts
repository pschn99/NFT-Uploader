import RAPIER from '@dimforge/rapier2d-compat';
import { ReplayRunner } from '../src/replay/ReplayRunner';
import * as fs from 'fs';
import * as path from 'path';

async function runCheck() {
  console.log('Starting Rapier Bump Verification...');
  
  // Ensure engine can load WASM asynchronously
  await RAPIER.init();
  
  // 1. Create test simulation components
  const gravity = { x: 0.0, y: -9.81 };
  const world = new RAPIER.World(gravity);
  
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0.0, 10.0);
  const body = world.createRigidBody(bodyDesc);
  
  const colliderDesc = RAPIER.ColliderDesc.ball(0.5);
  world.createCollider(colliderDesc, body);
  
  // Verify basic simulation step
  world.step();
  
  const finalY = body.translation().y;
  console.log(`Verification: Gravity step complete. Body Y = ${finalY.toFixed(4)} m`);
  
  if (finalY < 10.0) {
    console.log('Rapier basic simulation verification: PASS');
  } else {
    throw new Error('Verification failed: rigid body did not fall under gravity.');
  }

  // 2. Headlessly re-simulate all golden replays to verify no regression (Priority 7)
  const replaysDir = path.resolve(__dirname, '../tests/replays');
  if (fs.existsSync(replaysDir)) {
    const files = fs.readdirSync(replaysDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(replaysDir, f))
      .sort();

    console.log(`Verifying all ${files.length} golden replays for regression...`);
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const result = await ReplayRunner.run(data);
      if (!result.success) {
        throw new Error(`Regression detected on ${path.basename(file)}! Actual hash (${result.actualHash}) did not match expected (${result.expectedHash})`);
      }
      console.log(`✅ Golden replay ${path.basename(file)} verification: PASS`);
    }
  } else {
    console.log('Warning: No golden replays found in tests/replays/ yet.');
  }
  
  console.log('Rapier version check completed successfully!');
}

runCheck().catch((err) => {
  console.error('Rapier version check failed:', err);
  process.exit(1);
});
