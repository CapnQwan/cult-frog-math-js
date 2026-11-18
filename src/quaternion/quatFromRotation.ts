/**
 * The rotation-matrix-to-quaternion conversion, shared by `Quat.fromMat3` and
 * `Mat4.decompose`.
 *
 * It takes the nine elements as numbers rather than a matrix, because
 * `decompose` only has the rotation once it has divided the scale out of the
 * columns, as locals: taking a `Mat3` would mean writing them to a scratch
 * matrix first.
 *
 * Internal to the package: this module is not re-exported from any entry
 * point and imports neither namespace, so both can depend on it without the
 * quaternion module depending on the matrix one at runtime.
 *
 * @module quatFromRotation
 */

import type { Quat } from './_types/quat.js';

/**
 * Writes the unit quaternion for the rotation matrix whose elements are
 * `r<row><col>` into `out`.
 *
 * Every quaternion component can be recovered from the diagonal, but only up
 * to sign, and dividing by a small one amplifies its rounding. So the largest
 * of `|w|`, `|x|`, `|y|` and `|z|` is recovered from the diagonal first, and
 * the others from the sums and differences of opposite off-diagonal elements,
 * divided by it. Using the trace for `w` alone would fail near half turns,
 * where `w` is near zero. Picking the largest makes the result accurate for
 * every rotation, and fixes its sign: the recovered component is positive, so
 * the same matrix always gives the same quaternion, though not necessarily
 * the one it was built from, which may be its negation.
 *
 * The result is normalised, which is exact for a rotation and keeps the result
 * unit length when the matrix has drifted slightly from one. It doesn't make a
 * scaled, sheared or mirrored matrix into the right rotation: the caller is
 * responsible for passing a rotation.
 *
 * Every argument is a number, so `out` can't alias the input.
 *
 * @param out - The quaternion to write to.
 * @returns `out`.
 */
// biome-ignore format: visual alignment with the matrix
export function quatFromRotation(
  out: Quat,
  r00: number, r01: number, r02: number,
  r10: number, r11: number, r12: number,
  r20: number, r21: number, r22: number
): Quat {
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

  const invLen = 1 / Math.hypot(x, y, z, w);

  out[0] = x * invLen;
  out[1] = y * invLen;
  out[2] = z * invLen;
  out[3] = w * invLen;

  return out;
}
