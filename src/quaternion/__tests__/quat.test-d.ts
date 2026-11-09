// src/quaternion/__tests__/quat.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec3 from '../../vector/vec3/vec3.js';
import * as quat from '../quat.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { Vec2 } from '../../vector/vec2/_types/vec2.js';
import type { ReadonlyVec3, Vec3 } from '../../vector/vec3/_types/vec3.js';
import type { ReadonlyVec4, Vec4 } from '../../vector/vec4/_types/vec4.js';
import type { Quat, ReadonlyQuat } from '../_types/quat.js';

declare const live: Quat;
declare const frozen: ReadonlyQuat;
declare const vector: Vec4;
declare const raw: Float32Array<ArrayBuffer>;
declare const axis: Vec3;
declare const frozenAxis: ReadonlyVec3;
declare const flat: Vec2;

/** A `Quat` backed by a `SharedArrayBuffer`, as a view into worker-shared storage would be. */
type SharedQuat = Brand<FixedFloat32Array<4, SharedArrayBuffer>, BrandOf<Quat>>;
declare const shared: SharedQuat;
declare const sab: SharedArrayBuffer;
declare const rawShared: Float32Array<SharedArrayBuffer>;

describe('Quat / ReadonlyQuat relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Quat>().toExtend<ReadonlyQuat>();
    expectTypeOf<ReadonlyQuat>().not.toExtend<Quat>();
  });

  test('brand rejects unbranded arrays', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyQuat>();
  });

  test('Quat and Vec4 do not interchange despite an identical layout', () => {
    // Same 4 float32s in memory, different meaning: the brands keep a rotation
    // from being passed where a vector is expected, and vice versa.
    expectTypeOf<Vec4>().not.toExtend<ReadonlyQuat>();
    expectTypeOf<Quat>().not.toExtend<ReadonlyVec4>();
    expectTypeOf<Quat>().not.toEqualTypeOf<Vec4>();
  });

  test('length is the literal 4', () => {
    expectTypeOf<Quat['length']>().toEqualTypeOf<4>();
    expectTypeOf<ReadonlyQuat['length']>().toEqualTypeOf<4>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([0, 0, 0, 1]);
    // @ts-expect-error `subarray` would hand out a mutable alias
    frozen.subarray(0, 1);
  });

  test('readonly can be uploaded to the GPU without a cast', () => {
    expectTypeOf<ReadonlyQuat>().toExtend<ArrayBufferView>();
  });
});

describe('quat signatures', () => {
  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(quat.copy).parameter(0).toEqualTypeOf<Quat>();
    expectTypeOf(quat.copy).parameter(1).toEqualTypeOf<ReadonlyQuat>();
    expectTypeOf(quat.clone).parameter(0).toEqualTypeOf<ReadonlyQuat>();
    expectTypeOf(quat.set).parameter(0).toEqualTypeOf<Quat>();
    expectTypeOf(quat.identity).parameter(0).toEqualTypeOf<Quat>();
  });

  test('allocators return owned, mutable quaternions', () => {
    expectTypeOf(quat.create).returns.toEqualTypeOf<Quat>();
    expectTypeOf(quat.clone).returns.toEqualTypeOf<Quat>();
  });

  test('in-place writers return the mutable out', () => {
    expectTypeOf(quat.set).returns.toEqualTypeOf<Quat>();
    expectTypeOf(quat.copy).returns.toEqualTypeOf<Quat>();
    expectTypeOf(quat.identity).returns.toEqualTypeOf<Quat>();
  });

  test('IDENTITY is shared and cannot be passed as out', () => {
    expectTypeOf(quat.IDENTITY).toEqualTypeOf<ReadonlyQuat>();
    // @ts-expect-error the shared constant must never be written through
    quat.identity(quat.IDENTITY);
  });

  test('every create parameter is optional', () => {
    expectTypeOf(quat.create).parameter(0).toEqualTypeOf<number | undefined>();
    expectTypeOf(quat.create).parameter(3).toEqualTypeOf<number | undefined>();
  });

  test('call sites', () => {
    quat.copy(live, frozen);
    quat.copy(live, live);
    quat.clone(frozen);
    quat.identity(live);
    // @ts-expect-error readonly can never be an out parameter
    quat.set(frozen, 0, 0, 0, 1);
    // @ts-expect-error a Vec4 is not a Quat, identical layout notwithstanding
    quat.copy(live, vector);
    // @ts-expect-error the scalar component is required
    quat.set(live, 0, 0, 0);
  });
});

