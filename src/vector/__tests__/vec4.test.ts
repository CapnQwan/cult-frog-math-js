// src/vector/__tests__/vec4.test.ts
import { describe, expect, test } from 'vitest';

import * as vec4 from '../vec4.js';

import type { ReadonlyVec4, Vec4 } from '../_types/vec4.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/**
 * Exact comparison against float32-rounded expectations, so tests can use
 * natural literals like 0.1 without encoding the rounding by hand.
 */
function expectComponents(v: ReadonlyVec4, x: number, y: number, z: number, w: number): void {
  expect([v[0], v[1], v[2], v[3]]).toEqual([
    Math.fround(x),
    Math.fround(y),
    Math.fround(z),
    Math.fround(w),
  ]);
}

/**
 * Test-only cast site: a Vec4 view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBuffer, index: number): Vec4 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 4) as Vec4;
}

/** A buffer of `count` floats initialised to 1, 2, 3, ... so every slot is distinguishable. */
function sequentialBuffer(count: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * FLOAT_BYTES);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = i + 1;
  return buffer;
}

describe('create', () => {
  test('defaults every component to zero', () => {
    expectComponents(vec4.create(), 0, 0, 0, 0);
  });

  test('stores provided components in x, y, z, w order', () => {
    expectComponents(vec4.create(1, 2, 3, 4), 1, 2, 3, 4);
  });

  test('w is the last slot, matching GLSL/WGSL vec4', () => {
    const v = vec4.create(0, 0, 0, 1);
    expect(v[3]).toBe(1);
    expect(v[0]).toBe(0);
  });

  test('defaults only the omitted components', () => {
    expectComponents(vec4.create(5), 5, 0, 0, 0);
    expectComponents(vec4.create(5, 6), 5, 6, 0, 0);
    expectComponents(vec4.create(5, 6, 7), 5, 6, 7, 0);
  });

  test('rounds components to float32', () => {
    const v = vec4.create(0.1, 0, 0, 0);
    expect(v[0]).not.toBe(0.1);
    expect(v[0]).toBe(Math.fround(0.1));
  });

  test('allocates a standalone four-element buffer', () => {
    const v = vec4.create();
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(4);
    expect(v.byteOffset).toBe(0);
    expect(v.buffer.byteLength).toBe(4 * FLOAT_BYTES);
  });
});

describe('clone', () => {
  test('copies components into a new vector with its own buffer', () => {
    const source = vec4.create(1, 2, 3, 4);
    const result = vec4.clone(source);

    expectComponents(result, 1, 2, 3, 4);
    expect(result).not.toBe(source);
    expect(result.buffer).not.toBe(source.buffer);
  });

  test('round-trips float32 values exactly', () => {
    const source = vec4.create(0.1, -0.7, 1e-7, 3.3);
    const result = vec4.clone(source);

    expect(result[0]).toBe(source[0]);
    expect(result[1]).toBe(source[1]);
    expect(result[2]).toBe(source[2]);
    expect(result[3]).toBe(source[3]);
  });

  test('result and source are independent after cloning', () => {
    const source = vec4.create(1, 2, 3, 4);
    const result = vec4.clone(source);

    vec4.set(source, 9, 9, 9, 9);
    expectComponents(result, 1, 2, 3, 4);

    vec4.set(result, 5, 6, 7, 8);
    expectComponents(source, 9, 9, 9, 9);
  });

  test('accepts a readonly input', () => {
    const frozen: ReadonlyVec4 = vec4.create(1, 2, 3, 4);
    expectComponents(vec4.clone(frozen), 1, 2, 3, 4);
  });

  test('cloning a pooled view produces a standalone vector', () => {
    const pool = sequentialBuffer(12);
    const view = viewAt(pool, 4);
    const snapshot = vec4.clone(view);

    expect(snapshot.buffer).not.toBe(pool);
    expect(snapshot.byteOffset).toBe(0);
    expect(snapshot.buffer.byteLength).toBe(4 * FLOAT_BYTES);

    // The owning system writes to the pool; the snapshot must not move.
    vec4.set(view, 0, 0, 0, 0);
    expectComponents(snapshot, 5, 6, 7, 8);
  });
});

describe('set', () => {
  test('writes components and returns out', () => {
    const out = vec4.create();
    const result = vec4.set(out, 1, 2, 3, 4);

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3, 4);
  });

  test('overwrites existing values', () => {
    const out = vec4.create(7, 8, 9, 10);
    vec4.set(out, -1, 0, 1, 2);
    expectComponents(out, -1, 0, 1, 2);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.set(viewAt(pool, 4), 0, 0, 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 4, 0, 0, 0, 0, 9, 10, 11, 12]);
  });
});

