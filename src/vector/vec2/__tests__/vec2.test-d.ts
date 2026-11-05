// src/vector/vec2/__tests__/vec2.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec2 from '../vec2.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../../_types/fixedFloat32Array.js';
import type { Vec3 } from '../../vec3/_types/vec3.js';
import type { ReadonlyVec2, Vec2 } from '../_types/vec2.js';

declare const live: Vec2;
declare const frozen: ReadonlyVec2;
declare const other: Vec3;
declare const raw: Float32Array<ArrayBuffer>;

/** A `Vec2` backed by a `SharedArrayBuffer`, as a view into worker-shared storage would be. */
type SharedVec2 = Brand<FixedFloat32Array<2, SharedArrayBuffer>, BrandOf<Vec2>>;
declare const shared: SharedVec2;
declare const sab: SharedArrayBuffer;
declare const rawShared: Float32Array<SharedArrayBuffer>;

describe('Vec2 / ReadonlyVec2 relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Vec2>().toExtend<ReadonlyVec2>();
    expectTypeOf<ReadonlyVec2>().not.toExtend<Vec2>();
  });

  test('brand rejects unbranded and differently-branded arrays', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyVec2>();
    expectTypeOf<Vec3>().not.toExtend<ReadonlyVec2>();
  });

  test('length is the literal 2', () => {
    expectTypeOf<Vec2['length']>().toEqualTypeOf<2>();
    expectTypeOf<ReadonlyVec2['length']>().toEqualTypeOf<2>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([1, 2]);
    // @ts-expect-error `subarray` would hand out a mutable alias
    frozen.subarray(0, 1);
  });

  test('readonly can be uploaded to the GPU without a cast', () => {
    expectTypeOf<ReadonlyVec2>().toExtend<ArrayBufferView>();
  });
});

describe('vec2 signatures', () => {
  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(vec2.copy).parameter(0).toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.copy).parameter(1).toEqualTypeOf<ReadonlyVec2>();
    expectTypeOf(vec2.clone).parameter(0).toEqualTypeOf<ReadonlyVec2>();
  });

  test('allocators return owned, mutable vectors', () => {
    expectTypeOf(vec2.create).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.clone).returns.toEqualTypeOf<Vec2>();
  });

  test('call sites', () => {
    vec2.copy(live, frozen);
    vec2.copy(live, live);
    vec2.clone(frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec2.set(frozen, 0, 0);
    // @ts-expect-error wrong-dimension input
    vec2.copy(live, other);
  });
});

describe('shared memory', () => {
  test('a SharedArrayBuffer view casts to Vec2 with a single cast', () => {
    expectTypeOf(new Float32Array(sab, 0, 2) as Vec2).toEqualTypeOf<Vec2>();
  });

  test('SAB-backed values are accepted as out and as readonly inputs', () => {
    expectTypeOf<SharedVec2>().toExtend<Vec2>();
    expectTypeOf<SharedVec2>().toExtend<ReadonlyVec2>();
    vec2.copy(shared, frozen);
    vec2.copy(live, shared);
    vec2.clone(shared);
  });

  test('brand still rejects unbranded shared arrays', () => {
    expectTypeOf<typeof rawShared>().not.toExtend<ReadonlyVec2>();
  });
});

