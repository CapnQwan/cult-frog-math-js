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
 * turns twice as far as `b`.
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
    return nlerp(out, a, b, t);
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
