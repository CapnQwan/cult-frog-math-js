// src/colors/color/__tests__/color.test.ts
import { describe, expect, test } from 'vitest';

import * as color from '../color.js';

import type { Color, ReadonlyColor } from '../_types/color.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/**
 * Exact comparison against float32-rounded expectations, so tests can use
 * natural literals like 0.1 without encoding the rounding by hand.
 */
function expectChannels(c: ReadonlyColor, r: number, g: number, b: number, a: number): void {
  expect([c[0], c[1], c[2], c[3]]).toEqual([
    Math.fround(r),
    Math.fround(g),
    Math.fround(b),
    Math.fround(a),
  ]);
}

/**
 * Test-only cast site: a Color view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBuffer, index: number): Color {
  return new Float32Array(buffer, index * FLOAT_BYTES, 4) as Color;
}

/** A buffer of `count` floats initialised to 1, 2, 3, ... so every slot is distinguishable. */
function sequentialBuffer(count: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * FLOAT_BYTES);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = i + 1;
  return buffer;
}

describe('create', () => {
  test('defaults colour channels to zero and alpha to opaque', () => {
    expectChannels(color.create(), 0, 0, 0, 1);
    expectChannels(color.create(1, 0, 0), 1, 0, 0, 1);
  });

  test('an explicit alpha overrides the default', () => {
    expectChannels(color.create(1, 0, 0, 0), 1, 0, 0, 0);
  });

  test('stores channels in r, g, b, a order', () => {
    expectChannels(color.create(0.1, 0.2, 0.3, 0.4), 0.1, 0.2, 0.3, 0.4);
  });

  test('rounds to float32', () => {
    expect(color.create(0.1)[0]).toBe(Math.fround(0.1));
    expect(color.create(0.1)[0]).not.toBe(0.1);
  });

  test('does not clamp, so HDR and negative values survive', () => {
    expectChannels(color.create(4, -1, 1.5, 2), 4, -1, 1.5, 2);
  });

  test('allocates a new buffer every call', () => {
    const a = color.create();
    const b = color.create();
    expect(a).not.toBe(b);
    expect(a.buffer).not.toBe(b.buffer);
    expect(a).toHaveLength(color.SIZE);
  });
});

describe('clone', () => {
  test('copies every channel into a new buffer', () => {
    const a = color.create(0.1, 0.2, 0.3, 0.4);
    const c = color.clone(a);

    expect(c).not.toBe(a);
    expect(c.buffer).not.toBe(a.buffer);
    expectChannels(c, 0.1, 0.2, 0.3, 0.4);
  });

  test('gives a mutable copy of a shared constant without touching it', () => {
    const c = color.clone(color.WHITE);
    c[0] = 0;

    expect(Array.from(color.WHITE)).toEqual([1, 1, 1, 1]);
  });

  test('snapshots a pooled view, so later writes to the pool do not show', () => {
    const pool = sequentialBuffer(8);
    const c = color.clone(viewAt(pool, 4));
    new Float32Array(pool).fill(0);

    expectChannels(c, 5, 6, 7, 8);
  });
});

describe('set', () => {
  test('writes channels in r, g, b, a order and returns out', () => {
    const out = color.create();
    const result = color.set(out, 0.1, 0.2, 0.3, 0.4);

    expect(result).toBe(out);
    expectChannels(out, 0.1, 0.2, 0.3, 0.4);
  });

  test('does not clamp', () => {
    expectChannels(color.set(color.create(), 4, -1, 1.5, 2), 4, -1, 1.5, 2);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    color.set(viewAt(pool, 4), 0, 0, 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 4, 0, 0, 0, 0, 9, 10, 11, 12]);
  });
});

