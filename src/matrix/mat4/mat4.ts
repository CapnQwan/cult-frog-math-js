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
 * Camera matrices are right-handed, looking down negative z: `lookAt` builds
 * the view matrix, and the projections come in two depth ranges, named by
 * suffix. `NO` maps depth from negative one to one, for WebGL; `ZO` maps it
 * from zero to one, for WebGPU, Vulkan, Metal and Direct3D.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module mat4
 */

import { EPSILON } from '../../constants.js';
import * as Scalars from '../../scalars.js';

import type { Quat, ReadonlyQuat } from '../../quaternion/_types/quat.js';
import type { ReadonlyVec3, Vec3 } from '../../vector/vec3/_types/vec3.js';
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
  for (let i = 0; i < SIZE; i++) if (!Scalars.isEqualEpsilon(a[i]!, b[i]!, eps)) return false;
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

/**
 * Writes a translation by `v` into `out`.
 *
 * Every element of `out` is overwritten: this builds a new transform rather
 * than moving the one already in `out`. To translate an existing matrix,
 * `multiply` by the result.
 *
 * The translation lands in the last column, at indices 12, 13 and 14, and the
 * rest is the identity, so the result is exact. It moves points
 * (`Vec3.transformMat4`) but leaves directions unchanged
 * (`Vec3.transformDirectionMat4`). `fromTranslation` of the negated vector is
 * its exact inverse.
 *
 * `v` is read into locals first, so it may be a view overlapping `out`.
 *
 * @param out - The matrix to write to.
 * @param v - The translation.
 * @returns `out`.
 */
export function fromTranslation(out: Mat4, v: ReadonlyVec3): Mat4 {
  // biome-ignore format: packed component reads
  const x = v[0], y = v[1], z = v[2];

  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;

  out[12] = x;
  out[13] = y;
  out[14] = z;
  out[15] = 1;

  return out;
}

/**
 * Writes the rotation described by the quaternion `q` into `out`.
 *
 * Every element of `out` is overwritten: this builds a new transform rather
 * than rotating the one already in `out`. To rotate an existing matrix,
 * `multiply` by the result.
 *
 * The upper-left 3x3 is the rotation, and the translation and bottom row are
 * those of the identity. Transforming by the result matches
 * `Vec3.transformQuat` with the same `q`, up to rounding, and the conventions
 * carry over: `fromQuat` of `Quat.multiply(tmp, a, b)` equals the `multiply`
 * of `fromQuat(a)` and `fromQuat(b)`, applying `b` first. `q` and `-q` give
 * exactly the same matrix. The inverse is the `transpose`, or `fromQuat` of
 * the `Quat.conjugate`.
 *
 * `q` **must be unit length**, as for `Vec3.transformQuat`. A non-unit `q`
 * gives neither a rotation nor a scaled one, so the matrix skews whatever it
 * transforms. Normalise `q` first if it has drifted.
 *
 * Rotations are only close to exact: `Math.cos(Math.PI / 2)` is about `6e-17`
 * rather than `0`, so even a quarter turn leaves tiny elements where the
 * identity has zeros. Compare results with `isEqualEpsilon`.
 *
 * Bad input stays visible: a `NaN` component in `q` makes the rotation
 * elements `NaN`.
 *
 * `q` is read into locals first, so it may be a view overlapping `out`.
 *
 * @param out - The matrix to write to.
 * @param q - The unit quaternion to rotate by.
 * @returns `out`.
 */
export function fromQuat(out: Mat4, q: ReadonlyQuat): Mat4 {
  // biome-ignore format: packed component reads
  const x = q[0], y = q[1], z = q[2], w = q[3];

  // Doubling each component once makes every term below a single multiply.
  // biome-ignore format: packed quaternion terms
  const xx = x + x, yy = y + y, zz = z + z;
  // biome-ignore format: packed quaternion terms
  const xyy = x * yy, xzz = x * zz, yzz = y * zz;
  // biome-ignore format: packed quaternion terms
  const wxx = w * xx, wyy = w * yy, wzz = w * zz;
  // biome-ignore format: packed quaternion terms
  const xx2 = x * xx, yy2 = y * yy, zz2 = z * zz;

  out[0] = 1 - (yy2 + zz2);
  out[1] = xyy + wzz;
  out[2] = xzz - wyy;
  out[3] = 0;

  out[4] = xyy - wzz;
  out[5] = 1 - (xx2 + zz2);
  out[6] = yzz + wxx;
  out[7] = 0;

  out[8] = xzz + wyy;
  out[9] = yzz - wxx;
  out[10] = 1 - (xx2 + yy2);
  out[11] = 0;

  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;

  return out;
}

