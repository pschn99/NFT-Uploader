/**
 * Centralized simulation constants defining physical-to-logical conversions,
 * sizes, and limits for the PINBALLZZZ game.
 */

// 1. Coordinate Conversion
export const PIXELS_PER_METRE = 50; // 50 pixels = 1 virtual metre in physics
export const METRES_PER_PIXEL = 1.0 / PIXELS_PER_METRE;

// 2. Creator Studio Grid Settings
export const GRID_CELL_PIXELS = 32; // Logical editor grid cell size in pixels
export const GRID_CELL_METRES = GRID_CELL_PIXELS * METRES_PER_PIXEL; // 0.64 virtual metres

// 3. Ball
export const BALL_RADIUS = 0.35; // 0.35m radius per TDD §5.1

// 4. Bumper
export const BUMPER_RADIUS = 0.6; // Default bumper radius (matches BlockRegistry)

// 5. Campaign & Game Mechanics
export const CHECKPOINT_INTERVAL_METRES = 100.0; // Distance between height checkpoints
export const FALL_FLOOR_OFFSET_METRES = 10.0;     // Distance below checkpoint where Fall Floor spawns
export const FALL_FLOOR_ACTIVE_DURATION_MS = 2000; // Duration the Fall Floor remains solid (TDD §5.5)

// 6. Seeded Random Number Generator
// Multipliers for standard mulberry32 generator
export const RNG_SEED_MULTIPLIER = 0x6D2B79F5;
export const RNG_SEED_INCREMENT = 0x5DEECE66D;

// 7. Dynamic Chunking Configuration
export const CHUNK_HEIGHT_METRES = 10.0;           // Height of each dynamic world chunk
export const ACTIVE_CHUNKS_PADDING = 3;            // How many chunks to load ahead/behind player

// 8. Drain Boundary
export const DRAIN_Y_THRESHOLD = -1.5; // Ball falls below this Y to trigger drain (TDD §7.2)
