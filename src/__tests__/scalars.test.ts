// src/__tests__/scalars.test.ts
import { describe, expect, test } from 'vitest';

import { EPSILON } from '../constants.js';
import { clamp, isEqualEpsilon, round, saturate, snapToZero, wrap } from '../scalars.js';

describe('clamp', () => {
  test('leaves a value inside the range untouched', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test('pulls values back to the nearest bound', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  test('bounds are inclusive', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  test('handles a negative range', () => {
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  test('returns min when the bounds are passed the wrong way round', () => {
    // Documented behaviour rather than an error: the lower bound wins.
    expect(clamp(5, 10, 0)).toBe(10);
  });

  test('propagates NaN', () => {
    expect(clamp(Number.NaN, 0, 1)).toBeNaN();
  });
});

describe('saturate', () => {
  test('constrains to the unit range', () => {
    expect(saturate(-0.5)).toBe(0);
    expect(saturate(0.25)).toBe(0.25);
    expect(saturate(1.5)).toBe(1);
  });

  test('bounds are inclusive', () => {
    expect(saturate(0)).toBe(0);
    expect(saturate(1)).toBe(1);
  });
});

describe('round', () => {
  test('rounds to whole numbers by default', () => {
    expect(round(1.4)).toBe(1);
    expect(round(1.6)).toBe(2);
  });

  test('rounds to the requested number of decimals', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2355, 2)).toBe(1.24);
    expect(round(1.23456789, 4)).toBe(1.2346);
  });

  test('negative decimals round to the left of the point', () => {
    expect(round(1234, -2)).toBe(1200);
    expect(round(1250, -2)).toBe(1300);
  });

  test('halves round toward positive infinity, not away from zero', () => {
    expect(round(0.5)).toBe(1);
    expect(round(1.5)).toBe(2);
    expect(Object.is(round(-0.5), -0)).toBe(true);
    expect(round(-1.5)).toBe(-1);
  });

  test('a decimal that only looks like a half does not round up', () => {
    // 1.005 is stored as slightly less than 1.005, so this is 1, not 1.01.
    expect(round(1.005, 2)).toBe(1);
  });
});

describe('wrap', () => {
  test('leaves a value inside the range untouched', () => {
    expect(wrap(90, 0, 360)).toBe(90);
  });

  test('wraps values past the top back around', () => {
    expect(wrap(370, 0, 360)).toBe(10);
    expect(wrap(730, 0, 360)).toBe(10);
  });

  test('wraps negative values forward', () => {
    expect(wrap(-10, 0, 360)).toBe(350);
    expect(wrap(-370, 0, 360)).toBe(350);
  });

  test('max is exclusive and maps onto min', () => {
    expect(wrap(360, 0, 360)).toBe(0);
    expect(wrap(1, 0, 1)).toBe(0);
  });

  test('wraps into a range that does not start at zero', () => {
    expect(wrap(190, -180, 180)).toBe(-170);
    expect(wrap(-190, -180, 180)).toBe(170);
    expect(wrap(180, -180, 180)).toBe(-180);
  });

  test('works on fractional values and ranges', () => {
    expect(wrap(1.25, 0, 1)).toBe(0.25);
    expect(wrap(-0.25, 0, 1)).toBe(0.75);
  });

  test('wraps array indices against the length, not the last index', () => {
    const items = ['a', 'b', 'c'];
    expect(wrap(3, 0, items.length)).toBe(0);
    expect(wrap(-1, 0, items.length)).toBe(2);
    expect(items[wrap(4, 0, items.length)]).toBe('b');
  });

  test('returns NaN for a degenerate range', () => {
    expect(wrap(5, 5, 5)).toBeNaN();
  });
});

describe('snapToZero', () => {
  test('collapses values closer to zero than EPSILON', () => {
    expect(snapToZero(1e-9)).toBe(0);
    expect(snapToZero(-1e-9)).toBe(0);
  });

  test('leaves larger values untouched', () => {
    expect(snapToZero(0.5)).toBe(0.5);
    expect(snapToZero(-0.5)).toBe(-0.5);
  });

  test('the threshold is strict, so exactly EPSILON survives', () => {
    expect(snapToZero(EPSILON)).toBe(EPSILON);
    expect(snapToZero(EPSILON / 2)).toBe(0);
  });

  test('zero stays zero', () => {
    expect(snapToZero(0)).toBe(0);
  });
});

describe('isEqualEpsilon', () => {
  test('identical values are equal', () => {
    expect(isEqualEpsilon(1, 1)).toBe(true);
    expect(isEqualEpsilon(0, 0)).toBe(true);
  });

  test('values within tolerance are equal', () => {
    expect(isEqualEpsilon(1, 1 + 1e-9)).toBe(true);
    expect(isEqualEpsilon(0, 1e-9)).toBe(true);
  });

  test('values outside tolerance are not', () => {
    expect(isEqualEpsilon(0, 0.1)).toBe(false);
    expect(isEqualEpsilon(1, 1.1)).toBe(false);
  });

  test('the boundary is inclusive', () => {
    // Near unit scale the scale factor is 1, so the tolerance is exactly eps.
    expect(isEqualEpsilon(0, EPSILON)).toBe(true);
  });

  test('tolerance scales with magnitude', () => {
    // Two adjacent float32 values near 10,000 are ~0.001 apart: far beyond an
    // absolute 1e-6, but well inside a relative one.
    const a = Math.fround(10000.5);
    const b = Math.fround(10000.5 + 0.001);

    expect(a).not.toBe(b);
    expect(isEqualEpsilon(a, b)).toBe(true);
    expect(Math.abs(a - b)).toBeGreaterThan(EPSILON);
  });

  test('still separates genuinely different large values', () => {
    expect(isEqualEpsilon(10000, 10001)).toBe(false);
  });

  test('accepts a custom tolerance', () => {
    expect(isEqualEpsilon(0, 0.05, 0.1)).toBe(true);
    expect(isEqualEpsilon(0, 0.5, 0.1)).toBe(false);
  });

  test('returns false for NaN', () => {
    expect(isEqualEpsilon(Number.NaN, 0)).toBe(false);
  });

  test('returns false for Infinity', () => {
    expect(isEqualEpsilon(Infinity, 0)).toBe(false);
  });

  test('returns false for -Infinity', () => {
    expect(isEqualEpsilon(-Infinity, 0)).toBe(false);
  });
});
