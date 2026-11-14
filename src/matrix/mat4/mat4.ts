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
 * Vectors are columns, so the result applies `b` first, then `a`. Order
 * matters: `multiply(out, a, b)` and `multiply(out, b, a)` are generally
 * different transforms. `multiply(out, m, delta)` applies `delta` in `m`'s
 * local frame, while `multiply(out, delta, m)` applies it in the parent
 * frame.
 *
 * A model-view-projection matrix is `projection * view * model`, which is
 * `multiply(mvp, projection, multiply(mvp, view, model))`. Reusing `mvp` for
 * the inner product is safe, since `out` may alias an input.
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

/**
 * Transposes `a`, swapping its rows and columns, and writes the result into
 * `out`.
 *
 * The element at row `r`, column `c` moves to row `c`, column `r`, so the
 * diagonal stays where it is and, for example, `a03` trades places with
 * `a30`. No arithmetic is done: every element is copied bit for bit, including
 * `NaN`, `-0` and infinities, so transposing twice gives back the original
 * exactly.
 *
 * For a pure rotation, the transpose is also the inverse, and much cheaper to
 * compute. That holds only while the columns are unit length and
 * perpendicular to each other: once the matrix scales or shears, the transpose
 * no longer undoes it. Translation breaks it too. A transform with a
 * translation keeps it in the last column, and the transpose moves it into the
 * bottom row, which is no longer an affine transform. To undo a rotation and
 * translation, transpose only the upper-left 3x3 and rotate the negated
 * translation by it.
 *
 * Row-major data viewed as a `Mat4` holds the transpose of the matrix it
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
export function transpose(out: Mat4, a: ReadonlyMat4): Mat4 {
  const a00 = a[0], a01 = a[4], a02 = a[8],  a03 = a[12];
  const a10 = a[1], a11 = a[5], a12 = a[9],  a13 = a[13];
  const a20 = a[2], a21 = a[6], a22 = a[10], a23 = a[14];
  const a30 = a[3], a31 = a[7], a32 = a[11], a33 = a[15];

  out[0] = a00;
  out[1] = a01;
  out[2] = a02;
  out[3] = a03;

  out[4] = a10;
  out[5] = a11;
  out[6] = a12;
  out[7] = a13;

  out[8] = a20;
  out[9] = a21;
  out[10] = a22;
  out[11] = a23;

  out[12] = a30;
  out[13] = a31;
  out[14] = a32;
  out[15] = a33;

  return out;
}

/**
 * Returns the determinant of `a`.
 *
 * For an affine transform, the bottom row is `0 0 0 1`, so the determinant is
 * that of the upper-left 3x3 and translation does not affect it. Its magnitude
 * is then the factor by which the transform scales volume: `8` doubles every
 * axis and `1` keeps volume. Its sign says whether the transform keeps
 * handedness: a negative determinant means it mirrors, which reverses the
 * winding order of the triangles it transforms, so back-face culling has to
 * flip for them. A rotation gives `1`, up to rounding.
 *
 * Determinants multiply under `multiply`, so a chain of transforms mirrors
 * only if an odd number of them do. Transposing does not change the
 * determinant.
 *
 * Zero means `a` has no inverse. Rounding rarely lands exactly on zero for a
 * matrix that is singular in theory, and a nearly singular matrix gives a
 * small non-zero result, so test against a tolerance scaled to the elements'
 * magnitude rather than `=== 0`.
 *
 * The elements are float32, but the arithmetic runs in float64, so the result
 * is not rounded to float32. A `NaN` element gives `NaN`.
 *
 * @param a - The matrix to measure.
 * @returns The determinant of `a`.
 */
// biome-ignore format: visual alignment with the matrix
export function determinant(a: ReadonlyMat4): number {
  const a00 = a[0], a01 = a[4], a02 = a[8],  a03 = a[12];
  const a10 = a[1], a11 = a[5], a12 = a[9],  a13 = a[13];
  const a20 = a[2], a21 = a[6], a22 = a[10], a23 = a[14];
  const a30 = a[3], a31 = a[7], a32 = a[11], a33 = a[15];

  const d23 = a22 * a33 - a23 * a32; 
  const d13 = a21 * a33 - a23 * a31;
  const d12 = a21 * a32 - a22 * a31;
  const d03 = a20 * a33 - a23 * a30;
  const d02 = a20 * a32 - a22 * a30;
  const d01 = a20 * a31 - a21 * a30;

  const m00 = a11 * d23 - a12 * d13 + a13 * d12;
  const m01 = a10 * d23 - a12 * d03 + a13 * d02;
  const m02 = a10 * d13 - a11 * d03 + a13 * d01;
  const m03 = a10 * d12 - a11 * d02 + a12 * d01;

  return a00 * m00 - a01 * m01 + a02 * m02 - a03 * m03;
}

