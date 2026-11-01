import { describe, expect, test } from 'vitest';

import { easeIn, easeInOut, easeOut } from '../cubic.js';
import { smoothstep } from '../smooth.js';

const h = 1e-6;

describe('easeIn', () => {
  test('matches known values', () => {
    expect(easeIn(0.25)).toBe(0.015625);
    expect(easeIn(0.5)).toBe(0.125);
    expect(easeIn(0.75)).toBe(0.421875);
  });

  test('starts flat and ends steep', () => {
    expect((easeIn(h) - easeIn(0)) / h).toBeCloseTo(0, 4);
    expect((easeIn(1) - easeIn(1 - h)) / h).toBeCloseTo(3, 4);
  });

  test('does not clamp outside the unit range', () => {
    expect(easeIn(-1)).toBe(-1);
    expect(easeIn(2)).toBe(8);
  });
});

describe('easeOut', () => {
  test('matches known values', () => {
    expect(easeOut(0.25)).toBe(0.578125);
    expect(easeOut(0.5)).toBe(0.875);
    expect(easeOut(0.75)).toBe(0.984375);
  });

  test('starts steep and ends flat', () => {
    expect((easeOut(h) - easeOut(0)) / h).toBeCloseTo(3, 4);
    expect((easeOut(1) - easeOut(1 - h)) / h).toBeCloseTo(0, 4);
  });

  test('does not clamp outside the unit range', () => {
    expect(easeOut(-1)).toBe(-7);
    expect(easeOut(2)).toBe(2);
  });
});

describe('easeInOut', () => {
  test('matches known values on each side of the midpoint', () => {
    expect(easeInOut(0.25)).toBe(0.0625);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(0.75)).toBe(0.9375);
  });

  test('is flat at both ends', () => {
    expect((easeInOut(h) - easeInOut(0)) / h).toBeCloseTo(0, 4);
    expect((easeInOut(1) - easeInOut(1 - h)) / h).toBeCloseTo(0, 4);
  });

  test('is a different curve from smoothstep', () => {
    expect(easeInOut(0.25)).toBe(0.0625);
    expect(smoothstep(0.25)).toBe(0.15625);
  });

  test('does not clamp outside the unit range', () => {
    expect(easeInOut(-1)).toBe(-4);
    expect(easeInOut(2)).toBe(5);
  });
});
