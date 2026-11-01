import { describe, expect, test } from 'vitest';

import { easeIn, easeInOut, easeOut } from '../quint.js';
import { smootherstep } from '../smooth.js';

const h = 1e-6;

describe('easeIn', () => {
  test('matches known values', () => {
    expect(easeIn(0.25)).toBe(0.0009765625);
    expect(easeIn(0.5)).toBe(0.03125);
    expect(easeIn(0.75)).toBe(0.2373046875);
  });

  test('starts flat and ends steep', () => {
    expect((easeIn(h) - easeIn(0)) / h).toBeCloseTo(0, 4);
    expect((easeIn(1) - easeIn(1 - h)) / h).toBeCloseTo(5, 4);
  });

  test('does not clamp outside the unit range', () => {
    expect(easeIn(-1)).toBe(-1);
    expect(easeIn(2)).toBe(32);
  });
});

describe('easeOut', () => {
  test('matches known values', () => {
    expect(easeOut(0.25)).toBe(0.7626953125);
    expect(easeOut(0.5)).toBe(0.96875);
    expect(easeOut(0.75)).toBe(0.9990234375);
  });

  test('starts steep and ends flat', () => {
    expect((easeOut(h) - easeOut(0)) / h).toBeCloseTo(5, 4);
    expect((easeOut(1) - easeOut(1 - h)) / h).toBeCloseTo(0, 4);
  });

  test('does not clamp outside the unit range', () => {
    expect(easeOut(-1)).toBe(-31);
    expect(easeOut(2)).toBe(2);
  });
});

describe('easeInOut', () => {
  test('matches known values on each side of the midpoint', () => {
    expect(easeInOut(0.25)).toBe(0.015625);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(easeInOut(0.75)).toBe(0.984375);
  });

  test('is flat at both ends', () => {
    expect((easeInOut(h) - easeInOut(0)) / h).toBeCloseTo(0, 4);
    expect((easeInOut(1) - easeInOut(1 - h)) / h).toBeCloseTo(0, 4);
  });

  test('is a different curve from smootherstep', () => {
    expect(easeInOut(0.25)).toBe(0.015625);
    expect(smootherstep(0.25)).toBe(0.103515625);
  });

  test('does not clamp outside the unit range', () => {
    expect(easeInOut(-1)).toBe(-16);
    expect(easeInOut(2)).toBe(17);
  });
});
