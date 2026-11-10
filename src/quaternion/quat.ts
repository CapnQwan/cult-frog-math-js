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

import type { ReadonlyVec3, Vec3 } from '../vector/vec3/_types/vec3.js';
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
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];
  const magSq = x * x + y * y + z * z + w * w;
  if (magSq === 0) return identity(out);

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
 * Returns the dot product of `a` and `b`, treating each as one 4D vector. The
 * order doesn't matter.
 *
 * For unit quaternions it measures how far apart two rotations are: the
 * absolute value is `cos(θ/2)`, where `θ` is the angle of the rotation that
 * takes one to the other. `1` means the same rotation and `0` means half a
 * turn apart. Recover the angle with `2 * Math.acos(Math.min(Math.abs(d), 1))`;
 * the `min` matters because unit quaternions are rarely exactly unit, and
 * `Math.acos` of anything above `1` is `NaN`.
 *
 * Use the absolute value when comparing rotations. `q` and `-q` describe the
 * same rotation but have a dot product of `-1`. The sign is still meaningful:
 * a negative dot product means `b` is on the far side of `a`, and
 * interpolating between them takes the long way round unless one of them is
 * negated first.
 *
 * The result isn't rounded to float32 or limited to its range. Bad input stays
 * visible: a `NaN` component gives `NaN`, and so does an infinite component
 * multiplied by `0`.
 *
 * @param a - The first quaternion.
 * @param b - The second quaternion.
 * @returns The dot product.
 */
export function dot(a: ReadonlyQuat, b: ReadonlyQuat): number {
  // biome-ignore format: packed component reads
  const aX = a[0], aY = a[1], aZ = a[2], aW = a[3];
  // biome-ignore format: packed component reads
  const bX = b[0], bY = b[1], bZ = b[2], bW = b[3];
  return aX * bX + aY * bY + aZ * bZ + aW * bW;
}

/**
 * Returns the angle in radians of the rotation that takes `a` to `b`: how far
 * apart the two orientations are. Pass {@link IDENTITY} as `a` to get the
 * rotation angle of `b` on its own.
 *
 * The result is always between `0` and `π`, the short way round. `q` and `-q`
 * are the same rotation, so they are `0` apart, and the order of the inputs
 * doesn't matter.
 *
 * It is worked out as `2 * atan2(sin, cos)` of the half-angle rather than
 * `2 * acos(dot(a, b))`. `acos` is badly conditioned near `1`, so for
 * near-identical rotations the `acos` form is out by up to about `1e-3`
 * radians, enough to break a "have we arrived?" check; this form gives `0`
 * for `angle(q, q)` and stays accurate down to tiny separations. The lengths
 * are divided out, so the inputs don't need to be exactly unit length, and a
 * scaled quaternion gives the same angle as its normalised form.
 *
 * The zero quaternion is no rotation at all and gives `0` against anything. A
 * `NaN` component in either input gives `NaN`.
 *
 * @param a - The first rotation.
 * @param b - The second rotation.
 * @returns The angle between them in radians, from `0` to `π`.
 */
export function angle(a: ReadonlyQuat, b: ReadonlyQuat): number {
  const aMagSq = magnitudeSq(a);
  const bMagSq = magnitudeSq(b);
  const d = dot(a, b);
  return 2 * Math.atan2(Math.sqrt(Math.max(0, aMagSq * bMagSq - d * d)), Math.abs(d));
}

/**
 * Writes the inverse of `a` into `out`: the {@link conjugate} divided by the
 * squared length, so `multiply(out, a, invert(tmp, a))` is the identity on
 * either side, whatever the length of `a`.
 *
 * For a unit quaternion this is the conjugate, and `conjugate` is cheaper, so
 * prefer it for rotations. Reach for `invert` when `a` may not be unit length
 * and the product must still come out as the identity.
 *
 * That is not the same as undoing a drifted rotation. The inverse of a
 * non-unit `a` has length `1 / magnitude(a)`, so it isn't unit either and
 * isn't fit for `Vec3.transformQuat`, which requires a unit quaternion. To
 * undo a rotation that may have drifted, normalise it and then conjugate it.
 *
 * The zero quaternion has no inverse and gives the identity, matching
 * {@link normalize}, so a broken rotation falls back to no rotation rather than
 * `NaN`. The product of zero with that identity is still zero, not the
 * identity. Only an exact zero is special-cased: a very short `a` gives a very
 * long inverse, and only subnormal lengths can overflow to `Infinity`.
 *
 * The squared length is computed in float64 and the result is rounded to
 * float32 as it is stored. A zero in the vector part comes out as `-0`, so
 * `invert(out, IDENTITY)` is `(-0, -0, -0, 1)`, which `isEqual` still treats
 * as the identity. Bad input stays visible: a `NaN` component makes every
 * component `NaN`, and an infinite one gives `NaN` in its own slot.
 *
 * `a` is read into locals first, so `out` may be `a` or a view overlapping it.
 *
 * @param out - The quaternion to write to.
 * @param a - The quaternion to invert.
 * @returns `out`.
 */