/**
 * Writes a rotation of `angle` radians about `axis` into `out`.
 *
 * Every element of `out` is overwritten: this builds a new transform rather
 * than rotating the one already in `out`. To rotate an existing matrix,
 * `multiply` by the result.
 *
 * The rotation follows the right-hand rule, like `Quat.fromAxisAngle`: with
 * the package's y-up, right-handed axes, a positive angle about `Vec3.UP`
 * turns `Vec3.FORWARD` (negative z) towards `Vec3.LEFT`, which is
 * counter-clockwise when viewed from above. The result matches
 * `fromQuat(out, Quat.fromAxisAngle(tmp, axis, angle))`, up to rounding, but
 * is built directly from the full angle, without the quaternion's half angle.
 * So unlike the quaternion, angles a full turn apart give the same matrix, up
 * to rounding. Negating the angle gives the inverse, which is also the
 * `transpose`.
 *
 * `axis` **must be unit length**, and isn't normalised here. Any other length
 * gives a matrix that isn't a rotation: a zero axis gives a uniform scale by
 * `cos(angle)`. Normalise the axis first if it was computed rather than
 * written as a constant.
 *
 * Rotations are only close to exact: `Math.cos(Math.PI / 2)` is about `6e-17`
 * rather than `0`, so even a quarter turn leaves tiny elements where the
 * identity has zeros. Compare results with `isEqualEpsilon`.
 *
 * `axis` is read into locals first, so it may be a view overlapping `out`.
 *
 * @param out - The matrix to write to.
 * @param axis - The unit axis to rotate about.
 * @param angle - The rotation angle in radians.
 * @returns `out`.
 */
export function fromAxisAngle(out: Mat4, axis: ReadonlyVec3, angle: number): Mat4 {
  // biome-ignore format: packed component reads
  const x = axis[0], y = axis[1], z = axis[2];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const t = 1 - cos;

  // Rodrigues' rotation formula: cos * I + sin * [axis]x + t * axis * axisᵀ.
  // biome-ignore format: packed axis terms
  const tx = t * x, ty = t * y, tz = t * z;
  // biome-ignore format: packed axis terms
  const txy = tx * y, txz = tx * z, tyz = ty * z;
  // biome-ignore format: packed axis terms
  const sx = sin * x, sy = sin * y, sz = sin * z;

  out[0] = tx * x + cos;
  out[1] = txy + sz;
  out[2] = txz - sy;
  out[3] = 0;

  out[4] = txy - sz;
  out[5] = ty * y + cos;
  out[6] = tyz + sx;
  out[7] = 0;

  out[8] = txz + sy;
  out[9] = tyz - sx;
  out[10] = tz * z + cos;
  out[11] = 0;

  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;

  return out;
}

/**
 * Writes a scale by `v` along each axis into `out`.
 *
 * Every element of `out` is overwritten: this builds a new transform rather
 * than scaling the one already in `out`. To scale an existing matrix,
 * `multiply` by the result.
 *
 * The scale lands on the diagonal and the rest is the identity, so the result
 * is exact. A negative component mirrors along that axis, which makes the
 * `determinant` negative, and a zero component flattens it, which leaves the
 * matrix without an inverse. `fromScale` of the reciprocals is its inverse.
 *
 * `v` is read into locals first, so it may be a view overlapping `out`.
 *
 * @param out - The matrix to write to.
 * @param v - The scale along x, y and z.
 * @returns `out`.
 */
export function fromScale(out: Mat4, v: ReadonlyVec3): Mat4 {
  // biome-ignore format: packed component reads
  const x = v[0], y = v[1], z = v[2];

  out[0] = x;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = y;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = z;
  out[11] = 0;

  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;

  return out;
}

