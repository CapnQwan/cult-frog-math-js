/**
 * Quaternions stored as `[x, y, z, w]`, with the scalar part **last**.
 *
 * A unit quaternion encodes a rotation of `θ` about a unit axis `n` as
 * `xyz = n * sin(θ/2)`, `w = cos(θ/2)`. Nothing here enforces unit length: that
 * is the caller's responsibility, and chains of multiplications will drift.
 *
 * Because the scalar comes last, a `Quat` shares its layout with `Vec4` and with
 * a shader's `vec4<f32>`, so it uploads to the GPU untouched. The two types are
 * branded separately even so — they mean different things.
 *
 * `create` defaults the vector part to zero and the scalar to `1`, so
 * `create()` is the identity rotation. A zero `w` default would give the zero
 * quaternion, which is not a rotation at all and cannot be normalised.
 *
 * Rotations compose with `multiply`, which follows the column-vector
 * convention used by the matrices: `multiply(out, a, b)` applies `b` first,
 * then `a`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module quat
 */

import { EPSILON } from '../constants.js';
import { isEqualEpsilon as isEqualEpsilonScalar } from '../scalars.js';

import type { Quat, ReadonlyQuat } from './_types/quat.js';

/**
 * Allocates a new quaternion. Omitted vector components default to `0` and the
 * scalar `w` defaults to `1`, so `create()` is the identity rotation. Pass
 * `w = 0` explicitly for the zero quaternion, which is not a rotation and
 * cannot be normalised.
 *
 * The components are taken raw and are not normalised; passing an arbitrary
 * `x, y, z, w` gives you exactly those values, unit length or not.
 *
 * @param x - The x component of the vector part.
 * @param y - The y component of the vector part.
 * @param z - The z component of the vector part.
 * @param w - The scalar component. Defaults to `1`.
 * @returns A new quaternion with its own buffer.
 */
export function create(x: number = 0, y: number = 0, z: number = 0, w: number = 1): Quat {
  const quat = new Float32Array(4) as Quat;
  quat[0] = x;
  quat[1] = y;
  quat[2] = z;
  quat[3] = w;
  return quat;
}

/**
 * Allocates a new quaternion with the same components as `a`.
 *
 * Use this to take a standalone snapshot of a pooled view: the result has its
 * own buffer and won't change when the original memory is written to.
 *
 * @param a - The quaternion to clone.
 * @returns A new quaternion with its own buffer.
 */
export function clone(a: ReadonlyQuat): Quat {
  return create(a[0], a[1], a[2], a[3]);
}

/**
 * Writes all four components into `out`. Values are rounded to float32 and are
 * not normalised.
 *
 * Every component is overwritten, so whatever `out` held before is irrelevant.
 *
 * @param out - The quaternion to write to.
 * @param x - The x component of the vector part.
 * @param y - The y component of the vector part.
 * @param z - The z component of the vector part.
 * @param w - The scalar component.
 * @returns `out`.
 */
export function set(out: Quat, x: number, y: number, z: number, w: number): Quat {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}

/**
 * Copies the components of `a` into `out`.
 *
 * `out` and `a` may be the same quaternion, or different views that overlap the
 * same memory: every component is read into a local before anything is written,
 * so nothing can be clobbered before it has been used.
 *
 * @param out - The quaternion to write to.
 * @param a - The quaternion to copy from.
 * @returns `out`.
 */
export function copy(out: Quat, a: ReadonlyQuat): Quat {
  // biome-ignore format: keeps the format easier to read
  const x = a[0], y = a[1], z = a[2], w = a[3];

  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;

  return out;
}

/**
 * Writes the identity rotation `(0, 0, 0, 1)` into `out`, discarding its
 * previous contents.
 *
 * This is the in-place reset; it allocates nothing. To get a *new* identity
 * quaternion, use `create()`.
 *
 * @param out - The quaternion to write to.
 * @returns `out`.
 */
export function identity(out: Quat): Quat {
  return set(out, 0, 0, 0, 1);
}

