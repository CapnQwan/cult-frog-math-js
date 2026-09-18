// src/__tests__/scalars.test.ts
import { describe, expect, test } from 'vitest';

import { EPSILON } from '../constants.js';
import {
  clamp,
  equalsEpsilon,
  lerp,
  round,
  saturate,
  smoothstep,
  snapToZero,
  wrap,
} from '../scalars.js';

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

describe('lerp', () => {
  test('returns a exactly at t = 0', () => {
    expect(lerp(2, 8, 0)).toBe(2);
    expect(lerp(1e16, 1e-16, 0)).toBe(1e16);
  });

  test('interpolates between the endpoints', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(lerp(-5, 5, 0.5)).toBe(0);
  });

  test('extrapolates outside [0, 1] rather than clamping', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
    expect(lerp(0, 10, -0.5)).toBe(-5);
  });

  test('lands on b exactly when both endpoints are near unit scale', () => {
    expect(lerp(0.1, 0.3, 1)).toBe(0.3);
    expect(lerp(-5, 5, 1)).toBe(5);
  });

  test('does not land on b exactly when the magnitudes differ', () => {
    // The documented cost of the fast `a + (b - a) * t` form: the subtraction
    // loses precision, so t = 1 is not an exact endpoint in general. Use
    // `(1 - t) * a + t * b` where that matters.
    expect(lerp(100, 0.1, 1)).not.toBe(0.1);
    expect(lerp(100, 0.1, 1)).toBeCloseTo(0.1, 10);
    expect(lerp(1e16, 1, 1)).toBe(0);
  });
});

describe('smoothstep', () => {
  test('applies the Hermite S-curve, not a linear ramp', () => {
    // A linear remap would return 0.25 here.
    expect(smoothstep(0, 1, 0.25)).toBe(0.15625);
    expect(smoothstep(0, 1, 0.75)).toBe(0.84375);
  });

  test('passes through the endpoints and the midpoint', () => {
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 1)).toBe(1);
  });

  test('clamps outside the range', () => {
    expect(smoothstep(0, 1, -5)).toBe(0);
    expect(smoothstep(0, 1, 5)).toBe(1);
  });

  test('eases: the slope is flat at both ends', () => {
    // This is the reason to prefer it over a linear remap. A linear ramp would
    // have a slope of 1 everywhere; the curve's is ~0 at the edges.
    const h = 1e-4;
    const slopeAtStart = (smoothstep(0, 1, h) - smoothstep(0, 1, 0)) / h;
    const slopeAtEnd = (smoothstep(0, 1, 1) - smoothstep(0, 1, 1 - h)) / h;

    expect(slopeAtStart).toBeLessThan(0.01);
    expect(slopeAtEnd).toBeLessThan(0.01);
  });

  test('is symmetric about the midpoint', () => {
    expect(smoothstep(0, 1, 0.3) + smoothstep(0, 1, 0.7)).toBeCloseTo(1, 12);
  });

  test('remaps an arbitrary range, taking edges first and the value last', () => {
    // Parameter order matches the GLSL intrinsic, not clamp's (value, min, max).
    expect(smoothstep(10, 20, 15)).toBe(0.5);
    expect(smoothstep(10, 20, 10)).toBe(0);
    expect(smoothstep(10, 20, 20)).toBe(1);
  });

  test('returns NaN for a degenerate range', () => {
    expect(smoothstep(5, 5, 5)).toBeNaN();
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

describe('equalsEpsilon', () => {
  test('identical values are equal', () => {
    expect(equalsEpsilon(1, 1)).toBe(true);
    expect(equalsEpsilon(0, 0)).toBe(true);
  });

  test('values within tolerance are equal', () => {
    expect(equalsEpsilon(1, 1 + 1e-9)).toBe(true);
    expect(equalsEpsilon(0, 1e-9)).toBe(true);
  });

  test('values outside tolerance are not', () => {
    expect(equalsEpsilon(0, 0.1)).toBe(false);
    expect(equalsEpsilon(1, 1.1)).toBe(false);
  });

  test('the boundary is inclusive', () => {
    // Near unit scale the scale factor is 1, so the tolerance is exactly eps.
    expect(equalsEpsilon(0, EPSILON)).toBe(true);
  });

  test('tolerance scales with magnitude', () => {
    // Two adjacent float32 values near 10,000 are ~0.001 apart: far beyond an
    // absolute 1e-6, but well inside a relative one.
    const a = Math.fround(10000.5);
    const b = Math.fround(10000.5 + 0.001);

    expect(a).not.toBe(b);
    expect(equalsEpsilon(a, b)).toBe(true);
    expect(Math.abs(a - b)).toBeGreaterThan(EPSILON);
  });

  test('still separates genuinely different large values', () => {
    expect(equalsEpsilon(10000, 10001)).toBe(false);
  });

  test('accepts a custom tolerance', () => {
    expect(equalsEpsilon(0, 0.05, 0.1)).toBe(true);
    expect(equalsEpsilon(0, 0.5, 0.1)).toBe(false);
  });
});
