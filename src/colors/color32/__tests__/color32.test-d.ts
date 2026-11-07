// src/colors/color32/__tests__/color32.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as color32 from '../color32.js';
import { Color32 as Color32Namespace } from '../index.js';

import type { Color32 } from '../_types/color32.js';
import type { Color32 as ExportedColor32 } from '../index.js';

declare const c: Color32;
declare const raw: number;

describe('Color32 brand', () => {
  test('a Color32 is usable as a number, but a number is not a Color32', () => {
    expectTypeOf<Color32>().toExtend<number>();
    expectTypeOf<number>().not.toExtend<Color32>();
  });

  test('a cast literal is a Color32', () => {
    expectTypeOf(0xff0000ff as Color32).toEqualTypeOf<Color32>();
  });
});

describe('color32 signatures', () => {
  test('create returns a Color32', () => {
    expectTypeOf(color32.create).returns.toEqualTypeOf<Color32>();
    expectTypeOf(color32.create).parameters.toEqualTypeOf<
      [number, number, number, (number | undefined)?]
    >();
  });

  test('getters take a Color32 and return a number', () => {
    for (const getter of [color32.red, color32.green, color32.blue, color32.alpha]) {
      expectTypeOf(getter).parameter(0).toEqualTypeOf<Color32>();
      expectTypeOf(getter).returns.toEqualTypeOf<number>();
    }
  });

  test('lerp takes two Color32s and a factor, and returns a Color32', () => {
    expectTypeOf(color32.lerp).parameters.toEqualTypeOf<[Color32, Color32, number]>();
    expectTypeOf(color32.lerp).returns.toEqualTypeOf<Color32>();
  });

  test('constants are Color32s', () => {
    expectTypeOf(color32.WHITE).toEqualTypeOf<Color32>();
    expectTypeOf(color32.TRANSPARENT).toEqualTypeOf<Color32>();
  });

  test('call sites', () => {
    color32.red(c);
    // @ts-expect-error an unbranded number is rejected
    color32.red(raw);
    // @ts-expect-error an unbranded literal is rejected
    color32.alpha(0xff0000ff);
  });
});

describe('index exports', () => {
  test('the type and the namespace share the name Color32', () => {
    expectTypeOf<ExportedColor32>().toEqualTypeOf<Color32>();
    expectTypeOf(Color32Namespace.create).toEqualTypeOf(color32.create);
  });
});
