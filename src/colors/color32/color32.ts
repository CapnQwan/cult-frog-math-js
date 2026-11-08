/**
 * sRGB-encoded RGBA colours packed into one unsigned 32-bit integer as
 * `0xRRGGBBAA`, with 8 bits per channel.
 *
 * The colour channels are sRGB-encoded, not linear: the transfer function
 * spends more of the 256 levels on dark tones, where eyes notice differences
 * most, which is what keeps 8 bits per channel free of visible banding. That
 * is the space CSS hex, colour pickers, PNGs and `ImageData` use, so values
 * from any of them can be stored as they are. Alpha is coverage, not light,
 * and is never encoded.
 *
 * Because the channels are encoded, arithmetic on them is not arithmetic on
 * light. Decode to a linear `Color` with `Color.fromColor32` for lighting or
 * physically correct blending, and encode back with `fromColor`; dividing by
 * `255` alone is not a decode.
 *
 * The packing follows CSS hex notation, so a `Color32` can be compared directly
 * against a literal (`Color32.create(255, 128, 0, 255) === 0xff8000ff`). It is
 * not a GPU byte layout: written into a `Uint32Array` on a little-endian
 * machine (nearly all of them), the bytes land in memory as `AA BB GG RR`,
 * not the `RR GG BB AA` that `unorm8x4` vertex attributes and `ImageData`
 * expect.
 *
 * A `Color32` is a plain number, so nothing here allocates and there are no
 * `out` parameters.
 *
 * @module color32
 */

import * as Interpolation from '../../interpolation.js';
import * as Scalar from '../../scalars.js';
import { linearToSrgb } from '../srgb.js';

import type { ReadonlyColor } from '../color/index.js';
import type { Color32 } from './_types/color32.js';

const R_SHIFT = 24;
const G_SHIFT = 16;
const B_SHIFT = 8;
const A_SHIFT = 0;

const CHANNEL_MIN = 0;
const CHANNEL_MAX = 255;
const CHANNEL_MASK = 0xff;

/** Reads the 8-bit channel stored `shift` bits up. */
function toChannel(value: number, shift: number): number {
  return (value >> shift) & CHANNEL_MASK;
}

/**
 * Rounds `value` to the nearest integer, keeps its low 8 bits and moves them
 * `shift` bits up. Masking before the shift is what stops an out-of-range
 * value bleeding into the channel above it.
 *
 * `Math.round` rather than `+ 0.5` and a bitwise truncate: truncation runs
 * toward zero, so the `+ 0.5` trick shifts every negative value up by one and
 * `-1` would pack as `0` instead of wrapping to `255`.
 */
function fromChannel(value: number, shift: number): number {
  return (Math.round(value) & CHANNEL_MASK) << shift;
}

/**
 * Packs four 8-bit channels into a `Color32`.
 *
 * Each channel is an integer from `0` to `255`. Fractions are rounded to the
 * nearest integer, halves toward positive infinity (`127.5` becomes `128`,
 * `127.4` becomes `127`), so channels computed in floating point land on the
 * closest representable value. After rounding only the low 8 bits are kept,
 * so out-of-range values wrap rather than clamp (`256` becomes `0`, `-1`
 * becomes `255`) and never affect another channel. Rounding happens first,
 * which means `255.5` rounds to `256` and wraps to `0`. `NaN` and the
 * infinities become `0`. Clamp first if you want saturation.
 *
 * Alpha defaults to `255`, so `create(255, 128, 0)` is opaque orange,
 * matching six-digit CSS hex, which has no alpha and is always opaque.
 *
 * @param r - The red channel, `0` to `255`.
 * @param g - The green channel, `0` to `255`.
 * @param b - The blue channel, `0` to `255`.
 * @param alpha - The alpha channel, `0` to `255`, where `255` is opaque.
 * Defaults to `255`.
 * @returns The packed colour, always in the range `0` to `0xffffffff`.
 */
export function create(r: number, g: number, b: number, alpha: number = 255): Color32 {
  const rc = fromChannel(r, R_SHIFT);
  const gc = fromChannel(g, G_SHIFT);
  const bc = fromChannel(b, B_SHIFT);
  const ac = fromChannel(alpha, A_SHIFT);
  return ((rc | gc | bc | ac) >>> 0) as Color32;
}

/**
 * Reads the red channel.
 *
 * @param color32 - The colour to read.
 * @returns The red channel, an integer from `0` to `255`.
 */
export function red(color32: Color32): number {
  return toChannel(color32, R_SHIFT);
}

/**
 * Reads the green channel.
 *
 * @param color32 - The colour to read.
 * @returns The green channel, an integer from `0` to `255`.
 */
export function green(color32: Color32): number {
  return toChannel(color32, G_SHIFT);
}

/**
 * Reads the blue channel.
 *
 * @param color32 - The colour to read.
 * @returns The blue channel, an integer from `0` to `255`.
 */
export function blue(color32: Color32): number {
  return toChannel(color32, B_SHIFT);
}

/**
 * Reads the alpha channel.
 *
 * @param color32 - The colour to read.
 * @returns The alpha channel, an integer from `0` to `255`, where `255` is
 * opaque.
 */
