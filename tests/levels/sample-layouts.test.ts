import fs from 'fs';
import path from 'path';
import RAPIER from '@dimforge/rapier2d-compat';
import { migrateToLatest, levelDataToSectorData } from '../../src/levels/migrate';
import { SectorLoader } from '../../src/tower/SectorLoader';
import { GameSession } from '../../src/simulation/session/GameSession';

const SAMPLE_LAYOUTS_DIR = path.resolve(__dirname, '../../sample_layouts');
const SANDBOX_DIR = path.resolve(__dirname, '../../levels/sandbox');

const SAMPLE_LAYOUT_FILES = [
  'basic_em.json',
  'classic_pinball_layout.json',
  'layout_dropbank_spinner.json',
  'layout_minimal_sandbox.json',
  'layout_orbit_loops.json',
  'layout_widebody_stress.json',
];

const SANDBOX_FILES = [
  'basic_em.json',
  'classic_pinball.json',
  'dropbank_spinner.json',
  'minimal_sandbox.json',
  'orbit_loops.json',
  'widebody_stress.json',
  'sandbox_template.json',
];

function loadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

beforeAll(async () => {
  await RAPIER.init();
});

// ---------------------------------------------------------------------------
// sample_layouts/ — migration test
// These files use a DIFFERENT format (normalized 0-1 coords or pixel coords)
// than what the game's migration pipeline expects. They are DESIGN REFERENCE
// documents, not loadable level files.
// ---------------------------------------------------------------------------
describe('sample_layouts migration', () => {
  for (const file of SAMPLE_LAYOUT_FILES) {
    const filePath = path.join(SAMPLE_LAYOUTS_DIR, file);
    if (!fs.existsSync(filePath)) continue;

    test(`${file}: migrateToLatest runs without throwing`, () => {
      const raw = loadJson(filePath);
      expect(() => migrateToLatest(raw)).not.toThrow();
    });

    test(`${file}: produces format_version 3 but MISSING essential objects`, () => {
      const raw = loadJson(filePath);
      const level = migrateToLatest(raw);

      expect(level.format_version).toBe(3);
      expect(level.sector_height_m).toBeGreaterThan(0);

      // sample_layouts are NOT in a compatible format — they use
      // normalized coordinates (0-1) or pixel coords with different
      // field names (walls[].points, flippers[].pivot, pop_bumpers, etc.)
      // The migration silently produces NaN grid positions or empty blocks.
      const hasPlunger = level.blocks.some((b) => b.type === 'plunger');
      const hasFlippers = level.blocks.some(
        (b) => b.type === 'flipper_left' || b.type === 'flipper_right'
      );
      const hasWalls = level.blocks.some((b) => b.type === 'wall');
      // For basic_em.json, the blocks array is empty (no compatible fields found),
      // so blocks.every() is vacuously true. For all others, NaN grid positions.
      if (level.blocks.length === 0) {
        expect(level.blocks).toHaveLength(0);
      } else {
        const allValidPositions = level.blocks.every(
          (b) => Number.isFinite(b.grid_x) && Number.isFinite(b.grid_y)
        );
        expect(allValidPositions).toBe(false);
      }
      // In most cases no flippers are found (different field structure)
      // but basic_em.json has objects array, not flippers/ walls/ bumpers arrays
      if (file === 'basic_em.json') {
        expect(hasPlunger).toBe(false);
        expect(hasWalls).toBe(false);
        expect(hasFlippers).toBe(false);
      }
    });

    test(`${file}: levelDataToSectorData produces NaN coordinates`, () => {
      const raw = loadJson(filePath);
      const level = migrateToLatest(raw);
      const sector = levelDataToSectorData(level);

      // Walls, flippers, bumpers all get NaN x/y because the
      // sample_layout coordinate system is incompatible
      for (const wall of sector.walls) {
        expect(Number.isFinite(wall.x)).toBe(false);
      }
      for (const flipper of sector.flippers) {
        expect(Number.isFinite(flipper.x)).toBe(false);
      }
      if (sector.bumpers && sector.bumpers.length > 0) {
        for (const bumper of sector.bumpers) {
          expect(Number.isFinite(bumper.x)).toBe(false);
        }
      }
      // Plunger is always undefined (no compatible plunger field)
      expect(sector.plunger).toBeUndefined();
    });
  }
});

// ---------------------------------------------------------------------------
// levels/sandbox/ — full load + simulation test
// These are the equivalent playable levels in proper Format v3.
// ---------------------------------------------------------------------------
describe('sandbox levels load into simulation and are playable', () => {
  for (const file of SANDBOX_FILES) {
    const filePath = path.join(SANDBOX_DIR, file);
    if (!fs.existsSync(filePath)) continue;

    test(`${file}: SectorLoader.load() succeeds`, () => {
      const session = new GameSession();
      const raw = loadJson(filePath);

      expect(() => {
        const chunkManager = SectorLoader.load(session.simulation, raw);
        expect(chunkManager).toBeDefined();
        session.destroy();
      }).not.toThrow();
    });

    test(`${file}: spawns ball, flippers, and physics steps without error`, () => {
      const session = new GameSession();
      const raw = loadJson(filePath);

      SectorLoader.load(session.simulation, raw);

      // Ball must be set
      expect(session.simulation.ball).toBeDefined();
      const ballPos = session.simulation.ball.getPosition();
      expect(Number.isFinite(ballPos.x)).toBe(true);
      expect(Number.isFinite(ballPos.y)).toBe(true);

      // At least one flipper must exist
      expect(session.simulation.flippers.length).toBeGreaterThan(0);

      // Physics steps run without throwing for 5 seconds (300 frames)
      expect(() => {
        for (let i = 0; i < 300; i++) {
          session.simulation.step([]);
        }
      }).not.toThrow();

      session.destroy();
    });

    test(`${file}: ball responds to gravity (falls downward)`, () => {
      const session = new GameSession();
      const raw = loadJson(filePath);

      SectorLoader.load(session.simulation, raw);

      const initialY = session.simulation.ball.getPosition().y;

      for (let i = 0; i < 10; i++) {
        session.simulation.step([]);
      }

      const finalY = session.simulation.ball.getPosition().y;
      // Ball must have fallen (y increases upward in the physics coordinate system)
      expect(finalY).toBeLessThan(initialY);

      session.destroy();
    });

    test(`${file}: flippers respond to input`, () => {
      const session = new GameSession();
      const raw = loadJson(filePath);

      SectorLoader.load(session.simulation, raw);

      const leftFlipper = session.simulation.flippers.find(
        (f) => f.side === 'left'
      );
      expect(leftFlipper).toBeDefined();
      const initialRotation = leftFlipper!.getRotation();

      // Actuate left flipper
      session.simulation.step([{ action: 'flipper_left', phase: 'down' }]);
      for (let i = 0; i < 15; i++) {
        session.simulation.step([]);
      }

      const actuatedRotation = leftFlipper!.getRotation();
      // Flipper should have moved (rotation changed)
      expect(actuatedRotation).not.toBeCloseTo(initialRotation, 1);

      session.destroy();
    });
  }
});
