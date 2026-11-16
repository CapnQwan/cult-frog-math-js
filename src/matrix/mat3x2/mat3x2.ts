/**
 * 2D affine transforms, stored as 6 contiguous floats in column-major order:
 * 3 columns of 2 rows, the `matCxR` order of WGSL's `mat3x2<f32>`.
 *
 * Arguments are given in *row-major* order, so a matrix spelled out in source
 * reads the way it does on paper; these functions transpose on the way into
 * memory. Element names are always `a<row><col>`, raw indices are always
 * column major. The bottom row of the full 3x3 matrix is always `0 0 1` and
 * isn't stored:
 *
 * ```text
 *   a00  a01  a02          0   2   4
 *   a10  a11  a12    ->    1   3   5
 *  ( 0    0    1 )        (implied)
 * ```
 *
 * The first two columns are the linear part and the last is the translation,
 * at indices 4 and 5. Because the bottom row is implied rather than stored,
 * every `Mat3x2` is an affine transform: it can translate, rotate, scale and
 * shear, but not project.
 *
 * There is no `transpose`. The transpose of a 3x2 matrix is a 2x3 one, which
 * isn't this type, and the transpose of an affine transform isn't affine.
 *
 * For 3D transforms, use `Mat3` (rotation and scale) or `Mat4` (with
 * translation and projection).
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module mat3x2
 */

import { EPSILON } from '../../constants.js';
import * as Scalars from '../../scalars.js';

import type { Mat3x2, ReadonlyMat3x2 } from './_types/index.js';

/** The number of elements in a `Mat3x2`. */
export const SIZE = 6;

/**
 * Allocates a new matrix from elements given in row-major order.
 *
 * Omitted elements default to the identity's: `1` for `a00` and `a11`, and
 * `0` everywhere else, so `create()` is the identity transform, which changes
 * nothing. A zero default would give a transform that collapses everything
 * onto the origin and has no inverse. Defaults apply element by element, so a
 * partial argument list keeps the rest of the identity: `create(2)` scales x
 * by `2` and leaves `a11` at `1`. For the zero matrix, pass all six elements
 * as `0`.
 *
 * Values are stored as float32, so they may be rounded — worth remembering
 * for translations far from the origin.
 *
 * @returns A new matrix with its own buffer.
 */
