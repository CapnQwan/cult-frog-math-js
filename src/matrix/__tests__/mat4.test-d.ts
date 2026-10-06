// src/matrix/__tests__/mat4.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as mat4 from '../mat4.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { Mat3 } from '../_types/mat3.js';
import type { Mat4, ReadonlyMat4 } from '../_types/mat4.js';

declare const live: Mat4;
declare const frozen: ReadonlyMat4;
declare const other: Mat3;
declare const raw: Float32Array<ArrayBuffer>;

/** A `Mat4` backed by a `SharedArrayBuffer`, as a view into worker-shared storage would be. */
type SharedMat4 = Brand<FixedFloat32Array<16, SharedArrayBuffer>, BrandOf<Mat4>>;
declare const shared: SharedMat4;
declare const sab: SharedArrayBuffer;
declare const rawShared: Float32Array<SharedArrayBuffer>;

describe('Mat4 / ReadonlyMat4 relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Mat4>().toExtend<ReadonlyMat4>();
    expectTypeOf<ReadonlyMat4>().not.toExtend<Mat4>();
  });

  test('brand rejects unbranded and differently-branded arrays', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyMat4>();
    expectTypeOf<Mat3>().not.toExtend<ReadonlyMat4>();
  });

  test('length is the literal 16', () => {
    expectTypeOf<Mat4['length']>().toEqualTypeOf<16>();
    expectTypeOf<ReadonlyMat4['length']>().toEqualTypeOf<16>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    // @ts-expect-error `subarray` would hand out a mutable alias
    frozen.subarray(0, 1);
  });
});

describe('mat4 signatures', () => {
  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(mat4.copy).parameter(0).toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.copy).parameter(1).toEqualTypeOf<ReadonlyMat4>();
    expectTypeOf(mat4.clone).parameter(0).toEqualTypeOf<ReadonlyMat4>();
    expectTypeOf(mat4.set).parameter(0).toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.identity).parameter(0).toEqualTypeOf<Mat4>();
  });

  test('allocators return owned, mutable matrices', () => {
    expectTypeOf(mat4.create).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.clone).returns.toEqualTypeOf<Mat4>();
  });

  test('in-place writers return the mutable out', () => {
    expectTypeOf(mat4.set).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.copy).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.identity).returns.toEqualTypeOf<Mat4>();
  });

  test('IDENTITY is shared and cannot be passed as out', () => {
    expectTypeOf(mat4.IDENTITY).toEqualTypeOf<ReadonlyMat4>();
    // @ts-expect-error the shared constant must never be written through
    mat4.identity(mat4.IDENTITY);
  });

  test('create takes elements only, no out parameter', () => {
    expectTypeOf(mat4.create).parameter(0).toEqualTypeOf<number | undefined>();
  });

  test('call sites', () => {
    mat4.copy(live, frozen);
    mat4.copy(live, live);
    mat4.clone(frozen);
    mat4.identity(live);
    // @ts-expect-error readonly can never be an out parameter
    mat4.set(frozen, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    // @ts-expect-error wrong-dimension input
    mat4.copy(live, other);
    // @ts-expect-error too few elements
    mat4.set(live, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0);
  });
});

describe('shared memory', () => {
  test('a SharedArrayBuffer view casts to Mat4 with a single cast', () => {
    expectTypeOf(new Float32Array(sab, 0, 16) as Mat4).toEqualTypeOf<Mat4>();
  });

  test('SAB-backed values are accepted as out and as readonly inputs', () => {
    expectTypeOf<SharedMat4>().toExtend<Mat4>();
    expectTypeOf<SharedMat4>().toExtend<ReadonlyMat4>();
    mat4.copy(shared, frozen);
    mat4.copy(live, shared);
    mat4.clone(shared);
  });

  test('brand still rejects unbranded shared arrays', () => {
    expectTypeOf<typeof rawShared>().not.toExtend<ReadonlyMat4>();
  });
});
