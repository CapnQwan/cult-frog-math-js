import { describe, expect, test } from 'vitest';

import * as Easing from '../easing.js';
import { Easing as IndexEasing } from '../index.js';

const powerFamilies = [
  ['Quad', Easing.Quad],
  ['Cubic', Easing.Cubic],
  ['Quart', Easing.Quart],
  ['Quint', Easing.Quint],
] as const;

describe('Easing', () => {
  test('exposes one namespace per family', () => {
    expect(Object.keys(Easing).sort()).toEqual(['Cubic', 'Quad', 'Quart', 'Quint', 'Smooth']);
  });

  test('the index exports the same namespaces', () => {
    expect(IndexEasing.Cubic).toBe(Easing.Cubic);
    expect(IndexEasing.Smooth).toBe(Easing.Smooth);
  });

  test.each(powerFamilies)('%s has the three power curves, each taking t', (_name, family) => {
    expect(Object.keys(family).sort()).toEqual(['easeIn', 'easeInOut', 'easeOut']);
    expect(family.easeIn).toHaveLength(1);
    expect(family.easeOut).toHaveLength(1);
    expect(family.easeInOut).toHaveLength(1);
  });

  test('the families grow more pronounced with their exponent', () => {
    expect(Easing.Quad.easeIn(0.5)).toBeGreaterThan(Easing.Cubic.easeIn(0.5));
    expect(Easing.Cubic.easeIn(0.5)).toBeGreaterThan(Easing.Quart.easeIn(0.5));
    expect(Easing.Quart.easeIn(0.5)).toBeGreaterThan(Easing.Quint.easeIn(0.5));
  });

  test('Smooth has the two smoothstep curves, each taking t', () => {
    expect(Object.keys(Easing.Smooth).sort()).toEqual(['smootherstep', 'smoothstep']);
    expect(Easing.Smooth.smoothstep).toHaveLength(1);
    expect(Easing.Smooth.smootherstep).toHaveLength(1);
  });
});
