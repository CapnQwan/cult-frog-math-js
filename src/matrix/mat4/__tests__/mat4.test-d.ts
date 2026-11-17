// src/matrix/mat4/__tests__/mat4.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as mat4 from '../mat4.js';

import type { Brand, BrandOf } from '@cult-frog/types';
import type { FixedFloat32Array } from '../../../_types/fixedFloat32Array.js';
import type { Quat, ReadonlyQuat } from '../../../quaternion/_types/quat.js';
import type { ReadonlyVec3, Vec3 } from '../../../vector/vec3/_types/vec3.js';
import type { Vec4 } from '../../../vector/vec4/_types/vec4.js';
import type { Mat3 } from '../../mat3/_types/mat3.js';
import type { Mat4, ReadonlyMat4 } from '../_types/mat4.js';

declare const live: Mat4;
declare const frozen: ReadonlyMat4;
declare const other: Mat3;
declare const raw: Float32Array<ArrayBuffer>;
declare const vector: Vec3;
declare const frozenVector: ReadonlyVec3;
declare const four: Vec4;
declare const rotation: Quat;
declare const frozenRotation: ReadonlyQuat;

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

  test('readonly can be uploaded to the GPU without a cast', () => {
    expectTypeOf<ReadonlyMat4>().toExtend<ArrayBufferView>();
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

describe('equality', () => {
  test('inputs are readonly and the result is a boolean', () => {
    expectTypeOf(mat4.isEqual).parameters.toEqualTypeOf<[ReadonlyMat4, ReadonlyMat4]>();
    expectTypeOf(mat4.isEqualEpsilon).parameters.toEqualTypeOf<
      [ReadonlyMat4, ReadonlyMat4, (number | undefined)?]
    >();
    expectTypeOf(mat4.isEqual).returns.toEqualTypeOf<boolean>();
    expectTypeOf(mat4.isEqualEpsilon).returns.toEqualTypeOf<boolean>();
  });

  test('call sites', () => {
    mat4.isEqual(live, frozen);
    mat4.isEqual(shared, live);
    mat4.isEqualEpsilon(frozen, live, 0.1);
    // @ts-expect-error wrong-dimension input
    mat4.isEqual(live, other);
    // @ts-expect-error unbranded arrays are rejected
    mat4.isEqualEpsilon(live, raw);
  });
});

describe('multiply', () => {
  test('out is mutable, inputs are readonly, and out is returned', () => {
    expectTypeOf(mat4.multiply).parameters.toEqualTypeOf<[Mat4, ReadonlyMat4, ReadonlyMat4]>();
    expectTypeOf(mat4.multiply).returns.toEqualTypeOf<Mat4>();
  });

  test('call sites', () => {
    mat4.multiply(live, frozen, mat4.IDENTITY);
    mat4.multiply(live, live, live);
    mat4.multiply(shared, shared, frozen);
    // @ts-expect-error readonly can never be an out parameter
    mat4.multiply(frozen, live, live);
    // @ts-expect-error the shared constant must never be written through
    mat4.multiply(mat4.IDENTITY, live, live);
    // @ts-expect-error wrong-dimension out
    mat4.multiply(other, live, live);
    // @ts-expect-error wrong-dimension input
    mat4.multiply(live, live, other);
    // @ts-expect-error unbranded arrays are rejected
    mat4.multiply(live, raw, live);
  });
});

describe('transpose', () => {
  test('out is mutable, the input is readonly, and out is returned', () => {
    expectTypeOf(mat4.transpose).parameters.toEqualTypeOf<[Mat4, ReadonlyMat4]>();
    expectTypeOf(mat4.transpose).returns.toEqualTypeOf<Mat4>();
  });

  test('call sites', () => {
    mat4.transpose(live, frozen);
    mat4.transpose(live, live);
    mat4.transpose(shared, mat4.IDENTITY);
    // @ts-expect-error readonly can never be an out parameter
    mat4.transpose(frozen, live);
    // @ts-expect-error the shared constant must never be written through
    mat4.transpose(mat4.IDENTITY, live);
    // @ts-expect-error wrong-dimension out
    mat4.transpose(other, live);
    // @ts-expect-error wrong-dimension input
    mat4.transpose(live, other);
    // @ts-expect-error unbranded arrays are rejected
    mat4.transpose(live, raw);
  });
});

describe('determinant', () => {
  test('takes a readonly matrix and returns a number', () => {
    expectTypeOf(mat4.determinant).parameters.toEqualTypeOf<[ReadonlyMat4]>();
    expectTypeOf(mat4.determinant).returns.toEqualTypeOf<number>();
  });

  test('call sites', () => {
    mat4.determinant(live);
    mat4.determinant(frozen);
    mat4.determinant(shared);
    mat4.determinant(mat4.IDENTITY);
    // @ts-expect-error wrong-dimension input
    mat4.determinant(other);
    // @ts-expect-error unbranded arrays are rejected
    mat4.determinant(raw);
  });
});

describe('invert', () => {
  test('out is mutable, the input is readonly, and out or null is returned', () => {
    expectTypeOf(mat4.invert).parameters.toEqualTypeOf<[Mat4, ReadonlyMat4]>();
    expectTypeOf(mat4.invert).returns.toEqualTypeOf<Mat4 | null>();
  });

  test('the result must be checked before it is used', () => {
    // @ts-expect-error the inverse is null for a singular matrix
    mat4.multiply(live, mat4.invert(live, frozen), frozen);

    const inverse = mat4.invert(live, frozen);
    if (inverse) mat4.multiply(live, inverse, frozen);
  });

  test('call sites', () => {
    mat4.invert(live, frozen);
    mat4.invert(live, live);
    mat4.invert(shared, mat4.IDENTITY);
    // @ts-expect-error readonly can never be an out parameter
    mat4.invert(frozen, live);
    // @ts-expect-error the shared constant must never be written through
    mat4.invert(mat4.IDENTITY, live);
    // @ts-expect-error wrong-dimension out
    mat4.invert(other, live);
    // @ts-expect-error wrong-dimension input
    mat4.invert(live, other);
    // @ts-expect-error unbranded arrays are rejected
    mat4.invert(live, raw);
  });
});

describe('builders', () => {
  test('out is mutable, the inputs are readonly, and out is returned', () => {
    expectTypeOf(mat4.fromTranslation).parameters.toEqualTypeOf<[Mat4, ReadonlyVec3]>();
    expectTypeOf(mat4.fromScale).parameters.toEqualTypeOf<[Mat4, ReadonlyVec3]>();
    expectTypeOf(mat4.fromQuat).parameters.toEqualTypeOf<[Mat4, ReadonlyQuat]>();
    expectTypeOf(mat4.fromAxisAngle).parameters.toEqualTypeOf<[Mat4, ReadonlyVec3, number]>();
    expectTypeOf(mat4.fromTRS).parameters.toEqualTypeOf<
      [Mat4, ReadonlyVec3, ReadonlyQuat, ReadonlyVec3]
    >();
    expectTypeOf(mat4.fromTranslation).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.fromScale).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.fromQuat).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.fromAxisAngle).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.fromTRS).returns.toEqualTypeOf<Mat4>();
  });

  test('call sites', () => {
    mat4.fromTranslation(live, frozenVector);
    mat4.fromScale(shared, vector);
    mat4.fromQuat(live, frozenRotation);
    mat4.fromAxisAngle(live, frozenVector, 0.5);
    mat4.fromTRS(live, vector, rotation, frozenVector);
    // @ts-expect-error readonly can never be an out parameter
    mat4.fromTranslation(frozen, vector);
    // @ts-expect-error the shared constant must never be written through
    mat4.fromQuat(mat4.IDENTITY, rotation);
    // @ts-expect-error wrong-dimension out
    mat4.fromScale(other, vector);
    // @ts-expect-error a quaternion is not a translation
    mat4.fromTranslation(live, rotation);
    // @ts-expect-error a vector is not a quaternion
    mat4.fromQuat(live, four);
    // @ts-expect-error the angle comes after the axis
    mat4.fromAxisAngle(live, 0.5, vector);
    // @ts-expect-error the rotation comes between the translation and the scale
    mat4.fromTRS(live, vector, vector, rotation);
    // @ts-expect-error unbranded arrays are rejected
    mat4.fromScale(live, raw);
  });
});

