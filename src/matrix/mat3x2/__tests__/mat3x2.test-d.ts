// src/matrix/mat3x2/__tests__/mat3x2.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as mat3x2 from '../mat3x2.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../../_types/fixedFloat32Array.js';
import type { Mat2 } from '../../mat2/_types/mat2.js';
import type { Mat3, ReadonlyMat3 } from '../../mat3/_types/mat3.js';
import type { Mat3x2, ReadonlyMat3x2 } from '../_types/mat3x2.js';

declare const live: Mat3x2;
declare const frozen: ReadonlyMat3x2;
declare const square: Mat3;
declare const frozenSquare: ReadonlyMat3;
declare const other: Mat2;
declare const raw: Float32Array<ArrayBuffer>;

/** A `Mat3x2` backed by a `SharedArrayBuffer`, as a view into worker-shared storage would be. */
type SharedMat3x2 = Brand<FixedFloat32Array<6, SharedArrayBuffer>, BrandOf<Mat3x2>>;
declare const shared: SharedMat3x2;
declare const sab: SharedArrayBuffer;
declare const rawShared: Float32Array<SharedArrayBuffer>;

describe('Mat3x2 / ReadonlyMat3x2 relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Mat3x2>().toExtend<ReadonlyMat3x2>();
    expectTypeOf<ReadonlyMat3x2>().not.toExtend<Mat3x2>();
  });

  test('brand rejects unbranded and differently-branded arrays', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyMat3x2>();
    expectTypeOf<Mat2>().not.toExtend<ReadonlyMat3x2>();
  });

  test('a 2D affine transform and a Mat3 are not interchangeable in either direction', () => {
    // This separation is why Mat3x2 exists: a 2D transform must never reach a
    // function that reads all nine elements as a 3D linear map.
    expectTypeOf<Mat3>().not.toExtend<ReadonlyMat3x2>();
    expectTypeOf<Mat3x2>().not.toExtend<ReadonlyMat3>();
  });

  test('length is the literal 6', () => {
    expectTypeOf<Mat3x2['length']>().toEqualTypeOf<6>();
    expectTypeOf<ReadonlyMat3x2['length']>().toEqualTypeOf<6>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([1, 0, 0, 1, 0, 0]);
    // @ts-expect-error `subarray` would hand out a mutable alias
    frozen.subarray(0, 1);
  });

  test('readonly can be uploaded to the GPU without a cast', () => {
    expectTypeOf<ReadonlyMat3x2>().toExtend<ArrayBufferView>();
  });
});

describe('mat3x2 signatures', () => {
  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(mat3x2.copy).parameter(0).toEqualTypeOf<Mat3x2>();
    expectTypeOf(mat3x2.copy).parameter(1).toEqualTypeOf<ReadonlyMat3x2>();
    expectTypeOf(mat3x2.clone).parameter(0).toEqualTypeOf<ReadonlyMat3x2>();
    expectTypeOf(mat3x2.set).parameter(0).toEqualTypeOf<Mat3x2>();
    expectTypeOf(mat3x2.identity).parameter(0).toEqualTypeOf<Mat3x2>();
  });

  test('allocators return owned, mutable matrices', () => {
    expectTypeOf(mat3x2.create).returns.toEqualTypeOf<Mat3x2>();
    expectTypeOf(mat3x2.clone).returns.toEqualTypeOf<Mat3x2>();
  });

  test('in-place writers return the mutable out', () => {
    expectTypeOf(mat3x2.set).returns.toEqualTypeOf<Mat3x2>();
    expectTypeOf(mat3x2.copy).returns.toEqualTypeOf<Mat3x2>();
    expectTypeOf(mat3x2.identity).returns.toEqualTypeOf<Mat3x2>();
  });

  test('IDENTITY is shared and cannot be passed as out', () => {
    expectTypeOf(mat3x2.IDENTITY).toEqualTypeOf<ReadonlyMat3x2>();
    // @ts-expect-error the shared constant must never be written through
    mat3x2.identity(mat3x2.IDENTITY);
  });

  test('create takes elements only, no out parameter', () => {
    expectTypeOf(mat3x2.create).parameter(0).toEqualTypeOf<number | undefined>();
  });

  test('call sites', () => {
    mat3x2.copy(live, frozen);
    mat3x2.copy(live, live);
    mat3x2.clone(frozen);
    mat3x2.identity(live);
    // @ts-expect-error readonly can never be an out parameter
    mat3x2.set(frozen, 1, 0, 0, 0, 1, 0);
    // @ts-expect-error a Mat3 is not a 2D affine transform
    mat3x2.copy(live, frozenSquare);
    // @ts-expect-error a Mat3 can't be written as one either
    mat3x2.identity(square);
    // @ts-expect-error wrong-dimension input
    mat3x2.copy(live, other);
    // @ts-expect-error too few elements
    mat3x2.set(live, 1, 0, 0, 0, 1);
  });
});

