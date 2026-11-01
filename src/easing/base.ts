/**
 * Factories behind the power eases: `Quad`, `Cubic`, `Quart` and `Quint` are
 * these three curves at exponents 2 to 5.
 *
 * Each factory returns a curve taking `t`, the progress from `0` to `1`. Curves
 * do not clamp `t`, so wrap it in `saturate` if it can leave the unit range.
 *
 * @module base
 */

/**
 * Creates a curve that starts slowly and accelerates: `t^exponent`.
 *
 * Assumes `exponent > 0`: at `0` the curve is a constant `1`, because `0 ** 0`
 * is `1`, and a negative exponent gives `Infinity` at `t = 0`.
 *
 * The curve lands exactly on `0` and `1`. It does not clamp `t`, and outside the
 * unit range the result depends on the exponent: an even one folds back, so
 * `easeIn(2)(-1)` is `1`, and a fractional one gives `NaN` for a negative `t`.
 *
 * @param exponent - The power to raise `t` to. Higher is more pronounced.
 * @returns The curve, taking `t` and returning the eased progress.
 */
export function easeIn(exponent: number): (t: number) => number {
  return (t: number) => t ** exponent;
}

/**
 * Creates a curve that starts quickly and decelerates: `1 - (1 - t)^exponent`.
 * This is `easeIn` mirrored, so `easeOut(n)(t)` is `1 - easeIn(n)(1 - t)`.
 *
 * Assumes `exponent > 0`: at `0` the curve is a constant `0`, because `0 ** 0`
 * is `1`, and a negative exponent gives `-Infinity` at `t = 1`.
 *
 * The curve lands exactly on `0` and `1`. It does not clamp `t`, and outside the
 * unit range the result depends on the exponent: an even one folds back, so
 * `easeOut(2)(2)` is `0`, and a fractional one gives `NaN` for a `t` above `1`.
 *
 * @param exponent - The power to raise `1 - t` to. Higher is more pronounced.
 * @returns The curve, taking `t` and returning the eased progress.
 */
export function easeOut(exponent: number): (t: number) => number {
  return (t: number) => 1 - (1 - t) ** exponent;
}

/**
 * Creates a curve that accelerates to the midpoint, then decelerates: `easeIn`
 * squeezed into the first half and `easeOut` into the second.
 *
 * The two halves meet at exactly `0.5` when `t` is `0.5`, and the curve is flat
 * at both ends for any `exponent > 1`. At `1` it is a straight line.
 *
 * Assumes `exponent > 0`: at `0` the curve is a constant `0.5`, because `0 ** 0`
 * is `1`, and a negative exponent gives `Infinity` at `t = 0` and `-Infinity` at
 * `t = 1`.
 *
 * The curve lands exactly on `0` and `1`. It does not clamp `t`, and outside the
 * unit range the result depends on the exponent: an even one folds back, so
 * `easeInOut(2)(-1)` is `2`, and a fractional one gives `NaN`.
 *
 * @param exponent - The power each half is shaped by. Higher is more pronounced.
 * @returns The curve, taking `t` and returning the eased progress.
 */
export function easeInOut(exponent: number): (t: number) => number {
  return (t: number) => (t < 0.5 ? (2 * t) ** exponent / 2 : 1 - (2 - 2 * t) ** exponent / 2);
}
