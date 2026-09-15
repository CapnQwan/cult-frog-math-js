import type { Brand } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { ReadonlyFixedFloat32Array } from '../../_types/readonlyFixedFloat32Array.js';

/**
 * A Vector2 represented as a 2-element array
 *
 * vector[0] = x
 * vector[1] = y
 */
export type Vec2 = Brand<FixedFloat32Array<2>, 'Vec2'>;

/**
 * A Readonly Vector2 represented as a 2-element array
 *
 * vector[0] = x
 * vector[1] = y
 */
export type ReadonlyVec2 = Brand<ReadonlyFixedFloat32Array<2>, 'Vec2'>;