describe('copy', () => {
  test('copies every channel and returns out', () => {
    const out = color.create();
    const result = color.copy(out, color.create(0.1, 0.2, 0.3, 0.4));

    expect(result).toBe(out);
    expectChannels(out, 0.1, 0.2, 0.3, 0.4);
  });

  test('copying a colour onto itself leaves it unchanged', () => {
    const c = color.create(0.1, 0.2, 0.3, 0.4);
    color.copy(c, c);

    expectChannels(c, 0.1, 0.2, 0.3, 0.4);
  });

  test('overlapping views: out one element ahead of input', () => {
    // Buffer [1, 2, 3, 4, 5]; input covers [0..3], out covers [1..4].
    const buffer = sequentialBuffer(5);
    color.copy(viewAt(buffer, 1), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([1, 1, 2, 3, 4]);
  });

  test('overlapping views: out one element behind input', () => {
    // Buffer [1, 2, 3, 4, 5]; input covers [1..4], out covers [0..3].
    const buffer = sequentialBuffer(5);
    color.copy(viewAt(buffer, 0), viewAt(buffer, 1));

    expect(Array.from(new Float32Array(buffer))).toEqual([2, 3, 4, 5, 5]);
  });
});

describe('isEqual', () => {
  test('colours with the same channels are equal', () => {
    expect(color.isEqual(color.create(0.1, 0.2, 0.3, 0.4), color.create(0.1, 0.2, 0.3, 0.4))).toBe(
      true
    );
  });

  test('a difference in any single channel, alpha included, makes them unequal', () => {
    const a = color.create(0.1, 0.2, 0.3, 0.4);
    for (let i = 0; i < color.SIZE; i++) {
      const b = color.clone(a);
      b[i] = 0.9;
      expect(color.isEqual(a, b)).toBe(false);
    }
  });

  test('is exact: a float32-sized difference is unequal', () => {
    expect(color.isEqual(color.create(0, 0, 0, 1), color.create(0, 0, 0, 1 + 2 ** -23))).toBe(
      false
    );
  });

  test('treats -0 and 0 as equal', () => {
    expect(color.isEqual(color.create(-0, 0, -0, 0), color.create(0, -0, 0, -0))).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const c = color.create(0, 0, 0, Number.NaN);
    expect(color.isEqual(c, c)).toBe(false);
  });
});

describe('isEqualEpsilon', () => {
  test('differences within the default tolerance are equal', () => {
    expect(
      color.isEqualEpsilon(color.create(1, 0, 0.5, 1), color.create(1 + 2 ** -23, 1e-7, 0.5, 1))
    ).toBe(true);
  });

  test('a difference beyond tolerance in any single channel makes them unequal', () => {
    const a = color.create(0.1, 0.2, 0.3, 0.4);
    const nudged = [
      color.create(0.101, 0.2, 0.3, 0.4),
      color.create(0.1, 0.201, 0.3, 0.4),
      color.create(0.1, 0.2, 0.301, 0.4),
      color.create(0.1, 0.2, 0.3, 0.401),
    ];
    for (const b of nudged) {
      expect(color.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('one 8-bit step as eps asks whether two colours look the same', () => {
    const a = color.create(0.5, 0.5, 0.5, 1);
    const b = color.create(0.5 + 0.5 / 255, 0.5, 0.5, 1);
    const c = color.create(0.5 + 2 / 255, 0.5, 0.5, 1);

    expect(color.isEqualEpsilon(a, b)).toBe(false);
    expect(color.isEqualEpsilon(a, b, 1 / 255)).toBe(true);
    expect(color.isEqualEpsilon(a, c, 1 / 255)).toBe(false);
  });

  test('tolerance widens for HDR channels above 1', () => {
    const a = color.create(1000, 0, 0, 1);
    const b = color.create(1000 + 5e-4, 0, 0, 1);

    expect(color.isEqual(a, b)).toBe(false);
    expect(color.isEqualEpsilon(a, b)).toBe(true);
  });

  test('infinite and NaN channels are never equal', () => {
    const inf = color.create(Infinity, 0, 0, 1);
    const nan = color.create(Number.NaN, 0, 0, 1);

    expect(color.isEqualEpsilon(inf, inf)).toBe(false);
    expect(color.isEqualEpsilon(nan, nan)).toBe(false);
  });
});

describe('isEqualRGB', () => {
  test('matches the values just written by set', () => {
    const c = color.set(color.create(), 0.1, 0.2, 0.3, 1);
    expect(c[0]).not.toBe(0.1);
    expect(color.isEqualRGB(c, 0.1, 0.2, 0.3)).toBe(true);
  });

  test('ignores alpha', () => {
    expect(color.isEqualRGB(color.RED, 1, 0, 0)).toBe(true);
    expect(color.isEqualRGB(color.create(1, 0, 0, 0), 1, 0, 0)).toBe(true);
  });

  test('a difference in any colour channel makes them unequal', () => {
    const c = color.create(0.1, 0.2, 0.3, 1);
    expect(color.isEqualRGB(c, 0.9, 0.2, 0.3)).toBe(false);
    expect(color.isEqualRGB(c, 0.1, 0.9, 0.3)).toBe(false);
    expect(color.isEqualRGB(c, 0.1, 0.2, 0.9)).toBe(false);
  });

  test('NaN is never equal', () => {
    expect(color.isEqualRGB(color.create(Number.NaN, 0, 0, 1), Number.NaN, 0, 0)).toBe(false);
  });
});

describe('isEqualRGBA', () => {
  test('matches the values just written by set', () => {
    const c = color.set(color.create(), 0.1, 0.2, 0.3, 0.4);
    expect(color.isEqualRGBA(c, 0.1, 0.2, 0.3, 0.4)).toBe(true);
  });

  test('a difference in any single channel, alpha included, makes them unequal', () => {
    const c = color.create(0.1, 0.2, 0.3, 0.4);
    expect(color.isEqualRGBA(c, 0.9, 0.2, 0.3, 0.4)).toBe(false);
    expect(color.isEqualRGBA(c, 0.1, 0.9, 0.3, 0.4)).toBe(false);
    expect(color.isEqualRGBA(c, 0.1, 0.2, 0.9, 0.4)).toBe(false);
    expect(color.isEqualRGBA(c, 0.1, 0.2, 0.3, 0.9)).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(color.isEqualRGBA(color.create(0, -0, 0, -0), -0, 0, -0, 0)).toBe(true);
  });

  test('NaN is never equal', () => {
    expect(color.isEqualRGBA(color.create(0, 0, 0, Number.NaN), 0, 0, 0, Number.NaN)).toBe(false);
  });
});

describe('lerp', () => {
  const from = color.create(0, 1, 0.2, 1);
  const to = color.create(1, 0, 0.6, 0.5);

  test('blends every channel from a towards b, and returns out', () => {
    const out = color.create();
    const result = color.lerp(out, from, to, 0.25);

    expect(result).toBe(out);
    expectChannels(out, 0.25, 0.75, 0.3, 0.875);
  });

  test('t of 0 gives a and t of 1 gives b, exactly', () => {
    expectChannels(color.lerp(color.create(), from, to, 0), from[0], from[1], from[2], from[3]);
    expectChannels(color.lerp(color.create(), from, to, 1), to[0], to[1], to[2], to[3]);
  });

  test('does not clamp t or the result, so it extrapolates past either end', () => {
    expectChannels(color.lerp(color.create(), color.BLACK, color.WHITE, 2), 2, 2, 2, 1);
    expectChannels(color.lerp(color.create(), color.BLACK, color.WHITE, -1), -1, -1, -1, 1);
  });

  test('interpolates alpha without premultiplying', () => {
    expectChannels(color.lerp(color.create(), color.RED, color.TRANSPARENT, 0.5), 0.5, 0, 0, 0.5);
  });

  test('out may be the same object as an input', () => {
    const a = color.create(0, 1, 0.2, 1);
    color.lerp(a, a, to, 0.25);
    expectChannels(a, 0.25, 0.75, 0.3, 0.875);

    const b = color.create(1, 0, 0.6, 0.5);
    color.lerp(b, from, b, 0.25);
    expectChannels(b, 0.25, 0.75, 0.3, 0.875);
  });

  test('overlapping views: out one element ahead of a', () => {
    // Buffer [1, 2, 3, 4, 5]; a covers [0..3], out covers [1..4].
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    color.lerp(out, viewAt(buffer, 0), color.create(11, 12, 13, 14), 0.5);

    expectChannels(out, 6, 7, 8, 9);
  });

  test('overlapping views: out one element behind a', () => {
    // Buffer [1, 2, 3, 4, 5]; a covers [1..4], out covers [0..3].
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    color.lerp(out, viewAt(buffer, 1), color.create(12, 13, 14, 15), 0.5);

    expectChannels(out, 7, 8, 9, 10);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(6);
    const out = viewAt(buffer, 1);
    color.lerp(out, viewAt(buffer, 0), viewAt(buffer, 2), 0.5);

    expectChannels(out, 2, 3, 4, 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    color.lerp(viewAt(pool, 4), color.BLACK, color.WHITE, 0.5);

    expect(Array.from(new Float32Array(pool))).toEqual([
      1, 2, 3, 4, 0.5, 0.5, 0.5, 1, 9, 10, 11, 12,
    ]);
  });
});

describe('constants', () => {
  test.each([
    ['WHITE', color.WHITE, [1, 1, 1, 1]],
    ['BLACK', color.BLACK, [0, 0, 0, 1]],
    ['RED', color.RED, [1, 0, 0, 1]],
    ['GREEN', color.GREEN, [0, 1, 0, 1]],
    ['BLUE', color.BLUE, [0, 0, 1, 1]],
    ['YELLOW', color.YELLOW, [1, 1, 0, 1]],
    ['CYAN', color.CYAN, [0, 1, 1, 1]],
    ['MAGENTA', color.MAGENTA, [1, 0, 1, 1]],
    ['TRANSPARENT', color.TRANSPARENT, [0, 0, 0, 0]],
  ] as const)('%s has the channels %j', (_name, value, channels) => {
    expect(Array.from(value)).toEqual(channels);
  });

  test('BLACK matches create() with no arguments', () => {
    expect(Array.from(color.create())).toEqual(Array.from(color.BLACK));
  });
});
