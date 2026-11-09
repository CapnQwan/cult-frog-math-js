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
 * quaternion, which is not a rotation at all and has no direction to normalise
 * towards (`normalize` falls back to the identity for it).
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

import type { ReadonlyVec3 } from '../vector/index.js';
import type { Quat, ReadonlyQuat } from './_types/quat.js';

/** The number of elements in a `Quat`. */
export const SIZE = 4;

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
  const quat = new Float32Array(SIZE) as Quat;
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
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
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

  out[0] = aW * bX + aX * bW + aY * bZ - aZ * bY;
  out[1] = aW * bY - aX * bZ + aY * bW + aZ * bX;
  out[2] = aW * bZ + aX * bY - aY * bX + aZ * bW;
  out[3] = aW * bW - aX * bX - aY * bY - aZ * bZ;
  return out;
}

/**
 * Returns the squared length of `a`, treating all four components as one
 * 4D vector.
 *
 * A unit quaternion, which is the only kind that represents a rotation, has a
 * squared length of `1`. That makes this the cheap way to check for drift
 * after a chain of `multiply` calls: compare it against `1` with
 * `isEqualEpsilon` rather than taking the square root.
 *
 * Calculated in float64 from the stored float32 components, so it can't
 * overflow or underflow, even at the extremes of the float32 range.
 *
 * @param a - The quaternion to measure.
 * @returns The squared length.
 */
export function magnitudeSq(a: ReadonlyQuat): number {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];
  return x * x + y * y + z * z + w * w;
}

/**
 * Returns the length of `a`, treating all four components as one 4D vector.
 *
 * This is `1` for every rotation. Prefer {@link magnitudeSq} when you only need
 * to compare against `1`, since it skips the square root.
 *
 * @param a - The quaternion to measure.
 * @returns The length.
 */
export function magnitude(a: ReadonlyQuat): number {
  return Math.sqrt(magnitudeSq(a));
}

/**
 * Writes `a` scaled to a length of `1` into `out`, turning it back into a
 * valid rotation.
 *
 * Use it to correct drift: rounding to float32 pulls the result of each
 * `multiply` slightly away from unit length, and the error builds up over long
 * chains. Scaling doesn't change which rotation a quaternion represents, so a
 * drifted quaternion keeps its rotation and loses only the error.
 *
 * The zero quaternion gives the **identity**, unlike `Vec3.normalize`, which
 * turns a zero vector into a zero vector. A zero vector is a meaningful value
 * (no movement), but the zero quaternion is not a rotation at all, and every
 * caller of this function wants a rotation back. Of the rotations, the identity
 * is the safe default because it changes nothing. Only an exact zero is
 * treated this way, so very short quaternions still normalize correctly.
 *
 * The result is rounded to float32, so its length is close to `1` but rarely
 * exact. Compare it using `isEqualEpsilon`.
 *
 * Bad input stays visible: a `NaN` component makes the whole result `NaN`, and
 * an infinite component gives `NaN` in that slot and `0` in the finite ones.
 *
 * `out` may be the same quaternion as `a`, which is the usual way to normalise
 * in place: `normalize(q, q)`.
 *
 * @param out - The quaternion to write to.
 * @param a - The quaternion to normalize.
 * @returns `out`.
 */
export function normalize(out: Quat, a: ReadonlyQuat): Quat {
  const magSq = magnitudeSq(a);
  if (magSq === 0) return identity(out);

  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];
  const invMag = 1 / Math.sqrt(magSq);

  out[0] = x * invMag;
  out[1] = y * invMag;
  out[2] = z * invMag;
  out[3] = w * invMag;

  return out;
}

/**
 * Writes the conjugate of `a` into `out`: the vector part negated, the scalar
 * `w` unchanged.
 *
 * For a unit quaternion, the conjugate is its inverse, the rotation that
 * undoes it: `multiply(out, q, conjugate(tmp, q))` gives the identity. It's
 * the same rotation angle about the reversed axis, which comes to the same
 * thing as the reversed angle about the same axis.
 *
 * It only inverts unit quaternions. For anything else, the product with the
 * original comes out as the squared length on `w` instead of `1`, so
 * normalise first if `a` might have drifted.
 *
 * `out` may be the same quaternion as `a`, or a view overlapping it.
 *
 * @param out - The quaternion to write to.
 * @param a - The quaternion to conjugate.
 * @returns `out`.
 */
export function conjugate(out: Quat, a: ReadonlyQuat): Quat {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];
  out[0] = -x;
  out[1] = -y;
  out[2] = -z;
  out[3] = w;
  return out;
}

/**
 * Writes the rotation of `angle` radians about `axis` into `out`.
 *
 * The rotation follows the right-hand rule: with your right thumb along
 * `axis`, a positive angle turns the way your fingers curl. Combined with the
 * package's y-up, right-handed axes, that means a positive angle about
 * `Vec3.UP` turns `Vec3.FORWARD` (negative z) towards `Vec3.LEFT`, which is
 * counter-clockwise when viewed from above.
 *
 * `axis` **must be unit length**, and isn't normalised here: the result is
 * only a unit quaternion if the axis is. A longer or shorter axis gives a
 * quaternion of the wrong length, and a zero axis gives `(0, 0, 0, cos(angle/2))`,
 * which isn't a rotation for any angle except multiples of a full turn.
 * Normalise the axis first if it was computed rather than written as a
 * constant.
 *
 * Angles a full turn apart give opposite quaternions, `q` and `-q`, that
 * describe the same rotation, because the components use the half angle. They
 * rotate vectors identically, but `isEqual` treats them as different.
 *
 * Every component of `out` is overwritten, and `axis` is read into locals
 * first, so `axis` may be a view overlapping `out`.
 *
 * @param out - The quaternion to write to.
 * @param axis - The unit axis to rotate about.
 * @param angle - The rotation angle in radians.
 * @returns `out`.
 */
export function fromAxisAngle(out: Quat, axis: ReadonlyVec3, angle: number): Quat {
  // biome-ignore format: packed component reads
  const x = axis[0], y = axis[1], z = axis[2];
  const half = angle * 0.5;
  const sin = Math.sin(half);

  out[0] = x * sin;
  out[1] = y * sin;
  out[2] = z * sin;
  out[3] = Math.cos(half);

  return out;
}