describe('copy', () => {
  test('copies components and returns out', () => {
    const out = vec4.create();
    const source = vec4.create(1, 2, 3, 4);
    const result = vec4.copy(out, source);

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3, 4);
  });

  test('never writes to the input', () => {
    const out = vec4.create(7, 8, 9, 10);
    const source = vec4.create(1, 2, 3, 4);
    vec4.copy(out, source);
    expectComponents(source, 1, 2, 3, 4);
  });

  test('supports chaining through nested calls', () => {
    const a = vec4.create();
    const b = vec4.create();
    vec4.copy(b, vec4.set(a, 1, 2, 3, 4));
    expectComponents(b, 1, 2, 3, 4);
  });

  test('out === input is a no-op', () => {
    const v = vec4.create(1, 2, 3, 4);
    vec4.copy(v, v);
    expectComponents(v, 1, 2, 3, 4);
  });

  test('overlapping views: out one element ahead of input', () => {
    // Buffer [1, 2, 3, 4, 5]; input covers [0..3], out covers [1..4].
    const buffer = sequentialBuffer(5);
    vec4.copy(viewAt(buffer, 1), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([1, 1, 2, 3, 4]);
  });

  test('overlapping views: out one element behind input', () => {
    // Buffer [1, 2, 3, 4, 5]; input covers [1..4], out covers [0..3].
    const buffer = sequentialBuffer(5);
    vec4.copy(viewAt(buffer, 0), viewAt(buffer, 1));

    expect(Array.from(new Float32Array(buffer))).toEqual([2, 3, 4, 5, 5]);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.copy(viewAt(pool, 4), vec4.create(0, 0, 0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 4, 0, 0, 0, 0, 9, 10, 11, 12]);
  });
});

describe('isEqual', () => {
  test('vectors with the same components are equal', () => {
    expect(vec4.isEqual(vec4.create(1, 2, 3, 4), vec4.create(1, 2, 3, 4))).toBe(true);
  });

  test('a vector equals itself', () => {
    const v = vec4.create(1, 2, 3, 4);
    expect(vec4.isEqual(v, v)).toBe(true);
  });

  test('a difference in any single component makes them unequal', () => {
    const a = vec4.create(1, 2, 3, 4);
    for (let i = 0; i < 4; i++) {
      const b = vec4.clone(a);
      b[i] = 99;
      expect(vec4.isEqual(a, b)).toBe(false);
    }
  });

  test('is exact: a float32-sized difference is unequal', () => {
    expect(vec4.isEqual(vec4.create(0, 0, 0, 1), vec4.create(0, 0, 0, 1 + 2 ** -23))).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(vec4.isEqual(vec4.create(-0, 0, -0, 0), vec4.create(0, -0, 0, -0))).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const v = vec4.create(0, 0, 0, Number.NaN);
    expect(vec4.isEqual(v, v)).toBe(false);
  });

  test('compares only the slots of each view', () => {
    // Buffer [1, 2, 3, 4, 1, 2, 3, 4]; views at 0 and 4 hold the same components.
    const buffer = new Float32Array([1, 2, 3, 4, 1, 2, 3, 4]).buffer;
    expect(vec4.isEqual(viewAt(buffer, 0), viewAt(buffer, 4))).toBe(true);
    expect(vec4.isEqual(viewAt(buffer, 0), viewAt(buffer, 1))).toBe(false);
  });

  test('accepts readonly inputs', () => {
    const frozen: ReadonlyVec4 = vec4.create(1, 2, 3, 4);
    expect(vec4.isEqual(frozen, vec4.create(1, 2, 3, 4))).toBe(true);
  });
});