// biome-ignore format: visual alignment with the matrix
export function create(
  a00: number = 1, a01: number = 0, a02: number = 0,
  a10: number = 0, a11: number = 1, a12: number = 0,
): Mat3x2 {
  const out = new Float32Array(SIZE) as Mat3x2;

  out[0] = a00; out[2] = a01; out[4] = a02;
  out[1] = a10; out[3] = a11; out[5] = a12;

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
export function clone(a: ReadonlyMat3x2): Mat3x2 {
  return create(
    a[0], a[2], a[4],
    a[1], a[3], a[5],
  );
}

/**
 * Writes all six elements into `out`, given in row-major order. Values are
 * rounded to float32.
 *
 * Every element is overwritten, so whatever `out` held before is irrelevant.
 *
 * @param out - The matrix to write to.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function set(
  out: Mat3x2,
  a00: number, a01: number, a02: number,
  a10: number, a11: number, a12: number,
): Mat3x2 {
  out[0] = a00; out[2] = a01; out[4] = a02;
  out[1] = a10; out[3] = a11; out[5] = a12;
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
export function copy(out: Mat3x2, a: ReadonlyMat3x2): Mat3x2 {
  const a00 = a[0], a01 = a[2], a02 = a[4];
  const a10 = a[1], a11 = a[3], a12 = a[5];

  out[0] = a00; out[2] = a01; out[4] = a02;
  out[1] = a10; out[3] = a11; out[5] = a12;

  return out;
}

/**
 * Writes the identity transform into `out`, discarding its previous contents.
 *
 * This is the in-place reset; it allocates nothing. To get a *new* identity
 * matrix, use `create()`.
 *
 * @param out - The matrix to write to.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function identity(out: Mat3x2): Mat3x2 {
  return set(
    out,
    1, 0, 0,
    0, 1, 0,
  );
}

/**
 * The 2D identity transform.
 *
 * Shared instance, readonly at the type level only. Never cast it to
 * `Mat3x2` or write to it; `clone` it if you need a mutable copy.
 */
export const IDENTITY = identity(create()) as ReadonlyMat3x2;

/**
 * Returns whether two matrices have exactly equal elements.
 *
 * @param a - The first matrix.
 * @param b - The second matrix.
 * @returns `true` if every element is equal.
 */
export function isEqual(a: ReadonlyMat3x2, b: ReadonlyMat3x2): boolean {
  for (let i = 0; i < SIZE; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Returns whether two matrices are equal within a tolerance, compared
 * element by element.
 *
 * Each element goes through the scalar `isEqualEpsilon`, so the tolerance is
 * `eps` near unit scale and widens with the elements' magnitude. That
 * includes the translation, so two transforms far from the origin compare
 * with a looser tolerance on every element.
 *
 * @param a - The first matrix.
 * @param b - The second matrix.
 * @param eps - The base tolerance, before scaling. Defaults to {@link EPSILON}.
 * @returns `true` if every element is within tolerance.
 */
export function isEqualEpsilon(a: ReadonlyMat3x2, b: ReadonlyMat3x2, eps = EPSILON): boolean {
  // biome-ignore lint/style/noNonNullAssertion: i < SIZE, so the index is always in bounds
  for (let i = 0; i < SIZE; i++) if (!Scalars.isEqualEpsilon(a[i]!, b[i]!, eps)) return false;
  return true;
}

/**
 * Composes two transforms (the matrix product `a * b`) and writes the result
 * into `out`.
 *
 * Vectors are columns, so the result applies `b` first, then `a`. Order
 * matters: `multiply(out, a, b)` and `multiply(out, b, a)` are generally
 * different transforms. `multiply(out, m, delta)` applies `delta` in `m`'s
 * local frame, while `multiply(out, delta, m)` applies it in the parent
 * frame.
 *
 * The product is the one the full 3x3 matrices would give, with their implied
 * `0 0 1` bottom rows. Those rows reduce it to two parts: the linear part is
 * the 2x2 product of `a`'s and `b`'s, and the translation is `b`'s translation
 * carried through `a`'s linear part, plus `a`'s own translation. The bottom
 * row of the product is `0 0 1` again, so the result is always affine, and it
 * takes 12 multiplies rather than the 27 of a full 3x3 product.
 *
 * With finite elements, `IDENTITY` on either side gives back the other input.
 * An infinite element meets the identity's zeros, and `0 * Infinity` is
 * `NaN`, so the elements it reaches come out as `NaN`.
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
export function multiply(out: Mat3x2, a: ReadonlyMat3x2, b: ReadonlyMat3x2): Mat3x2 {
  const a00 = a[0], a01 = a[2], a02 = a[4];
  const a10 = a[1], a11 = a[3], a12 = a[5];

  const b00 = b[0], b01 = b[2], b02 = b[4];
  const b10 = b[1], b11 = b[3], b12 = b[5];

  out[0] = a00 * b00 + a01 * b10;
  out[1] = a10 * b00 + a11 * b10;

  out[2] = a00 * b01 + a01 * b11;
  out[3] = a10 * b01 + a11 * b11;

  out[4] = a00 * b02 + a01 * b12 + a02;
  out[5] = a10 * b02 + a11 * b12 + a12;

  return out;
}

/**
 * Returns the determinant of `a`.
 *
 * Its magnitude is the factor by which `a` scales area: `2` doubles it and
 * `0.5` halves it. Its sign says whether `a` keeps orientation: a negative
 * determinant means `a` mirrors, turning counter-clockwise order into
 * clockwise. A rotation gives `1`, up to rounding.
 *
 * This is the determinant of the full 3x3 matrix, and the implied `0 0 1`
 * bottom row reduces it to that of the 2x2 linear part. The translation never
 * affects it: moving a shape doesn't change its area or its orientation.
 *
 * Determinants multiply under `multiply`, so a chain of transforms mirrors
 * only if an odd number of them do.
 *
 * Zero means `a` collapses the plane onto a line or a point, and has no
 * inverse. Rounding rarely lands exactly on zero for a matrix that is singular
 * in theory, and a nearly singular matrix gives a small non-zero result, so
 * test against a tolerance scaled to the elements' magnitude rather than
 * `=== 0`.
 *
 * The elements are float32, but the arithmetic runs in float64, so the result
 * is not rounded to float32. A `NaN` in the linear part gives `NaN`; a `NaN`
 * translation doesn't reach the result.
 *
 * @param a - The matrix to measure.
 * @returns The determinant of `a`.
 */
// biome-ignore format: visual alignment with the matrix
export function determinant(a: ReadonlyMat3x2): number {
  const a00 = a[0], a01 = a[2];
  const a10 = a[1], a11 = a[3];

  return a00 * a11 - a01 * a10;
}

/**
 * Inverts `a` and writes the result into `out`, so that `a * out` and
 * `out * a` are both the identity, up to rounding.
 *
 * The inverse undoes the transform: if `a` takes coordinates from a local
 * frame into its parent, the inverse takes them back. That's how a camera
 * transform becomes a view transform, or a screen position becomes a local
 * one for hit testing.
 *
 * The inverse of an affine transform is affine, so it fits a `Mat3x2`. Its
 * linear part is the inverse of `a`'s, and its translation is `a`'s
 * translation carried back through that inverse and negated: undoing `a`
 * means removing its translation first, then undoing its linear part. A pure
 * translation therefore inverts exactly, to its negation.
 *
 * Returns `null` when `a` is singular, meaning the determinant of its linear
 * part is exactly zero, as for a matrix that scales an axis to zero. The
 * translation never makes a matrix singular. A `NaN` in the linear part makes
 * the determinant `NaN`, which returns `null` the same way, but a `NaN`
 * translation doesn't reach the determinant: the matrix inverts, with a `NaN`
 * translation in the result. When `null` is returned there is no inverse to
 * write, so `out` is left untouched. Check the result before using it.
 *
 * The check is exact rather than within a tolerance, because a fixed
 * tolerance can't tell a small but valid matrix from a nearly singular one:
 * the determinant shrinks with the square of a uniform scale, so a scale of
 * `0.01` gives `1e-4` and still inverts cleanly. A nearly singular matrix
 * inverts to very large elements, most of whose precision has been lost to
 * rounding, and its translation, divided by the same tiny determinant, loses
 * the most. Infinite elements are not caught: if they make the determinant
 * infinite rather than `NaN`, the result is zeros and `NaN` rather than an
 * inverse.
 *
 * `out` may be the same matrix as `a`, or a view overlapping it: every element
 * is read into a local before anything is written.
 *
 * @param out - The matrix to write to. Untouched when `null` is returned.
 * @param a - The matrix to invert.
 * @returns `out`, or `null` if `a` has no inverse.
 */
// biome-ignore format: visual alignment with the matrix
export function invert(out: Mat3x2, a: ReadonlyMat3x2): Mat3x2 | null {
  const a00 = a[0], a01 = a[2], a02 = a[4];
  const a10 = a[1], a11 = a[3], a12 = a[5];

  const det = a00 * a11 - a01 * a10;

  if (!det) return null;

  const invDet = 1 / det;

  out[0] = a11 * invDet;
  out[1] = -a10 * invDet;

  out[2] = -a01 * invDet;
  out[3] = a00 * invDet;

  // -inverse(linear) * translation, with the 1 / det factored out.
  out[4] = (a01 * a12 - a11 * a02) * invDet;
  out[5] = (a10 * a02 - a00 * a12) * invDet;

  return out;
}
