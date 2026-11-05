// src/vector/vec3/__tests__/vec3.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec3 from '../vec3.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../../_types/fixedFloat32Array.js';
import type { Vec2 } from '../../vec2/_types/vec2.js';
import type { ReadonlyVec3, Vec3 } from '../_types/vec3.js';

declare const live: Vec3;
declare const frozen: ReadonlyVec3;
declare const other: Vec2;
declare const raw: Float32Array<ArrayBuffer>;

/** A `Vec3` backed by a `SharedArrayBuffer`, as a view into worker-shared storage would be. */
type SharedVec3 = Brand<FixedFloat32Array<3, SharedArrayBuffer>, BrandOf<Vec3>>;
declare const shared: SharedVec3;
declare const sab: SharedArrayBuffer;
declare const rawShared: Float32Array<SharedArrayBuffer>;

describe('Vec3 / ReadonlyVec3 relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Vec3>().toExtend<ReadonlyVec3>();
    expectTypeOf<ReadonlyVec3>().not.toExtend<Vec3>();
  });

  test('brand rejects unbranded and differently-branded arrays', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyVec3>();
    expectTypeOf<Vec2>().not.toExtend<ReadonlyVec3>();
  });

  test('length is the literal 3', () => {
    expectTypeOf<Vec3['length']>().toEqualTypeOf<3>();
    expectTypeOf<ReadonlyVec3['length']>().toEqualTypeOf<3>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([1, 2, 3]);
    // @ts-expect-error `subarray` would hand out a mutable alias
    frozen.subarray(0, 1);
  });

  test('readonly can be uploaded to the GPU without a cast', () => {
    expectTypeOf<ReadonlyVec3>().toExtend<ArrayBufferView>();
  });
});

describe('vec3 signatures', () => {
  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(vec3.copy).parameter(0).toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.copy).parameter(1).toEqualTypeOf<ReadonlyVec3>();
    expectTypeOf(vec3.clone).parameter(0).toEqualTypeOf<ReadonlyVec3>();
  });

  test('allocators return owned, mutable vectors', () => {
    expectTypeOf(vec3.create).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.clone).returns.toEqualTypeOf<Vec3>();
  });

  test('call sites', () => {
    vec3.copy(live, frozen);
    vec3.copy(live, live);
    vec3.clone(frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec3.set(frozen, 0, 0, 0);
    // @ts-expect-error wrong-dimension input
    vec3.copy(live, other);
  });
});

describe('shared memory', () => {
  test('a SharedArrayBuffer view casts to Vec3 with a single cast', () => {
    expectTypeOf(new Float32Array(sab, 0, 3) as Vec3).toEqualTypeOf<Vec3>();
  });

  test('SAB-backed values are accepted as out and as readonly inputs', () => {
    expectTypeOf<SharedVec3>().toExtend<Vec3>();
    expectTypeOf<SharedVec3>().toExtend<ReadonlyVec3>();
    vec3.copy(shared, frozen);
    vec3.copy(live, shared);
    vec3.clone(shared);
  });

  test('brand still rejects unbranded shared arrays', () => {
    expectTypeOf<typeof rawShared>().not.toExtend<ReadonlyVec3>();
  });
});

