// src/vector/__tests__/vec4.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec4 from '../vec4.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { Vec3 } from '../_types/vec3.js';
import type { ReadonlyVec4, Vec4 } from '../_types/vec4.js';

declare const live: Vec4;
declare const frozen: ReadonlyVec4;
declare const other: Vec3;
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
