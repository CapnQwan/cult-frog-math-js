// src/vector/__tests__/vec4.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec4 from '../vec4.js';

import type { Vec3 } from '../_types/vec3.js';
import type { ReadonlyVec4, Vec4 } from '../_types/vec4.js';

declare const live: Vec4;
declare const frozen: ReadonlyVec4;
declare const other: Vec3;
declare const raw: Float32Array<ArrayBuffer>;

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
