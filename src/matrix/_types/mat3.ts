import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../_types/readonlyFixedFloat32Array.js';

/**
 * A 3x3 matrix stored as a `Float32Array` of length 9, in column-major order:
 * `[a00, a10, a20, a01, a11, a21, a02, a12, a22]`. Each run of three elements
 * is one column.
 *
 * Unlike the other types in this package, a `Mat3` is *not* a straight GPU
 * upload: it's packed tightly as 9 floats, while WGSL's `mat3x3<f32>` and
 * std140 pad every column out to 16 bytes (48 bytes total). Write it into a
 * uniform block one column at a time, or promote it to a `Mat4`.
 *
 * Elements are float32, so values are rounded on write
 * (`0.1` reads back as `0.10000000149011612`).
 *
 * Branded: a plain `Float32Array` won't type-check. Make one with
 * `mat3.create`, or cast when wrapping existing memory (e.g. a pooled view).
 */
export type Mat3 = Brand<FixedFloat32Array<9>, 'Matrix3x3'>;

/**
 * A `Mat3` that can't be written through, so it can't be passed as `out`.
 *
 * This limits *your* access, not the memory: if it's a view into shared
 * storage, the values can still change underneath you.
 */
export type ReadonlyMat3 = Brand<ReadonlyFixedFloat32Array<9>, 'Matrix3x3'>;
