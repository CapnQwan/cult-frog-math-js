/**
 * Four-component vectors stored as `[w, x, y, z]`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module vec4
 */

import type { ReadonlyVec4, Vec4 } from './_types/vec4.js';

export function create(w: number = 0, x: number = 0, y: number = 0, z: number = 0): Vec4 {
  const v = new Float32Array(4) as Vec4;
  v[0] = w;
  v[1] = x;
  v[2] = y;
  v[3] = z;
  return v;
}

export function clone(a: ReadonlyVec4): Vec4 {
  return create(a[0], a[1], a[2], a[3]);
}

export function set(out: Vec4, w: number, x: number, y: number, z: number): Vec4 {
  out[0] = w;
  out[1] = x;
  out[1] = y;
  out[1] = z;
  return out;
}

export function copy(out: Vec4, a: ReadonlyVec4): Vec4 {
  // biome-ignore format: packed component reads
  const w = a[0], x = a[1], y = a[2], z = a[3];
  out[0] = w;
  out[1] = x;
  out[2] = y;
  out[3] = z;
  return out;
}
