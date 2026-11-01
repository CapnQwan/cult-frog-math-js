import { describe, expect, test } from 'vitest';

import { smootherstep, smoothstep } from '../smooth.js';

describe('smoothstep', () => {
  test('applies the Hermite S-curve, not a linear ramp', () => {
    // A linear ramp would return 0.25 here.
    expect(smoothstep(0.25)).toBe(0.15625);
    expect(smoothstep(0.75)).toBe(0.84375);
  });

  test('lands exactly on both endpoints and the midpoint', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(1)).toBe(1);
  });

  test('never decreases across the unit range', () => {
    for (let i = 1; i <= 100; i++) {
      expect(smoothstep(i / 100)).toBeGreaterThanOrEqual(smoothstep((i - 1) / 100));
    }
  });

  test('eases: the slope is flat at both ends', () => {
    // This is the reason to prefer it over a linear ramp. A linear ramp would
    // have a slope of 1 everywhere; the curve's is ~0 at the edges.
    const h = 1e-4;
    const slopeAtStart = (smoothstep(h) - smoothstep(0)) / h;
    const slopeAtEnd = (smoothstep(1) - smoothstep(1 - h)) / h;

    expect(slopeAtStart).toBeLessThan(0.01);
    expect(slopeAtEnd).toBeLessThan(0.01);
  });

  test('still accelerates suddenly at the start', () => {
    // The non-zero curvature here is what `smootherstep` removes.
    const h = 1e-3;
    expect((smoothstep(h) - 2 * smoothstep(0) + smoothstep(-h)) / (h * h)).toBeCloseTo(6, 5);
  });

  test('is symmetric about the midpoint', () => {
    expect(smoothstep(0.3) + smoothstep(0.7)).toBeCloseTo(1, 12);
  });

  test('does not clamp, and turns back outside the unit range', () => {
    expect(smoothstep(-1)).toBe(5);
    expect(smoothstep(2)).toBe(-4);
  });

  test('propagates NaN', () => {
    expect(smoothstep(Number.NaN)).toBeNaN();
  });
});

describe('smootherstep', () => {
  test('lands exactly on both endpoints and the midpoint', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(0.5)).toBe(0.5);
    expect(smootherstep(1)).toBe(1);
  });

  test('matches a known value', () => {
    expect(smootherstep(0.25)).toBe(0.103515625);
  });

  test('never decreases across the unit range', () => {
    for (let i = 1; i <= 100; i++) {
      expect(smootherstep(i / 100)).toBeGreaterThanOrEqual(smootherstep((i - 1) / 100));
    }
  });

  test('is flat at both ends', () => {
    const h = 1e-6;
    expect((smootherstep(h) - smootherstep(0)) / h).toBeCloseTo(0, 5);
    expect((smootherstep(1) - smootherstep(1 - h)) / h).toBeCloseTo(0, 5);
  });

  test('has no acceleration at the start', () => {
    // Zero curvature at the ends is what sets this apart from `smoothstep`.
    const h = 1e-3;
    expect((smootherstep(h) - 2 * smootherstep(0) + smootherstep(-h)) / (h * h)).toBeCloseTo(0, 3);
  });

  test('is symmetric around the midpoint', () => {
    expect(smootherstep(0.3) + smootherstep(0.7)).toBeCloseTo(1, 12);
  });

  test('does not clamp outside the unit range', () => {
    expect(smootherstep(-1)).toBe(-31);
    expect(smootherstep(2)).toBe(32);
  });

  test('propagates NaN', () => {
    expect(smootherstep(Number.NaN)).toBeNaN();
  });
});
