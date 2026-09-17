// src/vec3.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec3 from '../vec3.js';

import type { Vec2 } from '../_types/vec2.js';
import type { ReadonlyVec3, Vec3 } from '../_types/vec3.js';

declare const live: Vec3;
declare const frozen: ReadonlyVec3;
declare const other: Vec2;
declare const raw: Float32Array<ArrayBuffer>;

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
