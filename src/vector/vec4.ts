/**
 * Four-component vectors stored as `[x, y, z, w]`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module vec4
 */

import { EPSILON } from '../constants.js';
import { isEqualEpsilon as isEqualEpsilonScalar } from '../scalars.js';

import type { ReadonlyVec4, Vec4 } from './_types/vec4.js';

/**
 * Allocates a new vector. Omitted components default to `0`.
 *
 * Values are stored as float32, so they may be rounded
 * (`create(0.1)[0]` reads back as `0.10000000149011612`).
 *
 * @param x - The x component.
 * @param y - The y component.
 * @param z - The z component.
 * @param w - The w component.
 * @returns A new vector with its own buffer.
 */
export function create(x: number = 0, y: number = 0, z: number = 0, w: number = 0): Vec4 {
  const v = new Float32Array(4) as Vec4;
  v[0] = x;
  v[1] = y;
  v[2] = z;
  v[3] = w;
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
export function clone(a: ReadonlyVec4): Vec4 {
  return create(a[0], a[1], a[2], a[3]);
}

/**
 * Writes `x`, `y`, `z` and `w` into `out`. Values are rounded to float32.
 *
 * @param out - The vector to write to.
 * @param x - The x component.
 * @param y - The y component.
 * @param z - The z component.
 * @param w - The w component.
 * @returns `out`.
 */
export function set(out: Vec4, x: number, y: number, z: number, w: number): Vec4 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
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
export function copy(out: Vec4, a: ReadonlyVec4): Vec4 {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}

/**
 * Returns whether two vectors have exactly equal components.
 *
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns `true` if every component is equal.
 */
export function isEqual(a: ReadonlyVec4, b: ReadonlyVec4): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
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
export function isEqualEpsilon(a: ReadonlyVec4, b: ReadonlyVec4, eps = EPSILON): boolean {
  return (
    isEqualEpsilonScalar(a[0], b[0], eps) &&
    isEqualEpsilonScalar(a[1], b[1], eps) &&
    isEqualEpsilonScalar(a[2], b[2], eps) &&
    isEqualEpsilonScalar(a[3], b[3], eps)
  );
}

/**
 * Returns whether a vector's components equal `x`, `y`, `z` and `w`.
 *
 * `x`, `y`, `z` and `w` are rounded to 32-bit floats first, as {@link set}
 * stores them, so `isEqualXYZW(v, x, y, z, w)` is `true` immediately after
 * `set(v, x, y, z, w)`.
 *
 * @param a - The vector.
 * @param x - The x component to compare.
 * @param y - The y component to compare.
 * @param z - The z component to compare.
 * @param w - The w component to compare.
 * @returns `true` if all components are equal.
 */
export function isEqualXYZW(a: ReadonlyVec4, x: number, y: number, z: number, w: number): boolean {
  return (
    Math.fround(x) === a[0] &&
    Math.fround(y) === a[1] &&
    Math.fround(z) === a[2] &&
    Math.fround(w) === a[3]
  );
}

/**
 * Adds `a` and `b`, component by component.
 *
 * Each sum is rounded to float32 when stored, so a small step can vanish against
 * a large value: adding `1` to a component of `16777216` leaves it unchanged.
 * Keep that in mind when accumulating positions far from the origin.
 *
 * `w` is added like any other component, so adding two homogeneous points gives
 * `w = 2`, not a point.
 *
 * @param out - The vector to write to.
 * @param a - The vector to add to.
 * @param b - The vector to add.
 * @returns `out`.
 */
export function add(out: Vec4, a: ReadonlyVec4, b: ReadonlyVec4): Vec4 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax + bx;
  out[1] = ay + by;
  out[2] = az + bz;
  out[3] = aw + bw;
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
export function sub(out: Vec4, a: ReadonlyVec4, b: ReadonlyVec4): Vec4 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax - bx;
  out[1] = ay - by;
  out[2] = az - bz;
  out[3] = aw - bw;
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
export function mul(out: Vec4, a: ReadonlyVec4, b: ReadonlyVec4): Vec4 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax * bx;
  out[1] = ay * by;
  out[2] = az * bz;
  out[3] = aw * bw;
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
export function div(out: Vec4, a: ReadonlyVec4, b: ReadonlyVec4): Vec4 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax / bx;
  out[1] = ay / by;
  out[2] = az / bz;
  out[3] = aw / bw;
  return out;
}

/**
 * Multiplies every component of `a` by `scalar`.
 *
 * `w` is scaled too, so scaling a homogeneous point `(x, y, z, 1)` doesn't move it:
 * the perspective divide cancels the factor back out.
 *
 * For a different factor per component, use {@link mul}.
 *
 * @param out - The vector to write to.
 * @param a - The vector to scale.
 * @param scalar - The factor applied to every component.
 * @returns `out`.
 */
export function scale(out: Vec4, a: ReadonlyVec4, scalar: number): Vec4 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  out[0] = ax * scalar;
  out[1] = ay * scalar;
  out[2] = az * scalar;
  out[3] = aw * scalar;
  return out;
}

