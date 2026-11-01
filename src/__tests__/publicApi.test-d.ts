import { describe, expectTypeOf, test } from 'vitest';

import { Mat2 } from '../mat2.js';
import { Mat3 } from '../mat3.js';
import { Mat4 } from '../mat4.js';
import { Quat } from '../quat.js';
import { Vec2 } from '../vec2.js';
import { Vec3 } from '../vec3.js';
import { Vec4 } from '../vec4.js';

import type * as root from '../index.js';
import type { ReadonlyMat2 } from '../mat2.js';
import type { ReadonlyMat3 } from '../mat3.js';
import type { ReadonlyMat4 } from '../mat4.js';
import type { ReadonlyQuat } from '../quat.js';
import type { ReadonlyVec2 } from '../vec2.js';
import type { ReadonlyVec3 } from '../vec3.js';
import type { ReadonlyVec4 } from '../vec4.js';

describe('entry points export each namespace with its types', () => {
  test('vectors', () => {
    expectTypeOf(Vec2.create).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(Vec2.clone).parameter(0).toEqualTypeOf<ReadonlyVec2>();
    expectTypeOf(Vec3.create).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(Vec3.clone).parameter(0).toEqualTypeOf<ReadonlyVec3>();
    expectTypeOf(Vec4.create).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(Vec4.clone).parameter(0).toEqualTypeOf<ReadonlyVec4>();
  });

  test('matrices', () => {
    expectTypeOf(Mat2.create).returns.toEqualTypeOf<Mat2>();
    expectTypeOf(Mat2.clone).parameter(0).toEqualTypeOf<ReadonlyMat2>();
    expectTypeOf(Mat3.create).returns.toEqualTypeOf<Mat3>();
    expectTypeOf(Mat3.clone).parameter(0).toEqualTypeOf<ReadonlyMat3>();
    expectTypeOf(Mat4.create).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(Mat4.clone).parameter(0).toEqualTypeOf<ReadonlyMat4>();
  });

  test('quaternions', () => {
    expectTypeOf(Quat.create).returns.toEqualTypeOf<Quat>();
    expectTypeOf(Quat.clone).parameter(0).toEqualTypeOf<ReadonlyQuat>();
  });
});

describe('the root exports the same names', () => {
  test('types', () => {
    expectTypeOf<root.Vec2>().toEqualTypeOf<Vec2>();
    expectTypeOf<root.ReadonlyVec2>().toEqualTypeOf<ReadonlyVec2>();
    expectTypeOf<root.Vec3>().toEqualTypeOf<Vec3>();
    expectTypeOf<root.ReadonlyVec3>().toEqualTypeOf<ReadonlyVec3>();
    expectTypeOf<root.Vec4>().toEqualTypeOf<Vec4>();
    expectTypeOf<root.ReadonlyVec4>().toEqualTypeOf<ReadonlyVec4>();
    expectTypeOf<root.Mat2>().toEqualTypeOf<Mat2>();
    expectTypeOf<root.ReadonlyMat2>().toEqualTypeOf<ReadonlyMat2>();
    expectTypeOf<root.Mat3>().toEqualTypeOf<Mat3>();
    expectTypeOf<root.ReadonlyMat3>().toEqualTypeOf<ReadonlyMat3>();
    expectTypeOf<root.Mat4>().toEqualTypeOf<Mat4>();
    expectTypeOf<root.ReadonlyMat4>().toEqualTypeOf<ReadonlyMat4>();
    expectTypeOf<root.Quat>().toEqualTypeOf<Quat>();
    expectTypeOf<root.ReadonlyQuat>().toEqualTypeOf<ReadonlyQuat>();
  });

  test('namespaces', () => {
    expectTypeOf<typeof root.Vec2>().toEqualTypeOf<typeof Vec2>();
    expectTypeOf<typeof root.Vec3>().toEqualTypeOf<typeof Vec3>();
    expectTypeOf<typeof root.Vec4>().toEqualTypeOf<typeof Vec4>();
    expectTypeOf<typeof root.Mat2>().toEqualTypeOf<typeof Mat2>();
    expectTypeOf<typeof root.Mat3>().toEqualTypeOf<typeof Mat3>();
    expectTypeOf<typeof root.Mat4>().toEqualTypeOf<typeof Mat4>();
    expectTypeOf<typeof root.Quat>().toEqualTypeOf<typeof Quat>();
  });

  test('the old lowercase namespaces are gone', () => {
    // @ts-expect-error namespaces are PascalCase; `vec3` is only a subpath
    type _Old = typeof root.vec3;
  });
});
