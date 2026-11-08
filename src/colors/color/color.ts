/**
 * Linear RGBA colours stored as a `Float32Array` of length 4: `[r, g, b, a]`,
 * with each channel a float where `0` is none and `1` is full intensity.
 *
 * Channels are linear: proportional to emitted light, so `0.5` is half the
 * light of `1`. That makes arithmetic on them physically meaningful, so
 * `lerp`, averaging and lighting maths give the results light actually
 * would. It is also what a linear shader pipeline expects in a uniform; the
 * GPU decodes sRGB textures and encodes sRGB render targets, but never
 * converts uniform values.
 *
 * Values from colour pickers, CSS hex and `Color32` are sRGB-encoded, not
 * linear. Decode them before storing them here: `fromColor32` applies the
 * sRGB transfer function, and `Color32.fromColor` encodes back. Dividing by
 * `255` alone gives a colour that renders lighter and washed out. Alpha is
 * coverage, not light, so it is never encoded and is only ever scaled.
 *
 * This is the layout a shader reads: a `Color` uploads as a `vec4<f32>`
 * uniform or a `float32x4` vertex attribute with no conversion. Nothing
 * clamps, so channels above `1` are valid HDR values and survive every
 * function here. Colours are not premultiplied.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module color
 */

import { EPSILON } from '../../constants.js';
import * as Interpolation from '../../interpolation.js';
import * as Scalar from '../../scalars.js';
import { Color32 } from '../color32/index.js';
import { srgbToLinear } from '../srgb.js';

import type { Color, ReadonlyColor } from './_types/color.js';

/** The number of elements in a `Color`. */
export const SIZE = 4;

/**
 * Allocates a new colour. Omitted colour channels default to `0` and alpha
 * defaults to `1`, so `create()` is `BLACK` and `create(1, 0, 0)` is opaque
 * red. Pass `0` for alpha to get a transparent colour.
 *
 * Values are stored as float32, so they may be rounded
 * (`create(0.1)[0]` reads back as `0.10000000149011612`), and nothing is
 * clamped.
 *
 * @param r - The red channel, usually `0` to `1`.
 * @param g - The green channel, usually `0` to `1`.
 * @param b - The blue channel, usually `0` to `1`.
 * @param alpha - The alpha channel, usually `0` to `1`, where `1` is opaque.
 * Defaults to `1`.
 * @returns A new colour with its own buffer.
 */
export function create(r: number = 0, g: number = 0, b: number = 0, alpha: number = 1): Color {
  const color = new Float32Array(SIZE) as Color;
  color[0] = r;
  color[1] = g;
  color[2] = b;
  color[3] = alpha;
  return color;
}

/**
 * Allocates a new colour with the same channels as `a`.
 *
 * Use this to take a mutable copy of a shared constant, or a standalone
 * snapshot of a pooled view: the result has its own buffer and won't change
 * when the original memory is written to.
 *
 * @param a - The colour to clone.
 * @returns A new colour with its own buffer.
 */
export function clone(a: ReadonlyColor): Color {
  return create(a[0], a[1], a[2], a[3]);
}

/**
 * Writes `r`, `g`, `b` and `alpha` into `out`. Values are rounded to float32
 * and not clamped.
 *
 * Unlike `create`, alpha has no default. `set` overwrites a colour that
 * already exists, so a default of `1` would quietly make a translucent colour
 * opaque whenever only its colour channels were meant to change.
 *
 * @param out - The colour to write to.
 * @param r - The red channel, usually `0` to `1`.
 * @param g - The green channel, usually `0` to `1`.
 * @param b - The blue channel, usually `0` to `1`.
 * @param alpha - The alpha channel, usually `0` to `1`, where `1` is opaque.
 * @returns `out`.
 */
export function set(out: Color, r: number, g: number, b: number, alpha: number): Color {
  out[0] = r;
  out[1] = g;
  out[2] = b;
  out[3] = alpha;
  return out;
}

/**
 * Copies the channels of `a` into `out`.
 *
 * `out` and `a` may be the same colour or overlapping views of the same
 * memory.
 *
 * @param out - The colour to write to.
 * @param a - The colour to copy from.
 * @returns `out`.
 */
