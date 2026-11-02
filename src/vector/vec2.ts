/**
 * Two-component vectors stored as `[x, y]`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module vec2
 */

import { EPSILON } from '../constants.js';
import { isEqualEpsilon as isEqualEpsilonScalar } from '../scalars.js';

import type { ReadonlyVec2, Vec2 } from './_types/vec2.js';

/**
 * Allocates a new vector. Omitted components default to `0`.
 *
 * Values are stored as float32, so they may be rounded
 * (`create(0.1)[0]` reads back as `0.10000000149011612`).
 *
 * @param x - The x component.
 * @param y - The y component.
 * @returns A new vector with its own buffer.
 */
export function create(x: number = 0, y: number = 0): Vec2 {
  const v = new Float32Array(2) as Vec2;
  v[0] = x;
  v[1] = y;
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
export function clone(a: ReadonlyVec2): Vec2 {
  return create(a[0], a[1]);
}

/**
 * Writes `x` and `y` into `out`. Values are rounded to float32.
 *
 * @param out - The vector to write to.
 * @param x - The x component.
 * @param y - The y component.
 * @returns `out`.
 */
export function set(out: Vec2, x: number, y: number): Vec2 {
  out[0] = x;
  out[1] = y;
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
export function copy(out: Vec2, a: ReadonlyVec2): Vec2 {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1];
  out[0] = x;
  out[1] = y;
  return out;
}

/**
 * Returns whether two vectors have exactly equal components.
 *
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns `true` if every component is equal.
 */
export function isEqual(a: ReadonlyVec2, b: ReadonlyVec2): boolean {
  return a[0] === b[0] && a[1] === b[1];
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
export function isEqualEpsilon(a: ReadonlyVec2, b: ReadonlyVec2, eps = EPSILON): boolean {
  return isEqualEpsilonScalar(a[0], b[0], eps) && isEqualEpsilonScalar(a[1], b[1], eps);
}

/**
 * Returns whether a vector's components equal `x` and `y`.
 *
 * `x` and `y` are rounded to 32-bit floats first, as {@link set} stores them, so
 * `isEqualXY(v, x, y)` is `true` immediately after `set(v, x, y)`.
 *
 * @param a - The vector.
 * @param x - The x component to compare.
 * @param y - The y component to compare.
 * @returns `true` if both components are equal.
 */
export function isEqualXY(a: ReadonlyVec2, x: number, y: number): boolean {
  return Math.fround(x) === a[0] && Math.fround(y) === a[1];
}

/**
 * `(0, 0)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec2`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const ZERO = create(0, 0) as ReadonlyVec2;
/**
 * `(1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec2`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const ONE = create(1, 1) as ReadonlyVec2;
/**
 * `(0, 1)`: up in this package's y-up convention. In screen space, where y
 * grows downward, this points down.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec2`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const UP = create(0, 1) as ReadonlyVec2;
/**
 * `(0, -1)`: down in this package's y-up convention. In screen space, where y
 * grows downward, this points up.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec2`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const DOWN = create(0, -1) as ReadonlyVec2;
/**
 * `(-1, 0)`: negative x.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec2`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const LEFT = create(-1, 0) as ReadonlyVec2;
/**
 * `(1, 0)`: positive x.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec2`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const RIGHT = create(1, 0) as ReadonlyVec2;
