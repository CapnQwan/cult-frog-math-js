/**
 * Smoothstep curves: single polynomials solved to be flat at both ends, rather
 * than the two joined halves of a power ease's `easeInOut`.
 *
 * Both take a `0`-to-`1` value directly and don't clamp, like every other easing
 * curve. For the GLSL-style `(min, max, value)` forms, which remap and clamp, use
 * `smoothstep` and `smootherstep` from the package root.
 *
 * @module smooth
 */

/**
 * Eases `v` with Ken Perlin's quintic `6v⁵ - 15v⁴ + 10v³`, also known as `fade`
 * in noise code.
 *
 * Flatter at the ends than `smoothstep`: its slope *and* its curvature are zero
 * at both ends, so there's no sudden change in acceleration where motion starts
 * or stops. Not the same curve as `Quint.easeInOut`, which stays flat for longer:
 * at `0.25` this gives `0.103515625` where that gives `0.015625`.
 *
 * This takes a `0`-to-`1` value rather than a range, which skips the divide and
 * the clamp in hot loops such as noise. For a range, use the root
 * `smootherstep(min, max, value)` instead.
 *
 * Lands exactly on `0`, `0.5` and `1`. Does **not** clamp, and overshoots hard
 * outside the unit range: `smootherstep(2)` is `32`. Wrap `v` in `saturate` if it
 * can leave the range.
 *
 * @param v - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export function smootherstep(v: number): number {
  return v * v * v * (v * (v * 6 - 15) + 10);
}

/**
 * Eases `v` with the classic Hermite cubic `3v² - 2v³`.
 *
 * The curve's slope is zero at both ends, so motion driven by it starts and stops
 * gently instead of turning a corner — that easing is the whole reason to prefer
 * it over a linear ramp. Not the same curve as `Cubic.easeInOut`, which is steeper
 * in the middle: at `0.25` this gives `0.15625` where that gives `0.0625`.
 *
 * This takes a `0`-to-`1` value rather than a range, so it can be swapped with any
 * other easing curve. For a range, use the root `smoothstep(min, max, value)`
 * instead.
 *
 * Lands exactly on `0`, `0.5` and `1`. Does **not** clamp, and turns back on itself
 * outside the unit range: `smoothstep(2)` is `-4` and `smoothstep(-1)` is `5`. Wrap
 * `v` in `saturate` if it can leave the range.
 *
 * @param v - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export function smoothstep(v: number): number {
  return v * v * (3 - 2 * v);
}