/**
 * Writes the transform `T * R * S` into `out`: a scale by `s`, then the
 * rotation `r`, then a translation by `t`.
 *
 * That is the order a scene-graph node means by its position, rotation and
 * scale. The scale is along the object's own axes, before it is rotated, so a
 * non-uniform scale stretches the object rather than shearing it. The result
 * equals `multiply` of `fromTranslation(t)`, `fromQuat(r)` and `fromScale(s)`
 * in that order, up to rounding, but is built in one pass: each column of the
 * rotation is scaled by the matching component of `s`.
 *
 * Every element of `out` is overwritten: this builds a new transform rather
 * than adding to the one already in `out`. To apply it to an existing matrix,
 * `multiply` by the result.
 *
 * `r` **must be unit length**, as for `fromQuat`. A zero component in `s`
 * leaves the matrix without an inverse, and a negative one mirrors it.
 *
 * Bad input stays visible: a `NaN` component in any input makes the elements
 * it reaches `NaN`.
 *
 * All three inputs are read into locals first, so each may be a view
 * overlapping `out`.
 *
 * @param out - The matrix to write to.
 * @param t - The translation, applied last.
 * @param r - The unit quaternion to rotate by, applied second.
 * @param s - The scale along x, y and z, applied first.
 * @returns `out`.
 */
export function fromTRS(out: Mat4, t: ReadonlyVec3, r: ReadonlyQuat, s: ReadonlyVec3): Mat4 {
  // biome-ignore format: packed component reads
  const tX = t[0], tY = t[1], tZ = t[2];
  // biome-ignore format: packed component reads
  const rX = r[0], rY = r[1], rZ = r[2], rW = r[3];
  // biome-ignore format: packed component reads
  const sX = s[0], sY = s[1], sZ = s[2];

  // Doubling each component once makes every term below a single multiply.
  // biome-ignore format: packed quaternion terms
  const xx = rX + rX, yy = rY + rY, zz = rZ + rZ;
  // biome-ignore format: packed quaternion terms
  const xyy = rX * yy, xzz = rX * zz, yzz = rY * zz;
  // biome-ignore format: packed quaternion terms
  const wxx = rW * xx, wyy = rW * yy, wzz = rW * zz;
  // biome-ignore format: packed quaternion terms
  const xx2 = rX * xx, yy2 = rY * yy, zz2 = rZ * zz;

  // The rotation as a 3×3 matrix, built from the quaternion.
  const r00 = 1 - (yy2 + zz2);
  const r01 = xyy - wzz;
  const r02 = xzz + wyy;

  const r10 = xyy + wzz;
  const r11 = 1 - (xx2 + zz2);
  const r12 = yzz - wxx;

  const r20 = xzz - wyy;
  const r21 = yzz + wxx;
  const r22 = 1 - (xx2 + yy2);

  out[0] = r00 * sX;
  out[1] = r10 * sX;
  out[2] = r20 * sX;
  out[3] = 0;

  out[4] = r01 * sY;
  out[5] = r11 * sY;
  out[6] = r21 * sY;
  out[7] = 0;

  out[8] = r02 * sZ;
  out[9] = r12 * sZ;
  out[10] = r22 * sZ;
  out[11] = 0;

  out[12] = tX;
  out[13] = tY;
  out[14] = tZ;
  out[15] = 1;

  return out;
}

