/**
 * Two-component vectors stored as `[x, y]`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module vec2
 */

import type { ReadonlyVec2, Vec2 } from './_types/vec2.js';

export function create(x: number = 0, y: number = 0): Vec2 {
  const v = new Float32Array(2) as Vec2;
  v[0] = x;
  v[1] = y;
  return v;
}

export function clone(a: ReadonlyVec2): Vec2 {
  return create(a[0], a[1]);
}

export function set(out: Vec2, x: number, y: number): Vec2 {
  out[0] = x;
  out[1] = y;
  return out;
}

export function copy(out: Vec2, a: ReadonlyVec2): Vec2 {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1];
  out[0] = x;
  out[1] = y;
  return out;
}
