/**
 * 4x4 matrices, stored as 16 contiguous floats in column-major order.
 *
 * Arguments are given in *row-major* order, so a matrix spelled out in source
 * reads the way it does on paper; these functions transpose on the way into
 * memory. Element names are always `a<row><col>`, raw indices are always
 * column major:
 *
 * ```text
 *   a00  a01  a02  a03          0   4   8  12
 *   a10  a11  a12  a13    ->    1   5   9  13
 *   a20  a21  a22  a23          2   6  10  14
 *   a30  a31  a32  a33          3   7  11  15
 * ```
 *
 * The practical consequence: translation is the last *column* — `a03`, `a13`,
 * `a23`, at indices 12, 13 and 14 — which is what `mat4x4<f32>` and
 * `uniformMatrix4fv` expect, so a `Mat4` uploads to the GPU untouched.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module mat4
 */

import type { Mat4, ReadonlyMat4 } from './_types/mat4.js';

/**
 * Allocates a new matrix from elements given in row-major order.
 *
 * Omitted elements default to `0`, so `create()` is the **zero** matrix, not
 * the identity. For a fresh identity matrix use `clone(IDENTITY)`.
 *
 * Values are stored as float32, so they may be rounded — worth remembering for
 * translations far from the origin.
 *
 * @returns A new matrix with its own buffer.
 */
// biome-ignore format: visual alignment with the matrix
export function create(
  a00: number = 0, a01: number = 0, a02: number = 0, a03: number = 0,
  a10: number = 0, a11: number = 0, a12: number = 0, a13: number = 0,
  a20: number = 0, a21: number = 0, a22: number = 0, a23: number = 0,
  a30: number = 0, a31: number = 0, a32: number = 0, a33: number = 0
): Mat4 {
  const out = new Float32Array(16) as Mat4;

  out[0] = a00; out[4] = a01; out[8]  = a02; out[12] = a03;
  out[1] = a10; out[5] = a11; out[9]  = a12; out[13] = a13;
  out[2] = a20; out[6] = a21; out[10] = a22; out[14] = a23;
  out[3] = a30; out[7] = a31; out[11] = a32; out[15] = a33;

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
export function clone(a: ReadonlyMat4): Mat4 {
  return create(
    a[0], a[4], a[8],  a[12],
    a[1], a[5], a[9],  a[13],
    a[2], a[6], a[10], a[14],
    a[3], a[7], a[11], a[15]
  );
}

/**
 * Writes all sixteen elements into `out`, given in row-major order. Values are
 * rounded to float32.
 *
 * Every element is overwritten, so whatever `out` held before is irrelevant.
 *
 * @param out - The matrix to write to.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function set(
  out: Mat4,
  a00: number, a01: number, a02: number, a03: number,
  a10: number, a11: number, a12: number, a13: number,
  a20: number, a21: number, a22: number, a23: number,
  a30: number, a31: number, a32: number, a33: number
): Mat4 {
  out[0] = a00; out[4] = a01; out[8]  = a02; out[12] = a03;
  out[1] = a10; out[5] = a11; out[9]  = a12; out[13] = a13;
  out[2] = a20; out[6] = a21; out[10] = a22; out[14] = a23;
  out[3] = a30; out[7] = a31; out[11] = a32; out[15] = a33;
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
export function copy(out: Mat4, a: ReadonlyMat4): Mat4 {
  const a00 = a[0], a01 = a[4], a02 = a[8],  a03 = a[12];
  const a10 = a[1], a11 = a[5], a12 = a[9],  a13 = a[13];
  const a20 = a[2], a21 = a[6], a22 = a[10], a23 = a[14];
  const a30 = a[3], a31 = a[7], a32 = a[11], a33 = a[15];

  out[0] = a00; out[4] = a01; out[8]  = a02; out[12] = a03;
  out[1] = a10; out[5] = a11; out[9]  = a12; out[13] = a13;
  out[2] = a20; out[6] = a21; out[10] = a22; out[14] = a23;
  out[3] = a30; out[7] = a31; out[11] = a32; out[15] = a33;
  
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
export function identity(out: Mat4): Mat4 {
  return set(
    out,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
}

/**
 * The 4x4 identity matrix.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Mat4`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const IDENTITY = identity(create()) as ReadonlyMat4;