/**
 * Splits the affine transform `m` into a translation, a rotation and a scale,
 * the inverse of `fromTRS`: building `fromTRS(tmp, outT, outR, outS)` gives
 * `m` back, up to rounding.
 *
 * Returns `false` when the upper-left 3x3 is singular, meaning its determinant
 * is exactly zero, as for a matrix that scales an axis to zero. With no
 * length along that axis there is no direction to recover a rotation from. A
 * `NaN` in the 3x3 makes the determinant `NaN`, which returns `false` the same
 * way. All three outputs are then left untouched. Like `invert`, the check is
 * exact rather than within a tolerance.
 *
 * The translation is the last column, copied exactly, so a `NaN` there is
 * copied into `outT` without affecting the rest. The scale along each axis is
 * the length of the matching column of the 3x3. The rotation is what remains
 * once each column is divided by its scale, converted to a quaternion and
 * normalised, so `outR` is always unit length, as `fromQuat` and `fromTRS`
 * require.
 *
 * The parts are not unique, only the matrix they rebuild is:
 *
 * - A mirroring matrix (negative `determinant`) is given a negative x scale,
 *   whichever axis it mirrored. `fromTRS` with a scale of `(1, -2, 1)`
 *   decomposes to `(-1, 2, 1)` and a different rotation, which rebuilds the
 *   same matrix.
 * - Two negative scale components are a half turn, so they come back positive,
 *   with the half turn in the rotation.
 * - `outR` may have either sign: `q` and `-q` are the same rotation. Compare it
 *   with `Quat.isEqualRotation` rather than component by component.
 *
 * `m` **must be** a translation, rotation and scale: what `fromTRS` builds,
 * or a product of such matrices in which every scale but the first applied is
 * uniform. None of this is checked.
 * The bottom row is ignored, so a projection decomposes to meaningless parts.
 * A shear, as a rotated child of a non-uniformly scaled parent gets, has no
 * exact TRS: `outR` is still a unit rotation, but `fromTRS`
 * of the parts doesn't rebuild `m`.
 *
 * Every element of `m` is read into a local before anything is written, so
 * each output may be a view overlapping `m`. The three outputs must not
 * overlap each other.
 *
 * @param outT - The vector to write the translation to.
 * @param outR - The quaternion to write the rotation to.
 * @param outS - The vector to write the scale along x, y and z to.
 * @param m - The affine transform to decompose.
 * @returns `true` once the parts are written, or `false` if the upper-left 3x3
 * is singular and nothing was written.
 */
// biome-ignore format: visual alignment with the matrix
export function decompose(outT: Vec3, outR: Quat, outS: Vec3, m: ReadonlyMat4): boolean {
  const a00 = m[0], a01 = m[4], a02 = m[8],  a03 = m[12];
  const a10 = m[1], a11 = m[5], a12 = m[9],  a13 = m[13];
  const a20 = m[2], a21 = m[6], a22 = m[10], a23 = m[14];

  const det =
    a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20);

  if (!det) return false;

  // A mirror flips one axis; putting it on x leaves the columns a rotation.
  const sX = det < 0 ? -Math.hypot(a00, a10, a20) : Math.hypot(a00, a10, a20);
  const sY = Math.hypot(a01, a11, a21);
  const sZ = Math.hypot(a02, a12, a22);

  const invX = 1 / sX, invY = 1 / sY, invZ = 1 / sZ;
  const r00 = a00 * invX, r01 = a01 * invY, r02 = a02 * invZ;
  const r10 = a10 * invX, r11 = a11 * invY, r12 = a12 * invZ;
  const r20 = a20 * invX, r21 = a21 * invY, r22 = a22 * invZ;

  // Recover the largest of |w|, |x|, |y| and |z| from the diagonal first, and
  // the rest from the off-diagonal sums and differences divided by it. Dividing
  // by the largest keeps the result accurate near half turns, where w is
  // near zero and recovering it first would divide by almost nothing.
  let x: number, y: number, z: number, w: number;
  const trace = r00 + r11 + r22;

  if (trace > 0) {
    const k = 0.5 / Math.sqrt(trace + 1);
    w = 0.25 / k;
    x = (r21 - r12) * k;
    y = (r02 - r20) * k;
    z = (r10 - r01) * k;
  } else if (r00 > r11 && r00 > r22) {
    const k = 0.5 / Math.sqrt(1 + r00 - r11 - r22);
    x = 0.25 / k;
    w = (r21 - r12) * k;
    y = (r01 + r10) * k;
    z = (r02 + r20) * k;
  } else if (r11 > r22) {
    const k = 0.5 / Math.sqrt(1 + r11 - r00 - r22);
    y = 0.25 / k;
    w = (r02 - r20) * k;
    x = (r01 + r10) * k;
    z = (r12 + r21) * k;
  } else {
    const k = 0.5 / Math.sqrt(1 + r22 - r00 - r11);
    z = 0.25 / k;
    w = (r10 - r01) * k;
    x = (r02 + r20) * k;
    y = (r12 + r21) * k;
  }

  // Exact for a rotation, and keeps a sheared input's rotation unit length.
  const invLen = 1 / Math.hypot(x, y, z, w);

  outT[0] = a03;
  outT[1] = a13;
  outT[2] = a23;

  outR[0] = x * invLen;
  outR[1] = y * invLen;
  outR[2] = z * invLen;
  outR[3] = w * invLen;

  outS[0] = sX;
  outS[1] = sY;
  outS[2] = sZ;

  return true;
}

