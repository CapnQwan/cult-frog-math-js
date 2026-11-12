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

import { EPSILON } from '../../constants.js';
import { isEqualEpsilon as isEqualEpsilonScalar } from '../../scalars.js';

import type { Mat3, ReadonlyMat3 } from './_types/mat3.js';

/** The number of elements in a `Mat3`. */
export const SIZE = 9;

/**
 * Allocates a new matrix from elements given in row-major order.
 *
 * Omitted elements default to the identity's: `1` on the diagonal and `0`
 * everywhere else, so `create()` is the identity matrix, the transform that
 * changes nothing. A zero default would give the zero matrix, which collapses
 * everything onto the origin and has no inverse. Defaults apply element by
 * element, so a partial argument list keeps the rest of the identity:
 * `create(2)` is the identity with `a00` set to `2`, and the rest of the
 * diagonal is still `1`. For the zero matrix, pass all nine elements as `0`.
 *
 * Values are stored as float32, so they may be rounded.
 *
 * @returns A new matrix with its own buffer.
 */
// biome-ignore format: visual alignment with the matrix
export function create(
  a00: number = 1, a01: number = 0, a02: number = 0,
  a10: number = 0, a11: number = 1, a12: number = 0,
  a20: number = 0, a21: number = 0, a22: number = 1
): Mat3 {
  const out = new Float32Array(SIZE) as Mat3;

  out[0] = a00; out[3] = a01; out[6] = a02;
  out[1] = a10; out[4] = a11; out[7] = a12;
  out[2] = a20; out[5] = a21; out[8] = a22;

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
 * matrix, use `create()`.
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

/**
 * Returns whether two matrices have exactly equal elements.
 *
 * @param a - The first matrix.
 * @param b - The second matrix.
 * @returns `true` if every element is equal.
 */
export function isEqual(a: ReadonlyMat3, b: ReadonlyMat3): boolean {
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
export function isEqualEpsilon(a: ReadonlyMat3, b: ReadonlyMat3, eps = EPSILON): boolean {
  // biome-ignore lint/style/noNonNullAssertion: i < SIZE, so the index is always in bounds
  for (let i = 0; i < SIZE; i++) if (!isEqualEpsilonScalar(a[i]!, b[i]!, eps)) return false;
  return true;
}

/**
 * Multiplies two matrices (the matrix product `a * b`) and writes the result
 * into `out`.
 *
 * Vectors are columns, so the result applies `b` first, then `a`. Order
 * matters: `multiply(out, a, b)` and `multiply(out, b, a)` are generally
 * different transforms. `multiply(out, m, delta)` applies `delta` in `m`'s
 * local frame, while `multiply(out, delta, m)` applies it in the parent
 * frame.
 *
 * With finite elements, `IDENTITY` on either side gives back the other input.
 * An infinite element meets the identity's zeros, and `0 * Infinity` is
 * `NaN`, so the rest of its row or column comes out as `NaN`.
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
export function multiply(out: Mat3, a: ReadonlyMat3, b: ReadonlyMat3): Mat3 {
  const a00 = a[0], a01 = a[3], a02 = a[6];
  const a10 = a[1], a11 = a[4], a12 = a[7];
  const a20 = a[2], a21 = a[5], a22 = a[8];

  const b00 = b[0], b01 = b[3], b02 = b[6];
  const b10 = b[1], b11 = b[4], b12 = b[7];
  const b20 = b[2], b21 = b[5], b22 = b[8];

  out[0] = a00 * b00 + a01 * b10 + a02 * b20;
  out[1] = a10 * b00 + a11 * b10 + a12 * b20;
  out[2] = a20 * b00 + a21 * b10 + a22 * b20;

  out[3] = a00 * b01 + a01 * b11 + a02 * b21;
  out[4] = a10 * b01 + a11 * b11 + a12 * b21;
  out[5] = a20 * b01 + a21 * b11 + a22 * b21;

  out[6] = a00 * b02 + a01 * b12 + a02 * b22;
  out[7] = a10 * b02 + a11 * b12 + a12 * b22;
  out[8] = a20 * b02 + a21 * b12 + a22 * b22;

  return out;
}

/**
 * Transposes `a`, swapping its rows and columns, and writes the result into
 * `out`.
 *
 * The element at row `r`, column `c` moves to row `c`, column `r`, so the
 * diagonal stays where it is and, for example, `a01` trades places with
 * `a10`. No arithmetic is done: every element is copied bit for bit, including
 * `NaN`, `-0` and infinities, so transposing twice gives back the original
 * exactly.
 *
 * For a pure rotation, the transpose is also the inverse, and much cheaper to
 * compute. That holds only while the columns are unit length and
 * perpendicular to each other: once the matrix scales or shears, the transpose
 * no longer undoes it. When a `Mat3` holds a 2D transform with a translation
 * in its last column, the transpose moves that translation into the bottom
 * row, so it is not the inverse either.
 *
 * Row-major data viewed as a `Mat3` holds the transpose of the matrix it
 * describes, so transposing it gives that matrix in this package's
 * column-major layout, and the reverse converts back.
 *
 * `out` may be the same matrix as `a`, which transposes in place, or a view
 * overlapping it: every element is read into a local before anything is
 * written.
 *
 * @param out - The matrix to write to.
 * @param a - The matrix to transpose.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function transpose(out: Mat3, a: ReadonlyMat3): Mat3 {
  const a00 = a[0], a01 = a[3], a02 = a[6];
  const a10 = a[1], a11 = a[4], a12 = a[7];
  const a20 = a[2], a21 = a[5], a22 = a[8];

  out[0] = a00;
  out[1] = a01;
  out[2] = a02;

  out[3] = a10;
  out[4] = a11;
  out[5] = a12;

  out[6] = a20;
  out[7] = a21;
  out[8] = a22;

  return out;
}
