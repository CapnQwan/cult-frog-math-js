/**
 * 3x3 matrices, stored as 9 contiguous floats in column-major order.
 *
 * Arguments are given in *row-major* order, so a matrix spelled out in source
 * reads the way it does on paper; these functions transpose on the way into
 * memory. Element names are always `a<row><col>`, raw indices are always
 * column major:
 *
 * ```text
 *   a00  a01  a02          0   3   6
 *   a10  a11  a12    ->    1   4   7
 *   a20  a21  a22          2   5   8
 * ```
 *
 * Note that a `Mat3` is packed tightly as 9 floats, while WGSL's `mat3x3<f32>`
 * and std140 pad each column to 16 bytes. See the `Mat3` type for what that
 * means when uploading one to the GPU.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module mat3
 */

import type { Mat3, ReadonlyMat3 } from './_types/mat3.js';

/**
 * Allocates a new matrix from elements given in row-major order.
 *
 * Omitted elements default to `0`, so `create()` is the **zero** matrix, not
 * the identity. For a fresh identity matrix use `clone(IDENTITY)`.
 *
 * Values are stored as float32, so they may be rounded.
 *
 * @returns A new matrix with its own buffer.
 */
// biome-ignore format: visual alignment with the matrix
export function create(
  a00: number = 0, a01: number = 0, a02: number = 0,
  a10: number = 0, a11: number = 0, a12: number = 0,
  a20: number = 0, a21: number = 0, a22: number = 0
): Mat3 {
  const out = new Float32Array(9) as Mat3;

  out[0] = a00; out[3] = a01; out[6] = a02;
  out[1] = a10; out[4] = a11; out[7] = a12;
  out[2] = a20; out[5] = a21; out[8] = a22;

  return out;
}

/**
 * Allocates a new matrix with the same elements as `a`.
 *
 * Use this to take a standalone snapshot of a pooled view: the result has its
 * own buffer and won't change when the original memory is written to. It is
 * also how you get a mutable identity matrix, via `clone(IDENTITY)`.
 *
 * @param a - The matrix to clone.
 * @returns A new matrix with its own buffer.
 */
// biome-ignore format: visual alignment with the matrix
export function clone(a: ReadonlyMat3): Mat3 {
  return create(
    a[0], a[3], a[6],
    a[1], a[4], a[7],
    a[2], a[5], a[8],
  );
}

/**
 * Writes all nine elements into `out`, given in row-major order. Values are
 * rounded to float32.
 *
 * Every element is overwritten, so whatever `out` held before is irrelevant.
 *
 * @param out - The matrix to write to.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function set(
  out: Mat3,
  a00: number, a01: number, a02: number,
  a10: number, a11: number, a12: number,
  a20: number, a21: number, a22: number,
): Mat3 {
  out[0] = a00; out[3] = a01; out[6] = a02;
  out[1] = a10; out[4] = a11; out[7] = a12;
  out[2] = a20; out[5] = a21; out[8] = a22;
  return out;
}

/**
 * Copies the elements of `a` into `out`.
 *
 * `out` and `a` may be the same matrix, or different views that overlap the
 * same memory: every element is read into a local before anything is written,
 * so nothing can be clobbered before it has been used.
 *
 * @param out - The matrix to write to.
 * @param a - The matrix to copy from.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function copy(out: Mat3, a: ReadonlyMat3): Mat3 {
  const a00 = a[0], a01 = a[3], a02 = a[6];
  const a10 = a[1], a11 = a[4], a12 = a[7];
  const a20 = a[2], a21 = a[5], a22 = a[8];

  out[0] = a00; out[3] = a01; out[6] = a02;
  out[1] = a10; out[4] = a11; out[7] = a12;
  out[2] = a20; out[5] = a21; out[8] = a22;
  
  return out;
}

/**
 * Writes the identity matrix into `out`, discarding its previous contents.
 *
 * This is the in-place reset; it allocates nothing. To get a *new* identity
 * matrix, use `clone(IDENTITY)`.
 *
 * @param out - The matrix to write to.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function identity(out: Mat3): Mat3 {
  return set(
    out,
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  );
}

/**
 * The 3x3 identity matrix.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Mat3`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const IDENTITY = identity(create()) as ReadonlyMat3;