/**
 * Writes a perspective projection into `out`, for clip space whose depth runs
 * from `-1` at the near plane to `1` at the far plane, as WebGL expects. For
 * WebGPU, Vulkan, Metal or Direct3D, whose depth runs from `0` to `1`, use
 * `perspectiveZO`.
 *
 * The camera looks down negative z, as in a view matrix from `lookAt`, with
 * `y` up and `x` to the right. The projection copies that distance into `w`
 * (`w = -z`), so a point in front of the camera has a positive `w` and one
 * behind it a negative `w`, which the GPU clips. `Vec3.transformMat4` divides
 * by `w` and gives the normalised device coordinates directly; use
 * `Vec4.transformMat4` to keep the point in clip space.
 *
 * Using the matrix for the other depth range is not an error anywhere, but it
 * is wrong: in a `0` to `1` clip space, everything closer than about twice
 * `near` is clipped and half the depth range is lost.
 *
 * Depth is not linear in distance. Its precision is set almost entirely by
 * `near`: a point at distance `d` lands at a depth that changes with
 * `near / d`, so doubling `near` helps far more than halving `far`.
 *
 * `far` may be `Infinity`, which clips nothing beyond the near plane and costs
 * almost no precision, since `far` barely affects it. The matrix is built from
 * the limits rather than the finite formula, which would give `NaN`. Very
 * distant points still round to a depth of exactly `1`, from about `1e7` times
 * `near` in float32, and fail a `less` depth test against a buffer cleared to
 * `1`.
 *
 * `fovY` **must be** between `0` and `PI`, `aspect` positive and
 * `0 < near < far`. None of this is checked: anything else gives a matrix that
 * mirrors, flips depth or divides by zero.
 *
 * Every element of `out` is overwritten.
 *
 * @param out - The matrix to write to.
 * @param fovY - The vertical field of view, in radians.
 * @param aspect - The viewport width divided by its height.
 * @param near - The distance to the near plane, which maps to a depth of `-1`.
 * @param far - The distance to the far plane, which maps to a depth of `1`, or `Infinity`.
 * @returns `out`.
 */
export function perspectiveNO(
  out: Mat4,
  fovY: number,
  aspect: number,
  near: number,
  far: number
): Mat4 {
  const f = 1 / Math.tan(fovY * 0.5);

  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[11] = -1;

  out[12] = 0;
  out[13] = 0;
  out[15] = 0;

  if (far === Infinity) {
    out[10] = -1;
    out[14] = -2 * near;
  } else {
    const nf = 1 / (near - far);
    out[10] = (near + far) * nf;
    out[14] = 2 * near * far * nf;
  }

  return out;
}

/**
 * Writes a perspective projection into `out`, for clip space whose depth runs
 * from `0` at the near plane to `1` at the far plane, as WebGPU, Vulkan, Metal
 * and Direct3D expect. For WebGL, whose depth runs from `-1` to `1`, use
 * `perspectiveNO`.
 *
 * It differs from `perspectiveNO` only in the two elements that set depth, so
 * everything else carries over: the camera looks down negative z, `w = -z`, a
 * point behind the camera gets a negative `w`, and `Vec3.transformMat4` gives
 * normalised device coordinates.
 *
 * Using the matrix for the other depth range is not an error anywhere, but it
 * is wrong: in a `-1` to `1` clip space, geometry closer than `near` is kept
 * down to about half of `near`, and half the depth range is unused.
 *
 * Depth is not linear in distance: a point at distance `d` lands at a depth of
 * `far / (far - near) * (1 - near / d)`. Its precision is set almost entirely
 * by `near`, so doubling `near` helps far more than halving `far`.
 *
 * `far` may be `Infinity`, which clips nothing beyond the near plane and costs
 * almost no precision: the depth becomes `1 - near / d`, against a factor of
 * `1.0001` for a `far` that is `10000` times `near`. The matrix is built from
 * that limit rather than the finite formula, which would give `NaN`. Very
 * distant points still round to a depth of exactly `1`, from about `1e7` times
 * `near` in float32, and fail a `less` depth test against a buffer cleared to
 * `1`.
 *
 * `fovY` **must be** between `0` and `PI`, `aspect` positive and
 * `0 < near < far`. None of this is checked: anything else gives a matrix that
 * mirrors, flips depth or divides by zero.
 *
 * Every element of `out` is overwritten.
 *
 * @param out - The matrix to write to.
 * @param fovY - The vertical field of view, in radians.
 * @param aspect - The viewport width divided by its height.
 * @param near - The distance to the near plane, which maps to a depth of `0`.
 * @param far - The distance to the far plane, which maps to a depth of `1`, or `Infinity`.
 * @returns `out`.
 */
