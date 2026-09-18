import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../_types/readonlyFixedFloat32Array.js';

/**
 * A 2x2 matrix stored as a `Float32Array` of length 4, in column-major order:
 * `[a00, a10, a01, a11]`. The first two elements are column 0.
 *
 * This is the layout GLSL/WGSL `mat2x2<f32>` expects, so the buffer can be
 * uploaded to the GPU as-is, with no transpose step.
 *
 * Elements are float32, so values are rounded on write
 * (`0.1` reads back as `0.10000000149011612`).
 *
 * Branded: a plain `Float32Array` won't type-check. Make one with
 * `mat2.create`, or cast when wrapping existing memory (e.g. a pooled view).
 */
export type Mat2 = Brand<FixedFloat32Array<4>, 'Matrix2x2'>;

/**
 * A `Mat2` that can't be written through, so it can't be passed as `out`.
 *
 * This limits *your* access, not the memory: if it's a view into shared
 * storage, the values can still change underneath you.
 */
export type ReadonlyMat2 = Brand<ReadonlyFixedFloat32Array<4>, 'Matrix2x2'>;