describe('shared memory', () => {
  test('a SharedArrayBuffer view casts to Mat3x2 with a single cast', () => {
    expectTypeOf(new Float32Array(sab, 0, 6) as Mat3x2).toEqualTypeOf<Mat3x2>();
  });

  test('SAB-backed values are accepted as out and as readonly inputs', () => {
    expectTypeOf<SharedMat3x2>().toExtend<Mat3x2>();
    expectTypeOf<SharedMat3x2>().toExtend<ReadonlyMat3x2>();
    mat3x2.copy(shared, frozen);
    mat3x2.copy(live, shared);
    mat3x2.clone(shared);
  });

  test('brand still rejects unbranded shared arrays', () => {
    expectTypeOf<typeof rawShared>().not.toExtend<ReadonlyMat3x2>();
  });
});

describe('equality', () => {
  test('inputs are readonly and the result is a boolean', () => {
    expectTypeOf(mat3x2.isEqual).parameters.toEqualTypeOf<[ReadonlyMat3x2, ReadonlyMat3x2]>();
    expectTypeOf(mat3x2.isEqualEpsilon).parameters.toEqualTypeOf<
      [ReadonlyMat3x2, ReadonlyMat3x2, (number | undefined)?]
    >();
    expectTypeOf(mat3x2.isEqual).returns.toEqualTypeOf<boolean>();
    expectTypeOf(mat3x2.isEqualEpsilon).returns.toEqualTypeOf<boolean>();
  });

  test('call sites', () => {
    mat3x2.isEqual(live, frozen);
    mat3x2.isEqual(shared, live);
    mat3x2.isEqualEpsilon(frozen, live, 0.1);
    // @ts-expect-error a Mat3 is not a 2D affine transform
    mat3x2.isEqual(live, square);
    // @ts-expect-error unbranded arrays are rejected
    mat3x2.isEqualEpsilon(live, raw);
  });
});

describe('multiply', () => {
  test('out is mutable, inputs are readonly, and out is returned', () => {
    expectTypeOf(mat3x2.multiply).parameters.toEqualTypeOf<
      [Mat3x2, ReadonlyMat3x2, ReadonlyMat3x2]
    >();
    expectTypeOf(mat3x2.multiply).returns.toEqualTypeOf<Mat3x2>();
  });

  test('call sites', () => {
    mat3x2.multiply(live, frozen, mat3x2.IDENTITY);
    mat3x2.multiply(live, live, live);
    mat3x2.multiply(shared, shared, frozen);
    // @ts-expect-error readonly can never be an out parameter
    mat3x2.multiply(frozen, live, live);
    // @ts-expect-error the shared constant must never be written through
    mat3x2.multiply(mat3x2.IDENTITY, live, live);
    // @ts-expect-error a Mat3 is not a 2D affine transform
    mat3x2.multiply(live, live, frozenSquare);
    // @ts-expect-error a Mat3 can't be written as one either
    mat3x2.multiply(square, live, live);
    // @ts-expect-error unbranded arrays are rejected
    mat3x2.multiply(live, raw, live);
  });
});

describe('determinant', () => {
  test('takes a readonly matrix and returns a number', () => {
    expectTypeOf(mat3x2.determinant).parameters.toEqualTypeOf<[ReadonlyMat3x2]>();
    expectTypeOf(mat3x2.determinant).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    mat3x2.determinant(live);
    mat3x2.determinant(frozen);
    mat3x2.determinant(shared);
    mat3x2.determinant(mat3x2.IDENTITY);
    // @ts-expect-error a Mat3 is not a 2D affine transform
    mat3x2.determinant(frozenSquare);
    // @ts-expect-error wrong-dimension input
    mat3x2.determinant(other);
    // @ts-expect-error unbranded arrays are rejected
    mat3x2.determinant(raw);
  });
});

describe('invert', () => {
  test('out is mutable, the input is readonly, and out or null is returned', () => {
    expectTypeOf(mat3x2.invert).parameters.toEqualTypeOf<[Mat3x2, ReadonlyMat3x2]>();
    expectTypeOf(mat3x2.invert).returns.toEqualTypeOf<Mat3x2 | null>();
  });

  test('the result must be checked before it is used', () => {
    // @ts-expect-error the inverse is null for a singular matrix
    mat3x2.multiply(live, mat3x2.invert(live, frozen), frozen);

    const inverse = mat3x2.invert(live, frozen);
    if (inverse) mat3x2.multiply(live, inverse, frozen);
  });

  test('call sites', () => {
    mat3x2.invert(live, frozen);
    mat3x2.invert(live, live);
    mat3x2.invert(shared, mat3x2.IDENTITY);
    // @ts-expect-error readonly can never be an out parameter
    mat3x2.invert(frozen, live);
    // @ts-expect-error the shared constant must never be written through
    mat3x2.invert(mat3x2.IDENTITY, live);
    // @ts-expect-error a Mat3 can't be written as one
    mat3x2.invert(square, live);
    // @ts-expect-error a Mat3 is not a 2D affine transform
    mat3x2.invert(live, frozenSquare);
    // @ts-expect-error unbranded arrays are rejected
    mat3x2.invert(live, raw);
  });
});
