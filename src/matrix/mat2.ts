/**
 * 2x2 matrices, stored as 4 contiguous floats in column-major order.
 *
 * Arguments are given in *row-major* order, so a matrix spelled out in source
 * reads the way it does on paper; these functions transpose on the way into
 * memory. Element names are always `a<row><col>`, raw indices are always
 * column major:
 *
 * ```text
 *   a00  a01          0   2
 *   a10  a11    ->    1   3
 * ```
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module mat2
 */

import type { Mat2, ReadonlyMat2 } from './_types/mat2.js';

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
  a00: number = 0, a01: number = 0,
  a10: number = 0, a11: number = 0
): Mat2 {
  const out = new Float32Array(4) as Mat2;

  out[0] = a00; out[2] = a01;
  out[1] = a10; out[3] = a11;

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
export function clone(a: ReadonlyMat2): Mat2 {
  return create(
    a[0], a[2],
    a[1], a[3],
  );
}

/**
 * Writes all four elements into `out`, given in row-major order. Values are
 * rounded to float32.
 *
 * Every element is overwritten, so whatever `out` held before is irrelevant.
 *
 * @param out - The matrix to write to.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function set(
  out: Mat2,
  a00: number, a01: number,
  a10: number, a11: number,
): Mat2 {
  out[0] = a00; out[2] = a01;
  out[1] = a10; out[3] = a11;
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
export function copy(out: Mat2, a: ReadonlyMat2): Mat2 {
  const a00 = a[0], a01 = a[2];
  const a10 = a[1], a11 = a[3];

  out[0] = a00; out[2] = a01;
  out[1] = a10; out[3] = a11;

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
export function identity(out: Mat2): Mat2 {
  return set(
    out,
    1, 0,
    0, 1,
  );
}

/**
 * The 2x2 identity matrix.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Mat2`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const IDENTITY = identity(create()) as ReadonlyMat2;
