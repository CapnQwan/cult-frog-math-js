import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../_types/readonlyFixedFloat32Array.js';

/**
 * A quaternion stored as a `Float32Array` of length 4: `[x, y, z, w]`, with the
 * scalar part **last**.
 *
 * That ordering is deliberate. It makes a `Quat` byte-identical to a `Vec4` and
 * to a shader's `vec4<f32>`, so quaternions upload to the GPU untouched and
 * interchange with gl-matrix, three.js and glTF without a shuffle.
 *
 * A *unit* quaternion encodes a rotation: for a rotation of `θ` about a unit
 * axis `n`, the components are `xyz = n * sin(θ/2)` and `w = cos(θ/2)`. Nothing
 * in this module enforces unit length — normalising is the caller's job, and
 * repeated multiplication will drift.
 *
 * Components are float32, so values are rounded on write
 * (`0.1` reads back as `0.10000000149011612`).
 *
 * Branded, and branded *separately from `Vec4`* despite the identical memory
 * layout: the two mean different things, so the compiler won't let you pass one
 * where the other is expected. Make one with `quat.create`, or cast when
 * wrapping existing memory (e.g. a pooled view).
 */
export type Quat = Brand<FixedFloat32Array<4>, 'Quaternion'>;

/**
 * A `Quat` that can't be written through, so it can't be passed as `out`.
 *
 * This limits *your* access, not the memory: if it's a view into shared
 * storage, the values can still change underneath you.
 */
export type ReadonlyQuat = Brand<ReadonlyFixedFloat32Array<4>, 'Quaternion'>;