export function invert(out: Quat, a: ReadonlyQuat): Quat {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];
  const magSq = x * x + y * y + z * z + w * w;
  if (magSq === 0) return identity(out);

  const inv = 1 / magSq;
  out[0] = -x * inv;
  out[1] = -y * inv;
  out[2] = -z * inv;
  out[3] = w * inv;

  return out;
}

/**
 * Rotates `a` by `angle` radians about its own x axis and writes the result
 * into `out`.
 *
 * This is `multiply(out, a, fromAxisAngle(tmp, Vec3.RIGHT, angle))` with the
 * zero terms dropped: no temporary quaternion, and 8 multiplies instead of 16
 * plus the constructor. Because the turn is on the right, it happens in `a`'s
 * local frame, about the axis `a` has turned `Vec3.RIGHT` into, so that axis
 * stays put. To turn about the world x axis instead, multiply on the left:
 * `multiply(out, fromAxisAngle(tmp, Vec3.RIGHT, angle), a)`.
 *
 * It follows the right-hand rule, so a positive angle tilts the object's own
 * `FORWARD` towards its own `UP`, the same as a positive pitch in
 * {@link fromEuler}.
 *
 * Nothing renormalises. A unit `a` stays unit in exact arithmetic and `a`'s
 * length is otherwise kept, but float32 rounding drifts the length when this is
 * applied every frame, so call {@link normalize} periodically. Angles a full
 * turn apart give opposite quaternions for the same rotation.
 *
 * A `NaN` angle makes every component `NaN`. A `NaN` component of `a` comes out
 * `NaN` in its own slot and in the slot it's paired with (`x` with `w`, `y`
 * with `z`).
 *
 * `a` is read into locals first, so `out` may be `a` or a view overlapping it.
 *
 * @param out - The quaternion to write to.
 * @param a - The rotation to turn.
 * @param angle - The angle in radians, about `a`'s own x axis.
 * @returns `out`.
 */
export function rotateX(out: Quat, a: ReadonlyQuat, angle: number): Quat {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];

  const s = Math.sin(angle * 0.5);
  const c = Math.cos(angle * 0.5);

  out[0] = w * s + x * c;
  out[1] = y * c + z * s;
  out[2] = z * c - y * s;
  out[3] = w * c - x * s;

  return out;
}

/**
 * Rotates `a` by `angle` radians about its own y axis and writes the result
 * into `out`.
 *
 * This is `multiply(out, a, fromAxisAngle(tmp, Vec3.UP, angle))` with the
 * zero terms dropped: no temporary quaternion, and 8 multiplies instead of 16
 * plus the constructor. Because the turn is on the right, it happens in `a`'s
 * local frame, about the axis `a` has turned `Vec3.UP` into, so that axis
 * stays put. To turn about the world y axis instead, multiply on the left:
 * `multiply(out, fromAxisAngle(tmp, Vec3.UP, angle), a)`.
 *
 * It follows the right-hand rule, so a positive angle turns the object's own
 * `FORWARD` towards its own `LEFT`, the same as a positive yaw in
 * {@link fromEuler}.
 *
 * Nothing renormalises. A unit `a` stays unit in exact arithmetic and `a`'s
 * length is otherwise kept, but float32 rounding drifts the length when this is
 * applied every frame, so call {@link normalize} periodically. Angles a full
 * turn apart give opposite quaternions for the same rotation.
 *
 * A `NaN` angle makes every component `NaN`. A `NaN` component of `a` comes out
 * `NaN` in its own slot and in the slot it's paired with (`y` with `w`, `x`
 * with `z`).
 *
 * `a` is read into locals first, so `out` may be `a` or a view overlapping it.
 *
 * @param out - The quaternion to write to.
 * @param a - The rotation to turn.
 * @param angle - The angle in radians, about `a`'s own y axis.
 * @returns `out`.
 */