describe('equality', () => {
  test('inputs are readonly and the result is a boolean', () => {
    expectTypeOf(vec2.isEqual).parameters.toEqualTypeOf<[ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.isEqualEpsilon).parameters.toEqualTypeOf<
      [ReadonlyVec2, ReadonlyVec2, (number | undefined)?]
    >();
    expectTypeOf(vec2.isEqualXY).parameters.toEqualTypeOf<[ReadonlyVec2, number, number]>();
    expectTypeOf(vec2.isEqual).returns.toEqualTypeOf<boolean>();
    expectTypeOf(vec2.isEqualEpsilon).returns.toEqualTypeOf<boolean>();
    expectTypeOf(vec2.isEqualXY).returns.toEqualTypeOf<boolean>();
  });

  test('call sites', () => {
    vec2.isEqual(live, frozen);
    vec2.isEqual(shared, live);
    vec2.isEqualEpsilon(frozen, live, 0.1);
    vec2.isEqualXY(frozen, 0, 0);
    // @ts-expect-error wrong-dimension input
    vec2.isEqual(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec2.isEqualEpsilon(live, raw);
    // @ts-expect-error both components are required
    vec2.isEqualXY(live, 0);
  });
});

describe('arithmetic', () => {
  test('out is mutable, inputs are readonly, and out is returned', () => {
    expectTypeOf(vec2.add).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.sub).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.mul).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.div).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.scale).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, number]>();
    expectTypeOf(vec2.add).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.sub).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.mul).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.div).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.scale).returns.toEqualTypeOf<Vec2>();
  });

  test('call sites', () => {
    vec2.add(live, frozen, frozen);
    vec2.add(shared, live, shared);
    vec2.scale(live, frozen, 2);
    // @ts-expect-error readonly can never be an out parameter
    vec2.add(frozen, live, live);
    // @ts-expect-error readonly can never be an out parameter
    vec2.scale(frozen, live, 2);
    // @ts-expect-error wrong-dimension input
    vec2.sub(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec2.mul(live, raw, live);
    // @ts-expect-error scale takes a number, not a vector
    vec2.scale(live, frozen, frozen);
  });
});

describe('magnitude, distance and normalize', () => {
  test('measuring takes readonly inputs and returns a number', () => {
    expectTypeOf(vec2.magnitudeSq).parameters.toEqualTypeOf<[ReadonlyVec2]>();
    expectTypeOf(vec2.magnitude).parameters.toEqualTypeOf<[ReadonlyVec2]>();
    expectTypeOf(vec2.distanceSq).parameters.toEqualTypeOf<[ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.distance).parameters.toEqualTypeOf<[ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.magnitudeSq).returns.toEqualTypeOf<number>();
    expectTypeOf(vec2.magnitude).returns.toEqualTypeOf<number>();
    expectTypeOf(vec2.distanceSq).returns.toEqualTypeOf<number>();
    expectTypeOf(vec2.distance).returns.toEqualTypeOf<number>();
  });

  test('normalize writes to a mutable out and returns it', () => {
    expectTypeOf(vec2.normalize).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2]>();
    expectTypeOf(vec2.normalize).returns.toEqualTypeOf<Vec2>();
  });

  test('call sites', () => {
    vec2.magnitude(frozen);
    vec2.distance(live, frozen);
    vec2.distanceSq(shared, live);
    vec2.normalize(live, frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec2.normalize(frozen, live);
    // @ts-expect-error wrong-dimension input
    vec2.magnitude(other);
    // @ts-expect-error wrong-dimension input
    vec2.distance(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec2.magnitudeSq(raw);
  });
});

describe('dot', () => {
  test('dot takes readonly inputs and returns a number', () => {
    expectTypeOf(vec2.dot).parameters.toEqualTypeOf<[ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.dot).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    vec2.dot(frozen, live);
    vec2.dot(shared, frozen);
    // @ts-expect-error wrong-dimension input
    vec2.dot(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec2.dot(raw, live);
  });
});

describe('scaleAndAdd, negate and lerp', () => {
  test('they write to a mutable out and return it', () => {
    expectTypeOf(vec2.scaleAndAdd).parameters.toEqualTypeOf<
      [Vec2, ReadonlyVec2, ReadonlyVec2, number]
    >();
    expectTypeOf(vec2.negate).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2]>();
    expectTypeOf(vec2.lerp).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, ReadonlyVec2, number]>();
    expectTypeOf(vec2.scaleAndAdd).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.negate).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.lerp).returns.toEqualTypeOf<Vec2>();
  });

  test('call sites', () => {
    vec2.scaleAndAdd(live, live, frozen, 2);
    vec2.negate(live, frozen);
    vec2.lerp(shared, frozen, live, 0.5);
    // @ts-expect-error readonly can never be an out parameter
    vec2.scaleAndAdd(frozen, live, live, 2);
    // @ts-expect-error readonly can never be an out parameter
    vec2.negate(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec2.lerp(frozen, live, live, 0.5);
    // @ts-expect-error wrong-dimension input
    vec2.scaleAndAdd(live, other, live, 2);
    // @ts-expect-error wrong-dimension input
    vec2.negate(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec2.lerp(live, raw, live, 0.5);
    // @ts-expect-error the scalar is a number, not a vector
    vec2.scaleAndAdd(live, live, live, frozen);
    // @ts-expect-error t is a number, not a vector
    vec2.lerp(live, live, live, frozen);
  });
});

