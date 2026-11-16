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
