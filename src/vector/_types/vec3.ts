import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../_types/readonlyFixedFloat32Array.js';

/**
 * A Vector3 represented as a 3-element array
 *
 * vector[0] = x
 * vector[1] = y
 * vector[2] = z
 */
export type Vec3 = Brand<FixedFloat32Array<3>, 'Vec3'>;

/**
 * A Readonly Vector3 represented as a 3-element array
 *
 * vector[0] = x
 * vector[1] = y
 * vector[2] = z
 */
export type ReadonlyVec3 = Brand<ReadonlyFixedFloat32Array<3>, 'Vec3'>;
