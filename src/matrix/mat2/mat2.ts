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

import { EPSILON } from '../../constants.js';
import * as Scalars from '../../scalars.js';

import type { ReadonlyVec2 } from '../../vector/vec2/_types/vec2.js';
import type { Mat2, ReadonlyMat2 } from './_types/mat2.js';

/** The number of elements in a `Mat2`. */
export const SIZE = 4;

/**
 * Allocates a new matrix from elements given in row-major order.
 *
 * Omitted elements default to the identity's: `1` on the diagonal and `0`
 * everywhere else, so `create()` is the identity matrix, the transform that
 * changes nothing. A zero default would give the zero matrix, which collapses
 * everything onto the origin and has no inverse. Defaults apply element by
 * element, so a partial argument list keeps the rest of the identity:
 * `create(2)` is the identity with `a00` set to `2`, and `a11` is still
 * `1`. For the zero matrix, pass every element as `0`.
 *
 * Values are stored as float32, so they may be rounded.
 *
 * @returns A new matrix with its own buffer.
 */
// biome-ignore format: visual alignment with the matrix
export function create(
  a00: number = 1, a01: number = 0,
  a10: number = 0, a11: number = 1
): Mat2 {
  const out = new Float32Array(SIZE) as Mat2;

  out[0] = a00; out[2] = a01;
  out[1] = a10; out[3] = a11;

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
 * matrix, use `create()`.
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

/**
 * Returns whether two matrices have exactly equal elements.
 *
 * @param a - The first matrix.
 * @param b - The second matrix.
 * @returns `true` if every element is equal.
 */
export function isEqual(a: ReadonlyMat2, b: ReadonlyMat2): boolean {
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
export function isEqualEpsilon(a: ReadonlyMat2, b: ReadonlyMat2, eps = EPSILON): boolean {
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
export function multiply(out: Mat2, a: ReadonlyMat2, b: ReadonlyMat2): Mat2 {
  const a00 = a[0], a01 = a[2];
  const a10 = a[1], a11 = a[3];

  const b00 = b[0], b01 = b[2];
  const b10 = b[1], b11 = b[3];

  out[0] = a00 * b00 + a01 * b10;
  out[1] = a10 * b00 + a11 * b10;
  out[2] = a00 * b01 + a01 * b11;
  out[3] = a10 * b01 + a11 * b11;

  return out;
}

/**
 * Transposes `a`, swapping its rows and columns, and writes the result into
 * `out`.
 *
 * The element at row `r`, column `c` moves to row `c`, column `r`, so the
 * diagonal stays where it is and `a01` trades places with `a10`. No arithmetic
 * is done: every element is copied bit for bit, including `NaN`, `-0` and
 * infinities, so transposing twice gives back the original exactly.
 *
 * For a pure rotation, the transpose is also the inverse, and much cheaper to
 * compute. That holds only while the columns are unit length and
 * perpendicular to each other: once the matrix scales or shears, the transpose
 * no longer undoes it.
 *
 * Row-major data viewed as a `Mat2` holds the transpose of the matrix it
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
export function transpose(out: Mat2, a: ReadonlyMat2): Mat2 {
  const a00 = a[0], a01 = a[2];
  const a10 = a[1], a11 = a[3];

  out[0] = a00;
  out[1] = a01;

  out[2] = a10;
  out[3] = a11;

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
 * Determinants multiply under `multiply`, so a chain of transforms mirrors
 * only if an odd number of them do. Transposing does not change the
 * determinant.
 *
 * Zero means `a` collapses the plane onto a line or a point, and has no
 * inverse. Rounding rarely lands exactly on zero for a matrix that is singular
 * in theory, and a nearly singular matrix gives a small non-zero result, so
 * test against a tolerance scaled to the elements' magnitude rather than
 * `=== 0`.
 *
 * The elements are float32, but the arithmetic runs in float64, so the result
 * is not rounded to float32. A `NaN` element gives `NaN`.
 *
 * @param a - The matrix to measure.
 * @returns The determinant of `a`.
 */
// biome-ignore format: visual alignment with the matrix
export function determinant(a: ReadonlyMat2): number {
  const a00 = a[0], a01 = a[2];
  const a10 = a[1], a11 = a[3];

  return a00 * a11 - a01 * a10;
}

/**
 * Inverts `a` and writes the result into `out`, so that `a * out` and
 * `out * a` are both the identity, up to rounding.
 *
 * The inverse undoes the transform: if `a` takes coordinates from a local
 * frame into its parent, the inverse takes them back.
 *
 * Returns `null` when `a` is singular, meaning its determinant is exactly
 * zero, as for a matrix that scales an axis to zero. A `NaN` element makes
 * the determinant `NaN`, which returns `null` the same way. There is no
 * inverse to write, so `out` is left untouched. Check the result before using
 * it.
 *
 * The check is exact rather than within a tolerance, because a fixed
 * tolerance can't tell a small but valid matrix from a nearly singular one:
 * the determinant shrinks with the square of a uniform scale, so a scale of
 * `0.01` gives `1e-4` and still inverts cleanly. A nearly singular matrix
 * inverts to very large elements, most of whose precision has been lost to
 * rounding. Infinite elements are not caught: if they make the determinant
 * infinite rather than `NaN`, the result is zeros and `NaN` rather than an
 * inverse.
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
export function invert(out: Mat2, a: ReadonlyMat2): Mat2 | null {
  const a00 = a[0], a01 = a[2];
  const a10 = a[1], a11 = a[3];

  const det = a00 * a11 - a01 * a10;

  if (!det) return null;

  const invDet = 1 / det;

  out[0] = a11 * invDet;
  out[1] = -a10 * invDet;
  out[2] = -a01 * invDet;
  out[3] = a00 * invDet;

  return out;
}

/**
 * Writes a 2D rotation of `angle` radians into `out`.
 *
 * Every element of `out` is overwritten: this builds a new transform rather
 * than rotating the one already in `out`. To rotate an existing matrix,
 * `multiply` by the result.
 *
 * A positive angle turns counter-clockwise in this package's y-up convention,
 * taking `Vec2.RIGHT` towards `Vec2.UP`. In screen space, where y grows
 * downward, the same angle looks clockwise. Negating the angle gives the
 * inverse, which is also the `transpose`.
 *
 * Rotations are only close to exact: `Math.cos(Math.PI / 2)` is about `6e-17`
 * rather than `0`, so even a quarter turn leaves tiny elements where the
 * identity has zeros. Compare results with `isEqualEpsilon`.
 *
 * @param out - The matrix to write to.
 * @param angle - The rotation angle in radians.
 * @returns `out`.
 */
export function fromRotation(out: Mat2, angle: number): Mat2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  out[0] = cos;
  out[1] = sin;

  out[2] = -sin;
  out[3] = cos;

  return out;
}

/**
 * Writes a scale by `v` along each axis into `out`.
 *
 * Every element of `out` is overwritten: this builds a new transform rather
 * than scaling the one already in `out`. To scale an existing matrix,
 * `multiply` by the result.
 *
 * The scale lands on the diagonal and the rest is zero, so the result is
 * exact. A negative component mirrors along that axis, which makes the
 * `determinant` negative, and a zero component flattens it, which leaves the
 * matrix without an inverse. `fromScale` of the reciprocals is its inverse.
 *
 * `v` is read into locals first, so it may be a view overlapping `out`.
 *
 * @param out - The matrix to write to.
 * @param v - The scale along x and y.
 * @returns `out`.
 */
export function fromScale(out: Mat2, v: ReadonlyVec2): Mat2 {
  // biome-ignore format: packed component reads
  const x = v[0], y = v[1];

  out[0] = x;
  out[1] = 0;

  out[2] = 0;
  out[3] = y;

  return out;
}