/**
 * Inverts `a` and writes the result into `out`, so that `a * out` and
 * `out * a` are both the identity, up to rounding.
 *
 * The inverse undoes the transform: if `a` takes coordinates from a local
 * frame into its parent, the inverse takes them back. A camera's view matrix
 * is the inverse of its world matrix. The inverse of an affine transform is
 * affine too, with the translation undone.
 *
 * Returns `null` when `a` is singular, meaning its determinant is exactly
 * zero, as for a matrix that scales an axis to zero. A `NaN` element makes
 * the determinant `NaN`, which returns `null` the same way. There is no
 * inverse to write, so `out` is left untouched. Check the result before using
 * it.
 *
 * The check is exact rather than within a tolerance, because a fixed
 * tolerance can't tell a small but valid matrix from a nearly singular one:
 * the determinant of an affine transform shrinks with the cube of a uniform
 * scale, so a scale of `0.01` gives `1e-6` and still inverts cleanly. A
 * nearly singular matrix inverts to very large elements, most of whose
 * precision has been lost to rounding. Infinite elements are not caught: if
 * they make the determinant infinite rather than `NaN`, the result is zeros
 * and `NaN` rather than an inverse.
 *
 * For a pure rotation, `transpose` gives the same result, exactly and more
 * cheaply.
 *
 * `out` may be the same matrix as `a`, or a view overlapping it: every element
 * is read into a local before anything is written.
 *
 * @param out - The matrix to write to. Untouched when `null` is returned.
 * @param a - The matrix to invert.
 * @returns `out`, or `null` if `a` has no inverse.
 */
// biome-ignore format: visual alignment with the matrix
export function invert(out: Mat4, a: ReadonlyMat4): Mat4 | null {
  const a00 = a[0], a01 = a[4], a02 = a[8],  a03 = a[12];
  const a10 = a[1], a11 = a[5], a12 = a[9],  a13 = a[13];
  const a20 = a[2], a21 = a[6], a22 = a[10], a23 = a[14];
  const a30 = a[3], a31 = a[7], a32 = a[11], a33 = a[15];

  // m<row><col> is the minor of a<row><col>: the 3x3 determinant left after
  // deleting that row and column. Each is expanded along its first remaining
  // row, using 2x2 determinants of the other two rows named by the pair of
  // columns they use, so m<i><j> uses exactly the three whose names lack `j`.

  // Rows 2 and 3, for the minors of rows 0 and 1.
  const d23 = a22 * a33 - a23 * a32;
  const d13 = a21 * a33 - a23 * a31;
  const d12 = a21 * a32 - a22 * a31;
  const d03 = a20 * a33 - a23 * a30;
  const d02 = a20 * a32 - a22 * a30;
  const d01 = a20 * a31 - a21 * a30;

  const m00 = a11 * d23 - a12 * d13 + a13 * d12;
  const m01 = a10 * d23 - a12 * d03 + a13 * d02;
  const m02 = a10 * d13 - a11 * d03 + a13 * d01;
  const m03 = a10 * d12 - a11 * d02 + a12 * d01;

  const det = a00 * m00 - a01 * m01 + a02 * m02 - a03 * m03;

  if (!det) return null;

  const invDet = 1 / det;

  const m10 = a01 * d23 - a02 * d13 + a03 * d12;
  const m11 = a00 * d23 - a02 * d03 + a03 * d02;
  const m12 = a00 * d13 - a01 * d03 + a03 * d01;
  const m13 = a00 * d12 - a01 * d02 + a02 * d01;

  // Rows 1 and 3, for the minors of row 2.
  const e23 = a12 * a33 - a13 * a32;
  const e13 = a11 * a33 - a13 * a31;
  const e12 = a11 * a32 - a12 * a31;
  const e03 = a10 * a33 - a13 * a30;
  const e02 = a10 * a32 - a12 * a30;
  const e01 = a10 * a31 - a11 * a30;

  const m20 = a01 * e23 - a02 * e13 + a03 * e12;
  const m21 = a00 * e23 - a02 * e03 + a03 * e02;
  const m22 = a00 * e13 - a01 * e03 + a03 * e01;
  const m23 = a00 * e12 - a01 * e02 + a02 * e01;

  // Rows 1 and 2, for the minors of row 3.
  const f23 = a12 * a23 - a13 * a22;
  const f13 = a11 * a23 - a13 * a21;
  const f12 = a11 * a22 - a12 * a21;
  const f03 = a10 * a23 - a13 * a20;
  const f02 = a10 * a22 - a12 * a20;
  const f01 = a10 * a21 - a11 * a20;

  const m30 = a01 * f23 - a02 * f13 + a03 * f12;
  const m31 = a00 * f23 - a02 * f03 + a03 * f02;
  const m32 = a00 * f13 - a01 * f03 + a03 * f01;
  const m33 = a00 * f12 - a01 * f02 + a02 * f01;

  // The inverse is the transposed cofactor matrix over the determinant. The
  // cofactor of a<i><j> is m<i><j> with sign (-1)^(i + j), and transposing
  // puts it at row j, column i, which is storage index 4i + j.
  out[0]  =  m00 * invDet;
  out[1]  = -m01 * invDet;
  out[2]  =  m02 * invDet;
  out[3]  = -m03 * invDet;

  out[4]  = -m10 * invDet;
  out[5]  =  m11 * invDet;
  out[6]  = -m12 * invDet;
  out[7]  =  m13 * invDet;

  out[8]  =  m20 * invDet;
  out[9]  = -m21 * invDet;
  out[10] =  m22 * invDet;
  out[11] = -m23 * invDet;

  out[12] = -m30 * invDet;
  out[13] =  m31 * invDet;
  out[14] = -m32 * invDet;
  out[15] =  m33 * invDet;

  return out;
}