export function rotateY(out: Quat, a: ReadonlyQuat, angle: number): Quat {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];

  const s = Math.sin(angle * 0.5);
  const c = Math.cos(angle * 0.5);

  out[0] = x * c - z * s;
  out[1] = w * s + y * c;
  out[2] = x * s + z * c;
  out[3] = w * c - y * s;

  return out;
}

/**
 * Rotates `a` by `angle` radians about its own z axis and writes the result
 * into `out`.
 *
 * This is `multiply(out, a, fromAxisAngle(tmp, Vec3.BACK, angle))` with the
 * zero terms dropped: no temporary quaternion, and 8 multiplies instead of 16
 * plus the constructor. Because the turn is on the right, it happens in `a`'s
 * local frame, about the axis `a` has turned `Vec3.BACK` into, so that axis
 * stays put. To turn about the world z axis instead, multiply on the left:
 * `multiply(out, fromAxisAngle(tmp, Vec3.BACK, angle), a)`.
 *
 * It follows the right-hand rule, so a positive angle tips the object's own
 * `UP` towards its own `LEFT`, the same as a positive roll in
 * {@link fromEuler}.
 *
 * Nothing renormalises. A unit `a` stays unit in exact arithmetic and `a`'s
 * length is otherwise kept, but float32 rounding drifts the length when this is
 * applied every frame, so call {@link normalize} periodically. Angles a full
 * turn apart give opposite quaternions for the same rotation.
 *
 * A `NaN` angle makes every component `NaN`. A `NaN` component of `a` comes out
 * `NaN` in its own slot and in the slot it's paired with (`z` with `w`, `x`
 * with `y`).
 *
 * `a` is read into locals first, so `out` may be `a` or a view overlapping it.
 *
 * @param out - The quaternion to write to.
 * @param a - The rotation to turn.
 * @param angle - The angle in radians, about `a`'s own z axis.
 * @returns `out`.
 */
export function rotateZ(out: Quat, a: ReadonlyQuat, angle: number): Quat {
  // biome-ignore format: packed component reads
  const x = a[0], y = a[1], z = a[2], w = a[3];

  const s = Math.sin(angle * 0.5);
  const c = Math.cos(angle * 0.5);

  out[0] = x * c + y * s;
  out[1] = y * c - x * s;
  out[2] = w * s + z * c;
  out[3] = w * c - z * s;

  return out;
}

/**
 * The dot product above which {@link slerp} hands over to {@link nlerp}.
 *
 * Slerp's weights divide by `sin θ`, which heads to `0` as the inputs
 * converge, so the division loses precision and eventually becomes `0 / 0`.
 * Rounding can also push the dot product of two nearly equal unit quaternions
 * just above `1`, where `Math.acos` returns `NaN`; this cut-off catches that
 * too. `0.9995` is a separation of about 3.6° between the two rotations, and
 * at that size nlerp drifts from slerp's path by about a millionth of a radian.
 */
const SLERP_NLERP_THRESHOLD = 0.9995;

/**
 * Writes the spherical linear interpolation between `a` and `b` into `out`.
 *
 * The rotation turns at a constant angular speed along the shortest arc
 * between the two, so `t = 0.5` is exactly halfway in angle. That makes it the
 * choice for keyframed animation and anything where the timing of a turn must
 * be even. When that doesn't matter, {@link nlerp} is cheaper.
 *
 * It always takes the short way round. `q` and `-q` describe the same
 * rotation, so when the dot product is negative `b` is negated first, which
 * avoids a turn of more than half a revolution. A consequence is that
 * `t = 1` can give `-b` rather than `b`: the same rotation, but not equal
 * under `isEqual`.
 *
 * When the two rotations are within about 3.6° of each other it falls back
 * to `nlerp`, whose result is indistinguishable at that distance and which
 * avoids dividing by a vanishing `sin θ`.
 *
 * `t` is not clamped, matching the scalar `lerp`. Outside `[0, 1]` the
 * rotation keeps turning along the same arc at the same speed, so `t = 2`
 * turns twice as far as `b`. The exception is the `nlerp` fallback: for
 * rotations within about 3.6° of each other, extrapolation follows `nlerp`
 * and falls short as `t` grows. The gap is negligible near the ends (under
 * 0.005° at `t = 2`) but reaches about 1° by `t = 10`, and however large `t`
 * gets, the turn levels off at about half a revolution instead of continuing.
 *
 * Both inputs **must be unit length**. The dot product is only the cosine of
 * the angle between unit quaternions; for anything else the angle is wrong,
 * and a dot product above the threshold quietly takes the `nlerp` path. The
 * result is unit length, up to float32 rounding.
 *
 * A `NaN` in either input or in `t` makes the result `NaN`. Both inputs are
 * read into locals first, so `out` may be `a`, `b`, or a view overlapping
 * either.
 *
 * @param out - The quaternion to write to.
 * @param a - The unit rotation at `t = 0`.
 * @param b - The unit rotation at `t = 1`.
 * @param t - The interpolation factor, usually `0` to `1`.
 * @returns `out`.
 */
