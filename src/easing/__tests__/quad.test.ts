import { describe, expect, test } from 'vitest';

import { easeIn, easeInOut, easeOut } from '../quad.js';

const h = 1e-6;

describe('easeIn', () => {
  test('matches known values', () => {
    expect(easeIn(0.25)).toBe(0.0625);
    expect(easeIn(0.5)).toBe(0.25);
    expect(easeIn(0.75)).toBe(0.5625);
  });

  test('starts flat and ends steep', () => {
    expect((easeIn(h) - easeIn(0)) / h).toBeCloseTo(0, 4);
    expect((easeIn(1) - easeIn(1 - h)) / h).toBeCloseTo(2, 4);
  });

  test('does not clamp, and folds back below the range', () => {
    expect(easeIn(-1)).toBe(1);
    expect(easeIn(2)).toBe(4);
  });
});

describe('easeOut', () => {
  test('matches known values', () => {
    expect(easeOut(0.25)).toBe(0.4375);
    expect(easeOut(0.5)).toBe(0.75);
    expect(easeOut(0.75)).toBe(0.9375);
  });

  test('starts steep and ends flat', () => {
    expect((easeOut(h) - easeOut(0)) / h).toBeCloseTo(2, 4);
    expect((easeOut(1) - easeOut(1 - h)) / h).toBeCloseTo(0, 4);
  });

  test('does not clamp, and folds back above the range', () => {
    expect(easeOut(-1)).toBe(-3);
    expect(easeOut(2)).toBe(0);
  });
});

describe('easeInOut', () => {
  test('matches known values on each side of the midpoint', () => {
    expect(easeInOut(0.25)).toBe(0.125);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(0.75)).toBe(0.875);
  });

  test('is flat at both ends', () => {
    expect((easeInOut(h) - easeInOut(0)) / h).toBeCloseTo(0, 4);
    expect((easeInOut(1) - easeInOut(1 - h)) / h).toBeCloseTo(0, 4);
  });

  test('does not clamp, and folds back outside the range', () => {
    expect(easeInOut(-1)).toBe(2);
    expect(easeInOut(2)).toBe(-1);
  });
});