export function copy(out: Color, a: ReadonlyColor): Color {
  // biome-ignore format: packed component reads
  const r = a[0], g = a[1], b = a[2], alpha = a[3];
  out[0] = r;
  out[1] = g;
  out[2] = b;
  out[3] = alpha;
  return out;
}

/**
 * Returns whether two colours have exactly equal channels, alpha included.
 *
 * `-0` and `0` are equal, and a `NaN` channel is never equal to anything.
 *
 * @param a - The first colour.
 * @param b - The second colour.
 * @returns `true` if every channel is equal.
 */
export function isEqual(a: ReadonlyColor, b: ReadonlyColor): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/**
 * Returns whether two colours are equal within a tolerance, compared channel
 * by channel, alpha included.
 *
 * Each channel goes through the scalar `isEqualEpsilon`, so the tolerance is
 * `eps` for channels in the usual `0` to `1` range and widens for HDR values
 * above `1`. The default is far finer than any visible difference; pass a
 * larger `eps` (`1 / 255` is one 8-bit step) to ask whether two colours look
 * the same. Infinite and `NaN` channels are never equal.
 *
 * @param a - The first colour.
 * @param b - The second colour.
 * @param eps - The base tolerance, before scaling. Defaults to {@link EPSILON}.
 * @returns `true` if every channel is within tolerance.
 */
export function isEqualEpsilon(a: ReadonlyColor, b: ReadonlyColor, eps = EPSILON): boolean {
  return (
    Scalar.isEqualEpsilon(a[0], b[0], eps) &&
    Scalar.isEqualEpsilon(a[1], b[1], eps) &&
    Scalar.isEqualEpsilon(a[2], b[2], eps) &&
    Scalar.isEqualEpsilon(a[3], b[3], eps)
  );
}

/**
 * Returns whether a colour's red, green and blue channels equal `r`, `g` and
 * `b`, ignoring alpha.
 *
 * `r`, `g` and `b` are rounded to 32-bit floats first, as {@link set} stores
 * them, so the comparison holds immediately after setting those values.
 *
 * @param a - The colour.
 * @param r - The red channel to compare.
 * @param g - The green channel to compare.
 * @param b - The blue channel to compare.
 * @returns `true` if all three colour channels are equal.
 */
export function isEqualRGB(a: ReadonlyColor, r: number, g: number, b: number): boolean {
  return Math.fround(r) === a[0] && Math.fround(g) === a[1] && Math.fround(b) === a[2];
}

/**
 * Returns whether a colour's channels equal `r`, `g`, `b` and `alpha`.
 *
 * The values are rounded to 32-bit floats first, as {@link set} stores them,
 * so `isEqualRGBA(c, r, g, b, alpha)` is `true` immediately after
 * `set(c, r, g, b, alpha)`.
 *
 * @param a - The colour.
 * @param r - The red channel to compare.
 * @param g - The green channel to compare.
 * @param b - The blue channel to compare.
 * @param alpha - The alpha channel to compare.
 * @returns `true` if all four channels are equal.
 */
export function isEqualRGBA(
  a: ReadonlyColor,
  r: number,
  g: number,
  b: number,
  alpha: number
): boolean {
  return (
    Math.fround(r) === a[0] &&
    Math.fround(g) === a[1] &&
    Math.fround(b) === a[2] &&
    Math.fround(alpha) === a[3]
  );
}

/**
 * Interpolates between two colours, channel by channel, and writes the result
 * into `out`.
 *
 * `t` is not clamped and neither is the result: outside `[0, 1]` every
 * channel extrapolates, so `lerp(out, BLACK, WHITE, 2)` gives `2` in each
 * colour channel. Uses `a + (b - a) * t`, which gives exactly `a` at `t = 0`.
 * Like every function here, it follows float rules rather than guarding:
 * `NaN` for `t` gives `NaN` in every channel, and an infinite `t` gives `NaN`
 * in any channel with the same value at both ends (`0 * Infinity`).
 *
 * Because channels are linear, this is a blend of light: the midpoint of
 * `BLACK` and `WHITE` emits half of white's light, and red to green passes
 * through a yellow rather than the darker, muddy one an sRGB blend gives.
 * Alpha is interpolated like the other channels and colours are not
 * premultiplied, so a fade from `RED` to `TRANSPARENT` passes through
 * half-transparent dark red (`0.5, 0, 0, 0.5`) rather than half-transparent
 * red.
 *
 * @param out - The colour to write to.
 * @param a - The colour at `t = 0`.
 * @param b - The colour at `t = 1`.
 * @param t - How far to go from `a` to `b`, usually `0` to `1`.
 * @returns `out`.
 */