describe('isEqualEpsilon', () => {
  test('vectors with the same components are equal', () => {
    expect(vec4.isEqualEpsilon(vec4.create(1, 2, 3, 4), vec4.create(1, 2, 3, 4))).toBe(true);
  });

  test('differences within the default tolerance are equal', () => {
    expect(
      vec4.isEqualEpsilon(vec4.create(1, 0, 0, 0), vec4.create(1 + 2 ** -23, 1e-7, -1e-7, 1e-7))
    ).toBe(true);
  });

  test('a difference beyond tolerance in any single component makes them unequal', () => {
    const a = vec4.create(1, 2, 3, 4);
    for (let i = 0; i < 4; i++) {
      const b = vec4.clone(a);
      b[i] = 99;
      expect(vec4.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('tolerance scales with magnitude', () => {
    // Adjacent float32 values near 10,000 are ~0.001 apart, far beyond EPSILON.
    const a = vec4.create(0, 0, 0, 10000.5);
    const b = vec4.create(0, 0, 0, 10000.5 + 0.001);
    expect(vec4.isEqual(a, b)).toBe(false);
    expect(vec4.isEqualEpsilon(a, b)).toBe(true);
  });

  test('accepts a custom tolerance', () => {
    const zero = vec4.create();
    expect(vec4.isEqualEpsilon(zero, vec4.create(0, 0, 0, 0.05), 0.1)).toBe(true);
    expect(vec4.isEqualEpsilon(zero, vec4.create(0, 0, 0, 0.5), 0.1)).toBe(false);
  });

  test('NaN is never equal', () => {
    const v = vec4.create(Number.NaN, 0, 0, 0);
    expect(vec4.isEqualEpsilon(v, v)).toBe(false);
  });
});

describe('isEqualXYZW', () => {
  test('matches the values just written by set', () => {
    const v = vec4.set(vec4.create(), 0.1, 0.2, 0.3, 0.4);
    expect(v[0]).not.toBe(0.1);
    expect(vec4.isEqualXYZW(v, 0.1, 0.2, 0.3, 0.4)).toBe(true);
  });

  test('a difference in any single component makes them unequal', () => {
    const v = vec4.create(1, 2, 3, 4);
    expect(vec4.isEqualXYZW(v, 99, 2, 3, 4)).toBe(false);
    expect(vec4.isEqualXYZW(v, 1, 99, 3, 4)).toBe(false);
    expect(vec4.isEqualXYZW(v, 1, 2, 99, 4)).toBe(false);
    expect(vec4.isEqualXYZW(v, 1, 2, 3, 99)).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(vec4.isEqualXYZW(vec4.create(0, -0, 0, -0), -0, 0, -0, 0)).toBe(true);
  });

  test('NaN is never equal', () => {
    expect(vec4.isEqualXYZW(vec4.create(0, 0, 0, Number.NaN), 0, 0, 0, Number.NaN)).toBe(false);
  });
});

describe('add', () => {
  test('works component by component and returns out', () => {
    const out = vec4.create();
    const result = vec4.add(out, vec4.create(8, 18, 32, 50), vec4.create(2, 3, 4, 5));

    expect(result).toBe(out);
    expectComponents(out, 8 + 2, 18 + 3, 32 + 4, 50 + 5);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(8, 18, 32, 50);
    const b = vec4.create(2, 3, 4, 5);
    vec4.add(vec4.create(), a, b);

    expectComponents(a, 8, 18, 32, 50);
    expectComponents(b, 2, 3, 4, 5);
  });

  test('out may be the first input', () => {
    const a = vec4.create(8, 18, 32, 50);
    vec4.add(a, a, vec4.create(2, 3, 4, 5));

    expectComponents(a, 8 + 2, 18 + 3, 32 + 4, 50 + 5);
  });

  test('out may be the second input', () => {
    const b = vec4.create(2, 3, 4, 5);
    vec4.add(b, vec4.create(8, 18, 32, 50), b);

    expectComponents(b, 8 + 2, 18 + 3, 32 + 4, 50 + 5);
  });

  test('both inputs may be the same vector', () => {
    const v = vec4.create(1, 2, 3, 4);

    expectComponents(vec4.add(vec4.create(), v, v), 1 + 1, 2 + 2, 3 + 3, 4 + 4);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.add(out, viewAt(buffer, 0), vec4.create(10, 20, 30, 40));

    expectComponents(out, 1 + 10, 2 + 20, 3 + 30, 4 + 40);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.add(out, viewAt(buffer, 1), vec4.create(10, 20, 30, 40));

    expectComponents(out, 2 + 10, 3 + 20, 4 + 30, 5 + 40);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.add(out, vec4.create(10, 20, 30, 40), viewAt(buffer, 0));

    expectComponents(out, 10 + 1, 20 + 2, 30 + 3, 40 + 4);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.add(out, vec4.create(10, 20, 30, 40), viewAt(buffer, 1));

    expectComponents(out, 10 + 2, 20 + 3, 30 + 4, 40 + 5);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(6);
    const out = viewAt(buffer, 1);
    vec4.add(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 + 3, 2 + 4, 3 + 5, 4 + 6);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.add(viewAt(pool, 4), vec4.create(8, 18, 32, 50), vec4.create(2, 3, 4, 5));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      3,
      4,
      Math.fround(8 + 2),
      Math.fround(18 + 3),
      Math.fround(32 + 4),
      Math.fround(50 + 5),
      9,
      10,
      11,
      12,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(8, 18, 32, 50);
    const b: ReadonlyVec4 = vec4.create(2, 3, 4, 5);

    expectComponents(vec4.add(vec4.create(), a, b), 8 + 2, 18 + 3, 32 + 4, 50 + 5);
  });

  test('a small step can vanish against a large value', () => {
    const large = vec4.create(16777216, 16777216, 16777216, 16777216);
    const out = vec4.add(vec4.create(), large, vec4.create(1, 1, 1, 1));

    expect(vec4.isEqual(out, large)).toBe(true);
  });
});

describe('sub', () => {
  test('works component by component and returns out', () => {
    const out = vec4.create();
    const result = vec4.sub(out, vec4.create(8, 18, 32, 50), vec4.create(2, 3, 4, 5));

    expect(result).toBe(out);
    expectComponents(out, 8 - 2, 18 - 3, 32 - 4, 50 - 5);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(8, 18, 32, 50);
    const b = vec4.create(2, 3, 4, 5);
    vec4.sub(vec4.create(), a, b);

    expectComponents(a, 8, 18, 32, 50);
    expectComponents(b, 2, 3, 4, 5);
  });

  test('out may be the first input', () => {
    const a = vec4.create(8, 18, 32, 50);
    vec4.sub(a, a, vec4.create(2, 3, 4, 5));

    expectComponents(a, 8 - 2, 18 - 3, 32 - 4, 50 - 5);
  });

  test('out may be the second input', () => {
    const b = vec4.create(2, 3, 4, 5);
    vec4.sub(b, vec4.create(8, 18, 32, 50), b);

    expectComponents(b, 8 - 2, 18 - 3, 32 - 4, 50 - 5);
  });

  test('both inputs may be the same vector', () => {
    const v = vec4.create(1, 2, 3, 4);

    expectComponents(vec4.sub(vec4.create(), v, v), 1 - 1, 2 - 2, 3 - 3, 4 - 4);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.sub(out, viewAt(buffer, 0), vec4.create(10, 20, 30, 40));

    expectComponents(out, 1 - 10, 2 - 20, 3 - 30, 4 - 40);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.sub(out, viewAt(buffer, 1), vec4.create(10, 20, 30, 40));

    expectComponents(out, 2 - 10, 3 - 20, 4 - 30, 5 - 40);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.sub(out, vec4.create(10, 20, 30, 40), viewAt(buffer, 0));

    expectComponents(out, 10 - 1, 20 - 2, 30 - 3, 40 - 4);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.sub(out, vec4.create(10, 20, 30, 40), viewAt(buffer, 1));

    expectComponents(out, 10 - 2, 20 - 3, 30 - 4, 40 - 5);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(6);
    const out = viewAt(buffer, 1);
    vec4.sub(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 - 3, 2 - 4, 3 - 5, 4 - 6);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.sub(viewAt(pool, 4), vec4.create(8, 18, 32, 50), vec4.create(2, 3, 4, 5));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      3,
      4,
      Math.fround(8 - 2),
      Math.fround(18 - 3),
      Math.fround(32 - 4),
      Math.fround(50 - 5),
      9,
      10,
      11,
      12,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(8, 18, 32, 50);
    const b: ReadonlyVec4 = vec4.create(2, 3, 4, 5);

    expectComponents(vec4.sub(vec4.create(), a, b), 8 - 2, 18 - 3, 32 - 4, 50 - 5);
  });
});

describe('mul', () => {
  test('works component by component and returns out', () => {
    const out = vec4.create();
    const result = vec4.mul(out, vec4.create(8, 18, 32, 50), vec4.create(2, 3, 4, 5));

    expect(result).toBe(out);
    expectComponents(out, 8 * 2, 18 * 3, 32 * 4, 50 * 5);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(8, 18, 32, 50);
    const b = vec4.create(2, 3, 4, 5);
    vec4.mul(vec4.create(), a, b);

    expectComponents(a, 8, 18, 32, 50);
    expectComponents(b, 2, 3, 4, 5);
  });

  test('out may be the first input', () => {
    const a = vec4.create(8, 18, 32, 50);
    vec4.mul(a, a, vec4.create(2, 3, 4, 5));

    expectComponents(a, 8 * 2, 18 * 3, 32 * 4, 50 * 5);
  });

  test('out may be the second input', () => {
    const b = vec4.create(2, 3, 4, 5);
    vec4.mul(b, vec4.create(8, 18, 32, 50), b);

    expectComponents(b, 8 * 2, 18 * 3, 32 * 4, 50 * 5);
  });

  test('both inputs may be the same vector', () => {
    const v = vec4.create(1, 2, 3, 4);

    expectComponents(vec4.mul(vec4.create(), v, v), 1 * 1, 2 * 2, 3 * 3, 4 * 4);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.mul(out, viewAt(buffer, 0), vec4.create(10, 20, 30, 40));

    expectComponents(out, 1 * 10, 2 * 20, 3 * 30, 4 * 40);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.mul(out, viewAt(buffer, 1), vec4.create(10, 20, 30, 40));

    expectComponents(out, 2 * 10, 3 * 20, 4 * 30, 5 * 40);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.mul(out, vec4.create(10, 20, 30, 40), viewAt(buffer, 0));

    expectComponents(out, 10 * 1, 20 * 2, 30 * 3, 40 * 4);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.mul(out, vec4.create(10, 20, 30, 40), viewAt(buffer, 1));

    expectComponents(out, 10 * 2, 20 * 3, 30 * 4, 40 * 5);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(6);
    const out = viewAt(buffer, 1);
    vec4.mul(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 * 3, 2 * 4, 3 * 5, 4 * 6);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.mul(viewAt(pool, 4), vec4.create(8, 18, 32, 50), vec4.create(2, 3, 4, 5));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      3,
      4,
      Math.fround(8 * 2),
      Math.fround(18 * 3),
      Math.fround(32 * 4),
      Math.fround(50 * 5),
      9,
      10,
      11,
      12,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(8, 18, 32, 50);
    const b: ReadonlyVec4 = vec4.create(2, 3, 4, 5);

    expectComponents(vec4.mul(vec4.create(), a, b), 8 * 2, 18 * 3, 32 * 4, 50 * 5);
  });
});

describe('div', () => {
  test('works component by component and returns out', () => {
    const out = vec4.create();
    const result = vec4.div(out, vec4.create(8, 18, 32, 50), vec4.create(2, 3, 4, 5));

    expect(result).toBe(out);
    expectComponents(out, 8 / 2, 18 / 3, 32 / 4, 50 / 5);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(8, 18, 32, 50);
    const b = vec4.create(2, 3, 4, 5);
    vec4.div(vec4.create(), a, b);

    expectComponents(a, 8, 18, 32, 50);
    expectComponents(b, 2, 3, 4, 5);
  });

  test('out may be the first input', () => {
    const a = vec4.create(8, 18, 32, 50);
    vec4.div(a, a, vec4.create(2, 3, 4, 5));

    expectComponents(a, 8 / 2, 18 / 3, 32 / 4, 50 / 5);
  });

  test('out may be the second input', () => {
    const b = vec4.create(2, 3, 4, 5);
    vec4.div(b, vec4.create(8, 18, 32, 50), b);

    expectComponents(b, 8 / 2, 18 / 3, 32 / 4, 50 / 5);
  });

  test('both inputs may be the same vector', () => {
    const v = vec4.create(1, 2, 3, 4);

    expectComponents(vec4.div(vec4.create(), v, v), 1 / 1, 2 / 2, 3 / 3, 4 / 4);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.div(out, viewAt(buffer, 0), vec4.create(10, 20, 30, 40));

    expectComponents(out, 1 / 10, 2 / 20, 3 / 30, 4 / 40);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.div(out, viewAt(buffer, 1), vec4.create(10, 20, 30, 40));

    expectComponents(out, 2 / 10, 3 / 20, 4 / 30, 5 / 40);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.div(out, vec4.create(10, 20, 30, 40), viewAt(buffer, 0));

    expectComponents(out, 10 / 1, 20 / 2, 30 / 3, 40 / 4);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.div(out, vec4.create(10, 20, 30, 40), viewAt(buffer, 1));

    expectComponents(out, 10 / 2, 20 / 3, 30 / 4, 40 / 5);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(6);
    const out = viewAt(buffer, 1);
    vec4.div(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 / 3, 2 / 4, 3 / 5, 4 / 6);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.div(viewAt(pool, 4), vec4.create(8, 18, 32, 50), vec4.create(2, 3, 4, 5));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      3,
      4,
      Math.fround(8 / 2),
      Math.fround(18 / 3),
      Math.fround(32 / 4),
      Math.fround(50 / 5),
      9,
      10,
      11,
      12,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(8, 18, 32, 50);
    const b: ReadonlyVec4 = vec4.create(2, 3, 4, 5);

    expectComponents(vec4.div(vec4.create(), a, b), 8 / 2, 18 / 3, 32 / 4, 50 / 5);
  });

  test('a zero divisor gives a signed Infinity', () => {
    const out = vec4.create();
    vec4.div(out, vec4.create(1, -1, 1, -1), vec4.create());

    expectComponents(
      out,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    );
  });

  test('a negative zero divisor flips the sign of Infinity', () => {
    const out = vec4.create();
    vec4.div(out, vec4.create(1, 1, 1, 1), vec4.create(-0, -0, -0, -0));

    expectComponents(
      out,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    );
  });

  test('zero divided by zero is NaN', () => {
    const out = vec4.div(vec4.create(), vec4.create(), vec4.create());

    expectComponents(out, Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  });

  test('a zero divisor only affects its own component', () => {
    const divisor = vec4.create(2, 3, 4, 5);
    divisor[3] = 0;
    const out = vec4.div(vec4.create(), vec4.create(8, 18, 32, 50), divisor);

    expectComponents(out, 8 / 2, 18 / 3, 32 / 4, Number.POSITIVE_INFINITY);
  });

  test('small divisors divide normally rather than being treated as zero', () => {
    const tiny = vec4.create(1e-7, 1e-7, 1e-7, 1e-7);
    const out = vec4.div(vec4.create(), tiny, tiny);

    expectComponents(out, 1, 1, 1, 1);
  });

  test('a quotient too large for float32 becomes Infinity', () => {
    const out = vec4.div(
      vec4.create(),
      vec4.create(1e30, 1e30, 1e30, 1e30),
      vec4.create(1e-30, 1e-30, 1e-30, 1e-30)
    );

    expectComponents(
      out,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY
    );
  });
});

describe('scale', () => {
  test('multiplies every component and returns out', () => {
    const out = vec4.create();
    const result = vec4.scale(out, vec4.create(8, 18, 32, 50), 2.5);

    expect(result).toBe(out);
    expectComponents(out, 8 * 2.5, 18 * 2.5, 32 * 2.5, 50 * 2.5);
  });

  test('never writes to the input', () => {
    const a = vec4.create(8, 18, 32, 50);
    vec4.scale(vec4.create(), a, 2);

    expectComponents(a, 8, 18, 32, 50);
  });

  test('out may be the input', () => {
    const a = vec4.create(8, 18, 32, 50);
    vec4.scale(a, a, 2);

    expectComponents(a, 8 * 2, 18 * 2, 32 * 2, 50 * 2);
  });

  test('a negative scalar flips every component', () => {
    expectComponents(vec4.scale(vec4.create(), vec4.create(8, 18, 32, 50), -1), -8, -18, -32, -50);
  });

  test('a scalar of zero clears every component', () => {
    expectComponents(vec4.scale(vec4.create(), vec4.create(8, 18, 32, 50), 0), 0, 0, 0, 0);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.scale(out, viewAt(buffer, 0), 10);

    expectComponents(out, 1 * 10, 2 * 10, 3 * 10, 4 * 10);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.scale(out, viewAt(buffer, 1), 10);

    expectComponents(out, 2 * 10, 3 * 10, 4 * 10, 5 * 10);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.scale(viewAt(pool, 4), vec4.create(8, 18, 32, 50), 2);

    expect(Array.from(new Float32Array(pool))).toEqual([
      1, 2, 3, 4, 16, 36, 64, 100, 9, 10, 11, 12,
    ]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(8, 18, 32, 50);

    expectComponents(vec4.scale(vec4.create(), a, 2), 8 * 2, 18 * 2, 32 * 2, 50 * 2);
  });
});

describe('magnitudeSq', () => {
  test('sums the squared components', () => {
    expect(vec4.magnitudeSq(vec4.create(3, 4, 12, 84))).toBe(7225);
  });

  test('every axis counts', () => {
    for (let i = 0; i < 4; i++) {
      const v = vec4.create();
      v[i] = 3;
      expect(vec4.magnitudeSq(v)).toBe(9);
    }
  });

  test('negative components square to the same result', () => {
    expect(vec4.magnitudeSq(vec4.create(-3, -4, -12, -84))).toBe(7225);
  });

  test('a zero vector has a squared length of zero', () => {
    expect(vec4.magnitudeSq(vec4.create())).toBe(0);
  });

  test('stays in range at the extremes of float32', () => {
    expect(vec4.magnitudeSq(vec4.create(3e38, 3e38, 3e38, 3e38))).toBeLessThan(
      Number.POSITIVE_INFINITY
    );
    expect(vec4.magnitudeSq(vec4.create(1e-45, 1e-45, 1e-45, 1e-45))).toBeGreaterThan(0);
  });

  test('reads only the slots of a pooled view', () => {
    const pool = sequentialBuffer(12);
    expect(vec4.magnitudeSq(viewAt(pool, 4))).toBe(5 * 5 + 6 * 6 + 7 * 7 + 8 * 8);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(3, 4, 12, 84);
    expect(vec4.magnitudeSq(a)).toBe(7225);
  });
});

describe('magnitude', () => {
  test('returns the length', () => {
    expect(vec4.magnitude(vec4.create(3, 4, 12, 84))).toBe(85);
  });

  test('every axis counts', () => {
    for (let i = 0; i < 4; i++) {
      const v = vec4.create();
      v[i] = 3;
      expect(vec4.magnitude(v)).toBe(3);
    }
  });

  test('a zero vector has a length of zero', () => {
    expect(vec4.magnitude(vec4.create())).toBe(0);
  });

  test('works on the stored float32 value', () => {
    expect(vec4.magnitude(vec4.create(0.1, 0, 0, 0))).toBe(Math.fround(0.1));
  });

  test('stays in range at the extremes of float32', () => {
    expect(vec4.magnitude(vec4.create(3e38, 3e38, 3e38, 3e38))).toBeLessThan(
      Number.POSITIVE_INFINITY
    );
    expect(vec4.magnitude(vec4.create(1e-45, 1e-45, 1e-45, 1e-45))).toBeGreaterThan(0);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(3, 4, 12, 84);
    expect(vec4.magnitude(a)).toBe(85);
  });
});

describe('distanceSq', () => {
  test('sums the squared differences', () => {
    expect(vec4.distanceSq(vec4.create(4, 6, 15, 88), vec4.create(1, 2, 3, 4))).toBe(7225);
  });

  test('the order does not matter', () => {
    const a = vec4.create(4, 6, 15, 88);
    const b = vec4.create(1, 2, 3, 4);
    expect(vec4.distanceSq(b, a)).toBe(vec4.distanceSq(a, b));
  });

  test('every axis counts', () => {
    for (let i = 0; i < 4; i++) {
      const v = vec4.create();
      v[i] = 3;
      expect(vec4.distanceSq(v, vec4.create())).toBe(9);
    }
  });

  test('a vector is no distance from itself', () => {
    const v = vec4.create(3, 4, 12, 84);
    expect(vec4.distanceSq(v, v)).toBe(0);
  });

  test('works with overlapping views', () => {
    const buffer = sequentialBuffer(5);
    expect(vec4.distanceSq(viewAt(buffer, 1), viewAt(buffer, 0))).toBe(4);
  });

  test('keeps float64 precision instead of rounding the difference to float32', () => {
    const a = vec4.create(0, 0, 0, 10000000);
    const b = vec4.create(0, 0, 0, 0.1);
    const difference = Math.fround(1e7) - Math.fround(0.1);

    expect(vec4.distanceSq(a, b)).toBe(difference * difference);
  });

  test('does not overflow at opposite ends of float32', () => {
    const a = vec4.create(0, 0, 0, 3e38);
    const b = vec4.create(0, 0, 0, -3e38);

    expect(vec4.distanceSq(a, b)).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(4, 6, 15, 88);
    const b: ReadonlyVec4 = vec4.create(1, 2, 3, 4);
    expect(vec4.distanceSq(a, b)).toBe(7225);
  });
});

describe('distance', () => {
  test('returns the distance', () => {
    expect(vec4.distance(vec4.create(4, 6, 15, 88), vec4.create(1, 2, 3, 4))).toBe(85);
  });

  test('the order does not matter', () => {
    const a = vec4.create(4, 6, 15, 88);
    const b = vec4.create(1, 2, 3, 4);
    expect(vec4.distance(b, a)).toBe(vec4.distance(a, b));
  });

  test('every axis counts', () => {
    for (let i = 0; i < 4; i++) {
      const v = vec4.create();
      v[i] = 3;
      expect(vec4.distance(vec4.create(), v)).toBe(3);
    }
  });

  test('a vector is no distance from itself', () => {
    const v = vec4.create(3, 4, 12, 84);
    expect(vec4.distance(v, v)).toBe(0);
  });

  test('keeps float64 precision instead of rounding the difference to float32', () => {
    const a = vec4.create(0, 0, 0, 10000000);
    const b = vec4.create(0, 0, 0, 0.1);

    expect(vec4.distance(a, b)).toBe(Math.fround(1e7) - Math.fround(0.1));
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(4, 6, 15, 88);
    const b: ReadonlyVec4 = vec4.create(1, 2, 3, 4);
    expect(vec4.distance(a, b)).toBe(85);
  });
});

describe('normalize', () => {
  test('keeps the direction, shortens to unit length and returns out', () => {
    const out = vec4.create();
    const result = vec4.normalize(out, vec4.create(3, 4, 12, 84));

    expect(result).toBe(out);
    expectComponents(out, 3 / 85, 4 / 85, 12 / 85, 84 / 85);
  });

  test('every axis normalizes to that unit axis', () => {
    for (let i = 0; i < 4; i++) {
      const v = vec4.create();
      v[i] = -3;
      const out = vec4.normalize(vec4.create(), v);

      expect(out[i]).toBe(-1);
      expect(vec4.magnitude(out)).toBe(1);
    }
  });

  test.each([1e-30, 1e-3, 1, 1e3, 1e30])('gives unit length for inputs of scale %d', (size) => {
    const out = vec4.normalize(
      vec4.create(),
      vec4.create(3 * size, 4 * size, 12 * size, 84 * size)
    );
    expect(vec4.magnitude(out)).toBeCloseTo(1, 6);
  });

  test('a zero vector stays zero rather than becoming NaN', () => {
    expectComponents(vec4.normalize(vec4.create(), vec4.create()), 0, 0, 0, 0);
  });

  test('a zero vector still overwrites whatever out held', () => {
    expectComponents(vec4.normalize(vec4.create(9, 9, 9, 9), vec4.create()), 0, 0, 0, 0);
  });

  test('negative zero counts as a zero vector', () => {
    const out = vec4.normalize(vec4.create(), vec4.create(-0, -0, -0, -0));

    for (let i = 0; i < 4; i++) expect(out[i]).toBe(-0);
  });

  test('very short vectors still normalize rather than being treated as zero', () => {
    const out = vec4.normalize(vec4.create(), vec4.create(0, 0, 0, 1e-7));
    expectComponents(out, 0, 0, 0, 1);
  });

  test('handles the extremes of float32', () => {
    const large = vec4.create(0, 0, 0, 3e38);
    const small = vec4.create(0, 0, 0, 1e-45);

    expectComponents(vec4.normalize(vec4.create(), large), 0, 0, 0, 1);
    expectComponents(vec4.normalize(vec4.create(), small), 0, 0, 0, 1);
  });

  test('a NaN component makes the whole result NaN', () => {
    const out = vec4.normalize(vec4.create(), vec4.create(Number.NaN, 1, 1, 1));
    expectComponents(out, Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  });

  test('an infinite component gives NaN in its slot and zero in the finite ones', () => {
    const out = vec4.normalize(vec4.create(), vec4.create(Number.POSITIVE_INFINITY, 1, 1, 1));
    expectComponents(out, Number.NaN, 0, 0, 0);
  });

  test('never writes to the input', () => {
    const a = vec4.create(3, 4, 12, 84);
    vec4.normalize(vec4.create(), a);

    expectComponents(a, 3, 4, 12, 84);
  });

  test('out may be the input', () => {
    const a = vec4.create(3, 4, 12, 84);
    vec4.normalize(a, a);

    expectComponents(a, 3 / 85, 4 / 85, 12 / 85, 84 / 85);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.normalize(out, viewAt(buffer, 0));

    const mag = Math.sqrt(1 * 1 + 2 * 2 + 3 * 3 + 4 * 4);
    expectComponents(out, 1 / mag, 2 / mag, 3 / mag, 4 / mag);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.normalize(out, viewAt(buffer, 1));

    const mag = Math.sqrt(2 * 2 + 3 * 3 + 4 * 4 + 5 * 5);
    expectComponents(out, 2 / mag, 3 / mag, 4 / mag, 5 / mag);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.normalize(viewAt(pool, 4), vec4.create());

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 4, 0, 0, 0, 0, 9, 10, 11, 12]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(3, 4, 12, 84);

    expectComponents(vec4.normalize(vec4.create(), a), 3 / 85, 4 / 85, 12 / 85, 84 / 85);
  });

  test('counts w like any other component', () => {
    const out = vec4.normalize(vec4.create(), vec4.create(2, 0, 0, 1));
    const mag = Math.sqrt(2 * 2 + 1 * 1);

    expectComponents(out, 2 / mag, 0, 0, 1 / mag);
  });
});
