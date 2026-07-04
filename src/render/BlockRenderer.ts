/**
 * BlockRenderer — shared vector-graphics drawing for all block types.
 *
 * This module is the single source of truth for how each block type looks.
 * It is called by:
 *   - `CreatorGrid`   (editor, ppm = GRID_CELL_PX / GRID_CELL_METRES = 50)
 *   - `BlockPalette`  (editor mini-swatches, smaller ppm for thumbnail scale)
 *
 * Scale parity note:
 *   GRID_CELL_PX / GRID_CELL_METRES = 32 / 0.64 = 50.0 = PIXELS_PER_METRE
 *   The editor and game share the same physical scale — no coordinate conversion
 *   is needed between contexts. The caller passes the correct ppm and the
 *   correct screen-space cx/cy for the block's grid-cell centre.
 *
 * Y-axis convention:
 *   Both callers hand in Phaser-space coordinates (Y increases downward).
 *   This module never flips Y internally.
 *
 * Dependency direction: render/ → levels/ (BlockType only). No simulation
 * imports; no Phaser Scene ownership.
 */

import Phaser from 'phaser';
import type { BlockType } from '../levels/LevelData';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface DrawBlockOptions {
  /** Phaser Graphics object to draw into. Caller manages clear/lifecycle. */
  gfx: Phaser.GameObjects.Graphics;
  /** Block type key — determines shape, size, colours. */
  type: BlockType;
  /** Centre of the block's grid cell in screen pixels (Phaser Y-down space). */
  cx: number;
  cy: number;
  /**
   * Pixels per physical metre.
   * Pass `GRID_CELL_PX / GRID_CELL_METRES` (= 50) for editor grid.
   * Pass a smaller value (e.g. 12) for palette thumbnail swatches.
   */
  ppm: number;
  /**
   * Rotation in radians taken from BlockRegistry.snapAngles[rotation_index].
   * 0 = no rotation. Positive = counter-clockwise in Rapier / clockwise in Phaser.
   */
  rotation: number;
  /** Drawing context — 'editor' gets a slightly higher alpha. */
  context: 'editor' | 'game' | 'palette';
  /** Optional radius override for parameterised bumpers (from BlockEntry.params). */
  radiusOverride?: number;
}

// ---------------------------------------------------------------------------
// Colour / style constants
// ---------------------------------------------------------------------------

const WALL_FILL        = 0x2a2a2a;
const WALL_STROKE      = 0xffffff;
const FLIPPER_FILL     = 0xcccccc;
const FLIPPER_STROKE   = 0xffffff;
const BUMPER_FILL      = 0x222222;
const BUMPER_STROKE    = 0xffffff;
const PLUNGER_FILL     = 0x555555;
const PLUNGER_STROKE   = 0x888888;
const CHECKPOINT_STROKE = 0x00ffaa;
const EXIT_STROKE      = 0xffaa00;

// Physical sizes in metres (must match Flipper.ts / Bumper.ts / BlockRegistry)
const WALL_M      = 0.64;   // 1 grid cell = GRID_CELL_METRES
const FLIPPER_L   = 1.6;    // Flipper length (Flipper.ts: length = 1.6)
const FLIPPER_T   = 0.25;   // Flipper thickness (Flipper.ts: thickness = 0.25)
const BUMPER_R    = 0.6;    // Default bumper radius (Bumper.ts / BlockRegistry)
const PLUNGER_W   = 0.4;
const PLUNGER_H   = 1.2;
const CHECKPOINT_R = 1.5;
const EXIT_R      = 2.0;

// ---------------------------------------------------------------------------
// Main draw function
// ---------------------------------------------------------------------------

/**
 * Draws a single block at the given screen-space centre using the supplied
 * Phaser Graphics object. Does not clear or manage the Graphics lifecycle.
 */
export function drawBlock(opts: DrawBlockOptions): void {
  const { gfx, type, cx, cy, ppm, rotation, context, radiusOverride } = opts;
  const alpha = context === 'palette' ? 0.9 : 0.9;

  switch (type) {
    case 'wall':
      drawWall(gfx, cx, cy, ppm, alpha);
      break;
    case 'flipper_left':
      drawFlipper(gfx, cx, cy, ppm, 'left', rotation, alpha);
      break;
    case 'flipper_right':
      drawFlipper(gfx, cx, cy, ppm, 'right', rotation, alpha);
      break;
    case 'bumper_standard':
      drawBumper(gfx, cx, cy, ppm, radiusOverride ?? BUMPER_R, alpha);
      break;
    case 'plunger':
      drawPlunger(gfx, cx, cy, ppm, alpha);
      break;
    case 'checkpoint':
      drawCheckpoint(gfx, cx, cy, ppm, alpha);
      break;
    case 'exit':
      drawExit(gfx, cx, cy, ppm, alpha);
      break;
  }
}

// ---------------------------------------------------------------------------
// Per-type drawing helpers
// ---------------------------------------------------------------------------

/** Wall: filled square, one grid cell (0.64 m × 0.64 m). */
function drawWall(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  ppm: number,
  alpha: number,
): void {
  const half = (WALL_M / 2) * ppm;
  gfx.fillStyle(WALL_FILL, alpha);
  gfx.fillRect(cx - half, cy - half, half * 2, half * 2);
  gfx.lineStyle(1.5, WALL_STROKE, alpha);
  gfx.strokeRect(cx - half, cy - half, half * 2, half * 2);
}

/**
 * Flipper: rotated rectangle.
 *
 * The paddle pivot is at the side of the block's grid-cell centre:
 *   - left  flipper: pivot at cx, body extends rightward  (+X in local space)
 *   - right flipper: pivot at cx, body extends leftward   (−X in local space)
 *
 * After computing the unrotated rect corners relative to the pivot, we apply
 * the 2D rotation matrix and draw as a polygon.
 */
