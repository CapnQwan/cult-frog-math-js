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

import { EPSILON } from '../../constants.js';
import { isEqualEpsilon as isEqualEpsilonScalar } from '../../scalars.js';

import type { Mat4, ReadonlyMat4 } from './_types/mat4.js';

/** The number of elements in a `Mat4`. */
export const SIZE = 16;

/**
 * Allocates a new matrix from elements given in row-major order.
 *
 * Omitted elements default to the identity's: `1` on the diagonal and `0`
 * everywhere else, so `create()` is the identity matrix, the transform that
 * changes nothing. A zero default would give the zero matrix, which collapses
 * everything onto the origin and has no inverse. Defaults apply element by
 * element, so a partial argument list keeps the rest of the identity:
 * `create(2)` is the identity with `a00` set to `2`, and the rest of the
 * diagonal is still `1`. For the zero matrix, pass all sixteen elements as
 * `0`.
 *
 * Values are stored as float32, so they may be rounded — worth remembering for
 * translations far from the origin.
 *
 * @returns A new matrix with its own buffer.
 */
// biome-ignore format: visual alignment with the matrix
export function create(
  a00: number = 1, a01: number = 0, a02: number = 0, a03: number = 0,
  a10: number = 0, a11: number = 1, a12: number = 0, a13: number = 0,
  a20: number = 0, a21: number = 0, a22: number = 1, a23: number = 0,
  a30: number = 0, a31: number = 0, a32: number = 0, a33: number = 1
): Mat4 {
  const out = new Float32Array(SIZE) as Mat4;

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
 * own buffer and won't change when the original memory is written to.
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
 * matrix, use `create()`.
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

/**
 * Returns whether two matrices have exactly equal elements.
 *
 * @param a - The first matrix.
 * @param b - The second matrix.
 * @returns `true` if every element is equal.
 */
export function isEqual(a: ReadonlyMat4, b: ReadonlyMat4): boolean {
  for (let i = 0; i < SIZE; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Returns whether two matrices are equal within a tolerance, compared
 * element by element.
 *
 * Each element goes through the scalar `isEqualEpsilon`, so the tolerance is
 * `eps` near unit scale and widens with the elements' magnitude.
 *
 * @param a - The first matrix.
 * @param b - The second matrix.
 * @param eps - The base tolerance, before scaling. Defaults to {@link EPSILON}.
 * @returns `true` if every element is within tolerance.
 */
export function isEqualEpsilon(a: ReadonlyMat4, b: ReadonlyMat4, eps = EPSILON): boolean {
  // biome-ignore lint/style/noNonNullAssertion: i < SIZE, so the index is always in bounds
  for (let i = 0; i < SIZE; i++) if (!isEqualEpsilonScalar(a[i]!, b[i]!, eps)) return false;
  return true;
}

/**
 * Multiplies two matrices (the matrix product `a * b`) and writes the result
 * into `out`.
 *
 * Vectors are columns, so the result applies `b` first, then `a`: to build a
 * model-view-projection matrix, multiply `projection * view * model`. Order
 * matters: `multiply(out, a, b)` and `multiply(out, b, a)` are generally
 * different transforms. In practice, `multiply(out, m, delta)` applies `delta`
 * in `m`'s local frame, while `multiply(out, delta, m)` applies it in the
 * parent frame. `IDENTITY` leaves the other input unchanged on either side.
 *
 * `out` may be the same matrix as `a` or `b`, or a view overlapping either:
 * both inputs are read into locals before anything is written.
 *
 * @param out - The matrix to write to.
 * @param a - The left operand, applied second.
 * @param b - The right operand, applied first.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function multiply(out: Mat4, a: ReadonlyMat4, b: ReadonlyMat4): Mat4 {
  const a00 = a[0], a01 = a[4], a02 = a[8],  a03 = a[12];
  const a10 = a[1], a11 = a[5], a12 = a[9],  a13 = a[13];
  const a20 = a[2], a21 = a[6], a22 = a[10], a23 = a[14];
  const a30 = a[3], a31 = a[7], a32 = a[11], a33 = a[15];

  const b00 = b[0], b01 = b[4], b02 = b[8],  b03 = b[12];
  const b10 = b[1], b11 = b[5], b12 = b[9],  b13 = b[13];
  const b20 = b[2], b21 = b[6], b22 = b[10], b23 = b[14];
  const b30 = b[3], b31 = b[7], b32 = b[11], b33 = b[15];

  out[0] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
  out[1] = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30;
  out[2] = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30;
  out[3] = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30;

  out[4] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
  out[5] = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31;
  out[6] = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31;
  out[7] = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31;

  out[8] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
  out[9] = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32;
  out[10] = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32;
  out[11] = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32;

  out[12] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;
  out[13] = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33;
  out[14] = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33;
  out[15] = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33;

  return out;
}