describe('shared memory', () => {
  test('a SharedArrayBuffer view casts to Quat with a single cast', () => {
    expectTypeOf(new Float32Array(sab, 0, 4) as Quat).toEqualTypeOf<Quat>();
  });

  test('SAB-backed values are accepted as out and as readonly inputs', () => {
    expectTypeOf<SharedQuat>().toExtend<Quat>();
    expectTypeOf<SharedQuat>().toExtend<ReadonlyQuat>();
    quat.copy(shared, frozen);
    quat.copy(live, shared);
    quat.clone(shared);
  });

  test('brand still rejects unbranded shared arrays', () => {
    expectTypeOf<typeof rawShared>().not.toExtend<ReadonlyQuat>();
  });
});

describe('equality', () => {
  test('inputs are readonly and the result is a boolean', () => {
    expectTypeOf(quat.isEqual).parameters.toEqualTypeOf<[ReadonlyQuat, ReadonlyQuat]>();
    expectTypeOf(quat.isEqualEpsilon).parameters.toEqualTypeOf<
      [ReadonlyQuat, ReadonlyQuat, (number | undefined)?]
    >();
    expectTypeOf(quat.isEqualXYZW).parameters.toEqualTypeOf<
      [ReadonlyQuat, number, number, number, number]
    >();
    expectTypeOf(quat.isEqual).returns.toEqualTypeOf<boolean>();
    expectTypeOf(quat.isEqualEpsilon).returns.toEqualTypeOf<boolean>();
    expectTypeOf(quat.isEqualXYZW).returns.toEqualTypeOf<boolean>();
  });

  test('call sites', () => {
    quat.isEqual(live, frozen);
    quat.isEqual(shared, live);
    quat.isEqualEpsilon(frozen, live, 0.1);
    quat.isEqualXYZW(frozen, 0, 0, 0, 1);
    // @ts-expect-error a Vec4 is not a Quat, identical layout notwithstanding
    quat.isEqual(live, vector);
    // @ts-expect-error unbranded arrays are rejected
    quat.isEqualEpsilon(live, raw);
    // @ts-expect-error the scalar component is required
    quat.isEqualXYZW(live, 0, 0, 0);
  });
});

describe('multiply', () => {
  test('writes a mutable out from readonly inputs', () => {
    expectTypeOf(quat.multiply).parameters.toEqualTypeOf<[Quat, ReadonlyQuat, ReadonlyQuat]>();
    expectTypeOf(quat.multiply).returns.toEqualTypeOf<Quat>();
  });

  test('call sites', () => {
    quat.multiply(live, frozen, quat.IDENTITY);
    quat.multiply(live, live, live);
    quat.multiply(shared, shared, frozen);
    // @ts-expect-error the shared constant must never be written through
    quat.multiply(quat.IDENTITY, live, live);
    // @ts-expect-error a Vec4 is not a Quat, identical layout notwithstanding
    quat.multiply(live, vector, frozen);
    // @ts-expect-error unbranded arrays are rejected
    quat.multiply(live, frozen, raw);
  });
});

describe('SIZE', () => {
  test('is the literal 4', () => {
    expectTypeOf<typeof quat.SIZE>().toEqualTypeOf<4>();
  });
});

describe('magnitudeSq and magnitude', () => {
  test('read a readonly quaternion and return a number', () => {
    expectTypeOf(quat.magnitudeSq).parameters.toEqualTypeOf<[ReadonlyQuat]>();
    expectTypeOf(quat.magnitude).parameters.toEqualTypeOf<[ReadonlyQuat]>();
    expectTypeOf(quat.magnitudeSq).returns.toEqualTypeOf<number>();
    expectTypeOf(quat.magnitude).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    quat.magnitudeSq(quat.IDENTITY);
    quat.magnitude(live);
    quat.magnitude(shared);
    // @ts-expect-error a Vec4 is not a Quat, identical layout notwithstanding
    quat.magnitudeSq(vector);
  });
});

