// src/colors/color/__tests__/color.test-d.ts
import { describe, expectTypeOf, test } from 'vitest';

import * as color from '../color.js';
import { Color as ColorNamespace } from '../index.js';

import type { Vec4 } from '../../../vector/vec4/_types/vec4.js';
import type { Color32 } from '../../color32/_types/color32.js';
import type { Color, ReadonlyColor } from '../_types/color.js';
import type { Color as ExportedColor, ReadonlyColor as ExportedReadonlyColor } from '../index.js';

declare const live: Color;
declare const frozen: ReadonlyColor;
declare const vector: Vec4;
declare const packed: Color32;
declare const raw: Float32Array<ArrayBuffer>;

describe('Color / ReadonlyColor relationship', () => {
  test('assignability is one-way', () => {
    expectTypeOf<Color>().toExtend<ReadonlyColor>();
    expectTypeOf<ReadonlyColor>().not.toExtend<Color>();
  });

  test('brand rejects unbranded arrays and other four-float types', () => {
    expectTypeOf<typeof raw>().not.toExtend<ReadonlyColor>();
    expectTypeOf<Vec4>().not.toExtend<ReadonlyColor>();
    expectTypeOf<Color>().not.toExtend<Vec4>();
  });

  test('a packed Color32 is not a Color', () => {
    expectTypeOf<Color32>().not.toExtend<ReadonlyColor>();
  });

  test('length is the literal 4', () => {
    expectTypeOf<Color['length']>().toEqualTypeOf<4>();
    expectTypeOf<ReadonlyColor['length']>().toEqualTypeOf<4>();
  });

  test('readonly has no write surface', () => {
    // @ts-expect-error index writes are blocked
    frozen[0] = 1;
    // @ts-expect-error `set` is omitted
    frozen.set([1, 1, 1, 1]);
  });

  test('readonly can be uploaded to the GPU without a cast', () => {
    expectTypeOf<ReadonlyColor>().toExtend<ArrayBufferView>();
  });
});

describe('color signatures', () => {
  test('allocators return owned, mutable colours', () => {
    expectTypeOf(color.create).parameters.toEqualTypeOf<
      [(number | undefined)?, (number | undefined)?, (number | undefined)?, (number | undefined)?]
    >();
    expectTypeOf(color.create).returns.toEqualTypeOf<Color>();
    expectTypeOf(color.clone).returns.toEqualTypeOf<Color>();
  });

  test('out is mutable, inputs are readonly', () => {
    expectTypeOf(color.clone).parameter(0).toEqualTypeOf<ReadonlyColor>();
    expectTypeOf(color.set).parameter(0).toEqualTypeOf<Color>();
    expectTypeOf(color.copy).parameters.toEqualTypeOf<[Color, ReadonlyColor]>();
    expectTypeOf(color.set).returns.toEqualTypeOf<Color>();
    expectTypeOf(color.copy).returns.toEqualTypeOf<Color>();
  });

  test('comparisons take readonly colours and return a boolean', () => {
    expectTypeOf(color.isEqual).parameters.toEqualTypeOf<[ReadonlyColor, ReadonlyColor]>();
    expectTypeOf(color.isEqualEpsilon).parameters.toEqualTypeOf<
      [ReadonlyColor, ReadonlyColor, (number | undefined)?]
    >();
    expectTypeOf(color.isEqualRGB).parameters.toEqualTypeOf<
      [ReadonlyColor, number, number, number]
    >();
    expectTypeOf(color.isEqualRGBA).parameters.toEqualTypeOf<
      [ReadonlyColor, number, number, number, number]
    >();
    for (const compare of [
      color.isEqual,
      color.isEqualEpsilon,
      color.isEqualRGB,
      color.isEqualRGBA,
    ]) {
      expectTypeOf(compare).returns.toEqualTypeOf<boolean>();
    }
  });

  test('lerp writes a mutable out from readonly inputs', () => {
    expectTypeOf(color.lerp).parameters.toEqualTypeOf<
      [Color, ReadonlyColor, ReadonlyColor, number]
    >();
    expectTypeOf(color.lerp).returns.toEqualTypeOf<Color>();
  });

  test('fromColor32 decodes a packed colour into a mutable out', () => {
    expectTypeOf(color.fromColor32).parameters.toEqualTypeOf<[Color, Color32]>();
    expectTypeOf(color.fromColor32).returns.toEqualTypeOf<Color>();
  });

  test('constants are readonly', () => {
    expectTypeOf(color.WHITE).toEqualTypeOf<ReadonlyColor>();
    expectTypeOf(color.TRANSPARENT).toEqualTypeOf<ReadonlyColor>();
  });

  test('call sites', () => {
    color.lerp(live, frozen, color.WHITE, 0.5);
    color.lerp(live, live, live, 0.5);
    color.copy(live, color.WHITE);
    color.clone(color.WHITE)[0] = 0;
    color.isEqual(frozen, live);
    // @ts-expect-error a shared constant can never be an out parameter
    color.lerp(color.WHITE, frozen, frozen, 0.5);
    // @ts-expect-error a shared constant can never be copied into
    color.copy(color.WHITE, live);
    // @ts-expect-error a shared constant can never be set
    color.set(color.WHITE, 0, 0, 0, 1);
    color.create(1, 0, 0);
    // @ts-expect-error set requires alpha, unlike create
    color.set(live, 1, 0, 0);
    // @ts-expect-error a Vec4 is not a colour, despite the same layout
    color.lerp(live, vector, frozen, 0.5);
    // @ts-expect-error a packed Color32 is not a Color
    color.lerp(live, packed, frozen, 0.5);
    color.fromColor32(live, packed);
    // @ts-expect-error a shared constant can never be decoded into
    color.fromColor32(color.WHITE, packed);
    // @ts-expect-error an unbranded number is not a Color32
    color.fromColor32(live, 0xff0000ff);
  });
});

describe('index exports', () => {
  test('the type and the namespace share the name Color', () => {
    expectTypeOf<ExportedColor>().toEqualTypeOf<Color>();
    expectTypeOf<ExportedReadonlyColor>().toEqualTypeOf<ReadonlyColor>();
    expectTypeOf(ColorNamespace.create).toEqualTypeOf(color.create);
  });
});
