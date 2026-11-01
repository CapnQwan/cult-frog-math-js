// Entry point for `@cult-frog/math/quat`.
export * as Quat from './quaternion/quat.js';

import type { Quat as QuatType } from './quaternion/_types/quat.js';

export type { ReadonlyQuat } from './quaternion/_types/quat.js';

export type Quat = QuatType;
