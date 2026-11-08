/**
 * The sRGB transfer function (IEC 61966-2-1), shared by `Color.fromColor32`
 * and `Color32.fromColor`.
 *
 * The curve has two segments: a straight line near black, then a power curve
 * with exponent `2.4`. A pure power curve would be infinitely steep at `0`,
 * so the smallest linear values would map to wildly different codes; the
 * straight segment, the "toe", avoids that.
 *
 * Both functions work on single colour channels from `0` to `1`. They are
 * never applied to alpha, which is coverage rather than light and is only
 * ever scaled. Neither clamps: callers saturate first where the result must
 * fit in `0`–`1`.
 *
 * Internal to the package: this module is not re-exported from any entry
 * point and imports neither colour namespace, so both can depend on it
 * without depending on each other.
 *
 * @module srgb
 */

/** The slope of the toe, the straight segment near black. */
const TOE_SLOPE = 12.92;

/** Reciprocal of {@link TOE_SLOPE}, so decoding multiplies rather than divides. */
const INV_TOE_SLOPE = 1 / TOE_SLOPE;

/** The scale of the power segment. Always `1 + CURVE_OFFSET`, so that `1` maps to `1`. */
const CURVE_SCALE = 1.055;

/** Reciprocal of {@link CURVE_SCALE}, so decoding multiplies rather than divides. */
const INV_CURVE_SCALE = 1 / CURVE_SCALE;

/** The offset of the power segment. */
const CURVE_OFFSET = 0.055;

/** The exponent of the power segment. Decoding raises to this power. */
const GAMMA = 2.4;

/** Reciprocal of {@link GAMMA}. Encoding raises to this power. */
const INV_GAMMA = 1 / GAMMA;

/**
 * The encoded value where the toe meets the power segment. At or below it,
 * decoding uses the toe.
 */
const DECODE_THRESHOLD = 0.04045;

/**
 * The linear value where the toe meets the power segment: `DECODE_THRESHOLD`
 * divided by `TOE_SLOPE`, as rounded in the standard. At or below it,
 * encoding uses the toe. Because of that rounding the two segments meet
 * within about `1e-7` rather than exactly, far below float32 or 8-bit
 * precision.
 */
const ENCODE_THRESHOLD = 0.0031308;

/**
 * Decodes one sRGB-encoded channel to linear light.
 *
 * `0` and `1` map to themselves. Values outside `0`–`1` aren't clamped:
 * negatives stay on the toe, and values above `1` continue along the power
 * curve.
 *
 * @param c - The encoded channel, usually `0` to `1`. Divide an 8-bit value
 * by `255` first.
 * @returns The linear channel.
 */
export function srgbToLinear(c: number): number {
  return c <= DECODE_THRESHOLD
    ? c * INV_TOE_SLOPE
    : ((c + CURVE_OFFSET) * INV_CURVE_SCALE) ** GAMMA;
}

/**
 * Encodes one linear channel with the sRGB transfer function. The inverse of
 * {@link srgbToLinear}, up to float64 rounding.
 *
 * `0` and `1` map to themselves, up to float64 rounding. Values outside
 * `0`–`1` aren't clamped: negatives stay on the toe, and values above `1`
 * give results above `1`. Saturate first if the result must fit in 8 bits.
 *
 * @param l - The linear channel, usually `0` to `1`.
 * @returns The encoded channel. Multiply by `255` for an 8-bit value.
 */
export function linearToSrgb(l: number): number {
  return l <= ENCODE_THRESHOLD ? l * TOE_SLOPE : CURVE_SCALE * l ** INV_GAMMA - CURVE_OFFSET;
}