export function slerp(out: Quat, a: ReadonlyQuat, b: ReadonlyQuat, t: number): Quat {
  // biome-ignore format: packed component reads
  const aX = a[0], aY = a[1], aZ = a[2], aW = a[3];
  // biome-ignore format: packed component reads
  let bX = b[0], bY = b[1], bZ = b[2], bW = b[3];

  // θ is the angle between the two in 4D, which is half the rotation angle.
  let cosTheta = aX * bX + aY * bY + aZ * bZ + aW * bW;

  if (cosTheta < 0) {
    cosTheta = -cosTheta;

    bX = -bX;
    bY = -bY;
    bZ = -bZ;
    bW = -bW;
  }

  if (cosTheta > SLERP_NLERP_THRESHOLD) {
    const invT = 1 - t;

    out[0] = aX * invT + bX * t;
    out[1] = aY * invT + bY * t;
    out[2] = aZ * invT + bZ * t;
    out[3] = aW * invT + bW * t;

    return normalize(out, out);
  }

  const theta = Math.acos(cosTheta);
  const sinTheta = Math.sin(theta);

  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;

  out[0] = aX * wa + bX * wb;
  out[1] = aY * wa + bY * wb;
  out[2] = aZ * wa + bZ * wb;
  out[3] = aW * wa + bW * wb;

  return out;
}

/**
 * Writes the normalised linear interpolation between `a` and `b` into `out`:
 * the components are blended linearly and the result is scaled back to unit
 * length.
 *
 * It follows the same arc as {@link slerp} but not at the same speed: it moves
 * slowest near the ends and fastest through the middle. For a turn of 2
 * radians, `t = 0.25` covers about `0.47` radians rather than `0.5`, while
 * `t = 0.5` is still exactly halfway. The gap shrinks quickly as the turn gets
 * smaller, and there are no trigonometric calls, so this is the usual choice
 * for per-frame smoothing such as easing a camera towards a target rotation.
 *
 * Like `slerp`, it always takes the short way round, negating `b` when the dot
 * product is negative, so `t = 1` can give a normalised `-b` rather than `b`.
 *
 * `t` is not clamped, matching the scalar `lerp`, but extrapolation does not
 * keep a steady turn: the blended point runs off along a straight line and
 * normalising pulls it back, so it falls increasingly short. `t = 2` on a
 * 1-radian turn reaches about `1.81` radians, not `2`. Use `slerp` to
 * extrapolate.
 *
 * Both inputs should be unit length. Normalising hides an error in their
 * lengths, but the blend is weighted towards the longer input.
 *
 * A `NaN` in either input or in `t` makes the result `NaN`. Both inputs are
 * read into locals first, so `out` may be `a`, `b`, or a view overlapping
 * either.
 *
 * @param out - The quaternion to write to.
 * @param a - The unit rotation at `t = 0`.
 * @param b - The unit rotation at `t = 1`.
 * @param t - The interpolation factor, usually `0` to `1`.
 * @returns `out`.
 */
export function nlerp(out: Quat, a: ReadonlyQuat, b: ReadonlyQuat, t: number): Quat {
  // biome-ignore format: packed component reads
  const aX = a[0], aY = a[1], aZ = a[2], aW = a[3];
  // biome-ignore format: packed component reads
  let bX = b[0], bY = b[1], bZ = b[2], bW = b[3];

  const cosTheta = aX * bX + aY * bY + aZ * bZ + aW * bW;

  if (cosTheta < 0) {
    bX = -bX;
    bY = -bY;
    bZ = -bZ;
    bW = -bW;
  }

  const invT = 1 - t;

  out[0] = aX * invT + bX * t;
  out[1] = aY * invT + bY * t;
  out[2] = aZ * invT + bZ * t;
  out[3] = aW * invT + bW * t;

  return normalize(out, out);
}

