/**
 * Quaternions stored as `[x, y, z, w]`, with the scalar part **last**.
 *
 * A unit quaternion encodes a rotation of `θ` about a unit axis `n` as
 * `xyz = n * sin(θ/2)`, `w = cos(θ/2)`. Nothing here enforces unit length: that
 * is the caller's responsibility, and chains of multiplications will drift.
 *
 * Because the scalar comes last, a `Quat` shares its layout with `Vec4` and with
 * a shader's `vec4<f32>`, so it uploads to the GPU untouched. The two types are
 * branded separately even so — they mean different things.
 *
 * As everywhere else in the package, `create` defaults its components to zero,
 * so `create()` is the zero quaternion — which is not a rotation at all and
 * cannot be normalised. For a usable starting rotation use `clone(IDENTITY)`.
 *
 * Follows the package conventions: `out` first and returned, inputs are
 * read-only, and `out` may alias any input.
 *
 * @module quat
 */

import type { Quat, ReadonlyQuat } from './_types/quat.js';

/**
 * Allocates a new quaternion. Omitted components default to `0`, so `create()`
 * is the **zero** quaternion, not the identity rotation. A zero quaternion has
 * no rotation to represent and cannot be normalised; for a fresh identity
 * rotation use `clone(IDENTITY)`.
 *
 * The components are taken raw and are not normalised; passing an arbitrary
 * `x, y, z, w` gives you exactly those values, unit length or not.
 *
 * @param x - The x component of the vector part.
 * @param y - The y component of the vector part.
 * @param z - The z component of the vector part.
 * @param w - The scalar component.
 * @returns A new quaternion with its own buffer.
 */
export function create(x: number = 0, y: number = 0, z: number = 0, w: number = 0): Quat {
  const quat = new Float32Array(4) as Quat;
  quat[0] = x;
  quat[1] = y;
  quat[2] = z;
  quat[3] = w;
  return quat;
}

/**
 * Allocates a new quaternion with the same components as `a`.
 *
 * Use this to take a standalone snapshot of a pooled view: the result has its
 * own buffer and won't change when the original memory is written to.
 *
 * @param a - The quaternion to clone.
 * @returns A new quaternion with its own buffer.
 */
export function clone(a: ReadonlyQuat): Quat {
  return create(a[0], a[1], a[2], a[3]);
}

/**
 * Writes all four components into `out`. Values are rounded to float32 and are
 * not normalised.
 *
 * Every component is overwritten, so whatever `out` held before is irrelevant.
 *
 * @param out - The quaternion to write to.
 * @param x - The x component of the vector part.
 * @param y - The y component of the vector part.
 * @param z - The z component of the vector part.
 * @param w - The scalar component.
 * @returns `out`.
 */
export function set(out: Quat, x: number, y: number, z: number, w: number): Quat {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}

/**
 * Copies the components of `a` into `out`.
 *
 * `out` and `a` may be the same quaternion, or different views that overlap the
 * same memory: every component is read into a local before anything is written,
 * so nothing can be clobbered before it has been used.
 *
 * @param out - The quaternion to write to.
 * @param a - The quaternion to copy from.
 * @returns `out`.
 */
export function copy(out: Quat, a: ReadonlyQuat): Quat {
  // biome-ignore format: keeps the format easier to read
  const x = a[0], y = a[1], z = a[2], w = a[3];

  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;

  return out;
}

/**
 * Writes the identity rotation `(0, 0, 0, 1)` into `out`, discarding its
 * previous contents.
 *
 * This is the in-place reset; it allocates nothing. To get a *new* identity
 * quaternion, use `clone(IDENTITY)`.
 *
 * @param out - The quaternion to write to.
 * @returns `out`.
 */
export function identity(out: Quat): Quat {
  return set(out, 0, 0, 0, 1);
}

/**
 * The identity rotation `(0, 0, 0, 1)`: the rotation that changes nothing.
 *
 * Shared instance, readonly at the type level only. Never cast it to `Quat`
 * or write to it; `clone` it if you need a mutable copy.
 */
export const IDENTITY = create(0, 0, 0, 1) as ReadonlyQuat;
