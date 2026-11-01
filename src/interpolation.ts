/**
 * Interpolation helpers: moving between two values, and finding where a value
 * sits between two others.
 *
 * Like the scalar helpers these work on plain `number`s, which are float64, so
 * a result is rounded when it lands in a `Vec3` or a `Mat4`. There is no `out`
 * parameter: every function simply returns its result.
 *
 * @module interpolation
 */

import { clamp } from './scalars.js';

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
 * Finds how far `v` sits between `min` and `max`, as a factor in `[0, 1]`.
 *
 * The inverse of `lerp`, within the range: `invLerp(0, 10, 2.5)` is `0.25`.
 *
 * **Clamped**, unlike `lerp`: values outside the range are held at `0` or `1`,
 * so `invLerp(0, 10, 15)` is `1`. That means feeding the result back through
 * `lerp` only recovers `v` when `v` was inside the range —
 * `lerp(0, 10, invLerp(0, 10, 15))` is `10`, not `15`.
 *
 * The parameter order matches the GLSL/HLSL `smoothstep` intrinsic — edges
 * first, value last — not the `(value, min, max)` order that `clamp` uses.
 *
 * Reversed bounds are fine and give a descending ramp: `invLerp(10, 0, 2.5)` is
 * `0.75`.
 *
 * A degenerate range where `min === max` has no meaningful answer, and doesn't
 * give a consistent one: `NaN` when `v === min`, `1` when `v` is above it and
 * `0` when `v` is below it. Guard against it if the bounds are computed rather
 * than literal. `NaN` in gives `NaN` out.
 *
 * @param min - The value mapping to `0`.
 * @param max - The value mapping to `1`.
 * @param v - The value to locate.
 * @returns The position of `v` in the range, limited to `[0, 1]`.
 */
export function invLerp(min: number, max: number, v: number): number {
  return clamp((v - min) / (max - min), 0, 1);
}