describe('equality', () => {
  test('inputs are readonly and the result is a boolean', () => {
    expectTypeOf(vec3.isEqual).parameters.toEqualTypeOf<[ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.isEqualEpsilon).parameters.toEqualTypeOf<
      [ReadonlyVec3, ReadonlyVec3, (number | undefined)?]
    >();
    expectTypeOf(vec3.isEqualXYZ).parameters.toEqualTypeOf<
      [ReadonlyVec3, number, number, number]
    >();
    expectTypeOf(vec3.isEqual).returns.toEqualTypeOf<boolean>();
    expectTypeOf(vec3.isEqualEpsilon).returns.toEqualTypeOf<boolean>();
    expectTypeOf(vec3.isEqualXYZ).returns.toEqualTypeOf<boolean>();
  });

  test('call sites', () => {
    vec3.isEqual(live, frozen);
    vec3.isEqual(shared, live);
    vec3.isEqualEpsilon(frozen, live, 0.1);
    vec3.isEqualXYZ(frozen, 0, 0, 0);
    // @ts-expect-error wrong-dimension input
    vec3.isEqual(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec3.isEqualEpsilon(live, raw);
    // @ts-expect-error every component is required
    vec3.isEqualXYZ(live, 0, 0);
  });
});

describe('arithmetic', () => {
  test('out is mutable, inputs are readonly, and out is returned', () => {
    expectTypeOf(vec3.add).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.sub).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.mul).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.div).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.scale).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, number]>();
    expectTypeOf(vec3.add).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.sub).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.mul).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.div).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.scale).returns.toEqualTypeOf<Vec3>();
  });

  test('call sites', () => {
    vec3.add(live, frozen, frozen);
    vec3.add(shared, live, shared);
    vec3.scale(live, frozen, 2);
    // @ts-expect-error readonly can never be an out parameter
    vec3.add(frozen, live, live);
    // @ts-expect-error readonly can never be an out parameter
    vec3.scale(frozen, live, 2);
    // @ts-expect-error wrong-dimension input
    vec3.sub(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec3.mul(live, raw, live);
    // @ts-expect-error scale takes a number, not a vector
    vec3.scale(live, frozen, frozen);
  });
});

