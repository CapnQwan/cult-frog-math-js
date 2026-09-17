import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../_types/readonlyFixedFloat32Array.js';

/**
 * A 3D vector stored as a `Float32Array` of length 3: `[x, y, z]`.
 *
 * Components are float32, so values are rounded on write
 * (`0.1` reads back as `0.10000000149011612`).
 *
 * Branded: a plain `Float32Array` won't type-check. Make one with
 * `vec3.create`, or cast when wrapping existing memory (e.g. a pooled view).
 */
export type Vec3 = Brand<FixedFloat32Array<3>, 'Vec3'>;

/**
 * A `Vec3` that can't be written through, so it can't be passed as `out`.
 *
 * This limits *your* access, not the memory: if it's a view into shared
 * storage, the values can still change underneath you.
 */
export type ReadonlyVec3 = Brand<ReadonlyFixedFloat32Array<3>, 'Vec3'>;
