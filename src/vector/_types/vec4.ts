import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../_types/readonlyFixedFloat32Array.js';

/**
 * A Vector4 represented as a 4-element array
 *
 * vector[0] = w
 * vector[1] = x
 * vector[2] = y
 * vector[3] = z
 */
export type Vec4 = Brand<FixedFloat32Array<4>, 'Vec4'>;

/**
 * A Readonly Vector4 represented as a 4-element array
 *
 * vector[0] = w
 * vector[1] = x
 * vector[2] = y
 * vector[3] = z
 */
export type ReadonlyVec4 = Brand<ReadonlyFixedFloat32Array<4>, 'Vec4'>;