describe('reflect and angle', () => {
  test('reflect writes to a mutable out and returns it', () => {
    expectTypeOf(vec2.reflect).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.reflect).returns.toEqualTypeOf<Vec2>();
  });

  test('angle takes readonly inputs and returns a number', () => {
    expectTypeOf(vec2.angle).parameters.toEqualTypeOf<[ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.angle).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    vec2.reflect(live, live, frozen);
    vec2.reflect(shared, frozen, frozen);
    vec2.angle(frozen, live);
    vec2.angle(shared, frozen);
    // @ts-expect-error readonly can never be an out parameter
    vec2.reflect(frozen, live, live);
    // @ts-expect-error wrong-dimension input
    vec2.reflect(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec2.reflect(live, live, raw);
    // @ts-expect-error wrong-dimension input
    vec2.angle(live, other);
    // @ts-expect-error unbranded arrays are rejected
    vec2.angle(raw, live);
  });
});

describe('abs, min, max, floor, ceil and round', () => {
  test('they write to a mutable out and return it', () => {
    expectTypeOf(vec2.abs).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2]>();
    expectTypeOf(vec2.min).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.max).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2, ReadonlyVec2]>();
    expectTypeOf(vec2.floor).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2]>();
    expectTypeOf(vec2.ceil).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2]>();
    expectTypeOf(vec2.round).parameters.toEqualTypeOf<[Vec2, ReadonlyVec2]>();
    expectTypeOf(vec2.abs).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.min).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.max).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.floor).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.ceil).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.round).returns.toEqualTypeOf<Vec2>();
  });

  test('call sites', () => {
    vec2.abs(live, frozen);
    vec2.min(shared, frozen, live);
    vec2.max(live, shared, frozen);
    vec2.floor(live, live);
    vec2.ceil(shared, frozen);
    vec2.round(live, shared);
    // @ts-expect-error readonly can never be an out parameter
    vec2.abs(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec2.min(frozen, live, live);
    // @ts-expect-error readonly can never be an out parameter
    vec2.max(frozen, live, live);
    // @ts-expect-error readonly can never be an out parameter
    vec2.floor(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec2.ceil(frozen, live);
    // @ts-expect-error readonly can never be an out parameter
    vec2.round(frozen, live);
    // @ts-expect-error wrong-dimension input
    vec2.abs(live, other);
    // @ts-expect-error wrong-dimension input
    vec2.min(live, other, live);
    // @ts-expect-error unbranded arrays are rejected
    vec2.max(live, live, raw);
    // @ts-expect-error unbranded arrays are rejected
    vec2.floor(live, raw);
    // @ts-expect-error wrong-dimension input
    vec2.ceil(live, other);
    // @ts-expect-error unlike the scalar round, there is no decimals parameter
    vec2.round(live, frozen, 2);
  });
});

describe('fromPacked', () => {
  test('it writes to a mutable out and returns it', () => {
    expectTypeOf(vec2.fromPacked).parameters.toEqualTypeOf<[Vec2, ArrayLike<number>, number]>();
    expectTypeOf(vec2.fromPacked).returns.toEqualTypeOf<Vec2>();
  });

  test('call sites', () => {
    vec2.fromPacked(live, raw, 0);
    vec2.fromPacked(shared, rawShared, 0);
    vec2.fromPacked(live, frozen, 0);
    vec2.fromPacked(live, [1, 2], 0);
    // @ts-expect-error readonly can never be an out parameter
    vec2.fromPacked(frozen, raw, 0);
    // @ts-expect-error unbranded arrays are rejected as out
    vec2.fromPacked(raw, raw, 0);
    // @ts-expect-error the packed values must be numbers
    vec2.fromPacked(live, ['1', '2'], 0);
    // @ts-expect-error the row index is required
    vec2.fromPacked(live, raw);
  });
});
