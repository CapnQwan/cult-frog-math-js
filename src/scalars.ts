/**
 * Scalar helpers: clamping, rounding, wrapping and approximate equality.
 *
 * These work on plain `number`s, which are float64. The rest of the package
 * stores float32, so a result computed here is rounded when it lands in a
 * `Vec3` or a `Mat4` — compute in these helpers, then store, rather than
 * round-tripping through storage in the middle of a calculation.
 *
 * Unlike the vector and matrix modules there is no `out` parameter: numbers are
 * immutable, so every function simply returns its result. Angles are radians.
 *
 * @module scalars
 */

import { EPSILON } from './constants.js';

/**
 * Constrains `value` to the inclusive range `[min, max]`.
 *
 * Assumes `min <= max`. If they are passed the wrong way round the lower bound
 * wins and you get `min` back, rather than an error — worth knowing if the
 * bounds are computed rather than literal. `NaN` in gives `NaN` out.
 *
 * @param value - The value to constrain.
 * @param min - The lower bound.
 * @param max - The upper bound.
 * @returns `value` limited to the range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Constrains `value` to `[0, 1]`.
 *
 * Named after the shader intrinsic of the same name. Use it for interpolation
 * factors, colour channels, and anything else that is meaningless outside the
 * unit range.
 *
 * @param value - The value to constrain.
 * @returns `value` limited to `[0, 1]`.
 */
export function saturate(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Rounds `value` to `decimals` decimal places.
 *
 * Negative `decimals` round to the left of the point instead:
 * `round(1234, -2)` is `1200`.
 *
 * Two inherited quirks worth knowing, both from `Math.round` and binary
 * floating point rather than from this function:
 *
 * - Halves round toward positive infinity, not away from zero, so `round(-0.5)`
 *   is `-0` and `round(-1.5)` is `-1`.
 * - Decimal fractions aren't exactly representable, so a value that looks like
 *   an exact half may not be one: `round(1.005, 2)` is `1`, because `1.005` is
 *   stored as slightly less than `1.005`.
 *
 * This is for presentation and snapping, not for money.
 *
 * @param value - The value to round.
 * @param decimals - The number of decimal places. Defaults to `0`.
 * @returns The rounded value.
 */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Wraps `value` into the half-open range `[min, max)`.
 *
 * `max` is **exclusive**: it is the same position as `min`, one turn along, so
 * `wrap(360, 0, 360)` is `0`. Negative inputs wrap forward as you'd expect —
 * `wrap(-10, 0, 360)` is `350`.
 *
 * Because the upper bound is exclusive, an array index wraps with the array's
 * length rather than its last index: `wrap(i, 0, items.length)`.
 *
 * Returns `NaN` for a degenerate range where `min === max`.
 *
 * @param value - The value to wrap.
 * @param min - The inclusive lower bound.
 * @param max - The exclusive upper bound.
 * @returns `value` wrapped into the range.
 */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

/**
 * Collapses values very close to zero down to exactly `0`.
 *
 * Useful for cleaning up accumulated drift before a sign test or a
 * normalisation, so a residue like `-1e-9` doesn't read as a direction.
 *
 * The threshold is strict, so a value of exactly `EPSILON` is left alone, and
 * it is absolute rather than relative — see `EPSILON` for why that only means
 * what you want near unit scale.
 *
 * @param value - The value to snap.
 * @returns `0` if `value` is within `EPSILON` of zero, otherwise `value`.
 */
export function snapToZero(value: number): number {
  return Math.abs(value) < EPSILON ? 0 : value;
}

/**
 * Compares two numbers for approximate equality.
 *
 * The tolerance is **relative**: it is scaled by the larger of the two
 * magnitudes, floored at `1`. So it behaves like an absolute `eps` for values
 * near unit scale, and widens as the numbers grow — which is what float32
 * storage needs, since the gap between representable values grows with
 * magnitude too. Comparing against a fixed `eps` by hand will fail for large
 * world coordinates where this succeeds.
 *
 * The boundary is inclusive: a difference of exactly the scaled tolerance
 * counts as equal.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @param eps - The base tolerance, before scaling. Defaults to `EPSILON`.
 * @returns `true` if the values are within tolerance of each other.
 */
export function isEqualEpsilon(a: number, b: number, eps = EPSILON): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}