/**
 * The identity rotation `(0, 0, 0, 1)`: the rotation that changes nothing.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Quat`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const IDENTITY = create(0, 0, 0, 1) as ReadonlyQuat;

/**
 * Returns whether two quaternions have exactly equal components.
 *
 * This compares the stored numbers, not the rotations they represent: `q` and
 * `-q` describe the same rotation but are not equal here.
 *
 * @param a - The first quaternion.
 * @param b - The second quaternion.
 * @returns `true` if every component is equal.
 */
export function isEqual(a: ReadonlyQuat, b: ReadonlyQuat): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/**
 * Returns whether two quaternions are equal within a tolerance, compared
 * component by component.
 *
 * Each component goes through the scalar `isEqualEpsilon`, so the tolerance is
 * `eps` near unit scale and widens with the components' magnitude.
 *
 * Like {@link isEqual}, this compares components rather than rotations, so
 * `q` and `-q` are not considered equal.
 *
 * @param a - The first quaternion.
 * @param b - The second quaternion.
 * @param eps - The base tolerance, before scaling. Defaults to {@link EPSILON}.
 * @returns `true` if every component is within tolerance.
 */
export function isEqualEpsilon(a: ReadonlyQuat, b: ReadonlyQuat, eps = EPSILON): boolean {
  return (
    isEqualEpsilonScalar(a[0], b[0], eps) &&
    isEqualEpsilonScalar(a[1], b[1], eps) &&
    isEqualEpsilonScalar(a[2], b[2], eps) &&
    isEqualEpsilonScalar(a[3], b[3], eps)
  );
}

/**
 * Returns whether a quaternion's components equal `x`, `y`, `z` and `w`.
 *
 * `x`, `y`, `z` and `w` are rounded to 32-bit floats first, as {@link set}
 * stores them, so `isEqualXYZW(q, x, y, z, w)` is `true` immediately after
 * `set(q, x, y, z, w)`.
 *
 * @param a - The quaternion.
 * @param x - The x component to compare.
 * @param y - The y component to compare.
 * @param z - The z component to compare.
 * @param w - The w component to compare.
 * @returns `true` if all components are equal.
 */
export function isEqualXYZW(a: ReadonlyQuat, x: number, y: number, z: number, w: number): boolean {
  return (
    Math.fround(x) === a[0] &&
    Math.fround(y) === a[1] &&
    Math.fround(z) === a[2] &&
    Math.fround(w) === a[3]
  );
}

/**
 * Multiplies two quaternions (the Hamilton product `a * b`) and writes the
 * result into `out`.
 *
 * For unit quaternions this composes rotations. The result applies `b`
 * first, then `a`, the same order as multiplying column-vector rotation
 * matrices. Order matters: `multiply(out, a, b)` and `multiply(out, b, a)`
 * are generally different rotations. In practice, `multiply(out, q, delta)`
 * applies `delta` in `q`'s local frame, while `multiply(out, delta, q)`
 * applies it in the world frame.
 *
 * `IDENTITY` leaves the other input unchanged on either side. The product of
 * two unit quaternions is a unit quaternion in exact arithmetic, but nothing
 * here renormalises, so float32 rounding drifts the length over long chains
 * of multiplications. Renormalise periodically.
 *
 * `out` may be the same quaternion as `a` or `b`, or a view overlapping
 * either.
 *
 * @param out - The quaternion to write to.
 * @param a - The left operand, applied second.
 * @param b - The right operand, applied first.
 * @returns `out`.
 */
export function multiply(out: Quat, a: ReadonlyQuat, b: ReadonlyQuat): Quat {
  // biome-ignore format: packed component reads
  const aX = a[0], aY = a[1], aZ = a[2], aW = a[3];
  // biome-ignore format: packed component reads
  const bX = b[0], bY = b[1], bZ = b[2], bW = b[3];
  return set(
    out,
    aW * bX + aX * bW + aY * bZ - aZ * bY,
    aW * bY - aX * bZ + aY * bW + aZ * bX,
    aW * bZ + aX * bY - aY * bX + aZ * bW,
    aW * bW - aX * bX - aY * bY - aZ * bZ
  );
}
