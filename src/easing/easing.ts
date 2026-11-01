/**
 * Easing curves, grouped into one namespace per family.
 *
 * `Quad`, `Cubic`, `Quart` and `Quint` are the power eases, from gentlest to most
 * pronounced, each with `easeIn`, `easeOut` and `easeInOut`. `Smooth` holds the
 * smoothstep curves.
 *
 * Every curve takes `t`, the progress from `0` to `1`, and returns the eased
 * progress, so they can be swapped for one another. For the `(min, max, value)`
 * forms of the smoothstep curves, use `smoothstep` and `smootherstep` from the
 * package root.
 *
 * Curves do not clamp `t`. Wrap it in `saturate` if it can leave the unit range,
 * as results get large or fold back outside it.
 *
 * @module easing
 */

export * as Cubic from './cubic.js';
export * as Quad from './quad.js';
export * as Quart from './quart.js';
export * as Quint from './quint.js';
export * as Smooth from './smooth.js';
