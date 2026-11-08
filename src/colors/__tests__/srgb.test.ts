// src/colors/__tests__/srgb.test.ts
import { describe, expect, test } from 'vitest';

import { linearToSrgb, srgbToLinear } from '../srgb.js';

/** Every 8-bit channel value, scaled to 0–1. */
const BYTES = Array.from({ length: 256 }, (_, v) => v / 255);

describe('srgbToLinear', () => {
  test('0 and 1 map to themselves', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBe(1);
  });

  test('decodes the 8-bit midpoint to about a fifth of the light', () => {
    expect(srgbToLinear(128 / 255)).toBeCloseTo(0.21586, 5);
  });

  test('uses the straight toe segment near black', () => {
    expect(srgbToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 15);
  });

  test('the toe and the power segment meet without a visible jump', () => {
    expect(Math.abs(srgbToLinear(0.04045) - srgbToLinear(0.04045 + 1e-12))).toBeLessThan(1e-7);
  });

  test('increases strictly across every 8-bit value', () => {
    for (let v = 1; v < BYTES.length; v++) {
      expect(srgbToLinear(BYTES[v] as number)).toBeGreaterThan(
        srgbToLinear(BYTES[v - 1] as number)
      );
    }
  });

  test('does not clamp', () => {
    expect(srgbToLinear(-0.5)).toBeCloseTo(-0.5 / 12.92, 15);
    expect(srgbToLinear(2)).toBeGreaterThan(1);
  });
});

describe('linearToSrgb', () => {
  test('0 and 1 map to themselves', () => {
    expect(linearToSrgb(0)).toBe(0);
    expect(linearToSrgb(1)).toBeCloseTo(1, 15);
  });

  test('encodes half the light as 188 in 8 bits', () => {
    expect(Math.round(linearToSrgb(0.5) * 255)).toBe(188);
  });

  test('uses the straight toe segment near black', () => {
    expect(linearToSrgb(0.003)).toBeCloseTo(0.003 * 12.92, 15);
  });

  test('the toe and the power segment meet without a visible jump', () => {
    expect(Math.abs(linearToSrgb(0.0031308) - linearToSrgb(0.0031308 + 1e-12))).toBeLessThan(1e-7);
  });

  test('does not clamp', () => {
    expect(linearToSrgb(-0.1)).toBeCloseTo(-0.1 * 12.92, 15);
    expect(linearToSrgb(2)).toBeGreaterThan(1);
  });
});

describe('round trips', () => {
  test('encoding undoes decoding for every 8-bit value', () => {
    for (const c of BYTES) {
      expect(linearToSrgb(srgbToLinear(c))).toBeCloseTo(c, 12);
    }
  });

  test('every 8-bit value comes back as the same byte', () => {
    for (let v = 0; v < BYTES.length; v++) {
      expect(Math.round(linearToSrgb(srgbToLinear(BYTES[v] as number)) * 255)).toBe(v);
    }
  });
});
