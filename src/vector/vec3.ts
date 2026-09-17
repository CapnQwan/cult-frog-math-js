/**
 * Three-component vectors stored as `[x, y, z]`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module vec3
 */

import type { ReadonlyVec3, Vec3 } from './_types/vec3.js';

export function create(x: number = 0, y: number = 0, z: number = 0): Vec3 {
  const v = new Float32Array(3) as Vec3;
  v[0] = x;
  v[1] = y;
  v[2] = z;
  return v;
}

export function clone(a: ReadonlyVec3): Vec3 {
  return create(a[0], a[1], a[2]);
}

export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function copy(out: Vec3, a: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export const ZERO = create(0, 0, 0) as ReadonlyVec3;
export const ONE = create(1, 1, 1) as ReadonlyVec3;
export const UP = create(0, 1, 0) as ReadonlyVec3;
export const DOWN = create(0, -1, 0) as ReadonlyVec3;
export const LEFT = create(-1, 0, 0) as ReadonlyVec3;
export const RIGHT = create(1, 0, 0) as ReadonlyVec3;
export const FORWARD = create(0, 0, 1) as ReadonlyVec3;
export const BACK = create(0, 0, -1) as ReadonlyVec3;
