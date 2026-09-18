/**
 * Scalar helpers: clamping, interpolation, wrapping and approximate equality.
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
 * Linearly interpolates from `a` to `b` by `t`.
 *
 * **Unclamped**: `t` outside `[0, 1]` extrapolates rather than saturating, so
 * `lerp(0, 10, 1.5)` is `15` and `lerp(0, 10, -0.5)` is `-5`. Wrap `t` in
 * `saturate` if you need the endpoints held.
 *
 * `t = 0` returns `a` exactly. `t = 1` is *not* guaranteed to return `b`
 * exactly: this is the fast form, `a + (b - a) * t`, and the subtraction loses
 * precision when `a` and `b` differ in magnitude. It is exact when both sit
 * near unit scale, and drifts by an ulp or so otherwise. If landing precisely
 * on `b` matters — a value compared for equality, or a loop that must settle —
 * use the slower `(1 - t) * a + t * b` instead.
 *
 * @param a - The value at `t = 0`.
 * @param b - The value at `t = 1`.
 * @param t - The interpolation factor.
 * @returns The interpolated value.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Maps `value` from the range `[min, max]` onto a smooth `0`-to-`1` ramp.
 *
 * The classic Hermite ease: the input is first clamped to the range, then
 * shaped by `3x² - 2x³`. The curve's slope is zero at both ends, so motion
 * driven by it starts and stops gently instead of turning a corner — that
 * easing is the whole reason to prefer it over a linear remap.
 *
 * The parameter order matches the GLSL/HLSL intrinsic — edges first, value
 * last — not the `(value, min, max)` order that `clamp` uses.
 *
 * Returns `NaN` for a degenerate range where `min === max`.
 *
 * @param min - The input value mapping to `0`.
 * @param max - The input value mapping to `1`.
 * @param value - The value to map.
 * @returns A smoothly eased value in `[0, 1]`.
 */
export function smoothstep(min: number, max: number, value: number): number {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
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
export function equalsEpsilon(a: number, b: number, eps = EPSILON): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}
