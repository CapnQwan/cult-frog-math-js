/**
 * Shared numeric constants.
 *
 * These are plain `number`s, so they carry full float64 precision. Writing one
 * into any of this package's `Float32Array`-backed types rounds it — `PI`
 * stored in a `Vec3` reads back as `3.1415927410125732`, not `Math.PI`. Compare
 * against `Math.fround(PI)` if you need an exact match against stored data.
 *
 * @module constants
 */

/**
 * The tolerance used for approximate comparisons, `1e-6`.
 *
 * Sized for float32 storage: the type's machine epsilon is about `1.19e-7`, so
 * `1e-6` sits roughly an order of magnitude above the smallest representable
 * difference near `1.0` — loose enough to absorb a few rounded operations,
 * tight enough to still mean "equal".
 *
 * This is an **absolute** tolerance, and it is calibrated for values near unit
 * scale. Float32 spacing grows with magnitude: around `10,000` consecutive
 * float32 values are about `0.001` apart, a thousand times `EPSILON`, so two
 * adjacent-but-distinct world coordinates at that scale will never compare
 * equal against it.
 *
 * `equalsEpsilon` already handles that: it scales the tolerance by the larger
 * of the two magnitudes, floored at `1`, so it behaves like an absolute `1e-6`
 * near unit scale and widens from there. Prefer it over comparing against
 * `EPSILON` by hand whenever the values might be large.
 */
export const EPSILON = 1e-6;

/**
 * `EPSILON` squared, `1e-12`.
 *
 * For comparisons against a squared length or squared distance, which lets you
 * skip the `Math.sqrt`: testing `lengthSquared < EPSILON_SQUARED` is equivalent
 * to `length < EPSILON` but cheaper, and is the usual way to check whether a
 * vector is short enough to treat as zero before normalising.
 *
 * Note that squaring compounds the scale sensitivity described on `EPSILON`:
 * the tolerance is only meaningful for lengths near unit scale.
 */
export const EPSILON_SQUARED = EPSILON * EPSILON;

/**
 * The ratio of a circle's circumference to its diameter, `3.141592653589793`.
 *
 * Re-exported from `Math.PI` so that angle constants can be imported from one
 * place alongside the rest of the package.
 */
export const PI = Math.PI;

/**
 * A full turn in radians: `2 * PI`, or `6.283185307179586`.
 */
export const TWO_PI = PI * 2;