export function perspectiveZO(
  out: Mat4,
  fovY: number,
  aspect: number,
  near: number,
  far: number
): Mat4 {
  const f = 1 / Math.tan(fovY * 0.5);

  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[11] = -1;

  out[12] = 0;
  out[13] = 0;
  out[15] = 0;

  if (far === Infinity) {
    out[10] = -1;
    out[14] = -near;
  } else {
    const nf = 1 / (near - far);
    out[10] = far * nf;
    out[14] = near * far * nf;
  }

  return out;
}

/**
 * Writes an orthographic projection of the box between `left` and `right`,
 * `bottom` and `top`, and `near` and `far` into `out`, for clip space whose
 * depth runs from `-1` at the near plane to `1` at the far plane, as WebGL
 * expects. For WebGPU, Vulkan, Metal or Direct3D, use `orthographicZO`.
 *
 * The camera looks down negative z, as in a view matrix from `lookAt`, so the
 * box spans view-space z from `-near` to `-far`. The box maps onto clip space
 * with no perspective: `w` stays `1`, sizes don't shrink with distance, and
 * depth is linear in distance.
 *
 * `left` and `right`, and `bottom` and `top`, are view-space coordinates, so a
 * box centred on the camera is `-halfWidth` to `halfWidth`. `near` may be zero
 * or negative, which reaches behind the camera, as shadow maps often need.
 *
 * `far` **must be finite**: depth is linear in distance, so there is no limit
 * to take, and an infinite `far` gives zeros or `NaN` in the depth row. `left`, `right` and `bottom`, `top` and
 * `near`, `far` **must differ**, which isn't checked: equal values divide by
 * zero.
 *
 * Every element of `out` is overwritten.
 *
 * @param out - The matrix to write to.
 * @param left - The view-space x that maps to `-1`.
 * @param right - The view-space x that maps to `1`.
 * @param bottom - The view-space y that maps to `-1`.
 * @param top - The view-space y that maps to `1`.
 * @param near - The distance to the near plane, which maps to a depth of `-1`.
 * @param far - The distance to the far plane, which maps to a depth of `1`.
 * @returns `out`.
 */