/**
 * Splits `q` into the unit axis it rotates about, written into `outAxis`, and
 * the angle in radians about that axis, which is returned. It is the reverse
 * of {@link fromAxisAngle}.
 *
 * Unlike the rest of the package, this returns the angle rather than its
 * `out` parameter. The axis and angle only mean something together, and
 * producing both in one call guarantees they come from the same sign of `q`.
 *
 * `q` and `-q` are the same rotation, and the result is the reading with an
 * angle from `0` to `π`: when `w` is negative, both halves are taken from
 * `-q`. So a rotation of more than half a turn comes back as the shorter turn
 * the other way, about the reversed axis, and `q` and `-q` give the same axis
 * and angle. The exception is an exact half turn, where `w` is zero and
 * neither way is shorter. The angle is `π` for both, but the axis follows the
 * sign of the vector part, so `q` and `-q` give opposite axes. Both are
 * correct. Either way, `fromAxisAngle(tmp, outAxis, angle)` rebuilds `q` or
 * `-q`, the same rotation, and the angle matches `angle(IDENTITY, q)`.
 *
 * The axis is the vector part normalised, and the angle is
 * `2 * atan2(length of the vector part, |w|)`. Both divide out the length of
 * `q`, so it doesn't have to be exactly unit length, and both stay accurate
 * for tiny rotations, where dividing by `sin(angle / 2)` or taking
 * `2 * acos(w)` would not.
 *
 * A rotation of zero has no axis: when the vector part is exactly zero, as for
 * the identity, `-IDENTITY` or the zero quaternion, `outAxis` is set to
 * `Vec3.RIGHT` and the angle is `0`. Any axis would be correct there, but a
 * fixed one keeps the axis unit length and deterministic. Only an exact zero
 * is special-cased; a very small rotation still gives its real axis.
 *
 * A `NaN` in the vector part makes the axis and the angle `NaN`. A `NaN` `w`
 * doesn't reach the axis, but makes the angle `NaN`.
 *
 * `q` is read into locals first, so `outAxis` may be a view overlapping it,
 * as in a pooled record that stores an axis next to a rotation.
 *
 * @param outAxis - The vector to write the unit axis to.
 * @param q - The rotation to split.
 * @returns The angle in radians, from `0` to `π`.
 */
