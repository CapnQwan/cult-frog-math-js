// src/vector/__tests__/vec2.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as vec2 from '../vec2.js';

import type { ReadonlyVec2, Vec2 } from '../_types/vec2.js';
import type { Vec3 } from '../_types/vec3.js';

declare const live: Vec2;
declare const frozen: ReadonlyVec2;
declare const other: Vec3;
declare const raw: Float32Array<ArrayBuffer>;

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
