import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../../_types/readonlyFixedFloat32Array.js';

/**
 * A linear RGBA colour stored as a `Float32Array` of length 4: `[r, g, b, a]`,
 * with `0` as none and `1` as full intensity, matching a GLSL/WGSL `vec4`.
 *
 * Linear means each channel is proportional to emitted light, which is what
 * blending and lighting maths assume and what a linear shader pipeline
 * expects in a uniform. sRGB-encoded values (colour pickers, CSS hex,
 * `Color32`) must be decoded before they're stored here; dividing by `255`
 * alone renders lighter and washed out. Alpha is never encoded.
 *
 * Channels are float32, so values are rounded on write
 * (`0.1` reads back as `0.10000000149011612`), and nothing clamps them:
 * values above `1` are valid HDR channels.
 *
 * Branded: a plain `Float32Array` won't type-check, and neither will a `Vec4`,
 * even though the layout is identical. Make one with `Color.create`, or cast
 * when wrapping existing memory (e.g. a pooled view). Any backing buffer
 * works, including a `SharedArrayBuffer`, but nothing here is atomic:
 * coordinate access across threads yourself.
 *
 * For an 8-bit colour packed into one number, use `Color32`.
 */
export type Color = Brand<FixedFloat32Array<4>, 'Color'>;

/**
 * A `Color` that can't be written through, so it can't be passed as `out`.
 *
 * This limits *your* access, not the memory: if it's a view into shared
 * storage, the values can still change underneath you.
 *
 * Hand the value itself to a GPU upload, not its `.buffer`: on a pooled view,
 * `.buffer` is the whole pool, not just this value.
 */
export type ReadonlyColor = Brand<ReadonlyFixedFloat32Array<4>, 'Color'>;
