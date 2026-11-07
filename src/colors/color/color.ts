/**
 * RGBA colours stored as a `Float32Array` of length 4: `[r, g, b, a]`, with
 * each channel a float where `0` is none and `1` is full intensity.
 *
 * This is the layout a shader reads: a `Color` uploads as a `vec4<f32>`
 * uniform or a `float32x4` vertex attribute with no conversion. Nothing
 * clamps, so channels above `1` are valid HDR values and survive every
 * function here.
 *
 * A `Color` doesn't record its colour space. Store whichever the consumer
 * expects, but `lerp` and any other arithmetic blend the values as stored, so
 * they are only physically meaningful on linear values. Colours are not
 * premultiplied.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module color
 */

import * as Interpolation from '../../interpolation.js';

import type { Color, ReadonlyColor } from './_types/color.js';

/** The number of elements in a `Color`. */
export const SIZE = 4;

/**
 * Allocates a new colour. Omitted channels default to `0`, alpha included,
 * so `create()` is `TRANSPARENT` and `create(1, 0, 0)` is a transparent red.
 * Pass alpha explicitly for an opaque colour.
 *
 * Values are stored as float32, so they may be rounded
 * (`create(0.1)[0]` reads back as `0.10000000149011612`), and nothing is
 * clamped.
 *
 * @param r - The red channel, usually `0` to `1`.
 * @param g - The green channel, usually `0` to `1`.
 * @param b - The blue channel, usually `0` to `1`.
 * @param a - The alpha channel, usually `0` to `1`, where `1` is opaque.
 * @returns A new colour with its own buffer.
 */
export function create(r: number = 0, g: number = 0, b: number = 0, a: number = 0): Color {
  const color = new Float32Array(SIZE) as Color;
  color[0] = r;
  color[1] = g;
  color[2] = b;
  color[3] = a;
  return color;
}

/**
 * Interpolates between two colours, channel by channel, and writes the result
 * into `out`.
 *
 * `t` is not clamped and neither is the result: outside `[0, 1]` every
 * channel extrapolates, so `lerp(out, BLACK, WHITE, 2)` gives `2` in each
 * colour channel. Uses `a + (b - a) * t`, which gives exactly `a` at `t = 0`.
 *
 * The blend works on the stored values. On linear values it's a blend of
 * light; on sRGB-encoded values the midpoint of `BLACK` and `WHITE` displays
 * darker than a physically half-way grey. Alpha is interpolated like the
 * other channels and colours are not premultiplied, so a fade from `RED` to
 * `TRANSPARENT` passes through half-transparent dark red (`0.5, 0, 0, 0.5`)
 * rather than half-transparent red.
 *
 * @param out - The colour to write to.
 * @param a - The colour at `t = 0`.
 * @param b - The colour at `t = 1`.
 * @param t - How far to go from `a` to `b`, usually `0` to `1`.
 * @returns `out`.
 */
export function lerp(out: Color, a: ReadonlyColor, b: ReadonlyColor, t: number): Color {
  // biome-ignore format: packed component reads
  const aR = a[0], aG = a[1], aB = a[2], aA = a[3];
  // biome-ignore format: packed component reads
  const bR = b[0], bG = b[1], bB = b[2], bA = b[3];
  out[0] = Interpolation.lerp(aR, bR, t);
  out[1] = Interpolation.lerp(aG, bG, t);
  out[2] = Interpolation.lerp(aB, bB, t);
  out[3] = Interpolation.lerp(aA, bA, t);
  return out;
}

// Every constant below uses only 0 and 1 in each channel, which encode to the
// same values in linear and sRGB, so they're correct in either colour space.

/**
 * Opaque white, `(1, 1, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; copy it into a colour you own if you need a mutable one.
 */
export const WHITE = create(1, 1, 1, 1) as ReadonlyColor;

/**
 * Opaque black, `(0, 0, 0, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it.
 */
export const BLACK = create(0, 0, 0, 1) as ReadonlyColor;

/**
 * Opaque red, `(1, 0, 0, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it.
 */
export const RED = create(1, 0, 0, 1) as ReadonlyColor;

/**
 * Opaque green at full intensity, `(0, 1, 0, 1)`. Brighter than CSS `green`,
 * which is `#008000`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it.
 */
export const GREEN = create(0, 1, 0, 1) as ReadonlyColor;

/**
 * Opaque blue, `(0, 0, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it.
 */
export const BLUE = create(0, 0, 1, 1) as ReadonlyColor;

/**
 * Opaque yellow, `(1, 1, 0, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it.
 */
export const YELLOW = create(1, 1, 0, 1) as ReadonlyColor;

/**
 * Opaque cyan, `(0, 1, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it.
 */
export const CYAN = create(0, 1, 1, 1) as ReadonlyColor;

/**
 * Opaque magenta, `(1, 0, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it.
 */
export const MAGENTA = create(1, 0, 1, 1) as ReadonlyColor;

/**
 * Transparent black, `(0, 0, 0, 0)`. Also what `create()` gives with no
 * arguments.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it.
 */
export const TRANSPARENT = create(0, 0, 0, 0) as ReadonlyColor;
