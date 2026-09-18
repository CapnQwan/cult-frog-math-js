import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../_types/readonlyFixedFloat32Array.js';

/**
 * A 4x4 matrix stored as a `Float32Array` of length 16, in column-major order.
 * Each run of four elements is one column, which puts the translation column
 * at indices 12, 13 and 14.
 *
 * This is the layout GLSL/WGSL `mat4x4<f32>` and `uniformMatrix4fv` expect, so
 * the buffer can be uploaded to the GPU as-is, with no transpose step.
 *
 * Elements are float32, so values are rounded on write
 * (`0.1` reads back as `0.10000000149011612`). For world transforms far from
 * the origin this is worth remembering: a translation of 10,000,000 units
 * resolves to about one unit.
 *
 * Branded: a plain `Float32Array` won't type-check. Make one with
 * `mat4.create`, or cast when wrapping existing memory (e.g. a pooled view).
 */
export type Mat4 = Brand<FixedFloat32Array<16>, 'Matrix4x4'>;

/**
 * A `Mat4` that can't be written through, so it can't be passed as `out`.
 *
 * This limits *your* access, not the memory: if it's a view into shared
 * storage, the values can still change underneath you.
 */
export type ReadonlyMat4 = Brand<ReadonlyFixedFloat32Array<16>, 'Matrix4x4'>;