describe('magnitude, distance and normalize', () => {
  test('measuring takes readonly inputs and returns a number', () => {
    expectTypeOf(vec3.magnitudeSq).parameters.toEqualTypeOf<[ReadonlyVec3]>();
    expectTypeOf(vec3.magnitude).parameters.toEqualTypeOf<[ReadonlyVec3]>();
    expectTypeOf(vec3.distanceSq).parameters.toEqualTypeOf<[ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.distance).parameters.toEqualTypeOf<[ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.magnitudeSq).returns.toEqualTypeOf<number>();
    expectTypeOf(vec3.magnitude).returns.toEqualTypeOf<number>();
    expectTypeOf(vec3.distanceSq).returns.toEqualTypeOf<number>();
    expectTypeOf(vec3.distance).returns.toEqualTypeOf<number>();
  });

  test('normalize writes to a mutable out and returns it', () => {
    expectTypeOf(vec3.normalize).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3]>();
    expectTypeOf(vec3.normalize).returns.toEqualTypeOf<Vec3>();
  });

  test('call sites', () => {
    vec3.magnitude(frozen);
    vec3.distance(live, frozen);
    vec3.distanceSq(shared, live);
    vec3.normalize(live, frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec3.normalize(frozen, live);
    // @ts-expect-error wrong-dimension input
    vec3.magnitude(other);
    // @ts-expect-error wrong-dimension input
    vec3.distance(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec3.magnitudeSq(raw);
  });
});

describe('dot and cross', () => {
  test('dot takes readonly inputs and returns a number', () => {
    expectTypeOf(vec3.dot).parameters.toEqualTypeOf<[ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.dot).returns.toEqualTypeOf<number>();
  });

  test('cross writes to a mutable out and returns it', () => {
    expectTypeOf(vec3.cross).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.cross).returns.toEqualTypeOf<Vec3>();
  });

  test('call sites', () => {
    vec3.dot(frozen, live);
    vec3.dot(shared, frozen);
    // @ts-expect-error wrong-dimension input
    vec3.dot(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec3.dot(raw, live);
    vec3.cross(live, frozen, frozen);
    vec3.cross(live, live, frozen);
    vec3.cross(shared, live, frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec3.cross(frozen, live, live);
    // @ts-expect-error wrong-dimension input
    vec3.cross(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec3.cross(live, live, raw);
  });
});

describe('scaleAndAdd, negate and lerp', () => {
  test('they write to a mutable out and return it', () => {
    expectTypeOf(vec3.scaleAndAdd).parameters.toEqualTypeOf<
      [Vec3, ReadonlyVec3, ReadonlyVec3, number]
    >();
    expectTypeOf(vec3.negate).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3]>();
    expectTypeOf(vec3.lerp).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3, number]>();
    expectTypeOf(vec3.scaleAndAdd).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.negate).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.lerp).returns.toEqualTypeOf<Vec3>();
  });

  test('call sites', () => {
    vec3.scaleAndAdd(live, live, frozen, 2);
    vec3.negate(live, frozen);
    vec3.lerp(shared, frozen, live, 0.5);
    // @ts-expect-error readonly can never be an out parameter
    vec3.scaleAndAdd(frozen, live, live, 2);
    // @ts-expect-error readonly can never be an out parameter
    vec3.negate(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec3.lerp(frozen, live, live, 0.5);
    // @ts-expect-error wrong-dimension input
    vec3.scaleAndAdd(live, other, live, 2);
    // @ts-expect-error wrong-dimension input
    vec3.negate(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec3.lerp(live, raw, live, 0.5);
    // @ts-expect-error the scalar is a number, not a vector
    vec3.scaleAndAdd(live, live, live, frozen);
    // @ts-expect-error t is a number, not a vector
    vec3.lerp(live, live, live, frozen);
  });
});

describe('reflect and angle', () => {
  test('reflect writes to a mutable out and returns it', () => {
    expectTypeOf(vec3.reflect).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.reflect).returns.toEqualTypeOf<Vec3>();
  });

  test('angle takes readonly inputs and returns a number', () => {
    expectTypeOf(vec3.angle).parameters.toEqualTypeOf<[ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.angle).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    vec3.reflect(live, live, frozen);
    vec3.reflect(shared, frozen, frozen);
    vec3.angle(frozen, live);
    vec3.angle(shared, frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec3.reflect(frozen, live, live);
    // @ts-expect-error wrong-dimension input
    vec3.reflect(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec3.reflect(live, live, raw);
    // @ts-expect-error wrong-dimension input
    vec3.angle(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec3.angle(raw, live);
  });
});

describe('abs, min, max, floor, ceil and round', () => {
  test('they write to a mutable out and return it', () => {
    expectTypeOf(vec3.abs).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3]>();
    expectTypeOf(vec3.min).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.max).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3, ReadonlyVec3]>();
    expectTypeOf(vec3.floor).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3]>();
    expectTypeOf(vec3.ceil).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3]>();
    expectTypeOf(vec3.round).parameters.toEqualTypeOf<[Vec3, ReadonlyVec3]>();
    expectTypeOf(vec3.abs).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.min).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.max).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.floor).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.ceil).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.round).returns.toEqualTypeOf<Vec3>();
  });

  test('call sites', () => {
    vec3.abs(live, frozen);
    vec3.min(shared, frozen, live);
    vec3.max(live, shared, frozen);
    vec3.floor(live, live);
    vec3.ceil(shared, frozen);
    vec3.round(live, shared);
    // @ts-expect-error readonly can never be an out parameter
    vec3.abs(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec3.min(frozen, live, live);
    // @ts-expect-error readonly can never be an out parameter
    vec3.max(frozen, live, live);
    // @ts-expect-error readonly can never be an out parameter
    vec3.floor(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec3.ceil(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec3.round(frozen, live);
    // @ts-expect-error wrong-dimension input
    vec3.abs(live, other);
    // @ts-expect-error wrong-dimension input
    vec3.min(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec3.max(live, live, raw);
    // @ts-expect-error unbranded arrays are rejected
    vec3.floor(live, raw);
    // @ts-expect-error wrong-dimension input
    vec3.ceil(live, other);
    // @ts-expect-error unlike the scalar round, there is no decimals parameter
    vec3.round(live, frozen, 2);
  });
});

describe('fromPacked', () => {
  test('it writes to a mutable out and returns it', () => {
    expectTypeOf(vec3.fromPacked).parameters.toEqualTypeOf<[Vec3, ArrayLike<number>, number]>();
    expectTypeOf(vec3.fromPacked).returns.toEqualTypeOf<Vec3>();
  });

  test('call sites', () => {
    vec3.fromPacked(live, raw, 0);
    vec3.fromPacked(shared, rawShared, 0);
    vec3.fromPacked(live, frozen, 0);
    vec3.fromPacked(live, [1, 2, 3], 0);
    // @ts-expect-error readonly can never be an out parameter
    vec3.fromPacked(frozen, raw, 0);
    // @ts-expect-error unbranded arrays are rejected as out
    vec3.fromPacked(raw, raw, 0);
    // @ts-expect-error the packed values must be numbers
    vec3.fromPacked(live, ['1', '2', '3'], 0);
    // @ts-expect-error the row index is required
    vec3.fromPacked(live, raw);
  });
});
