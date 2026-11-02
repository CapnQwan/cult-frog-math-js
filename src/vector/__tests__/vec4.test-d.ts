// src/vector/__tests__/vec4.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec4 from '../vec4.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { Quat } from '../../quaternion/_types/quat.js';
import type { Vec3 } from '../_types/vec3.js';
import type { ReadonlyVec4, Vec4 } from '../_types/vec4.js';

declare const live: Vec4;
declare const frozen: ReadonlyVec4;
declare const other: Vec3;
declare const rotation: Quat;
declare const raw: Float32Array<ArrayBuffer>;

/** A `Vec4` backed by a `SharedArrayBuffer`, as a view into worker-shared storage would be. */
type SharedVec4 = Brand<FixedFloat32Array<4, SharedArrayBuffer>, BrandOf<Vec4>>;
declare const shared: SharedVec4;
declare const sab: SharedArrayBuffer;
declare const rawShared: Float32Array<SharedArrayBuffer>;

describe('Vec4 / ReadonlyVec4 relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Vec4>().toExtend<ReadonlyVec4>();
    expectTypeOf<ReadonlyVec4>().not.toExtend<Vec4>();
  });

  test('brand rejects unbranded and differently-branded arrays', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyVec4>();
    expectTypeOf<Vec3>().not.toExtend<ReadonlyVec4>();
  });

  test('length is the literal 4', () => {
    expectTypeOf<Vec4['length']>().toEqualTypeOf<4>();
    expectTypeOf<ReadonlyVec4['length']>().toEqualTypeOf<4>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([1, 2, 3, 4]);
    // @ts-expect-error `subarray` would hand out a mutable alias
    frozen.subarray(0, 1);
  });

  test('readonly can be uploaded to the GPU without a cast', () => {
    expectTypeOf<ReadonlyVec4>().toExtend<ArrayBufferView>();
  });
});

describe('vec4 signatures', () => {
  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(vec4.copy).parameter(0).toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.copy).parameter(1).toEqualTypeOf<ReadonlyVec4>();
    expectTypeOf(vec4.clone).parameter(0).toEqualTypeOf<ReadonlyVec4>();
  });

  test('allocators return owned, mutable vectors', () => {
    expectTypeOf(vec4.create).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.clone).returns.toEqualTypeOf<Vec4>();
  });

  test('call sites', () => {
    vec4.copy(live, frozen);
    vec4.copy(live, live);
    vec4.clone(frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec4.set(frozen, 0, 0, 0, 0);
    // @ts-expect-error wrong-dimension input
    vec4.copy(live, other);
  });
});

describe('shared memory', () => {
  test('a SharedArrayBuffer view casts to Vec4 with a single cast', () => {
    expectTypeOf(new Float32Array(sab, 0, 4) as Vec4).toEqualTypeOf<Vec4>();
  });

  test('SAB-backed values are accepted as out and as readonly inputs', () => {
    expectTypeOf<SharedVec4>().toExtend<Vec4>();
    expectTypeOf<SharedVec4>().toExtend<ReadonlyVec4>();
    vec4.copy(shared, frozen);
    vec4.copy(live, shared);
    vec4.clone(shared);
  });

  test('brand still rejects unbranded shared arrays', () => {
    expectTypeOf<typeof rawShared>().not.toExtend<ReadonlyVec4>();
  });
});

describe('equality', () => {
  test('inputs are readonly and the result is a boolean', () => {
    expectTypeOf(vec4.isEqual).parameters.toEqualTypeOf<[ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.isEqualEpsilon).parameters.toEqualTypeOf<
      [ReadonlyVec4, ReadonlyVec4, (number | undefined)?]
    >();
    expectTypeOf(vec4.isEqualXYZW).parameters.toEqualTypeOf<
      [ReadonlyVec4, number, number, number, number]
    >();
    expectTypeOf(vec4.isEqual).returns.toEqualTypeOf<boolean>();
    expectTypeOf(vec4.isEqualEpsilon).returns.toEqualTypeOf<boolean>();
    expectTypeOf(vec4.isEqualXYZW).returns.toEqualTypeOf<boolean>();
  });

  test('call sites', () => {
    vec4.isEqual(live, frozen);
    vec4.isEqual(shared, live);
    vec4.isEqualEpsilon(frozen, live, 0.1);
    vec4.isEqualXYZW(frozen, 0, 0, 0, 0);
    // @ts-expect-error wrong-dimension input
    vec4.isEqual(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec4.isEqualEpsilon(live, raw);
    // @ts-expect-error every component is required
    vec4.isEqualXYZW(live, 0, 0, 0);
  });
});

describe('arithmetic', () => {
  test('out is mutable, inputs are readonly, and out is returned', () => {
    expectTypeOf(vec4.add).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.sub).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.mul).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.div).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.scale).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4, number]>();
    expectTypeOf(vec4.add).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.sub).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.mul).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.div).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.scale).returns.toEqualTypeOf<Vec4>();
  });

  test('call sites', () => {
    vec4.add(live, frozen, frozen);
    vec4.add(shared, live, shared);
    vec4.scale(live, frozen, 2);
    // @ts-expect-error readonly can never be an out parameter
    vec4.add(frozen, live, live);
    // @ts-expect-error readonly can never be an out parameter
    vec4.scale(frozen, live, 2);
    // @ts-expect-error wrong-dimension input
    vec4.sub(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec4.mul(live, raw, live);
    // @ts-expect-error scale takes a number, not a vector
    vec4.scale(live, frozen, frozen);
  });
});