/**
 * Returns the squared length of `a`.
 *
 * Skips the square root, so prefer it when comparing lengths:
 * `magnitudeSq(v) < limit * limit` agrees with `magnitude(v) < limit`. Remember to
 * square the other side, or use `EPSILON_SQUARED` in place of `EPSILON`.
 *
 * Calculated in float64 from the stored float32 components, so it can't overflow
 * or underflow, even at the extremes of the float32 range.
 *
 * `w` counts like any other component, so this is the true 4D result. That's
 * rarely what you want for a homogeneous point or direction stored in a `Vec4`.
 *
 * @param a - The vector to measure.
 * @returns The squared length.
 */
export function magnitudeSq(a: ReadonlyVec4): number {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  return ax * ax + ay * ay + az * az + aw * aw;
}

/**
 * Returns the length of `a`.
 *
 * Named `magnitude` because `a.length` is already taken: it's the component count,
 * always `4`, as on any typed array.
 *
 * Use {@link magnitudeSq} instead if you're only comparing lengths.
 *
 * `w` counts like any other component, so this is the true 4D result. That's
 * rarely what you want for a homogeneous point or direction stored in a `Vec4`.
 *
 * @param a - The vector to measure.
 * @returns The length.
 */
export function magnitude(a: ReadonlyVec4): number {
  return Math.sqrt(magnitudeSq(a));
}

/**
 * Returns the squared distance between `a` and `b`. The order doesn't matter.
 *
 * Skips the square root, so prefer it when comparing distances, as in range checks:
 * `distanceSq(a, b) < range * range`.
 *
 * Works on the components directly rather than calling {@link sub}, which would
 * allocate a scratch vector and round the difference to float32. Here, the
 * difference between `1e7` and `0.1` keeps its precision, and values at opposite
 * ends of the float32 range don't overflow.
 *
 * `w` counts like any other component, so this is the true 4D result. That's
 * rarely what you want for a homogeneous point or direction stored in a `Vec4`.
 *
 * @param a - The first point.
 * @param b - The second point.
 * @returns The squared distance.
 */
export function distanceSq(a: ReadonlyVec4, b: ReadonlyVec4): number {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  const dw = aw - bw;
  return dx * dx + dy * dy + dz * dz + dw * dw;
}

/**
 * Returns the distance between `a` and `b`. The order doesn't matter.
 *
 * Use {@link distanceSq} instead if you're only comparing distances.
 *
 * `w` counts like any other component, so this is the true 4D result. That's
 * rarely what you want for a homogeneous point or direction stored in a `Vec4`.
 *
 * @param a - The first point.
 * @param b - The second point.
 * @returns The distance.
 */
export function distance(a: ReadonlyVec4, b: ReadonlyVec4): number {
  return Math.sqrt(distanceSq(a, b));
}

/**
 * Writes a vector with the direction of `a` and a length of `1` into `out`.
 *
 * A zero vector gives a zero vector rather than `NaN`, because it's a normal input:
 * a player with no movement keys held, or two objects in the same spot. Only an
 * exact zero is treated this way, so very short vectors still normalize correctly.
 * To ignore tiny noise, check `magnitudeSq(a) < EPSILON_SQUARED` first.
 *
 * The result is rounded to float32, so its length is close to `1` but rarely
 * exact: normalizing `(3, 4, 0, 0)` gives a magnitude of `1.0000000238`. Compare it
 * using `isEqualEpsilon`.
 *
 * Bad input stays visible: a `NaN` component makes the whole result `NaN`, and an
 * infinite component gives `NaN` in that slot and `0` in the finite ones.
 *
 * `w` counts like any other component, so `(2, 0, 0, 1)` normalizes to about
 * `(0.894, 0, 0, 0.447)`. To normalize a direction stored in a `Vec4`, make sure
 * its `w` is `0`.
 *
 * @param out - The vector to write to.
 * @param a - The vector to normalize.
 * @returns `out`.
 */
export function normalize(out: Vec4, a: ReadonlyVec4): Vec4 {
  const mag = magnitude(a);
  return scale(out, a, mag === 0 ? 0 : 1 / mag);
}

/**
 * Returns the dot product of `a` and `b`, which measures how closely they point
 * the same way. The order doesn't matter.
 *
 * The sign holds at any length: positive means less than 90 degrees apart, `0`
 * means perpendicular and negative means more than 90 degrees apart. That makes
 * `dot(facing, toTarget) > 0` a cheap "is it in front of me?" check that needs no
 * normalizing. The value only reads as the cosine of the angle when both vectors
 * have a length of `1`: `1` is the same direction and `-1` is the opposite one.
 *
 * Clamp the result before passing it to `Math.acos`. A normalized vector's length
 * is close to `1` but rarely exact, so normalizing `(2, 3, 4, 5)` and dotting it with
 * itself gives `1.0000000728`, and `Math.acos` of anything above `1` is `NaN`.
 * Use `Math.acos(clamp(dot(a, b), -1, 1))`.
 *
 * `w` counts like any other component, so `(1, 0, 0, 1)` dotted with itself is `2`.
 * Use `Vec3` to compare 3D directions. That same `w` term is what makes plane tests
 * work: with a plane stored as `(nx, ny, nz, d)` and a point whose `w` is `1`, the
 * result is the point's signed distance from the plane.
 *
 * The result isn't rounded to float32 or limited to its range. Bad input stays
 * visible: a `NaN` component gives `NaN`, and so does an infinite component
 * multiplied by `0`.
 *
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns The dot product.
 */
export function dot(a: ReadonlyVec4, b: ReadonlyVec4): number {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  return ax * bx + ay * by + az * bz + aw * bw;
}
