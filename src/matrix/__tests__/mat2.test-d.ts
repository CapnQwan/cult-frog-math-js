// src/matrix/__tests__/mat2.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as mat2 from '../mat2.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../_types/fixedFloat32Array.js';
import type { Mat2, ReadonlyMat2 } from '../_types/mat2.js';
import type { Mat3 } from '../_types/mat3.js';

declare const live: Mat2;
declare const frozen: ReadonlyMat2;
declare const other: Mat3;
declare const raw: Float32Array<ArrayBuffer>;

/** A `Mat2` backed by a `SharedArrayBuffer`, as a view into worker-shared storage would be. */
type SharedMat2 = Brand<FixedFloat32Array<4, SharedArrayBuffer>, BrandOf<Mat2>>;
declare const shared: SharedMat2;
declare const sab: SharedArrayBuffer;
declare const rawShared: Float32Array<SharedArrayBuffer>;

describe('Mat2 / ReadonlyMat2 relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Mat2>().toExtend<ReadonlyMat2>();
    expectTypeOf<ReadonlyMat2>().not.toExtend<Mat2>();
  });

  test('brand rejects unbranded and differently-branded arrays', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyMat2>();
    expectTypeOf<Mat3>().not.toExtend<ReadonlyMat2>();
  });

  test('length is the literal 4', () => {
    expectTypeOf<Mat2['length']>().toEqualTypeOf<4>();
    expectTypeOf<ReadonlyMat2['length']>().toEqualTypeOf<4>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([1, 0, 0, 1]);
    // @ts-expect-error `subarray` would hand out a mutable alias
    frozen.subarray(0, 1);
  });
});

describe('mat2 signatures', () => {
  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(mat2.copy).parameter(0).toEqualTypeOf<Mat2>();
    expectTypeOf(mat2.copy).parameter(1).toEqualTypeOf<ReadonlyMat2>();
    expectTypeOf(mat2.clone).parameter(0).toEqualTypeOf<ReadonlyMat2>();
    expectTypeOf(mat2.set).parameter(0).toEqualTypeOf<Mat2>();
    expectTypeOf(mat2.identity).parameter(0).toEqualTypeOf<Mat2>();
  });

  test('allocators return owned, mutable matrices', () => {
    expectTypeOf(mat2.create).returns.toEqualTypeOf<Mat2>();
    expectTypeOf(mat2.clone).returns.toEqualTypeOf<Mat2>();
  });

  test('in-place writers return the mutable out', () => {
    expectTypeOf(mat2.set).returns.toEqualTypeOf<Mat2>();
    expectTypeOf(mat2.copy).returns.toEqualTypeOf<Mat2>();
    expectTypeOf(mat2.identity).returns.toEqualTypeOf<Mat2>();
  });

  test('IDENTITY is shared and cannot be passed as out', () => {
    expectTypeOf(mat2.IDENTITY).toEqualTypeOf<ReadonlyMat2>();
    // @ts-expect-error the shared constant must never be written through
    mat2.identity(mat2.IDENTITY);
  });

  test('create takes elements only, no out parameter', () => {
    expectTypeOf(mat2.create).parameter(0).toEqualTypeOf<number | undefined>();
  });

  test('call sites', () => {
    mat2.copy(live, frozen);
    mat2.copy(live, live);
    mat2.clone(frozen);
    mat2.identity(live);
    // @ts-expect-error readonly can never be an out parameter
    mat2.set(frozen, 1, 0, 0, 1);
    // @ts-expect-error wrong-dimension input
    mat2.copy(live, other);
    // @ts-expect-error too few elements
    mat2.set(live, 1, 0, 0);
  });
});

describe('shared memory', () => {
  test('a SharedArrayBuffer view casts to Mat2 with a single cast', () => {
    expectTypeOf(new Float32Array(sab, 0, 4) as Mat2).toEqualTypeOf<Mat2>();
  });

  test('SAB-backed values are accepted as out and as readonly inputs', () => {
    expectTypeOf<SharedMat2>().toExtend<Mat2>();
    expectTypeOf<SharedMat2>().toExtend<ReadonlyMat2>();
    mat2.copy(shared, frozen);
    mat2.copy(live, shared);
    mat2.clone(shared);
  });

  test('brand still rejects unbranded shared arrays', () => {
    expectTypeOf<typeof rawShared>().not.toExtend<ReadonlyMat2>();
  });
});
