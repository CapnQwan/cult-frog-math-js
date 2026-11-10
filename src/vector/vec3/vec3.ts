/**
 * Three-component vectors stored as `[x, y, z]`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module vec3
 */

import { EPSILON } from '../../constants.js';
import { lerp as lerpScalar } from '../../interpolation.js';
import { clamp, isEqualEpsilon as isEqualEpsilonScalar } from '../../scalars.js';

import type { ReadonlyQuat } from '../../quaternion/_types/quat.js';
import type { ReadonlyVec3, Vec3 } from './_types/vec3.js';

/** The number of elements in a `Vec3`. */
export const SIZE = 3;

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
  const v = new Float32Array(SIZE) as Vec3;
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
 * Writes `a + b * scalar` into `out`, the step behind `position += velocity * dt`.
 * Only `b` is scaled.
 *
 * Exists because the two-call version needs a scratch vector and rounds twice:
 * {@link scale} stores `b * scalar` as float32 before {@link add} uses it. Here the
 * whole sum is calculated in float64 and rounded once when stored, so the two forms
 * can differ slightly, and a large `b * scalar` can't overflow on the way through.
 *
 * Each result is still rounded to float32, so a small step can vanish against a
 * large value: moving a component of `16777216` by `1` leaves it unchanged. An
 * infinite component in `b` gives `NaN` when `scalar` is `0`.
 *
 * @param out - The vector to write to.
 * @param a - The vector to add to.
 * @param b - The vector to scale and add.
 * @param scalar - The factor applied to `b`, not to `a`.
 * @returns `out`.
 */
export function scaleAndAdd(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3, scalar: number): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ax + bx * scalar;
  out[1] = ay + by * scalar;
  out[2] = az + bz * scalar;
  return out;
}

/**
 * Writes `a` with the sign of every component flipped into `out`.
 *
 * A `0` component becomes `-0`. `isEqual` and arithmetic treat the two as the same,
 * but `Object.is` doesn't, and neither does a `toEqual` in tests.
 *
 * @param out - The vector to write to.
 * @param a - The vector to negate.
 * @returns `out`.
 */
export function negate(out: Vec3, a: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  out[0] = -ax;
  out[1] = -ay;
  out[2] = -az;
  return out;
}

/**
 * Writes the absolute value of every component of `a` into `out`.
 *
 * `-0` becomes `0`, and `NaN` stays `NaN`.
 *
 * @param out - The vector to write to.
 * @param a - The input vector.
 * @returns `out`.
 */
export function abs(out: Vec3, a: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  out[0] = Math.abs(ax);
  out[1] = Math.abs(ay);
  out[2] = Math.abs(az);
  return out;
}

/**
 * Writes the smaller of `a` and `b` into `out`, compared component by component,
 * so the result can mix components from both. Useful for growing bounding boxes.
 *
 * A `NaN` in either input gives `NaN` in that component only, and `-0` counts as
 * smaller than `0`.
 *
 * @param out - The vector to write to.
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns `out`.
 */
export function min(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = Math.min(ax, bx);
  out[1] = Math.min(ay, by);
  out[2] = Math.min(az, bz);
  return out;
}

/**
 * Writes the larger of `a` and `b` into `out`, compared component by component,
 * so the result can mix components from both. Useful for growing bounding boxes.
 *
 * A `NaN` in either input gives `NaN` in that component only, and `0` counts as
 * larger than `-0`.
 *
 * @param out - The vector to write to.
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns `out`.
 */
export function max(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = Math.max(ax, bx);
  out[1] = Math.max(ay, by);
  out[2] = Math.max(az, bz);
  return out;
}

/**
 * Writes every component of `a` rounded down into `out`.
 *
 * Rounds toward negative infinity, not toward zero, so `-1.5` becomes `-2`. That
 * makes it the right choice for turning positions into grid or tile coordinates.
 *
 * @param out - The vector to write to.
 * @param a - The input vector.
 * @returns `out`.
 */
export function floor(out: Vec3, a: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  out[0] = Math.floor(ax);
  out[1] = Math.floor(ay);
  out[2] = Math.floor(az);
  return out;
}

/**
 * Writes every component of `a` rounded up into `out`.
 *
 * Rounds toward positive infinity, so `-1.5` becomes `-1`. A component between
 * `-1` and `0` becomes `-0`. `isEqual` and arithmetic treat that as `0`, but
 * `Object.is` doesn't, and neither does a `toEqual` in tests.
 *
 * @param out - The vector to write to.
 * @param a - The input vector.
 * @returns `out`.
 */
