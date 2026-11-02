// src/vec3.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec3 from '../vec3.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { Vec2 } from '../_types/vec2.js';
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
