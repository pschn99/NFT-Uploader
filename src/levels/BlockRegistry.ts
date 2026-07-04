/**
 * BlockRegistry — neutral layer (src/levels/) with no Phaser imports.
 *
 * Maps block type keys to their physics descriptor parameters and editor
 * metadata. `SectorLoader`, `AbyssGenerator`, and `CreatorGrid` all read
 * from this registry.
 *
 * Rendering assets (Phaser sprite keys, tint values) are mapped separately
 * in the renderer layer and intentionally absent here.
 */

import type { BlockType } from './LevelData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The category of a block affects how it is treated by game systems. */
export type BlockCategory =
  | 'static'       // Immovable collider (wall, boundary)
  | 'flipper'      // Dynamic revolute-jointed paddle
  | 'bumper'       // Impulse-on-contact circular collider
  | 'trigger'      // Sensor — no direct physics collision response
  | 'mechanism';   // Active device (plunger, launcher)

/**
 * Collider shape descriptor used by Rapier body construction.
 * Mirrors Rapier shape types without importing Rapier directly so this
 * module stays pure and can be used in headless test environments.
 */
export type ColliderShapeDesc =
  | { shape: 'cuboid';   hx: number; hy: number }
  | { shape: 'ball';     radius: number }
  | { shape: 'sensor';   radius: number };   // Trigger / checkpoint / exit

/**
 * Full descriptor for a registered block type.
 */
export interface BlockDescriptor {
  type: BlockType;
  category: BlockCategory;
  /** Default collider shape. Blocks with `params.radius` override the radius at spawn time. */
  defaultCollider: ColliderShapeDesc;
  /**
   * Snap angles in radians available to this block in the Creator grid editor.
   * Index into this array = `BlockEntry.rotation_index`.
   * Empty array means no rotation is allowed.
   */
  snapAngles: number[];
  /** Human-readable label for the Creator Studio palette. */
  label: string;
}

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

// Flipper snap angles (radians) shared with migration and render systems (Priority 18)
export const FLIPPER_SNAP_ANGLES_RAD = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, -Math.PI / 6];

const HALF_CELL = 0.32;  // Half of GRID_CELL_METRES (0.64 m / 2)

const REGISTRY: Record<BlockType, BlockDescriptor> = {
  wall: {
    type: 'wall',
    category: 'static',
    defaultCollider: { shape: 'cuboid', hx: HALF_CELL, hy: HALF_CELL },
    snapAngles: [],
    label: 'Wall',
  },
  flipper_left: {
    type: 'flipper_left',
    category: 'flipper',
    defaultCollider: { shape: 'cuboid', hx: 0.8, hy: 0.1 },
    snapAngles: FLIPPER_SNAP_ANGLES_RAD,
    label: 'Flipper (Left)',
  },
  flipper_right: {
    type: 'flipper_right',
    category: 'flipper',
    defaultCollider: { shape: 'cuboid', hx: 0.8, hy: 0.1 },
    snapAngles: FLIPPER_SNAP_ANGLES_RAD,
    label: 'Flipper (Right)',
  },
  bumper_standard: {
    type: 'bumper_standard',
    category: 'bumper',
    defaultCollider: { shape: 'ball', radius: 0.6 },
    snapAngles: [],
    label: 'Bumper',
  },
  plunger: {
    type: 'plunger',
    category: 'mechanism',
    defaultCollider: { shape: 'cuboid', hx: 0.2, hy: 0.6 },
    snapAngles: [],
    label: 'Plunger',
  },
  checkpoint: {
    type: 'checkpoint',
    category: 'trigger',
    defaultCollider: { shape: 'sensor', radius: 1.5 },
    snapAngles: [],
    label: 'Checkpoint',
  },
  exit: {
    type: 'exit',
    category: 'trigger',
    defaultCollider: { shape: 'sensor', radius: 2.0 },
    snapAngles: [],
    label: 'Exit / Goal',
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the descriptor for a given block type.
 * Throws if the type is not registered — this indicates a programming error
 * (e.g. a new BlockType added to LevelData.ts without a registry entry).
 */
export function getBlockDescriptor(type: BlockType): BlockDescriptor {
  const desc = REGISTRY[type];
  if (!desc) {
    throw new Error(`BlockRegistry: unknown block type "${type as string}"`);
  }
  return desc;
}

/**
 * Returns all registered block descriptors, ordered for Creator palette display.
 */
export function getAllBlockDescriptors(): BlockDescriptor[] {
  const order: BlockType[] = [
    'wall',
    'flipper_left',
    'flipper_right',
    'bumper_standard',
    'plunger',
    'checkpoint',
    'exit',
  ];
  return order.map((t) => REGISTRY[t]);
}

/**
 * Returns `true` if the given string is a registered block type.
 */
export function isValidBlockType(type: string): type is BlockType {
  return type in REGISTRY;
}

/** All registered block type keys. */
export const ALL_BLOCK_TYPES: readonly BlockType[] = Object.keys(REGISTRY) as BlockType[];
