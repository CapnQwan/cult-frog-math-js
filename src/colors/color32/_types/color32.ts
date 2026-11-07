import type { Brand } from '@cult-frog/types';

/**
 * An RGBA colour packed into one unsigned 32-bit integer as `0xRRGGBBAA`,
 * with 8 bits per channel.
 *
 * Always an integer from `0` to `0xffffffff`, which is what makes `===`
 * against a hex literal work. Bitwise operators return signed 32-bit results,
 * so a colour with red at `128` or above comes out negative: apply `>>> 0`
 * before casting anything built by hand.
 *
 * Branded: a plain number won't type-check. Make one with `Color32.create`, or
 * cast a literal whose packing you know (`0xff0000ff as Color32`).
 *
 * This is not a GPU byte layout. Written into a `Uint32Array` on a
 * little-endian machine, the bytes land as `AA BB GG RR`.
 */
export type Color32 = Brand<number, 'Color32'>;