export function lerp(out: Color, a: ReadonlyColor, b: ReadonlyColor, t: number): Color {
  // biome-ignore format: packed component reads
  const aR = a[0], aG = a[1], aB = a[2], aAlpha = a[3];
  // biome-ignore format: packed component reads
  const bR = b[0], bG = b[1], bB = b[2], bAlpha = b[3];
  out[0] = Interpolation.lerp(aR, bR, t);
  out[1] = Interpolation.lerp(aG, bG, t);
  out[2] = Interpolation.lerp(aB, bB, t);
  out[3] = Interpolation.lerp(aAlpha, bAlpha, t);
  return out;
}

/** Reciprocal of `255`, the largest 8-bit channel value; maps a byte to `0`–`1`. */
const INV_CHANNEL_MAX = 1 / 255;

/**
 * Decodes a packed sRGB `Color32` into a linear colour and writes it into
 * `out`.
 *
 * Each colour channel is scaled from `0`–`255` to `0`–`1` and then decoded
 * with the sRGB transfer function, so byte `128` becomes about `0.216`, not
 * `0.5`. Alpha is coverage, not light, so it is only scaled. Use this for
 * colours from pickers, CSS hex or `ImageData` before lighting or blending
 * with them.
 *
 * Results are rounded to float32 as {@link set} stores them, and every
 * colour survives a round trip: `Color32.fromColor(fromColor32(out, c))` is
 * `c` for any `c`. The named constants match exactly in both namespaces.
 *
 * @param out - The colour to write to.
 * @param color32 - The packed colour to decode.
 * @returns `out`.
 */
export function fromColor32(out: Color, color32: Color32): Color {
  const r = srgbToLinear(Color32.red(color32) * INV_CHANNEL_MAX);
  const g = srgbToLinear(Color32.green(color32) * INV_CHANNEL_MAX);
  const b = srgbToLinear(Color32.blue(color32) * INV_CHANNEL_MAX);
  const alpha = Color32.alpha(color32) * INV_CHANNEL_MAX;
  return set(out, r, g, b, alpha);
}

// Every constant below uses only 0 and 1 in each channel. Those are fixed
// points of the sRGB transfer function, so each constant has the same values
// as its `Color32` counterpart scaled to 0–1, with no decoding needed.

/**
 * Opaque white, `(1, 1, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const WHITE = create(1, 1, 1, 1) as ReadonlyColor;

/**
 * Opaque black, `(0, 0, 0, 1)`. Also what `create()` gives with no
 * arguments.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const BLACK = create(0, 0, 0, 1) as ReadonlyColor;

/**
 * Opaque red, `(1, 0, 0, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const RED = create(1, 0, 0, 1) as ReadonlyColor;

/**
 * Opaque green at full intensity, `(0, 1, 0, 1)`. Brighter than CSS `green`,
 * which is `#008000`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const GREEN = create(0, 1, 0, 1) as ReadonlyColor;

/**
 * Opaque blue, `(0, 0, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const BLUE = create(0, 0, 1, 1) as ReadonlyColor;

/**
 * Opaque yellow, `(1, 1, 0, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const YELLOW = create(1, 1, 0, 1) as ReadonlyColor;

/**
 * Opaque cyan, `(0, 1, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const CYAN = create(0, 1, 1, 1) as ReadonlyColor;

/**
 * Opaque magenta, `(1, 0, 1, 1)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const MAGENTA = create(1, 0, 1, 1) as ReadonlyColor;

/**
 * Transparent black, `(0, 0, 0, 0)`.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Color`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const TRANSPARENT = create(0, 0, 0, 0) as ReadonlyColor;