describe('normalize and conjugate', () => {
  test('write a mutable out from a readonly input', () => {
    expectTypeOf(quat.normalize).parameters.toEqualTypeOf<[Quat, ReadonlyQuat]>();
    expectTypeOf(quat.conjugate).parameters.toEqualTypeOf<[Quat, ReadonlyQuat]>();
    expectTypeOf(quat.normalize).returns.toEqualTypeOf<Quat>();
    expectTypeOf(quat.conjugate).returns.toEqualTypeOf<Quat>();
  });

  test('call sites', () => {
    quat.normalize(live, frozen);
    quat.normalize(live, live);
    quat.conjugate(shared, quat.IDENTITY);
    // @ts-expect-error there is no one-argument in-place form: pass the quaternion twice
    quat.normalize(live);
    // @ts-expect-error the shared constant must never be written through
    quat.normalize(quat.IDENTITY, live);
    // @ts-expect-error the shared constant must never be written through
    quat.conjugate(quat.IDENTITY, live);
    // @ts-expect-error a Vec4 is not a Quat, identical layout notwithstanding
    quat.conjugate(live, vector);
  });
});

describe('fromAxisAngle', () => {
  test('takes a readonly Vec3 axis and writes a mutable out', () => {
    expectTypeOf(quat.fromAxisAngle).parameters.toEqualTypeOf<[Quat, ReadonlyVec3, number]>();
    expectTypeOf(quat.fromAxisAngle).returns.toEqualTypeOf<Quat>();
  });

  test('call sites', () => {
    quat.fromAxisAngle(live, vec3.UP, 1);
    quat.fromAxisAngle(live, axis, 1);
    quat.fromAxisAngle(shared, frozenAxis, 1);
    // @ts-expect-error the shared constant must never be written through
    quat.fromAxisAngle(quat.IDENTITY, vec3.UP, 1);
    // @ts-expect-error the axis is a Vec3, not a Vec2
    quat.fromAxisAngle(live, flat, 1);
    // @ts-expect-error a quaternion is not an axis
    quat.fromAxisAngle(live, frozen, 1);
    // @ts-expect-error unbranded arrays are rejected
    quat.fromAxisAngle(live, raw, 1);
    // @ts-expect-error the angle is required
    quat.fromAxisAngle(live, vec3.UP);
  });
});

describe('dot', () => {
  test('reads two readonly quaternions and returns a number', () => {
    expectTypeOf(quat.dot).parameters.toEqualTypeOf<[ReadonlyQuat, ReadonlyQuat]>();
    expectTypeOf(quat.dot).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    quat.dot(quat.IDENTITY, frozen);
    quat.dot(live, shared);
    // @ts-expect-error a Vec4 is not a Quat, identical layout notwithstanding
    quat.dot(live, vector);
    // @ts-expect-error unbranded arrays are rejected
    quat.dot(raw, live);
  });
});

describe('fromEuler', () => {
  test('takes three angles and writes a mutable out', () => {
    expectTypeOf(quat.fromEuler).parameters.toEqualTypeOf<[Quat, number, number, number]>();
    expectTypeOf(quat.fromEuler).returns.toEqualTypeOf<Quat>();
  });

  test('call sites', () => {
    quat.fromEuler(live, 0, 1, 0);
    quat.fromEuler(shared, 0.1, 0.2, 0.3);
    // @ts-expect-error the shared constant must never be written through
    quat.fromEuler(quat.IDENTITY, 0, 0, 0);
    // @ts-expect-error all three angles are required
    quat.fromEuler(live, 0, 1);
    // @ts-expect-error the angles are loose numbers, not a vector
    quat.fromEuler(live, axis);
  });
});

describe('slerp and nlerp', () => {
  test('blend two readonly quaternions into a mutable out', () => {
    expectTypeOf(quat.slerp).parameters.toEqualTypeOf<[Quat, ReadonlyQuat, ReadonlyQuat, number]>();
    expectTypeOf(quat.nlerp).parameters.toEqualTypeOf<[Quat, ReadonlyQuat, ReadonlyQuat, number]>();
    expectTypeOf(quat.slerp).returns.toEqualTypeOf<Quat>();
    expectTypeOf(quat.nlerp).returns.toEqualTypeOf<Quat>();
  });

  test('call sites', () => {
    quat.slerp(live, quat.IDENTITY, frozen, 0.5);
    quat.nlerp(live, live, live, 0.5);
    quat.slerp(shared, frozen, shared, 0.5);
    // @ts-expect-error the shared constant must never be written through
    quat.slerp(quat.IDENTITY, live, frozen, 0.5);
    // @ts-expect-error the shared constant must never be written through
    quat.nlerp(quat.IDENTITY, live, frozen, 0.5);
    // @ts-expect-error t is required
    quat.slerp(live, live, frozen);
    // @ts-expect-error a Vec4 is not a Quat, identical layout notwithstanding
    quat.nlerp(live, vector, frozen, 0.5);
    // @ts-expect-error unbranded arrays are rejected
    quat.slerp(live, live, raw, 0.5);
  });
});