export function ceil(out: Vec3, a: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  out[0] = Math.ceil(ax);
  out[1] = Math.ceil(ay);
  out[2] = Math.ceil(az);
  return out;
}

/**
 * Writes every component of `a` rounded to the nearest whole number into `out`.
 *
 * Halves round toward positive infinity, not away from zero, so `-1.5` becomes
 * `-1`, as with the scalar `round`. Unlike the scalar, this has no `decimals`
 * parameter. A component from `-0.5` up to `0` becomes `-0`. `isEqual` and
 * arithmetic treat that as `0`, but `Object.is` doesn't, and neither does a
 * `toEqual` in tests.
 *
 * @param out - The vector to write to.
 * @param a - The input vector.
 * @returns `out`.
 */
export function round(out: Vec3, a: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  out[0] = Math.round(ax);
  out[1] = Math.round(ay);
  out[2] = Math.round(az);
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
 * @param a - The vector to measure.
 * @returns The squared length.
 */
export function magnitudeSq(a: ReadonlyVec3): number {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  return ax * ax + ay * ay + az * az;
}

/**
 * Returns the length of `a`.
 *
 * Named `magnitude` because `a.length` is already taken: it's the component count,
 * always `3`, as on any typed array.
 *
 * Use {@link magnitudeSq} instead if you're only comparing lengths.
 *
 * @param a - The vector to measure.
 * @returns The length.
 */
export function magnitude(a: ReadonlyVec3): number {
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
 * @param a - The first point.
 * @param b - The second point.
 * @returns The squared distance.
 */
export function distanceSq(a: ReadonlyVec3, b: ReadonlyVec3): number {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Returns the distance between `a` and `b`. The order doesn't matter.
 *
 * Use {@link distanceSq} instead if you're only comparing distances.
 *
 * @param a - The first point.
 * @param b - The second point.
 * @returns The distance.
 */
export function distance(a: ReadonlyVec3, b: ReadonlyVec3): number {
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
 * exact: normalizing `(3, 4, 0)` gives a magnitude of `1.0000000238`. Compare it
 * using `isEqualEpsilon`.
 *
 * Bad input stays visible: a `NaN` component makes the whole result `NaN`, and an
 * infinite component gives `NaN` in that slot and `0` in the finite ones.
 *
 * @param out - The vector to write to.
 * @param a - The vector to normalize.
 * @returns `out`.
 */
export function normalize(out: Vec3, a: ReadonlyVec3): Vec3 {
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
 * is close to `1` but rarely exact, so normalizing `(1, 2, 3)` and dotting it with
 * itself gives `1.0000000103`, and `Math.acos` of anything above `1` is `NaN`.
 * Use `Math.acos(clamp(dot(a, b), -1, 1))`.
 *
 * The result isn't rounded to float32 or limited to its range. Bad input stays
 * visible: a `NaN` component gives `NaN`, and so does an infinite component
 * multiplied by `0`.
 *
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns The dot product.
 */
export function dot(a: ReadonlyVec3, b: ReadonlyVec3): number {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];
  return ax * bx + ay * by + az * bz;
}

/**
 * Writes the cross product of `a` and `b` into `out`: a vector perpendicular to
 * both, used for surface normals and for building a set of axes. `out` may be `a`,
 * `b` or a view overlapping either.
 *
 * The order matters, because `cross(out, b, a)` gives the opposite vector. The
 * direction follows the right-hand rule, matching this package's right-handed,
 * y-up axes: `RIGHT × UP` is `BACK`, `UP × BACK` is `RIGHT` and `BACK × RIGHT` is
 * `UP`. Forward is negative z, so `cross(out, FORWARD, UP)` gives `RIGHT`.
 *
 * The result's length is `|a| |b| sin(angle)`, so two unit vectors only give a unit
 * vector when they're perpendicular. Normalize the result if you need a direction.
 * Parallel or opposite vectors and zero inputs give a zero vector, which
 * {@link normalize} leaves as zero. Watch for this when deriving axes from a facing
 * direction: a camera looking straight up gets nothing from `cross(out, forward, UP)`.
 *
 * Calculated in float64 and rounded to float32 when stored, so nearly parallel
 * inputs keep their precision through the subtraction, but a component too large
 * for float32 becomes `Infinity`. An infinite input gives `NaN` wherever it's
 * multiplied by `0`.
 *
 * @param out - The vector to write to.
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns `out`.
 */
export function cross(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];

  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

/**
 * Writes the point `t` of the way from `a` to `b` into `out`: `0` gives `a`, `1` gives
 * `b` and `0.5` gives the midpoint.
 *
 * `t` isn't clamped, so values outside `0` to `1` carry on past either end. Pass
 * `saturate(t)` to stay between them.
 *
 * Watch out for a fixed `t` applied every frame, as in `lerp(pos, pos, target, 0.1)`.
 * It depends on the frame rate: after one second it's 95.8% of the way there at 30
 * steps and 99.8% at 60. For the same motion at any frame rate, use
 * `1 - Math.exp(-rate * dt)` as `t`.
 *
 * Blending directions doesn't keep their length: halfway between `(1, 0)` and
 * `(0, 1)` has a length of about `0.707`, and halfway between opposite directions is
 * zero. Normalize the result if you need a direction, and check for zero first.
 *
 * Uses `a + (b - a) * t`, which gives exactly `a` at `t = 0`. It only misses `b` at
 * `t = 1` when the two differ enormously in scale: going from `1e8` to `0.1` lands on
 * `0.09999999`. An infinite component in `a` gives `NaN` from `t = 0` upwards, and one
 * in `b` gives `NaN` at `t = 0` and `Infinity` above it.
 *
 * @param out - The vector to write to.
 * @param a - The vector at `t = 0`.
 * @param b - The vector at `t = 1`.
 * @param t - How far to go from `a` to `b`.
 * @returns `out`.
 */
export function lerp(out: Vec3, a: ReadonlyVec3, b: ReadonlyVec3, t: number): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const bx = b[0], by = b[1], bz = b[2];

  out[0] = lerpScalar(ax, bx, t);
  out[1] = lerpScalar(ay, by, t);
  out[2] = lerpScalar(az, bz, t);
  return out;
}

/**
 * Writes `a` bounced off a surface into `out`: `a - 2 (a · normal) normal`. The part
 * of `a` along `normal` flips and the rest is kept, as with a ball hitting a wall.
 * Apart from float32 rounding, the result is the same length as `a`.
 *
 * `normal` must have a length of `1`, and nothing checks this, so that a known unit
 * normal doesn't pay for a square root on every bounce. Any other length changes the
 * direction as well as the size: `(1, -1, 0)` off `(0, 2, 0)` gives `(1, 7, 0)` rather
 * than `(1, 1, 0)`. Which side of the surface the normal points to doesn't matter.
 *
 * It doesn't check which way `a` is heading: `(1, 1, 0)` moving away from a floor with
 * a normal of `(0, 1, 0)` still flips to `(1, -1, 0)`. For bounces, check
 * `dot(velocity, normal) < 0` first, or an object can get stuck flipping back and
 * forth inside a surface.
 *
 * Bad input stays visible: a `NaN` component makes the whole result `NaN`, and so does
 * an infinite one that meets `0` in the dot product, as with `(Infinity, -1, 0)` off
 * `(0, 1, 0)`.
 *
 * @param out - The vector to write to.
 * @param a - The incoming vector.
 * @param normal - The surface's normal, with a length of `1`.
 * @returns `out`.
 */
export function reflect(out: Vec3, a: ReadonlyVec3, normal: ReadonlyVec3): Vec3 {
  // biome-ignore format: packed component reads
  const ax = a[0], ay = a[1], az = a[2];
  // biome-ignore format: packed component reads
  const nx = normal[0], ny = normal[1], nz = normal[2];
  const k = 2 * dot(a, normal);

  out[0] = ax - k * nx;
  out[1] = ay - k * ny;
  out[2] = az - k * nz;

  return out;
}

/**
 * Returns the angle between `a` and `b` in radians, from `0` to `π`. Neither the order
 * nor their lengths matter. The angle has no sign, so it can't tell a left turn from
 * a right one.
 *
 * A zero vector has no direction and gives `0`, the same as two parallel vectors.
 * Only an exact zero is treated this way, so very short vectors still give the right
 * angle. To ignore tiny noise, check `magnitudeSq(a) < EPSILON_SQUARED` first.
 *
 * The cosine is clamped before `Math.acos`, so rounding can't produce `NaN`. Rounding
 * can still make parallel vectors come out very slightly apart, at around `5e-8`, so
 * compare the result using a tolerance rather than `=== 0`. Precision also falls away
 * for angles below about `1e-6`.
 *
 * To compare against a limit, as in a view cone, you can skip the `Math.acos`: with
 * unit vectors, `dot(a, b) > Math.cos(limit)` gives the same answer.
 *
 * A `NaN` or infinite component gives `NaN`.
 *
 * @param a - The first vector.
 * @param b - The second vector.
 * @returns The angle in radians, from `0` to `π`.
 */
export function angle(a: ReadonlyVec3, b: ReadonlyVec3): number {
  const magSqA = magnitudeSq(a);
  const magSqB = magnitudeSq(b);

  if (magSqA === 0 || magSqB === 0) return 0;

  const denominator = Math.sqrt(magSqA * magSqB);
  const cos = dot(a, b) / denominator;

  return Math.acos(clamp(cos, -1, 1));
}

/**
 * Copies row `index` of a tightly packed array into `out`, without making a view.
 * Row `i` starts at element `i * SIZE`. Values are rounded to float32.
 *
 * Bounds aren't checked: a component read from outside `packed` is written to
 * `out` as `NaN`.
 *
 * `out` may be a view into `packed`, including one that overlaps the row.
 *
 * @param out - The vector to write to.
 * @param packed - The packed values to read from.
 * @param index - The row to read, not an element offset.
 * @returns `out`.
 */
export function fromPacked(out: Vec3, packed: ArrayLike<number>, index: number): Vec3 {
  const from = index * SIZE;
  // biome-ignore format: packed component reads
  // biome-ignore lint/style/noNonNullAssertion: the caller owns the bounds
  const x = packed[from]!, y = packed[from + 1]!, z = packed[from + 2]!;
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

/**
 * Rotates `v` by the unit quaternion `q` and writes the result into `out`.
 *
 * This is how a quaternion is applied to anything: a direction, a velocity,
 * an offset from a parent. A quaternion has no direction of its own, so to
 * find which way an object faces, rotate the forward axis:
 * `transformQuat(out, Vec3.FORWARD, q)`.
 *
 * Rotations combine the same way as `Quat.multiply`, so rotating by
 * `multiply(tmp, a, b)` gives the same result as rotating by `b` and then by
 * `a`. Rotating by `Quat.conjugate` of a unit `q` undoes it.
 *
 * The result is the sandwich product `q * v * conjugate(q)`, worked out as
 * `t = 2 * cross(q.xyz, v)`, then `v + w * t + cross(q.xyz, t)`, which costs
 * about half of two `multiply` calls.
 *
 * `q` **must be unit length**. That simplification relies on it, so a
 * non-unit `q` gives neither a rotation nor a scaled one: a doubled identity
 * leaves `v` unchanged rather than scaling it by `4`. Normalise `q` first if
 * it has drifted. A unit `q` preserves the length of `v`, up to float32
 * rounding.
 *
 * Bad input stays visible: a `NaN` component in either input makes the result
 * `NaN`.
 *
 * Both inputs are read into locals first, so `out` may be `v`, or a view
 * overlapping either `v` or `q`.
 *
 * @param out - The vector to write to.
 * @param v - The vector to rotate.
 * @param q - The unit quaternion to rotate by.
 * @returns `out`.
 */
export function transformQuat(out: Vec3, v: ReadonlyVec3, q: ReadonlyQuat): Vec3 {
  // biome-ignore format: packed component reads
  const vx = v[0], vy = v[1], vz = v[2];
  // biome-ignore format: packed component reads
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];

  // t = 2 * (q.xyz × v)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);

  // v' = v + w * t + q.xyz × t
  out[0] = vx + qw * tx + (qy * tz - qz * ty);
  out[1] = vy + qw * ty + (qz * tx - qx * tz);
  out[2] = vz + qw * tz + (qx * ty - qy * tx);
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
 * `(0, 0, -1)`: forward in this package's right-handed, y-up convention, along
 * negative z.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const FORWARD = create(0, 0, -1) as ReadonlyVec3;
/**
 * `(0, 0, 1)`: back in this package's right-handed, y-up convention, along
 * positive z.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Vec3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const BACK = create(0, 0, 1) as ReadonlyVec3;