export function alpha(color32: Color32): number {
  return toChannel(color32, A_SHIFT);
}

/** Interpolates one channel and saturates it to the 8-bit range. */
function lerpChannel(from: number, to: number, t: number): number {
  return Scalar.clamp(Interpolation.lerp(from, to, t), CHANNEL_MIN, CHANNEL_MAX);
}

/**
 * Interpolates between two colours, channel by channel.
 *
 * Each channel is interpolated linearly, clamped to `0`–`255`, then rounded
 * to the nearest integer by `create`. `t` itself is not clamped: outside
 * `[0, 1]` each channel extrapolates and then saturates, so
 * `lerp(BLACK, WHITE, 2)` is `WHITE`, while a channel going from `100` to
 * `200` reaches `250` at `t = 1.5`. `NaN` for `t` gives `TRANSPARENT`.
 *
 * `t` must also be finite. An infinite `t` saturates channels that differ,
 * but a channel with the same value at both ends computes `0 * Infinity`,
 * which is `NaN` and packs as `0`: `lerp(BLACK, WHITE, Infinity)` is
 * transparent white (`0xffffff00`), not `WHITE`. Clamp `t` first if it can
 * come from an unbounded source, such as a division by a duration that can be
 * `0`.
 *
 * The blend works on the sRGB-encoded values directly, so it is not a blend
 * of light: the midpoint of `BLACK` and `WHITE` is `128`, which emits about a
 * fifth of white's light rather than half, and red to green passes through a
 * dark, muddy yellow. That's fine for UI tints and fades; use a linear
 * `Color` for lighting or physically correct gradients.
 * Alpha is interpolated like the other channels and colours are not
 * premultiplied, so a fade from `RED` to `TRANSPARENT` passes through
 * half-transparent dark red (`128, 0, 0, 128`) rather than half-transparent
 * red.
 *
 * @param from - The colour at `t = 0`.
 * @param to - The colour at `t = 1`.
 * @param t - The interpolation factor, usually `0` to `1`.
 * @returns The blended colour.
 */
export function lerp(from: Color32, to: Color32, t: number): Color32 {
  return create(
    lerpChannel(red(from), red(to), t),
    lerpChannel(green(from), green(to), t),
    lerpChannel(blue(from), blue(to), t),
    lerpChannel(alpha(from), alpha(to), t)
  );
}

/**
 * Encodes a linear `Color` as a packed sRGB colour.
 *
 * Every channel is first saturated to `0`–`1`, since 8 bits can't hold
 * anything outside it and {@link create} would otherwise wrap: negative
 * channels become `0`, and channels above `1` become `255`. Saturating passes
 * `NaN` through, and `create` then packs it as `0`. Colour
 * channels are then encoded with the sRGB transfer function, so linear `0.5`
 * becomes `188`, not `128`. Alpha is coverage, not light, so it is only
 * scaled. Each channel is rounded to the nearest 8-bit value.
 *
 * Saturating clips HDR values rather than tone mapping them: `(4, 2, 1)` and
 * `(1, 1, 1)` both encode as `WHITE`, so a bright highlight loses its hue.
 * Tone map HDR colours first if that matters.
 *
 * Encoding quantises, so `Color.fromColor32(out, fromColor(c))` only
 * approximates `c`. In linear terms the steps are finest near black and
 * coarsest near white. The other direction is exact: every `Color32`
 * survives a round trip through `Color.fromColor32` and back.
 *
 * @param color - The linear colour to encode.
 * @returns The packed colour.
 */
export function fromColor(color: ReadonlyColor): Color32 {
  // biome-ignore format: packed component reads
  const r = color[0], g = color[1], b = color[2], alpha = color[3];
  return create(
    linearToSrgb(Scalar.saturate(r)) * CHANNEL_MAX,
    linearToSrgb(Scalar.saturate(g)) * CHANNEL_MAX,
    linearToSrgb(Scalar.saturate(b)) * CHANNEL_MAX,
    Scalar.saturate(alpha) * CHANNEL_MAX
  );
}

/** Opaque white, `0xffffffff`. */
export const WHITE = create(255, 255, 255, 255);

/** Opaque black, `0x000000ff`. */
export const BLACK = create(0, 0, 0, 255);

/** Opaque red, `0xff0000ff`. */
export const RED = create(255, 0, 0, 255);

/** Opaque green at full intensity, `0x00ff00ff`. Brighter than CSS `green`, which is `#008000`. */
export const GREEN = create(0, 255, 0, 255);

/** Opaque blue, `0x0000ffff`. */
export const BLUE = create(0, 0, 255, 255);

/** Opaque yellow, `0xffff00ff`. */
export const YELLOW = create(255, 255, 0, 255);

/** Opaque cyan, `0x00ffffff`. */
export const CYAN = create(0, 255, 255, 255);

/** Opaque magenta, `0xff00ffff`. */
export const MAGENTA = create(255, 0, 255, 255);

/**
 * Transparent black, `0x00000000`. Also what `create(0, 0, 0, 0)` produces
 * (leaving alpha out gives `BLACK` instead), and what `lerp` produces for a
 * `NaN` factor.
 */
export const TRANSPARENT = create(0, 0, 0, 0);
