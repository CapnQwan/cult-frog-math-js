/**
 * Four-component vectors stored as `[x, y, z, w]`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module vec4
 */

import type { ReadonlyVec4, Vec4 } from './_types/vec4.js';

export function create(x: number = 0, y: number = 0, z: number = 0, w: number = 0): Vec4 {
  const v = new Float32Array(4) as Vec4;
  v[0] = x;
  v[1] = y;
  v[2] = z;
  v[3] = w;
  return v;
}

export function clone(a: ReadonlyVec4): Vec4 {
  return create(a[0], a[1], a[2], a[3]);
}

export function set(out: Vec4, x: number, y: number, z: number, w: number): Vec4 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}

export function copy(out: Vec4, a: ReadonlyVec4): Vec4 {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}
