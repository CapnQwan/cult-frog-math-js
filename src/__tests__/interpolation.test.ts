// src/__tests__/interpolation.test.ts
import { describe, expect, test } from 'vitest';

import { invLerp, lerp } from '../interpolation.js';

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

describe('invLerp', () => {
  test('finds the position of a value inside the range', () => {
    expect(invLerp(0, 10, 5)).toBe(0.5);
    expect(invLerp(0, 10, 2.5)).toBe(0.25);
    expect(invLerp(10, 20, 15)).toBe(0.5);
    expect(invLerp(-5, 5, 0)).toBe(0.5);
  });

  test('returns exactly 0 and 1 at the bounds', () => {
    expect(invLerp(10, 20, 10)).toBe(0);
    expect(invLerp(10, 20, 20)).toBe(1);
  });

  test('clamps outside the range, unlike lerp', () => {
    expect(invLerp(0, 10, -5)).toBe(0);
    expect(invLerp(0, 10, 15)).toBe(1);
  });

  test('undoes lerp for a value inside the range', () => {
    expect(invLerp(2, 8, lerp(2, 8, 0.25))).toBeCloseTo(0.25, 12);
    expect(lerp(2, 8, invLerp(2, 8, 3.5))).toBeCloseTo(3.5, 12);
  });

  test('does not undo lerp for a value outside the range', () => {
    // The documented cost of clamping: the overshoot is lost.
    expect(lerp(0, 10, invLerp(0, 10, 15))).toBe(10);
  });

  test('gives a descending ramp when the bounds are reversed', () => {
    expect(invLerp(10, 0, 2.5)).toBe(0.75);
    expect(invLerp(10, 0, 10)).toBe(0);
    expect(invLerp(10, 0, 0)).toBe(1);
    expect(invLerp(10, 0, 15)).toBe(0);
    expect(invLerp(10, 0, -5)).toBe(1);
  });

  test('takes the edges first and the value last', () => {
    // Parameter order matches the GLSL smoothstep, not clamp's (value, min, max).
    expect(invLerp(0, 4, 1)).toBe(0.25);
  });

  test('is inconsistent for a degenerate range', () => {
    // Documented rather than guarded: 0 / 0 is NaN, and +-Infinity clamps.
    expect(invLerp(5, 5, 5)).toBeNaN();
    expect(invLerp(5, 5, 6)).toBe(1);
    expect(invLerp(5, 5, 4)).toBe(0);
  });

  test('propagates NaN', () => {
    expect(invLerp(0, 10, Number.NaN)).toBeNaN();
  });
});
