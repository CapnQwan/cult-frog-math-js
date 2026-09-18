// src/quaternion/__tests__/quat.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as quat from '../quat.js';

import type { ReadonlyVec4, Vec4 } from '../../vector/_types/vec4.js';
import type { Quat, ReadonlyQuat } from '../_types/quat.js';

declare const live: Quat;
declare const frozen: ReadonlyQuat;
declare const vector: Vec4;
declare const raw: Float32Array<ArrayBuffer>;

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