export function orthographicNO(
  out: Mat4,
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Mat4 {
  const lr = 1 / (right - left);
  const bt = 1 / (top - bottom);
  const nf = 1 / (near - far);

  out[0] = 2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = 2 * bt;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;

  out[12] = -(right + left) * lr;
  out[13] = -(top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;

  return out;
}

/**
 * Writes an orthographic projection of the box between `left` and `right`,
 * `bottom` and `top`, and `near` and `far` into `out`, for clip space whose
 * depth runs from `0` at the near plane to `1` at the far plane, as WebGPU,
 * Vulkan, Metal and Direct3D expect. For WebGL, use `orthographicNO`.
 *
 * It differs from `orthographicNO` only in the two elements that set depth,
 * so everything else carries over: the camera looks down negative z, `w` stays
 * `1`, and depth is linear in distance.
 *
 * `left` and `right`, and `bottom` and `top`, are view-space coordinates, so a
 * box centred on the camera is `-halfWidth` to `halfWidth`. `near` may be zero
 * or negative, which reaches behind the camera, as shadow maps often need.
 *
 * `far` **must be finite**: depth is linear in distance, so there is no limit
 * to take, and an infinite `far` gives zeros or `NaN` in the depth row. `left`, `right` and `bottom`, `top` and
 * `near`, `far` **must differ**, which isn't checked: equal values divide by
 * zero.
 *
 * Every element of `out` is overwritten.
 *
 * @param out - The matrix to write to.
 * @param left - The view-space x that maps to `-1`.
 * @param right - The view-space x that maps to `1`.
 * @param bottom - The view-space y that maps to `-1`.
 * @param top - The view-space y that maps to `1`.
 * @param near - The distance to the near plane, which maps to a depth of `0`.
 * @param far - The distance to the far plane, which maps to a depth of `1`.
 * @returns `out`.
 */
export function orthographicZO(
  out: Mat4,
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Mat4 {
  const lr = 1 / (right - left);
  const bt = 1 / (top - bottom);
  const nf = 1 / (near - far);

  out[0] = 2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  out[4] = 0;
  out[5] = 2 * bt;
  out[6] = 0;
  out[7] = 0;

  out[8] = 0;
  out[9] = 0;
  out[10] = nf;
  out[11] = 0;

  out[12] = -(right + left) * lr;
  out[13] = -(top + bottom) * bt;
  out[14] = near * nf;
  out[15] = 1;

  return out;
}

/**
 * Writes the view matrix of a camera at `eye` looking at `center` into `out`,
 * or returns `null` when no such camera exists.
 *
 * The view matrix takes world coordinates into the camera's: right-handed,
 * with the camera at the origin looking down negative z, `y` up and `x` to the
 * right, which is what the perspective and orthographic projections expect.
 * `center` lands on the negative z axis at its distance from `eye`. It is the
 * inverse of the camera's world transform: its rotation rows are the camera's
 * right, up and back directions, and its translation moves `eye` to the
 * origin. Since it is rigid, it keeps lengths and angles, and its
 * `determinant` is `1`.
 *
 * `up` only picks the roll: it needn't be unit length or perpendicular to the
 * view direction, since only the plane it shares with that direction is used.
 * The camera's own up is the part of `up` perpendicular to the view direction,
 * normalised.
 *
 * Returns `null` when `eye` equals `center`, leaving no direction to look in,
 * or when `up` is zero or parallel to the view direction, leaving no roll to
 * pick. A `NaN` component in any input returns `null` the same way. `out` is
 * then left untouched; keeping last frame's view is usually the right
 * response. Infinite components are not caught, and give `NaN` elements.
 *
 * The checks are exact, so an `up` that is *nearly* parallel to the view
 * direction passes. The result is still a valid view matrix, but its roll is
 * dominated by rounding: an orbit camera passing over its target spins about
 * the view axis. Clamp the pitch short of straight up or down, or build the
 * view from the camera's orientation instead.
 *
 * All three inputs are read into locals first, so each may be a view
 * overlapping `out`.
 *
 * @param out - The matrix to write to. Untouched when `null` is returned.
 * @param eye - The camera's position.
 * @param center - The point the camera looks at.
 * @param up - The direction that should appear upward on screen.
 * @returns `out`, or `null` if the camera is degenerate.
 */
export function lookAt(
  out: Mat4,
  eye: ReadonlyVec3,
  center: ReadonlyVec3,
  up: ReadonlyVec3
): Mat4 | null {
  // biome-ignore format: packed component reads
  const eX = eye[0], eY = eye[1], eZ = eye[2];
  // biome-ignore format: packed component reads
  const cX = center[0], cY = center[1], cZ = center[2];
  // biome-ignore format: packed component reads
  const uX = up[0], uY = up[1], uZ = up[2];

  // The camera's back direction: it looks down its own negative z.
  let zx = eX - cX;
  let zy = eY - cY;
  let zz = eZ - cZ;

  let len = Math.hypot(zx, zy, zz);
  if (!len) return null;
  let invLen = 1 / len;

  zx *= invLen;
  zy *= invLen;
  zz *= invLen;

  // The camera's right direction.
  let xx = uY * zz - uZ * zy;
  let xy = uZ * zx - uX * zz;
  let xz = uX * zy - uY * zx;

  len = Math.hypot(xx, xy, xz);
  if (!len) return null;
  invLen = 1 / len;

  xx *= invLen;
  xy *= invLen;
  xz *= invLen;

  // The camera's up direction, already unit length as the cross of two
  // perpendicular unit vectors.
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;

  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;

  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;

  out[12] = -(xx * eX + xy * eY + xz * eZ);
  out[13] = -(yx * eX + yy * eY + yz * eZ);
  out[14] = -(zx * eX + zy * eY + zz * eZ);
  out[15] = 1;

  return out;
}
