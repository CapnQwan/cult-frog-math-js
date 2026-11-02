/**
 * Three-component vectors stored as `[x, y, z]`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module vec3
 */

import { EPSILON } from '../constants.js';
import { isEqualEpsilon as isEqualEpsilonScalar } from '../scalars.js';

import type { ReadonlyVec3, Vec3 } from './_types/vec3.js';

/**
 * Allocates a new vector. Omitted components default to `0`.
 *
 * Values are stored as float32, so they may be rounded
 * (`create(0.1)[0]` reads back as `0.10000000149011612`).
 *
 * @param x - The x component.
 * @param y - The y component.
 * @param z - The z component.
 * @returns A new vector with its own buffer.
 */
export function create(x: number = 0, y: number = 0, z: number = 0): Vec3 {
  const v = new Float32Array(3) as Vec3;
  v[0] = x;
  v[1] = y;
  v[2] = z;
  return v;
}

/**
 * Allocates a new vector with the same components as `a`.
 *
 * Use this to take a standalone snapshot of a pooled view: the result has its
 * own buffer and won't change when the original memory is written to.
 *
 * @param a - The vector to clone.
 * @returns A new vector with its own buffer.
 */
export function clone(a: ReadonlyVec3): Vec3 {
  return create(a[0], a[1], a[2]);
}

/**
 * Writes `x`, `y` and `z` into `out`. Values are rounded to float32.
 *
 * @param out - The vector to write to.
 * @param x - The x component.
 * @param y - The y component.
 * @param z - The z component.
 * @returns `out`.
 */
export function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * Copies the components of `a` into `out`.
 *
 * `out` and `a` may be the same vector or overlapping views of the same memory.
 *
 * @param out - The vector to write to.
 * @param a - The vector to copy from.
 * @returns `out`.
 */
export function copy(out: Vec3, a: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * Returns whether two vectors have exactly equal components.
 *
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns `true` if every component is equal.
 */
export function isEqual(a: ReadonlyVec3, b: ReadonlyVec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Returns whether two vectors are equal within a tolerance, compared
 * component by component.
 *
 * Each component goes through the scalar `isEqualEpsilon`, so the tolerance is
 * `eps` near unit scale and widens with the components' magnitude.
 *
 * @param a - The first vector.
 * @param b - The second vector.
 * @param eps - The base tolerance, before scaling. Defaults to {@link EPSILON}.
 * @returns `true` if every component is within tolerance.
 */
export function isEqualEpsilon(a: ReadonlyVec3, b: ReadonlyVec3, eps = EPSILON): boolean {
  return (
    isEqualEpsilonScalar(a[0], b[0], eps) &&
    isEqualEpsilonScalar(a[1], b[1], eps) &&
    isEqualEpsilonScalar(a[2], b[2], eps)
  );
}

/**
 * Returns whether a vector's components equal `x`, `y` and `z`.
 *
 * `x`, `y` and `z` are rounded to 32-bit floats first, as {@link set} stores
 * them, so `isEqualXYZ(v, x, y, z)` is `true` immediately after
 * `set(v, x, y, z)`.
 *
 * @param a - The vector.
 * @param x - The x component to compare.
 * @param y - The y component to compare.
 * @param z - The z component to compare.
 * @returns `true` if all components are equal.
 */
export function isEqualXYZ(a: ReadonlyVec3, x: number, y: number, z: number): boolean {
  return Math.fround(x) === a[0] && Math.fround(y) === a[1] && Math.fround(z) === a[2];
}

/**
 * Adds `a` and `b`, component by component.
 *
 * Each sum is rounded to float32 when stored, so a small step can vanish against
 * a large value: adding `1` to a component of `16777216` leaves it unchanged.
 * Keep that in mind when accumulating positions far from the origin.
 *
 * @param out - The vector to write to.
 * @param a - The vector to add to.
 * @param b - The vector to add.
 * @returns `out`.
 */
export function add(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ax + bx;
  out[1] = ay + by;
  out[2] = az + bz;
  return out;
}

/**
 * Subtracts `b` from `a`, component by component.
 *
 * The result points from `b` towards `a`, so the direction from `p` to `q` is
 * `sub(out, q, p)`.
 *
 * @param out - The vector to write to.
 * @param a - The vector to subtract from.
 * @param b - The vector to subtract.
 * @returns `out`.
 */
export function sub(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ax - bx;
  out[1] = ay - by;
  out[2] = az - bz;
  return out;
}

/**
 * Multiplies `a` by `b`, component by component.
 *
 * This is neither a dot product nor a cross product: each component only sees its
 * counterpart. It's for non-uniform factors such as per-axis scaling or colour
 * tints. For a single factor, use {@link scale}.
 *
 * @param out - The vector to write to.
 * @param a - The vector to multiply.
 * @param b - The per-component factors.
 * @returns `out`.
 */
export function mul(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ax * bx;
  out[1] = ay * by;
  out[2] = az * bz;
  return out;
}

/**
 * Divides `a` by `b`, component by component.
 *
 * Follows normal float rules with no guard against zero: a zero divisor gives
 * `Infinity` or `-Infinity` in that component, and `0 / 0` gives `NaN`. That's
 * deliberate, as a silent `0` would look like a valid result, while these show up
 * as soon as they're inspected. Check the divisor first where zero is expected.
 *
 * A quotient too large for float32 also becomes `Infinity` when stored, even with
 * a non-zero divisor.
 *
 * @param out - The vector to write to.
 * @param a - The vector to divide.
 * @param b - The per-component divisors.
 * @returns `out`.
 */
export function div(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ax / bx;
  out[1] = ay / by;
  out[2] = az / bz;
  return out;
}

/**
 * Multiplies every component of `a` by `scalar`.
 *
 * For a different factor per component, use {@link mul}.
 *
 * @param out - The vector to write to.
 * @param a - The vector to scale.
 * @param scalar - The factor applied to every component.
 * @returns `out`.
 */
export function scale(out: Vec3, a: ReadonlyVec3, scalar: number): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  out[0] = ax * scalar;
  out[1] = ay * scalar;
  out[2] = az * scalar;
  return out;
}

/**
 * `(0, 0, 0)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const ZERO = create(0, 0, 0) as ReadonlyVec3;
/**
 * `(1, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const ONE = create(1, 1, 1) as ReadonlyVec3;
/**
 * `(0, 1, 0)`: up in this package's y-up convention.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const UP = create(0, 1, 0) as ReadonlyVec3;
/**
 * `(0, -1, 0)`: down in this package's y-up convention.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const DOWN = create(0, -1, 0) as ReadonlyVec3;
/**
 * `(-1, 0, 0)`: negative x.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const LEFT = create(-1, 0, 0) as ReadonlyVec3;
/**
 * `(1, 0, 0)`: positive x.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const RIGHT = create(1, 0, 0) as ReadonlyVec3;
/**
 * `(0, 0, 1)`: positive z.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const FORWARD = create(0, 0, 1) as ReadonlyVec3;
/**
 * `(0, 0, -1)`: negative z.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const BACK = create(0, 0, -1) as ReadonlyVec3;