export function toAxisAngle(outAxis: Vec3, q: ReadonlyQuat): number {
  // biome-ignore format: packed component reads
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const lengthSq = qx * qx + qy * qy + qz * qz;

  if (lengthSq === 0) {
    outAxis[0] = 1;
    outAxis[1] = 0;
    outAxis[2] = 0;
    return 0;
  }

  const length = Math.sqrt(lengthSq);
  const sign = qw < 0 ? -1 : 1;
  const inv = sign / length;

  outAxis[0] = qx * inv;
  outAxis[1] = qy * inv;
  outAxis[2] = qz * inv;
  return 2 * Math.atan2(length, qw * sign);
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

/**
 * Writes the rotation described by Euler angles into `out`: `x` is pitch, `y`
 * is yaw and `z` is roll, all in radians.
 *
 * Euler angles only mean something with a fixed order, and this one is
 * **Y-X-Z**: the result is `qy * qx * qz`. Read as rotations about the world
 * axes, roll is applied first, then pitch, then yaw. Read as rotations about
 * the object's own axes, that is yaw, then pitch about the turned right axis,
 * then roll about the resulting forward axis, which is how a y-up camera or
 * character is usually steered.
 *
 * Each angle follows the right-hand rule about its axis, so with the
 * package's y-up, right-handed axes:
 *
 * - a positive `y` (yaw) turns `Vec3.FORWARD` towards `Vec3.LEFT`;
 * - a positive `x` (pitch) tilts `Vec3.FORWARD` towards `Vec3.UP`;
 * - a positive `z` (roll) tips `Vec3.UP` towards `Vec3.LEFT`.
 *
 * At a pitch of exactly ±90°, yaw and roll turn about the same axis, so only
 * their difference (or sum) matters and many angle triples give the same
 * rotation. This is gimbal lock, and it belongs to Euler angles themselves,
 * not to this function. Store orientations as quaternions and use Euler
 * angles only for input and authoring.
 *
 * The result is a unit quaternion, up to float32 rounding. As with
 * {@link fromAxisAngle}, angles a full turn apart give `q` and `-q`, the same
 * rotation with opposite signs.
 *
 * Every component of `out` is overwritten.
 *
 * @param out - The quaternion to write to.
 * @param x - The pitch, about the x axis, in radians.
 * @param y - The yaw, about the y axis, in radians.
 * @param z - The roll, about the z axis, in radians.
 * @returns `out`.
 */
export function fromEuler(out: Quat, x: number, y: number, z: number): Quat {
  // biome-ignore format: packed component reads
  const cx = Math.cos(x * 0.5), cy = Math.cos(y * 0.5), cz = Math.cos(z * 0.5);
  // biome-ignore format: packed component reads
  const sx = Math.sin(x * 0.5), sy = Math.sin(y * 0.5), sz = Math.sin(z * 0.5);

  out[0] = sx * cy * cz + cx * sy * sz;
  out[1] = cx * sy * cz - sx * cy * sz;
  out[2] = cx * cy * sz - sx * sy * cz;
  out[3] = cx * cy * cz + sx * sy * sz;
  return out;
}

/**
 * Writes the smallest rotation that turns the direction `from` into the
 * direction `to` into `out`: a turn about the axis perpendicular to both, by
 * the angle between them.
 *
 * Use it to align one direction with another when the roll about that
 * direction doesn't matter, such as standing a model's up axis on a ground
 * normal or pointing a turret's barrel at a target.
 *
 * It needs no trigonometry. `(cross(from, to), 1 + dot(from, to))` is the
 * rotation's quaternion scaled by `2 cos(θ/2)`, by the double-angle
 * identities, so normalising it gives the exact result. Identical inputs
 * therefore give exactly the identity.
 *
 * Opposite directions have no single answer: a half turn about any axis
 * perpendicular to `from` works, and near opposite the cross product is too
 * small to give a stable axis. When `1 + dot(from, to)` is below `EPSILON`,
 * within about 0.08° of opposite, it writes a half turn `(n, 0)` instead,
 * where `n` is `Vec3.UP` with its `from` component removed, then normalised.
 * A horizontal `from` therefore spins about `UP` and stays upright, rather than
 * flipping over. If `from` is within about 0.06° of vertical, so that too
 * little of `UP` is left to give a stable axis, `n` is `Vec3.RIGHT`. Inside that band the result turns `from` to exactly
 * `-from`, so it can miss `to` by up to about 0.08°.
 *
 * Both inputs **must be unit length**, and neither is normalised. The `1` in
 * `1 + dot` doesn't scale with them, so other lengths give the wrong angle,
 * not a scaled rotation. The result is unit length, up to float32 rounding.
 *
 * Accuracy falls off close to opposite. Float32 inputs are never exactly unit
 * length, and `1 + dot` cancels as it approaches `0`, so that rounding is
 * magnified: the angle is out by about `3e-7` radians at 10° short of
 * opposite, `2e-6` at 0.5° and `3e-5` at 0.1°, before the fallback takes over.
 *
 * A `NaN` component in either input makes every component `NaN`. All six
 * components are read into locals first, so `out` may overlap either input,
 * as in a pooled record that holds directions next to a rotation.
 *
 * @param out - The quaternion to write to.
 * @param from - The unit direction to turn from.
 * @param to - The unit direction to turn to.
 * @returns `out`.
 */
export function fromUnitVectors(out: Quat, from: ReadonlyVec3, to: ReadonlyVec3): Quat {
  // biome-ignore format: packed component reads
  const fx = from[0], fy = from[1], fz = from[2];
  // biome-ignore format: packed component reads
  const tx = to[0], ty = to[1], tz = to[2];
  const dot = fx * tx + fy * ty + fz * tz;

  if (1 + dot < EPSILON) {
    const nx = -fy * fx;
    const ny = 1 - fy * fy;
    const nz = -fy * fz;

    if (nx * nx + ny * ny + nz * nz < EPSILON) {
      out[0] = 1;
      out[1] = 0;
      out[2] = 0;
      out[3] = 0;
      return out;
    }

    out[0] = nx;
    out[1] = ny;
    out[2] = nz;
    out[3] = 0;
    return normalize(out, out);
  }

  out[0] = fy * tz - fz * ty;
  out[1] = fz * tx - fx * tz;
  out[2] = fx * ty - fy * tx;
  out[3] = 1 + dot;

  return normalize(out, out);
}
