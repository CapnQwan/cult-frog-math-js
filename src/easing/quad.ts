/**
 * Quadratic eases: the gentlest of the power curves, at exponent 2.
 *
 * @module quad
 */

/**
 * Starts slowly and accelerates: `t²`.
 *
 * Lands exactly on `0` and `1`. Does **not** clamp `t`, and because the exponent
 * is even it folds back below the range: `easeIn(-1)` is `1`, not `-1`. Wrap `t`
 * in `saturate` if it can leave the unit range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export function easeIn(t: number): number {
  return t * t;
}

/**
 * Starts quickly and decelerates: `1 - (1 - t)²`.
 *
 * Lands exactly on `0` and `1`. Does **not** clamp `t`, and because the exponent
 * is even it folds back above the range: `easeOut(2)` is `0`, not `2`. Wrap `t`
 * in `saturate` if it can leave the unit range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export function easeOut(t: number): number {
  const f = 1 - t;
  return 1 - f * f;
}

/**
 * Accelerates to the midpoint, then decelerates, and is flat at both ends.
 *
 * Lands exactly on `0`, `0.5` and `1`. Does **not** clamp `t`, and because the
 * exponent is even it folds back outside the range: `easeInOut(-1)` is `2` and
 * `easeInOut(2)` is `-1`. Wrap `t` in `saturate` if it can leave the unit range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export function easeInOut(t: number): number {
  if (t < 0.5) {
    const f = 2 * t;
    return (f * f) / 2;
  }
  const f = 2 - 2 * t;
  return 1 - (f * f) / 2;
}
