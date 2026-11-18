/**
 * Quintic eases: the most pronounced of the power curves, at exponent 5.
 *
 * @module quint
 */

/**
 * Starts slowly and accelerates: `t⁵`.
 *
 * Lands exactly on `0` and `1`. Does **not** clamp `t`, so it overshoots quickly
 * outside the unit range: `easeIn(2)` is `32`. Wrap `t` in `saturate` if it can
 * leave the range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export function easeIn(t: number): number {
  return t * t * t * t * t;
}

/**
 * Starts quickly and decelerates: `1 - (1 - t)⁵`.
 *
 * Lands exactly on `0` and `1`. Does **not** clamp `t`, so it overshoots quickly
 * outside the unit range: `easeOut(-1)` is `-31`. Wrap `t` in `saturate` if it
 * can leave the range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export function easeOut(t: number): number {
  const f = 1 - t;
  return 1 - f * f * f * f * f;
}

/**
 * Accelerates to the midpoint, then decelerates, and is flat at both ends.
 *
 * Not the same curve as `Smooth.smootherstep`, even though both are quintic and
 * flat at the ends: this stays flat for longer, so at `t = 0.25` it gives
 * `0.015625` where `smootherstep` gives `0.103515625`.
 *
 * Lands exactly on `0`, `0.5` and `1`. Does **not** clamp `t`, so it overshoots
 * quickly outside the unit range: `easeInOut(2)` is `17`. Wrap `t` in `saturate`
 * if it can leave the range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export function easeInOut(t: number): number {
  if (t < 0.5) {
    const f = 2 * t;
    return (f * f * f * f * f) / 2;
  }
  const f = 2 - 2 * t;
  return 1 - (f * f * f * f * f) / 2;
}
