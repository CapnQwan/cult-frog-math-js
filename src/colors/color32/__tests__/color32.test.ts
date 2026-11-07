// src/colors/color32/__tests__/color32.test.ts
import { describe, expect, test } from 'vitest';

import * as color32 from '../color32.js';

import type { Color32 } from '../_types/color32.js';

/** Reads every channel back in red, green, blue, alpha order. */
function channels(c: Color32): [number, number, number, number] {
  return [color32.red(c), color32.green(c), color32.blue(c), color32.alpha(c)];
}

describe('create', () => {
  test('packs channels as 0xRRGGBBAA', () => {
    expect(color32.create(0x12, 0x34, 0x56, 0x78)).toBe(0x12345678);
  });

  test('defaults alpha to opaque', () => {
    expect(color32.create(255, 128, 0)).toBe(0xff8000ff);
    expect(color32.create(0, 0, 0)).toBe(color32.BLACK);
  });

  test('packs the extremes', () => {
    expect(color32.create(0, 0, 0, 0)).toBe(0);
    expect(color32.create(255, 255, 255, 255)).toBe(0xffffffff);
  });

  test('stays unsigned when red sets the top bit', () => {
    const c = color32.create(255, 0, 0, 255);
    expect(c).toBe(0xff0000ff);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(color32.create(128, 0, 0, 0)).toBe(0x80000000);
  });

  test('wraps out-of-range channels to their low 8 bits', () => {
    expect(channels(color32.create(256, 257, 511, 300))).toEqual([0, 1, 255, 44]);
    expect(channels(color32.create(-1, -2, -256, -255))).toEqual([255, 254, 0, 1]);
  });

  test('out-of-range channels never bleed into a neighbour', () => {
    expect(color32.create(0, 256, 0, 0)).toBe(0);
    expect(color32.create(0, 0, 0, -1)).toBe(0x000000ff);
    expect(color32.create(0, -1, 0, 0)).toBe(0x00ff0000);
    expect(color32.create(-1, 0, 0, 0)).toBe(0xff000000);
  });

  test('rounds fractions to the nearest integer', () => {
    expect(channels(color32.create(127.4, 127.5, 254.6, 0.49))).toEqual([127, 128, 255, 0]);
  });

  test('rounds before wrapping', () => {
    expect(channels(color32.create(255.5, -0.5, -0.6, 255.4))).toEqual([0, 0, 255, 255]);
  });

  test('treats NaN and the infinities as zero', () => {
    expect(color32.create(Number.NaN, 255, Number.NaN, 255)).toBe(0x00ff00ff);
    expect(color32.create(Infinity, -Infinity, 0, 255)).toBe(0x000000ff);
  });
});

describe('channel getters', () => {
  test('read each channel from its own byte', () => {
    expect(channels(color32.create(0x12, 0x34, 0x56, 0x78))).toEqual([0x12, 0x34, 0x56, 0x78]);
  });

  test('read a channel at 255 without picking up the others', () => {
    expect(channels(color32.create(255, 0, 0, 0))).toEqual([255, 0, 0, 0]);
    expect(channels(color32.create(0, 255, 0, 0))).toEqual([0, 255, 0, 0]);
    expect(channels(color32.create(0, 0, 255, 0))).toEqual([0, 0, 255, 0]);
    expect(channels(color32.create(0, 0, 0, 255))).toEqual([0, 0, 0, 255]);
  });

  test('read colours cast from hex literals', () => {
    expect(channels(0xff8000c0 as Color32)).toEqual([255, 128, 0, 192]);
    expect(channels(0xffffffff as Color32)).toEqual([255, 255, 255, 255]);
  });

  test('round-trip every channel value', () => {
    for (let v = 0; v <= 255; v++) {
      const other = 255 - v;
      expect(channels(color32.create(v, other, v, other))).toEqual([v, other, v, other]);
    }
  });
});

describe('lerp', () => {
  const from = color32.create(0, 255, 10, 200);
  const to = color32.create(255, 0, 20, 100);

  test('returns the endpoints at t = 0 and t = 1', () => {
    expect(color32.lerp(from, to, 0)).toBe(from);
    expect(color32.lerp(from, to, 1)).toBe(to);
  });

  test('blends each channel independently', () => {
    expect(channels(color32.lerp(from, to, 0.25))).toEqual([64, 191, 13, 175]);
  });

  test('rounds blended channels to the nearest integer', () => {
    expect(color32.lerp(color32.TRANSPARENT, color32.WHITE, 0.5)).toBe(0x80808080);
    expect(color32.lerp(color32.BLACK, color32.WHITE, 0.999)).toBe(color32.WHITE);
  });

  test('extrapolates outside [0, 1] and saturates each channel', () => {
    const lo = color32.create(100, 100, 100, 255);
    const hi = color32.create(200, 200, 200, 255);
    expect(channels(color32.lerp(lo, hi, 1.5))).toEqual([250, 250, 250, 255]);
    expect(channels(color32.lerp(lo, hi, -1))).toEqual([0, 0, 0, 255]);
    expect(color32.lerp(color32.BLACK, color32.WHITE, 2)).toBe(color32.WHITE);
    expect(color32.lerp(color32.BLACK, color32.WHITE, -1)).toBe(color32.BLACK);
  });

  test('interpolates alpha without premultiplying', () => {
    expect(channels(color32.lerp(color32.RED, color32.TRANSPARENT, 0.5))).toEqual([128, 0, 0, 128]);
  });

  test('gives TRANSPARENT for a NaN factor', () => {
    expect(color32.lerp(from, to, Number.NaN)).toBe(color32.TRANSPARENT);
  });

  test('an infinite factor saturates differing channels and zeroes equal ones', () => {
    // Alpha is 255 at both ends, so it computes 0 * Infinity, which is NaN and packs as 0.
    expect(color32.lerp(color32.BLACK, color32.WHITE, Infinity)).toBe(0xffffff00);
    expect(color32.lerp(color32.BLACK, color32.WHITE, -Infinity)).toBe(0x00000000);
  });
});

describe('constants', () => {
  test.each([
    ['WHITE', color32.WHITE, 0xffffffff],
    ['BLACK', color32.BLACK, 0x000000ff],
    ['RED', color32.RED, 0xff0000ff],
    ['GREEN', color32.GREEN, 0x00ff00ff],
    ['BLUE', color32.BLUE, 0x0000ffff],
    ['YELLOW', color32.YELLOW, 0xffff00ff],
    ['CYAN', color32.CYAN, 0x00ffffff],
    ['MAGENTA', color32.MAGENTA, 0xff00ffff],
    ['TRANSPARENT', color32.TRANSPARENT, 0x00000000],
  ])('%s packs as its hex literal', (_name, value, hex) => {
    expect(value).toBe(hex);
  });

  test('TRANSPARENT needs an explicit zero alpha, since create defaults to opaque', () => {
    expect(color32.create(0, 0, 0, 0)).toBe(color32.TRANSPARENT);
    expect(color32.create(0, 0, 0)).not.toBe(color32.TRANSPARENT);
  });
});
