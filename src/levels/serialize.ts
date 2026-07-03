/**
 * Level serialization — Format v3.
 *
 * `serializeLevel` produces canonical JSON suitable for hashing and storage.
 * `deserializeLevel` parses and validates the top-level shape before returning.
 *
 * Neither function performs version migration — call `migrateToLatest()` from
 * `migrate.ts` on untrusted input before calling `deserializeLevel`.
 */

import type { LevelData } from './LevelData';

// ---------------------------------------------------------------------------
// Canonical JSON key order for deterministic hashing
// ---------------------------------------------------------------------------

/**
 * Replacer used by JSON.stringify to produce a stable key order and sort
 * the blocks array by (type, grid_x, grid_y) for hash determinism.
 */
function canonicalReplacer(_key: string, value: unknown): unknown {
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'type' in value[0]) {
    // Sort blocks array for stable hashing
    return [...(value as { type: string; grid_x: number; grid_y: number }[])].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (a.grid_x !== b.grid_x) return a.grid_x - b.grid_x;
      return a.grid_y - b.grid_y;
    });
  }
  return value;
}

/**
 * Serializes a `LevelData` object to a formatted JSON string.
 * The `playability_check` stamp is included if present.
 * For canonical hashing (excluding the stamp), use `serializeCanonical`.
 */
export function serializeLevel(data: LevelData): string {
  return JSON.stringify(data, canonicalReplacer, 2);
}

/**
 * Serializes a `LevelData` to canonical JSON for hash computation.
 * The `playability_check` field is intentionally excluded so that
 * re-stamping the same level produces the same `level_hash`.
 */
export function serializeCanonical(data: LevelData): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { playability_check: _stamp, ...rest } = data;
  return JSON.stringify(rest, canonicalReplacer);
}

/**
 * Parses a JSON string and validates the top-level `format_version` field.
 * Throws if the string is not valid JSON or is missing required fields.
 *
 * **Does not migrate** — call `migrateToLatest()` first on untrusted input.
 */
export function deserializeLevel(raw: string): LevelData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`deserializeLevel: invalid JSON — ${(err as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('deserializeLevel: expected a JSON object at root');
  }

  const obj = parsed as Record<string, unknown>;

  if (obj['format_version'] !== 3) {
    throw new Error(
      `deserializeLevel: expected format_version 3, got ${JSON.stringify(obj['format_version'])}. Call migrateToLatest() first.`
    );
  }

  if (!Array.isArray(obj['blocks'])) {
    throw new Error('deserializeLevel: missing required "blocks" array');
  }

  if (typeof obj['sector_height_m'] !== 'number') {
    throw new Error('deserializeLevel: missing required "sector_height_m" number');
  }

  return parsed as LevelData;
}