function drawFlipper(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  ppm: number,
  side: 'left' | 'right',
  rotation: number,
  alpha: number,
): void {
  const lenPx   = FLIPPER_L * ppm;
  const thickPx = FLIPPER_T * ppm;

  // Unrotated corners relative to pivot (cx, cy):
  //   left  flipper: extends from pivot rightward (+x direction)
  //   right flipper: extends from pivot leftward  (−x direction)
  const xSign = side === 'left' ? 1 : -1;

  const corners: [number, number][] = [
    [0,              -thickPx / 2],
    [xSign * lenPx,  -thickPx / 2],
    [xSign * lenPx,   thickPx / 2],
    [0,               thickPx / 2],
  ];

  // Phaser Y-down: clockwise rotation is positive.
  // Rapier Y-up: counter-clockwise is positive.
  // BlockRegistry.snapAngles are Rapier convention.
  // We negate rotation to convert to Phaser screen space.
  const cosR = Math.cos(-rotation);
  const sinR = Math.sin(-rotation);

  const rotated = corners.map(([lx, ly]): [number, number] => [
    cx + lx * cosR - ly * sinR,
    cy + lx * sinR + ly * cosR,
  ]);

  gfx.fillStyle(FLIPPER_FILL, alpha);
  gfx.beginPath();
  gfx.moveTo(rotated[0][0], rotated[0][1]);
  for (let i = 1; i < rotated.length; i++) {
    gfx.lineTo(rotated[i][0], rotated[i][1]);
  }
  gfx.closePath();
  gfx.fillPath();

  gfx.lineStyle(1.5, FLIPPER_STROKE, alpha);
  gfx.beginPath();
  gfx.moveTo(rotated[0][0], rotated[0][1]);
  for (let i = 1; i < rotated.length; i++) {
    gfx.lineTo(rotated[i][0], rotated[i][1]);
  }
  gfx.closePath();
  gfx.strokePath();

  // Pivot dot
  gfx.fillStyle(FLIPPER_STROKE, 1.0);
  gfx.fillCircle(cx, cy, Math.max(2, ppm * 0.06));
}

/** Bumper: filled circle with white outline. */
function drawBumper(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  ppm: number,
  radius: number,
  alpha: number,
): void {
  const rPx = radius * ppm;
  gfx.fillStyle(BUMPER_FILL, alpha);
  gfx.fillCircle(cx, cy, rPx);
  gfx.lineStyle(2, BUMPER_STROKE, alpha);
  gfx.strokeCircle(cx, cy, rPx);
}

/** Plunger: narrow rectangle (0.4 m wide × 1.2 m tall). */
function drawPlunger(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  ppm: number,
  alpha: number,
): void {
  const wPx = PLUNGER_W * ppm;
  const hPx = PLUNGER_H * ppm;
  gfx.fillStyle(PLUNGER_FILL, alpha);
  gfx.fillRect(cx - wPx / 2, cy - hPx / 2, wPx, hPx);
  gfx.lineStyle(1.5, PLUNGER_STROKE, alpha);
  gfx.strokeRect(cx - wPx / 2, cy - hPx / 2, wPx, hPx);
}

/**
 * Checkpoint: hollow dashed circle (approximated with arc segments).
 * No fill — clearly a sensor trigger, not a physics shape.
 */
function drawCheckpoint(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  ppm: number,
  alpha: number,
): void {
  const rPx = CHECKPOINT_R * ppm;
  gfx.lineStyle(1.5, CHECKPOINT_STROKE, alpha);
  drawDashedCircle(gfx, cx, cy, rPx, 12);

  // Cross-hair lines
  const arm = rPx * 0.35;
  gfx.lineStyle(1, CHECKPOINT_STROKE, alpha * 0.6);
  gfx.lineBetween(cx - arm, cy, cx + arm, cy);
  gfx.lineBetween(cx, cy - arm, cx, cy + arm);
}

/**
 * Exit / Goal: hollow circle + upward arrow, coloured orange.
 */
function drawExit(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  ppm: number,
  alpha: number,
): void {
  const rPx = EXIT_R * ppm;
  gfx.lineStyle(2, EXIT_STROKE, alpha);
  gfx.strokeCircle(cx, cy, rPx);

  // Upward arrow inside
  const arrowH  = rPx * 0.55;
  const arrowW  = rPx * 0.35;
  const tipY    = cy - arrowH;
  gfx.lineStyle(2, EXIT_STROKE, alpha);
  gfx.lineBetween(cx, tipY, cx, cy + arrowH * 0.4);          // shaft
  gfx.lineBetween(cx, tipY, cx - arrowW * 0.5, tipY + arrowW * 0.6);  // left barb
  gfx.lineBetween(cx, tipY, cx + arrowW * 0.5, tipY + arrowW * 0.6);  // right barb
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Approximates a dashed circle by drawing `segments` short arcs.
 * Works around the lack of native dashed-stroke support in Phaser Graphics.
 */
function drawDashedCircle(
  gfx: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  radius: number,
  segments: number,
): void {
  const step = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i += 2) {
    const a1 = i * step;
    const a2 = a1 + step * 0.7;  // draw 70% of each segment gap
    const x1 = cx + Math.cos(a1) * radius;
    const y1 = cy + Math.sin(a1) * radius;
    const x2 = cx + Math.cos(a2) * radius;
    const y2 = cy + Math.sin(a2) * radius;
    gfx.lineBetween(x1, y1, x2, y2);
  }
}
