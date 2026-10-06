import { describe, expectTypeOf, test } from 'vitest';

import { mat2 } from '../mat2.js';
import { mat3 } from '../mat3.js';
import { mat4 } from '../mat4.js';
import { quat } from '../quat.js';
import { vec2 } from '../vec2.js';
import { vec3 } from '../vec3.js';
import { vec4 } from '../vec4.js';

import type * as root from '../index.js';
import type { Mat2, ReadonlyMat2 } from '../mat2.js';
import type { Mat3, ReadonlyMat3 } from '../mat3.js';
import type { Mat4, ReadonlyMat4 } from '../mat4.js';
import type { Quat, ReadonlyQuat } from '../quat.js';
import type { ReadonlyVec2, Vec2 } from '../vec2.js';
import type { ReadonlyVec3, Vec3 } from '../vec3.js';
import type { ReadonlyVec4, Vec4 } from '../vec4.js';

describe('entry points export each namespace with its types', () => {
  test('vectors', () => {
    expectTypeOf(vec2.create).returns.toEqualTypeOf<Vec2>();
    expectTypeOf(vec2.clone).parameter(0).toEqualTypeOf<ReadonlyVec2>();
    expectTypeOf(vec3.create).returns.toEqualTypeOf<Vec3>();
    expectTypeOf(vec3.clone).parameter(0).toEqualTypeOf<ReadonlyVec3>();
    expectTypeOf(vec4.create).returns.toEqualTypeOf<Vec4>();
    expectTypeOf(vec4.clone).parameter(0).toEqualTypeOf<ReadonlyVec4>();
  });

  test('matrices', () => {
    expectTypeOf(mat2.create).returns.toEqualTypeOf<Mat2>();
    expectTypeOf(mat2.clone).parameter(0).toEqualTypeOf<ReadonlyMat2>();
    expectTypeOf(mat3.create).returns.toEqualTypeOf<Mat3>();
    expectTypeOf(mat3.clone).parameter(0).toEqualTypeOf<ReadonlyMat3>();
    expectTypeOf(mat4.create).returns.toEqualTypeOf<Mat4>();
    expectTypeOf(mat4.clone).parameter(0).toEqualTypeOf<ReadonlyMat4>();
  });

  test('quaternions', () => {
    expectTypeOf(quat.create).returns.toEqualTypeOf<Quat>();
    expectTypeOf(quat.clone).parameter(0).toEqualTypeOf<ReadonlyQuat>();
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
    expectTypeOf<typeof root.vec2>().toEqualTypeOf<typeof vec2>();
    expectTypeOf<typeof root.vec3>().toEqualTypeOf<typeof vec3>();
    expectTypeOf<typeof root.vec4>().toEqualTypeOf<typeof vec4>();
    expectTypeOf<typeof root.mat2>().toEqualTypeOf<typeof mat2>();
    expectTypeOf<typeof root.mat3>().toEqualTypeOf<typeof mat3>();
    expectTypeOf<typeof root.mat4>().toEqualTypeOf<typeof mat4>();
    expectTypeOf<typeof root.quat>().toEqualTypeOf<typeof quat>();
  });

  test('the old PascalCase namespaces are gone', () => {
    // @ts-expect-error namespaces are lowercase; `Vec3` is only a type
    type _Old = typeof root.Vec3;
  });
});
