// src/matrix/__tests__/mat3.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as mat3 from '../mat3.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { Mat2 } from '../_types/mat2.js';
import type { Mat3, ReadonlyMat3 } from '../_types/mat3.js';

declare const live: Mat3;
declare const frozen: ReadonlyMat3;
declare const other: Mat2;
declare const raw: Float32Array<ArrayBuffer>;

/** A `Mat3` backed by a `SharedArrayBuffer`, as a view into worker-shared storage would be. */
type SharedMat3 = Brand<FixedFloat32Array<9, SharedArrayBuffer>, BrandOf<Mat3>>;
declare const shared: SharedMat3;
declare const sab: SharedArrayBuffer;
declare const rawShared: Float32Array<SharedArrayBuffer>;

describe('Mat3 / ReadonlyMat3 relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Mat3>().toExtend<ReadonlyMat3>();
    expectTypeOf<ReadonlyMat3>().not.toExtend<Mat3>();
  });

  test('brand rejects unbranded and differently-branded arrays', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyMat3>();
    expectTypeOf<Mat2>().not.toExtend<ReadonlyMat3>();
  });

  test('length is the literal 9', () => {
    expectTypeOf<Mat3['length']>().toEqualTypeOf<9>();
    expectTypeOf<ReadonlyMat3['length']>().toEqualTypeOf<9>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    // @ts-expect-error `subarray` would hand out a mutable alias
    frozen.subarray(0, 1);
  });
});

describe('mat3 signatures', () => {
  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(mat3.copy).parameter(0).toEqualTypeOf<Mat3>();
    expectTypeOf(mat3.copy).parameter(1).toEqualTypeOf<ReadonlyMat3>();
    expectTypeOf(mat3.clone).parameter(0).toEqualTypeOf<ReadonlyMat3>();
    expectTypeOf(mat3.set).parameter(0).toEqualTypeOf<Mat3>();
    expectTypeOf(mat3.identity).parameter(0).toEqualTypeOf<Mat3>();
  });

  test('allocators return owned, mutable matrices', () => {
    expectTypeOf(mat3.create).returns.toEqualTypeOf<Mat3>();
    expectTypeOf(mat3.clone).returns.toEqualTypeOf<Mat3>();
  });

  test('in-place writers return the mutable out', () => {
    expectTypeOf(mat3.set).returns.toEqualTypeOf<Mat3>();
    expectTypeOf(mat3.copy).returns.toEqualTypeOf<Mat3>();
    expectTypeOf(mat3.identity).returns.toEqualTypeOf<Mat3>();
  });

  test('IDENTITY is shared and cannot be passed as out', () => {
    expectTypeOf(mat3.IDENTITY).toEqualTypeOf<ReadonlyMat3>();
    // @ts-expect-error the shared constant must never be written through
    mat3.identity(mat3.IDENTITY);
  });

  test('create takes elements only, no out parameter', () => {
    expectTypeOf(mat3.create).parameter(0).toEqualTypeOf<number | undefined>();
  });

  test('call sites', () => {
    mat3.copy(live, frozen);
    mat3.copy(live, live);
    mat3.clone(frozen);
    mat3.identity(live);
    // @ts-expect-error readonly can never be an out parameter
    mat3.set(frozen, 1, 0, 0, 0, 1, 0, 0, 0, 1);
    // @ts-expect-error wrong-dimension input
    mat3.copy(live, other);
    // @ts-expect-error too few elements
    mat3.set(live, 1, 0, 0, 0, 1, 0, 0, 0);
  });
});

describe('shared memory', () => {
  test('a SharedArrayBuffer view casts to Mat3 with a single cast', () => {
    expectTypeOf(new Float32Array(sab, 0, 9) as Mat3).toEqualTypeOf<Mat3>();
  });

  test('SAB-backed values are accepted as out and as readonly inputs', () => {
    expectTypeOf<SharedMat3>().toExtend<Mat3>();
    expectTypeOf<SharedMat3>().toExtend<ReadonlyMat3>();
    mat3.copy(shared, frozen);
    mat3.copy(live, shared);
    mat3.clone(shared);
  });

  test('brand still rejects unbranded shared arrays', () => {
    expectTypeOf<typeof rawShared>().not.toExtend<ReadonlyMat3>();
  });
});