describe('magnitude, distance and normalize', () => {
  test('measuring takes readonly inputs and returns a number', () => {
    expectTypeOf(vec4.magnitudeSq).parameters.toEqualTypeOf<[ReadonlyVec4]>();
    expectTypeOf(vec4.magnitude).parameters.toEqualTypeOf<[ReadonlyVec4]>();
    expectTypeOf(vec4.distanceSq).parameters.toEqualTypeOf<[ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.distance).parameters.toEqualTypeOf<[ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.magnitudeSq).returns.toEqualTypeOf<number>();
    expectTypeOf(vec4.magnitude).returns.toEqualTypeOf<number>();
    expectTypeOf(vec4.distanceSq).returns.toEqualTypeOf<number>();
    expectTypeOf(vec4.distance).returns.toEqualTypeOf<number>();
  });

  test('normalize writes to a mutable out and returns it', () => {
    expectTypeOf(vec4.normalize).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4]>();
    expectTypeOf(vec4.normalize).returns.toEqualTypeOf<Vec4>();
  });

  test('call sites', () => {
    vec4.magnitude(frozen);
    vec4.distance(live, frozen);
    vec4.distanceSq(shared, live);
    vec4.normalize(live, frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec4.normalize(frozen, live);
    // @ts-expect-error wrong-dimension input
    vec4.magnitude(other);
    // @ts-expect-error wrong-dimension input
    vec4.distance(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec4.magnitudeSq(raw);
  });
});

describe('dot', () => {
  test('dot takes readonly inputs and returns a number', () => {
    expectTypeOf(vec4.dot).parameters.toEqualTypeOf<[ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.dot).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    vec4.dot(frozen, live);
    vec4.dot(shared, frozen);
    // @ts-expect-error wrong-dimension input
    vec4.dot(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec4.dot(raw, live);
  });
});

describe('scaleAndAdd, negate and lerp', () => {
  test('they write to a mutable out and return it', () => {
    expectTypeOf(vec4.scaleAndAdd).parameters.toEqualTypeOf<
      [Vec4, ReadonlyVec4, ReadonlyVec4, number]
    >();
    expectTypeOf(vec4.negate).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4]>();
    expectTypeOf(vec4.lerp).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4, ReadonlyVec4, number]>();
    expectTypeOf(vec4.scaleAndAdd).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.negate).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.lerp).returns.toEqualTypeOf<Vec4>();
  });

  test('call sites', () => {
    vec4.scaleAndAdd(live, live, frozen, 2);
    vec4.negate(live, frozen);
    vec4.lerp(shared, frozen, live, 0.5);
    // @ts-expect-error readonly can never be an out parameter
    vec4.scaleAndAdd(frozen, live, live, 2);
    // @ts-expect-error readonly can never be an out parameter
    vec4.negate(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec4.lerp(frozen, live, live, 0.5);
    // @ts-expect-error wrong-dimension input
    vec4.scaleAndAdd(live, other, live, 2);
    // @ts-expect-error wrong-dimension input
    vec4.negate(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec4.lerp(live, raw, live, 0.5);
    // @ts-expect-error the scalar is a number, not a vector
    vec4.scaleAndAdd(live, live, live, frozen);
    // @ts-expect-error t is a number, not a vector
    vec4.lerp(live, live, live, frozen);
    // @ts-expect-error a Quat isn't a Vec4, so rotations can't be blended by accident
    vec4.lerp(live, rotation, rotation, 0.5);
  });
});

describe('reflect and angle', () => {
  test('reflect writes to a mutable out and returns it', () => {
    expectTypeOf(vec4.reflect).parameters.toEqualTypeOf<[Vec4, ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.reflect).returns.toEqualTypeOf<Vec4>();
  });

  test('angle takes readonly inputs and returns a number', () => {
    expectTypeOf(vec4.angle).parameters.toEqualTypeOf<[ReadonlyVec4, ReadonlyVec4]>();
    expectTypeOf(vec4.angle).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    vec4.reflect(live, live, frozen);
    vec4.reflect(shared, frozen, frozen);
    vec4.angle(frozen, live);
    vec4.angle(shared, frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec4.reflect(frozen, live, live);
    // @ts-expect-error wrong-dimension input
    vec4.reflect(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec4.reflect(live, live, raw);
    // @ts-expect-error wrong-dimension input
    vec4.angle(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec4.angle(raw, live);
  });
});

describe('fromPacked', () => {
  test('it writes to a mutable out and returns it', () => {
    expectTypeOf(vec4.fromPacked).parameters.toEqualTypeOf<[Vec4, ArrayLike<number>, number]>();
    expectTypeOf(vec4.fromPacked).returns.toEqualTypeOf<Vec4>();
  });

  test('call sites', () => {
    vec4.fromPacked(live, raw, 0);
    vec4.fromPacked(shared, rawShared, 0);
    vec4.fromPacked(live, frozen, 0);
    vec4.fromPacked(live, [1, 2, 3, 4], 0);
    // @ts-expect-error readonly can never be an out parameter
    vec4.fromPacked(frozen, raw, 0);
    // @ts-expect-error unbranded arrays are rejected as out
    vec4.fromPacked(raw, raw, 0);
    // @ts-expect-error the packed values must be numbers
    vec4.fromPacked(live, ['1', '2', '3', '4'], 0);
    // @ts-expect-error the row index is required
    vec4.fromPacked(live, raw);
  });
});

describe('constants', () => {
  test('are readonly and cannot be passed as out', () => {
    expectTypeOf(vec4.ZERO).toEqualTypeOf<ReadonlyVec4>();
    expectTypeOf(vec4.ONE).toEqualTypeOf<ReadonlyVec4>();
    // @ts-expect-error readonly can never be an out parameter
    vec4.set(vec4.ZERO, 0, 0, 0, 0);
    // @ts-expect-error readonly can never be an out parameter
    vec4.set(vec4.ONE, 0, 0, 0, 0);
  });
});
