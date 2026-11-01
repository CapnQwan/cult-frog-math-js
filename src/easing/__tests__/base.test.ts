import { describe, expect, test } from 'vitest';

import { easeIn, easeInOut, easeOut } from '../base.js';

// Fractional and out-of-family exponents, alongside the ones the families use.
const exponents = [1, 1.5, 2, 2.5, 3, 4, 5, 8];

describe.each(exponents)('at exponent %d', (exponent) => {
  const curves = [
    ['easeIn', easeIn(exponent)],
    ['easeOut', easeOut(exponent)],
    ['easeInOut', easeInOut(exponent)],
  ] as const;

  test.each(curves)('%s lands exactly on both endpoints', (_name, ease) => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  test.each(curves)('%s never decreases across the unit range', (_name, ease) => {
    for (let i = 1; i <= 100; i++) {
      expect(ease(i / 100)).toBeGreaterThanOrEqual(ease((i - 1) / 100));
    }
  });

  test('easeOut mirrors easeIn', () => {
    expect(easeOut(exponent)(0.3)).toBeCloseTo(1 - easeIn(exponent)(0.7), 12);
  });

  test('easeInOut has no jump where its halves meet', () => {
    const ease = easeInOut(exponent);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(0.5 - 1e-9)).toBeCloseTo(0.5, 6);
    expect(ease(0.5 + 1e-9)).toBeCloseTo(0.5, 6);
  });

  test('easeInOut is symmetric about the midpoint', () => {
    const ease = easeInOut(exponent);
    expect(ease(0.3) + ease(0.7)).toBeCloseTo(1, 12);
  });

  test('easeInOut is easeIn and easeOut squeezed into each half', () => {
    const ease = easeInOut(exponent);
    expect(ease(0.2)).toBeCloseTo(easeIn(exponent)(0.4) / 2, 12);
    expect(ease(0.8)).toBeCloseTo(0.5 + easeOut(exponent)(0.6) / 2, 12);
  });
});

describe('exponent 1', () => {
  test('every curve is a straight line', () => {
    expect(easeIn(1)(0.3)).toBe(0.3);
    expect(easeOut(1)(0.25)).toBe(0.25);
    expect(easeInOut(1)(0.25)).toBe(0.25);
    expect(easeInOut(1)(0.75)).toBe(0.75);
  });
});

describe('exponents the curves do not support', () => {
  test('exponent 0 loses the endpoints', () => {
    // Documented: `0 ** 0` is 1.
    expect(easeIn(0)(0)).toBe(1);
    expect(easeOut(0)(1)).toBe(0);
    expect(easeInOut(0)(0)).toBe(0.5);
    expect(easeInOut(0)(1)).toBe(0.5);
  });

  test('a negative exponent gives an infinity at the ends', () => {
    expect(easeIn(-1)(0)).toBe(Number.POSITIVE_INFINITY);
    expect(easeOut(-1)(1)).toBe(Number.NEGATIVE_INFINITY);
    expect(easeInOut(-1)(0)).toBe(Number.POSITIVE_INFINITY);
    expect(easeInOut(-1)(1)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('outside the unit range', () => {
  test('an even exponent folds back', () => {
    expect(easeIn(2)(-1)).toBe(1);
    expect(easeOut(2)(2)).toBe(0);
    expect(easeInOut(2)(-1)).toBe(2);
  });

  test('an odd exponent keeps going', () => {
    expect(easeIn(3)(-1)).toBe(-1);
    expect(easeOut(3)(2)).toBe(2);
    expect(easeInOut(3)(-1)).toBe(-4);
  });

  test('a fractional exponent gives NaN', () => {
    expect(easeIn(2.5)(-1)).toBeNaN();
    expect(easeOut(2.5)(2)).toBeNaN();
    expect(easeInOut(2.5)(-1)).toBeNaN();
    expect(easeInOut(2.5)(2)).toBeNaN();
  });
});
