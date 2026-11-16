import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../../_types/readonlyFixedFloat32Array.js';

/**
 * A 2D affine transform stored as a `Float32Array` of length 6, in
 * column-major order: `[a00, a10, a01, a11, a02, a12]`. Each pair of elements
 * is one column; the first two columns are the linear part (rotation, scale,
 * shear) and the last, at indices 4 and 5, is the translation.
 *
 * `3x2` means **3 columns of 2 rows**, the `matCxR` order WGSL and GLSL use,
 * not the rows-by-columns order of maths notation. System.Numerics'
 * `Matrix3x2` is 3 rows of 2 columns for row vectors: its bytes match this
 * layout, but its element names are transposed.
 *
 * The bottom row of the full 3x3 matrix is always `0 0 1`, so it isn't
 * stored. That makes every `Mat3x2` affine by construction: it can translate,
 * rotate, scale and shear, but never project, and nothing can write a bottom
 * row that would make it otherwise.
 *
 * This is the layout of WGSL's `mat3x2<f32>` (three 8-byte `vec2` columns, 24
 * bytes) and of WebGL2's `uniformMatrix3x2fv`, so it uploads as-is to either.
 * In WGSL, `m * vec3(p, 1.0)` transforms a point and `m * vec3(d, 0.0)` a
 * direction.
 *
 * Two layouts pad it, so it isn't a straight copy into them:
 *
 * - **std140**, the layout of a WebGL2 uniform block, pads every column to 16
 *   bytes, so a `mat3x2` there takes 48 bytes. Write it one column at a time.
 * - **Arrays in a WGSL uniform buffer** need an element stride that is a
 *   multiple of 16 bytes, so `array<mat3x2<f32>, N>` won't compile there.
 *   Pad each element to 32 bytes, use a storage buffer, or enable the
 *   `uniform_buffer_standard_layout` language extension, which lifts that
 *   rule: check `navigator.gpu.wgslLanguageFeatures` for it and declare
 *   `requires uniform_buffer_standard_layout;` in the shader.
 *
 * Elements are float32, so values are rounded on write
 * (`0.1` reads back as `0.10000000149011612`).
 *
 * Branded: a plain `Float32Array` won't type-check, and neither will a `Mat3`,
 * even one holding a 2D transform. Make one with `Mat3x2.create`, or cast when
 * wrapping existing memory (e.g. a pooled view). Any backing buffer works,
 * including a `SharedArrayBuffer`, but nothing here is atomic: coordinate
 * access across threads yourself.
 */
export type Mat3x2 = Brand<FixedFloat32Array<6>, 'Matrix3x2'>;

/**
 * A `Mat3x2` that can't be written through, so it can't be passed as `out`.
 *
 * This limits *your* access, not the memory: if it's a view into shared
 * storage, the values can still change underneath you.
 *
 * Hand the value itself to a GPU upload, not its `.buffer`: on a pooled view,
 * `.buffer` is the whole pool, not just this value.
 */
export type ReadonlyMat3x2 = Brand<ReadonlyFixedFloat32Array<6>, 'Matrix3x2'>;
