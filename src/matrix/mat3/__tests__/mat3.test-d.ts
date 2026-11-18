// src/matrix/mat3/__tests__/mat3.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as mat3 from '../mat3.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../../_types/fixedFloat32Array.js';
import type { Quat, ReadonlyQuat } from '../../../quaternion/_types/quat.js';
import type { Vec2 } from '../../../vector/vec2/_types/vec2.js';
import type { Vec4 } from '../../../vector/vec4/_types/vec4.js';
import type { Mat2 } from '../../mat2/_types/mat2.js';
import type { Mat4, ReadonlyMat4 } from '../../mat4/_types/mat4.js';
import type { Mat3, ReadonlyMat3 } from '../_types/mat3.js';

declare const live: Mat3;
declare const frozen: ReadonlyMat3;
declare const other: Mat2;
declare const raw: Float32Array<ArrayBuffer>;
declare const vector: Vec2;
declare const four: Vec4;
declare const rotation: Quat;
declare const frozenRotation: ReadonlyQuat;
declare const model: Mat4;
declare const frozenModel: ReadonlyMat4;

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

  test('readonly can be uploaded to the GPU without a cast', () => {
    expectTypeOf<ReadonlyMat3>().toExtend<ArrayBufferView>();
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

describe('equality', () => {
  test('inputs are readonly and the result is a boolean', () => {
    expectTypeOf(mat3.isEqual).parameters.toEqualTypeOf<[ReadonlyMat3, ReadonlyMat3]>();
    expectTypeOf(mat3.isEqualEpsilon).parameters.toEqualTypeOf<
      [ReadonlyMat3, ReadonlyMat3, (number | undefined)?]
    >();
    expectTypeOf(mat3.isEqual).returns.toEqualTypeOf<boolean>();
    expectTypeOf(mat3.isEqualEpsilon).returns.toEqualTypeOf<boolean>();
  });

  test('call sites', () => {
    mat3.isEqual(live, frozen);
    mat3.isEqual(shared, live);
    mat3.isEqualEpsilon(frozen, live, 0.1);
    // @ts-expect-error wrong-dimension input
    mat3.isEqual(live, other);
    // @ts-expect-error unbranded arrays are rejected
    mat3.isEqualEpsilon(live, raw);
  });
});

describe('multiply', () => {
  test('out is mutable, inputs are readonly, and out is returned', () => {
    expectTypeOf(mat3.multiply).parameters.toEqualTypeOf<[Mat3, ReadonlyMat3, ReadonlyMat3]>();
    expectTypeOf(mat3.multiply).returns.toEqualTypeOf<Mat3>();
  });

  test('call sites', () => {
    mat3.multiply(live, frozen, mat3.IDENTITY);
    mat3.multiply(live, live, live);
    mat3.multiply(shared, shared, frozen);
    // @ts-expect-error readonly can never be an out parameter
    mat3.multiply(frozen, live, live);
    // @ts-expect-error the shared constant must never be written through
    mat3.multiply(mat3.IDENTITY, live, live);
    // @ts-expect-error wrong-dimension out
    mat3.multiply(other, live, live);
    // @ts-expect-error wrong-dimension input
    mat3.multiply(live, live, other);
    // @ts-expect-error unbranded arrays are rejected
    mat3.multiply(live, raw, live);
  });
});

describe('transpose', () => {
  test('out is mutable, the input is readonly, and out is returned', () => {
    expectTypeOf(mat3.transpose).parameters.toEqualTypeOf<[Mat3, ReadonlyMat3]>();
    expectTypeOf(mat3.transpose).returns.toEqualTypeOf<Mat3>();
  });

  test('call sites', () => {
    mat3.transpose(live, frozen);
    mat3.transpose(live, live);
    mat3.transpose(shared, mat3.IDENTITY);
    // @ts-expect-error readonly can never be an out parameter
    mat3.transpose(frozen, live);
    // @ts-expect-error the shared constant must never be written through
    mat3.transpose(mat3.IDENTITY, live);
    // @ts-expect-error wrong-dimension out
    mat3.transpose(other, live);
    // @ts-expect-error wrong-dimension input
    mat3.transpose(live, other);
    // @ts-expect-error unbranded arrays are rejected
    mat3.transpose(live, raw);
  });
});

describe('determinant', () => {
  test('takes a readonly matrix and returns a number', () => {
    expectTypeOf(mat3.determinant).parameters.toEqualTypeOf<[ReadonlyMat3]>();
    expectTypeOf(mat3.determinant).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    mat3.determinant(live);
    mat3.determinant(frozen);
    mat3.determinant(shared);
    mat3.determinant(mat3.IDENTITY);
    // @ts-expect-error wrong-dimension input
    mat3.determinant(other);
    // @ts-expect-error unbranded arrays are rejected
    mat3.determinant(raw);
  });
});

describe('invert', () => {
  test('out is mutable, the input is readonly, and out or null is returned', () => {
    expectTypeOf(mat3.invert).parameters.toEqualTypeOf<[Mat3, ReadonlyMat3]>();
    expectTypeOf(mat3.invert).returns.toEqualTypeOf<Mat3 | null>();
  });

  test('the result must be checked before it is used', () => {
    // @ts-expect-error the inverse is null for a singular matrix
    mat3.multiply(live, mat3.invert(live, frozen), frozen);

    const inverse = mat3.invert(live, frozen);
    if (inverse) mat3.multiply(live, inverse, frozen);
  });

  test('call sites', () => {
    mat3.invert(live, frozen);
    mat3.invert(live, live);
    mat3.invert(shared, mat3.IDENTITY);
    // @ts-expect-error readonly can never be an out parameter
    mat3.invert(frozen, live);
    // @ts-expect-error the shared constant must never be written through
    mat3.invert(mat3.IDENTITY, live);
    // @ts-expect-error wrong-dimension out
    mat3.invert(other, live);
    // @ts-expect-error wrong-dimension input
    mat3.invert(live, other);
    // @ts-expect-error unbranded arrays are rejected
    mat3.invert(live, raw);
  });
});

describe('builders', () => {
  test('out is mutable, the input is readonly, and out is returned', () => {
    expectTypeOf(mat3.fromQuat).parameters.toEqualTypeOf<[Mat3, ReadonlyQuat]>();
    expectTypeOf(mat3.fromQuat).returns.toEqualTypeOf<Mat3>();
  });

  test('call sites', () => {
    mat3.fromQuat(live, frozenRotation);
    mat3.fromQuat(shared, rotation);
    // @ts-expect-error readonly can never be an out parameter
    mat3.fromQuat(frozen, rotation);
    // @ts-expect-error the shared constant must never be written through
    mat3.fromQuat(mat3.IDENTITY, rotation);
    // @ts-expect-error wrong-dimension out
    mat3.fromQuat(other, rotation);
    // @ts-expect-error a vector is not a quaternion
    mat3.fromQuat(live, four);
    // @ts-expect-error unbranded arrays are rejected
    mat3.fromQuat(live, raw);
  });

  test('fromMat4 and normalFromMat4 take a readonly Mat4', () => {
    expectTypeOf(mat3.fromMat4).parameters.toEqualTypeOf<[Mat3, ReadonlyMat4]>();
    expectTypeOf(mat3.fromMat4).returns.toEqualTypeOf<Mat3>();
    expectTypeOf(mat3.normalFromMat4).parameters.toEqualTypeOf<[Mat3, ReadonlyMat4]>();
    expectTypeOf(mat3.normalFromMat4).returns.toEqualTypeOf<Mat3 | null>();
  });

  test('fromMat4 and normalFromMat4 call sites', () => {
    mat3.fromMat4(live, frozenModel);
    mat3.fromMat4(shared, model);
    mat3.normalFromMat4(live, model);
    mat3.normalFromMat4(shared, frozenModel);
    // @ts-expect-error readonly can never be an out parameter
    mat3.fromMat4(frozen, model);
    // @ts-expect-error the shared constant must never be written through
    mat3.normalFromMat4(mat3.IDENTITY, model);
    // @ts-expect-error a Mat3 is not a Mat4
    mat3.fromMat4(live, frozen);
    // @ts-expect-error a Mat3 is not a Mat4
    mat3.normalFromMat4(live, live);
    // @ts-expect-error unbranded arrays are rejected
    mat3.normalFromMat4(live, raw);
  });

  test('the normal matrix must be checked before it is used', () => {
    // @ts-expect-error the normal matrix is null for a singular model matrix
    mat3.multiply(live, mat3.normalFromMat4(live, frozenModel), frozen);

    const normal = mat3.normalFromMat4(live, frozenModel);
    if (normal) mat3.multiply(live, normal, frozen);
  });

  test('the 2D builders live on Mat3x2', () => {
    // @ts-expect-error 2D transforms with a translation are Mat3x2s
    mat3.fromTranslation(live, vector);
    // @ts-expect-error 2D transforms with a translation are Mat3x2s
    mat3.fromTRS(live, vector, 0.5, vector);
  });
});

describe('fromPacked', () => {
  test('it writes to a mutable out and returns it', () => {
    expectTypeOf(mat3.fromPacked).parameters.toEqualTypeOf<[Mat3, Float32Array, number]>();
    expectTypeOf(mat3.fromPacked).returns.toEqualTypeOf<Mat3>();
  });

  test('call sites', () => {
    mat3.fromPacked(live, raw, 0);
    mat3.fromPacked(shared, rawShared, 0);
    // @ts-expect-error readonly can never be an out parameter
    mat3.fromPacked(frozen, raw, 0);
    // @ts-expect-error unbranded arrays are rejected as out
    mat3.fromPacked(raw, raw, 0);
    // @ts-expect-error plain arrays are rejected; pack the values into a Float32Array
    mat3.fromPacked(live, [1, 2, 3, 4, 5, 6, 7, 8, 9], 0);
    // @ts-expect-error the row index is required
    mat3.fromPacked(live, raw);
  });
});