describe('projections', () => {
  test('out is mutable, the planes are numbers, and out is returned', () => {
    type Perspective = [Mat4, number, number, number, number];
    type Orthographic = [Mat4, number, number, number, number, number, number];
    expectTypeOf(mat4.perspectiveNO).parameters.toEqualTypeOf<Perspective>();
    expectTypeOf(mat4.perspectiveZO).parameters.toEqualTypeOf<Perspective>();
    expectTypeOf(mat4.orthographicNO).parameters.toEqualTypeOf<Orthographic>();
    expectTypeOf(mat4.orthographicZO).parameters.toEqualTypeOf<Orthographic>();
    expectTypeOf(mat4.perspectiveNO).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.perspectiveZO).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.orthographicNO).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.orthographicZO).returns.toEqualTypeOf<Mat4>();
  });

  test('call sites', () => {
    mat4.perspectiveZO(live, 1, 16 / 9, 0.1, Number.POSITIVE_INFINITY);
    mat4.orthographicNO(shared, -1, 1, -1, 1, 0, 10);
    // @ts-expect-error readonly can never be an out parameter
    mat4.perspectiveNO(frozen, 1, 1, 0.1, 100);
    // @ts-expect-error the shared constant must never be written through
    mat4.orthographicZO(mat4.IDENTITY, -1, 1, -1, 1, 0, 10);
    // @ts-expect-error wrong-dimension out
    mat4.perspectiveZO(other, 1, 1, 0.1, 100);
    // @ts-expect-error every plane is required
    mat4.orthographicZO(live, -1, 1, -1, 1, 0);
  });
});

describe('lookAt', () => {
  test('out is mutable, the inputs are readonly, and out or null is returned', () => {
    expectTypeOf(mat4.lookAt).parameters.toEqualTypeOf<
      [Mat4, ReadonlyVec3, ReadonlyVec3, ReadonlyVec3]
    >();
    expectTypeOf(mat4.lookAt).returns.toEqualTypeOf<Mat4 | null>();
  });

  test('the result must be checked before it is used', () => {
    // @ts-expect-error the view is null for a degenerate camera
    mat4.multiply(live, frozen, mat4.lookAt(live, vector, frozenVector, vector));

    const view = mat4.lookAt(live, vector, frozenVector, vector);
    if (view) mat4.multiply(live, frozen, view);
  });

  test('call sites', () => {
    mat4.lookAt(live, frozenVector, vector, frozenVector);
    mat4.lookAt(shared, vector, vector, vector);
    // @ts-expect-error readonly can never be an out parameter
    mat4.lookAt(frozen, vector, vector, vector);
    // @ts-expect-error the shared constant must never be written through
    mat4.lookAt(mat4.IDENTITY, vector, vector, vector);
    // @ts-expect-error a quaternion is not a position
    mat4.lookAt(live, rotation, vector, vector);
    // @ts-expect-error a Vec4 is not a position
    mat4.lookAt(live, vector, four, vector);
    // @ts-expect-error unbranded arrays are rejected
    mat4.lookAt(live, vector, vector, raw);
  });
});
