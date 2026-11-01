/**
 * Cubic eases: the power curves at exponent 3.
 *
 * @module cubic
 */

import * as Base from './base.js';

/**
 * Starts slowly and accelerates: `t³`.
 *
 * Lands exactly on `0` and `1`. Does **not** clamp `t`, so it overshoots quickly
 * outside the unit range: `easeIn(2)` is `8`. Wrap `t` in `saturate` if it can
 * leave the range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export const easeIn = Base.easeIn(3);

/**
 * Starts quickly and decelerates: `1 - (1 - t)³`.
 *
 * Lands exactly on `0` and `1`. Does **not** clamp `t`, so it overshoots quickly
 * outside the unit range: `easeOut(-1)` is `-7`. Wrap `t` in `saturate` if it
 * can leave the range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export const easeOut = Base.easeOut(3);

/**
 * Accelerates to the midpoint, then decelerates, and is flat at both ends.
 *
 * Not the same curve as `Smooth.smoothstep`, even though both are cubic and flat
 * at the ends: this is steeper in the middle, so at `t = 0.25` it gives `0.0625`
 * where `smoothstep` gives `0.15625`.
 *
 * Lands exactly on `0`, `0.5` and `1`. Does **not** clamp `t`, so it overshoots
 * quickly outside the unit range: `easeInOut(2)` is `5`. Wrap `t` in `saturate`
 * if it can leave the range.
 *
 * @param t - The progress from `0` to `1`.
 * @returns The eased progress.
 */
export const easeInOut = Base.easeInOut(3);
