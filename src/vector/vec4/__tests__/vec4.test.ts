// src/vector/vec4/__tests__/vec4.test.ts
import { describe, expect, test } from 'vitest';

import { clamp } from '../../../scalars.js';
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

describe('dot', () => {
  test('multiplies matching components and adds the results', () => {
    expect(vec4.dot(vec4.create(1, 2, 3, 4), vec4.create(5, 6, 7, 8))).toBe(70);
  });

  test('the order does not matter', () => {
    const a = vec4.create(1, 2, 3, 4);
    const b = vec4.create(5, 6, 7, 8);

    expect(vec4.dot(a, b)).toBe(vec4.dot(b, a));
  });

  test('a vector dotted with itself is its squared magnitude', () => {
    const a = vec4.create(1, 2, 3, 4);

    expect(vec4.dot(a, a)).toBe(vec4.magnitudeSq(a));
  });

  test('unit vectors give the cosine of the angle between them', () => {
    const x = vec4.create(1, 0, 0, 0);

    expect(vec4.dot(x, x)).toBe(1);
    expect(vec4.dot(x, vec4.create(0, 1, 0, 0))).toBe(0);
    expect(vec4.dot(x, vec4.create(-1, 0, 0, 0))).toBe(-1);
  });

  test('the sign holds at any length', () => {
    const long = vec4.create(10, 0, 0, 0);

    expect(vec4.dot(long, vec4.create(0.5, 0.5, 0, 0))).toBe(5);
    expect(vec4.dot(long, vec4.create(0, 0.5, 0, 0))).toBe(0);
    expect(vec4.dot(long, vec4.create(-0.5, 0.5, 0, 0))).toBe(-5);
  });

  test('a zero vector gives zero', () => {
    expect(vec4.dot(vec4.create(1, 2, 3, 4), vec4.create())).toBe(0);
  });

  test('gives -0 when every product is -0', () => {
    expect(vec4.dot(vec4.create(-1, -1, -1, -1), vec4.create())).toBe(-0);
  });

  test('does not round the result to float32', () => {
    const tenth = Math.fround(0.1);
    const result = vec4.dot(vec4.create(0.1), vec4.create(0.1));

    expect(result).toBe(tenth * tenth);
    expect(result).not.toBe(Math.fround(result));
  });

  test('is not limited to the float32 range', () => {
    const large = Math.fround(3e38);

    expect(vec4.dot(vec4.create(3e38), vec4.create(3e38))).toBe(large * large);
  });

  test('normalized vectors can exceed 1, so the result needs clamping before acos', () => {
    const a = vec4.normalize(vec4.create(), vec4.create(2, 3, 4, 5));
    const result = vec4.dot(a, a);

    expect(result).toBeGreaterThan(1);
    expect(Math.acos(result)).toBeNaN();
    expect(Math.acos(clamp(result, -1, 1))).toBe(0);
  });

  test('a NaN component gives NaN', () => {
    expect(vec4.dot(vec4.create(Number.NaN), vec4.create(1, 1, 1, 1))).toBeNaN();
  });

  test('an infinite component gives NaN against zero and Infinity otherwise', () => {
    const infinite = vec4.create(Number.POSITIVE_INFINITY);

    expect(vec4.dot(infinite, vec4.create(0, 1, 0, 0))).toBeNaN();
    expect(vec4.dot(infinite, vec4.create(1, 0, 0, 0))).toBe(Number.POSITIVE_INFINITY);
  });

  test('w counts like any other component', () => {
    expect(vec4.dot(vec4.create(0, 0, 0, 2), vec4.create(0, 0, 0, 3))).toBe(6);
    expect(vec4.dot(vec4.create(1, 0, 0, 1), vec4.create(1, 0, 0, 1))).toBe(2);
  });

  test('a plane dotted with a point whose w is 1 gives its signed distance', () => {
    const plane = vec4.create(0, 1, 0, -5);

    expect(vec4.dot(plane, vec4.create(3, 8, 2, 1))).toBe(3);
    expect(vec4.dot(plane, vec4.create(3, 1, 2, 1))).toBe(-4);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(1, 2, 3, 4);
    const b = vec4.create(5, 6, 7, 8);
    vec4.dot(a, b);

    expectComponents(a, 1, 2, 3, 4);
    expectComponents(b, 5, 6, 7, 8);
  });

  test('reads only its own slots when the inputs are pooled views', () => {
    const pool = sequentialBuffer(9);

    expect(vec4.dot(viewAt(pool, 1), viewAt(pool, 5))).toBe(110);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(1, 2, 3, 4);
    const b: ReadonlyVec4 = vec4.create(5, 6, 7, 8);

    expect(vec4.dot(a, b)).toBe(70);
  });
});

describe('scaleAndAdd', () => {
  test('adds b times the scalar to a, and returns out', () => {
    const out = vec4.create();
    const result = vec4.scaleAndAdd(out, vec4.create(1, 2, 3, 4), vec4.create(10, 20, 30, 40), 0.5);

    expect(result).toBe(out);
    expectComponents(out, 6, 12, 18, 24);
  });

  test('a scalar of 0 gives a, and a scalar of 1 gives a + b', () => {
    const a = vec4.create(1, 2, 3, 4);
    const b = vec4.create(10, 20, 30, 40);

    expectComponents(vec4.scaleAndAdd(vec4.create(), a, b, 0), 1, 2, 3, 4);
    expectComponents(vec4.scaleAndAdd(vec4.create(), a, b, 1), 11, 22, 33, 44);
  });

  test('a negative scalar steps backwards', () => {
    const out = vec4.scaleAndAdd(
      vec4.create(),
      vec4.create(1, 2, 3, 4),
      vec4.create(10, 20, 30, 40),
      -1
    );

    expectComponents(out, -9, -18, -27, -36);
  });

  test('rounds once, so it can differ from scale followed by add', () => {
    const a = vec4.create(1);
    const b = vec4.create(9.81);
    const dt = 1 / 60;
    const once = vec4.scaleAndAdd(vec4.create(), a, b, dt);
    const twice = vec4.add(vec4.create(), a, vec4.scale(vec4.create(), b, dt));

    expect(once[0]).toBe(Math.fround(1 + Math.fround(9.81) * dt));
    expect(once[0]).not.toBe(twice[0]);
  });

  test('b times the scalar does not overflow before the sum', () => {
    const out = vec4.scaleAndAdd(vec4.create(), vec4.create(-3e38), vec4.create(3e38), 2);

    expect(out[0]).toBe(Math.fround(3e38));
  });

  test('a result too large for float32 becomes Infinity', () => {
    const out = vec4.scaleAndAdd(vec4.create(), vec4.create(3e38), vec4.create(3e38), 1);

    expect(out[0]).toBe(Number.POSITIVE_INFINITY);
  });

  test('a small step can vanish against a large value', () => {
    const out = vec4.scaleAndAdd(vec4.create(), vec4.create(16777216), vec4.create(1), 1);

    expect(out[0]).toBe(16777216);
  });

  test('a NaN scalar makes the whole result NaN', () => {
    const out = vec4.scaleAndAdd(
      vec4.create(),
      vec4.create(1, 2, 3, 4),
      vec4.create(10, 20, 30, 40),
      Number.NaN
    );

    expectComponents(out, Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  });

  test('an infinite component in b gives NaN when the scalar is 0', () => {
    const out = vec4.scaleAndAdd(
      vec4.create(),
      vec4.create(1, 2, 3, 4),
      vec4.create(Number.POSITIVE_INFINITY),
      0
    );

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(2);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(1, 2, 3, 4);
    const b = vec4.create(10, 20, 30, 40);
    vec4.scaleAndAdd(vec4.create(), a, b, 2);

    expectComponents(a, 1, 2, 3, 4);
    expectComponents(b, 10, 20, 30, 40);
  });

  test('out may be the first input', () => {
    const a = vec4.create(1, 2, 3, 4);
    vec4.scaleAndAdd(a, a, vec4.create(10, 20, 30, 40), 2);

    expectComponents(a, 21, 42, 63, 84);
  });

  test('out may be the second input', () => {
    const b = vec4.create(10, 20, 30, 40);
    vec4.scaleAndAdd(b, vec4.create(1, 2, 3, 4), b, 2);

    expectComponents(b, 21, 42, 63, 84);
  });

  test('out may be both inputs', () => {
    const a = vec4.create(1, 2, 3, 4);
    vec4.scaleAndAdd(a, a, a, 2);

    expectComponents(a, 3, 6, 9, 12);
  });

  test('overlapping views: out one element ahead of the first input', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 1);
    vec4.scaleAndAdd(out, viewAt(buffer, 0), viewAt(buffer, 4), 2);

    expectComponents(out, 11, 14, 17, 20);
  });

  test('overlapping views: out one element behind the first input', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 0);
    vec4.scaleAndAdd(out, viewAt(buffer, 1), viewAt(buffer, 5), 2);

    expectComponents(out, 14, 17, 20, 23);
  });

  test('overlapping views: out one element ahead of the second input', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 5);
    vec4.scaleAndAdd(out, viewAt(buffer, 0), viewAt(buffer, 4), 2);

    expectComponents(out, 11, 14, 17, 20);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.scaleAndAdd(viewAt(pool, 4), vec4.create(0, 0, 0, 0), vec4.create(1, 1, 1, 1), 1);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 4, 1, 1, 1, 1, 9, 10, 11, 12]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(1, 2, 3, 4);
    const b: ReadonlyVec4 = vec4.create(10, 20, 30, 40);

    expectComponents(vec4.scaleAndAdd(vec4.create(), a, b, 2), 21, 42, 63, 84);
  });
});

describe('negate', () => {
  test('flips the sign of every component and returns out', () => {
    const out = vec4.create();
    const result = vec4.negate(out, vec4.create(1, -2, 3, -4));

    expect(result).toBe(out);
    expectComponents(out, -1, 2, -3, 4);
  });

  test('negating twice gives the original back', () => {
    const a = vec4.create(1, 2, 3, 4);

    expectComponents(vec4.negate(a, vec4.negate(a, a)), 1, 2, 3, 4);
  });

  test('a zero component becomes -0, which isEqual still treats as zero', () => {
    const zero = vec4.create();
    const out = vec4.negate(vec4.create(), zero);

    expect(out[0]).toBe(-0);
    expect(vec4.isEqual(out, zero)).toBe(true);
  });

  test('-0 becomes 0', () => {
    const out = vec4.negate(vec4.create(), vec4.create(-0));

    expect(out[0]).toBe(0);
  });

  test('NaN stays NaN and Infinity flips', () => {
    const out = vec4.negate(vec4.create(), vec4.create(Number.NaN, Number.POSITIVE_INFINITY));

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(Number.NEGATIVE_INFINITY);
  });

  test('flipping w too means a homogeneous point stays in the same place', () => {
    const point = vec4.create(2, 4, 6, 2);
    const out = vec4.negate(vec4.create(), point);

    expectComponents(out, -2, -4, -6, -2);
    expect(out[0] / out[3]).toBe(point[0] / point[3]);
    expect(out[1] / out[3]).toBe(point[1] / point[3]);
    expect(out[2] / out[3]).toBe(point[2] / point[3]);
  });

  test('never writes to the input', () => {
    const a = vec4.create(1, 2, 3, 4);
    vec4.negate(vec4.create(), a);

    expectComponents(a, 1, 2, 3, 4);
  });

  test('out may be the input', () => {
    const a = vec4.create(1, 2, 3, 4);
    vec4.negate(a, a);

    expectComponents(a, -1, -2, -3, -4);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.negate(out, viewAt(buffer, 0));

    expectComponents(out, -1, -2, -3, -4);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.negate(out, viewAt(buffer, 1));

    expectComponents(out, -2, -3, -4, -5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.negate(viewAt(pool, 4), vec4.create(1, 1, 1, 1));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 4, -1, -1, -1, -1, 9, 10, 11, 12]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(1, 2, 3, 4);

    expectComponents(vec4.negate(vec4.create(), a), -1, -2, -3, -4);
  });
});

describe('abs', () => {
  test('makes every component positive and returns out', () => {
    const out = vec4.create();
    const result = vec4.abs(out, vec4.create(-1, -2, -3, -4));

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3, 4);
  });

  test('leaves positive components alone', () => {
    expectComponents(
      vec4.abs(vec4.create(), vec4.create(1.5, -2.5, 3.5, -4.5)),
      1.5,
      2.5,
      3.5,
      4.5
    );
  });

  test('-0 becomes 0', () => {
    const out = vec4.abs(vec4.create(), vec4.create(-0, 0, -0, 0));

    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(0);
  });

  test('NaN stays NaN and -Infinity becomes Infinity', () => {
    const out = vec4.abs(vec4.create(), vec4.create(Number.NaN, Number.NEGATIVE_INFINITY, -1, 2));

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(Number.POSITIVE_INFINITY);
    expect(out[2]).toBe(1);
    expect(out[3]).toBe(2);
  });

  test('never writes to the input', () => {
    const a = vec4.create(-1, -2, -3, -4);
    vec4.abs(vec4.create(), a);

    expectComponents(a, -1, -2, -3, -4);
  });

  test('out may be the input', () => {
    const a = vec4.create(-1, -2, -3, -4);
    vec4.abs(a, a);

    expectComponents(a, 1, 2, 3, 4);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.abs(out, viewAt(buffer, 0));

    expectComponents(out, 1, 2, 3, 4);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.abs(out, viewAt(buffer, 1));

    expectComponents(out, 2, 3, 4, 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    vec4.abs(viewAt(pool, 2), vec4.create(-9, -9, -9, -9));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 9, 9, 9, 9, 7, 8]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(-1, -2, -3, -4);

    expectComponents(vec4.abs(vec4.create(), a), 1, 2, 3, 4);
  });
});

describe('min', () => {
  test('takes the smaller value per component and returns out', () => {
    const out = vec4.create();
    const result = vec4.min(out, vec4.create(1, 5, 3, 8), vec4.create(4, 2, 6, 7));

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3, 7);
  });

  test('gives the same result with the inputs swapped', () => {
    const out = vec4.min(vec4.create(), vec4.create(4, 2, 6, 7), vec4.create(1, 5, 3, 8));

    expectComponents(out, 1, 2, 3, 7);
  });

  test('handles negative values', () => {
    const out = vec4.min(vec4.create(), vec4.create(-1, -5, 3, -8), vec4.create(-4, 2, -6, 7));

    expectComponents(out, -4, -5, -6, -8);
  });

  test('a NaN in either input gives NaN in that component only', () => {
    const fromA = vec4.min(
      vec4.create(),
      vec4.create(Number.NaN, 1, 2, 3),
      vec4.create(1, 2, 3, 4)
    );
    const fromB = vec4.min(
      vec4.create(),
      vec4.create(1, 2, 3, 4),
      vec4.create(Number.NaN, 1, 2, 3)
    );

    expect(fromA[0]).toBeNaN();
    expect(fromA[1]).toBe(1);
    expect(fromA[2]).toBe(2);
    expect(fromA[3]).toBe(3);
    expect(fromB[0]).toBeNaN();
    expect(fromB[1]).toBe(1);
    expect(fromB[2]).toBe(2);
    expect(fromB[3]).toBe(3);
  });

  test('-0 counts as smaller than 0, whichever input it is in', () => {
    const out = vec4.min(vec4.create(), vec4.create(0, -0, 0, -0), vec4.create(-0, 0, -0, 0));

    expect(out[0]).toBe(-0);
    expect(out[1]).toBe(-0);
    expect(out[2]).toBe(-0);
    expect(out[3]).toBe(-0);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(1, 5, 3, 8);
    const b = vec4.create(4, 2, 6, 7);
    vec4.min(vec4.create(), a, b);

    expectComponents(a, 1, 5, 3, 8);
    expectComponents(b, 4, 2, 6, 7);
  });

  test('out may be either input', () => {
    const a = vec4.create(1, 5, 3, 8);
    const b = vec4.create(4, 2, 6, 7);
    vec4.min(a, a, b);
    expectComponents(a, 1, 2, 3, 7);

    const c = vec4.create(1, 5, 3, 8);
    const d = vec4.create(4, 2, 6, 7);
    vec4.min(d, c, d);
    expectComponents(d, 1, 2, 3, 7);
  });

  test('overlapping views: out one element ahead of an input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.min(out, viewAt(buffer, 0), vec4.create(9, 9, 9, 9));

    expectComponents(out, 1, 2, 3, 4);
  });

  test('overlapping views: out one element behind an input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.min(out, vec4.create(9, 9, 9, 9), viewAt(buffer, 1));

    expectComponents(out, 2, 3, 4, 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    vec4.min(viewAt(pool, 2), vec4.create(-9, -9, -9, -9), vec4.create(0, 0, 0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, -9, -9, -9, -9, 7, 8]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(1, 5, 3, 8);
    const b: ReadonlyVec4 = vec4.create(4, 2, 6, 7);

    expectComponents(vec4.min(vec4.create(), a, b), 1, 2, 3, 7);
  });
});

describe('max', () => {
  test('takes the larger value per component and returns out', () => {
    const out = vec4.create();
    const result = vec4.max(out, vec4.create(1, 5, 3, 8), vec4.create(4, 2, 6, 7));

    expect(result).toBe(out);
    expectComponents(out, 4, 5, 6, 8);
  });

  test('gives the same result with the inputs swapped', () => {
    const out = vec4.max(vec4.create(), vec4.create(4, 2, 6, 7), vec4.create(1, 5, 3, 8));

    expectComponents(out, 4, 5, 6, 8);
  });

  test('handles negative values', () => {
    const out = vec4.max(vec4.create(), vec4.create(-1, -5, 3, -8), vec4.create(-4, 2, -6, 7));

    expectComponents(out, -1, 2, 3, 7);
  });

  test('a NaN in either input gives NaN in that component only', () => {
    const fromA = vec4.max(
      vec4.create(),
      vec4.create(Number.NaN, 1, 2, 3),
      vec4.create(1, 2, 3, 4)
    );
    const fromB = vec4.max(
      vec4.create(),
      vec4.create(1, 2, 3, 4),
      vec4.create(Number.NaN, 1, 2, 3)
    );

    expect(fromA[0]).toBeNaN();
    expect(fromA[1]).toBe(2);
    expect(fromA[2]).toBe(3);
    expect(fromA[3]).toBe(4);
    expect(fromB[0]).toBeNaN();
    expect(fromB[1]).toBe(2);
    expect(fromB[2]).toBe(3);
    expect(fromB[3]).toBe(4);
  });

  test('0 counts as larger than -0, whichever input it is in', () => {
    const out = vec4.max(vec4.create(), vec4.create(0, -0, 0, -0), vec4.create(-0, 0, -0, 0));

    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(0);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(1, 5, 3, 8);
    const b = vec4.create(4, 2, 6, 7);
    vec4.max(vec4.create(), a, b);

    expectComponents(a, 1, 5, 3, 8);
    expectComponents(b, 4, 2, 6, 7);
  });

  test('out may be either input', () => {
    const a = vec4.create(1, 5, 3, 8);
    const b = vec4.create(4, 2, 6, 7);
    vec4.max(a, a, b);
    expectComponents(a, 4, 5, 6, 8);

    const c = vec4.create(1, 5, 3, 8);
    const d = vec4.create(4, 2, 6, 7);
    vec4.max(d, c, d);
    expectComponents(d, 4, 5, 6, 8);
  });

  test('overlapping views: out one element ahead of an input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.max(out, viewAt(buffer, 0), vec4.create(-9, -9, -9, -9));

    expectComponents(out, 1, 2, 3, 4);
  });

  test('overlapping views: out one element behind an input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.max(out, vec4.create(-9, -9, -9, -9), viewAt(buffer, 1));

    expectComponents(out, 2, 3, 4, 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    vec4.max(viewAt(pool, 2), vec4.create(9, 9, 9, 9), vec4.create(0, 0, 0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 9, 9, 9, 9, 7, 8]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(1, 5, 3, 8);
    const b: ReadonlyVec4 = vec4.create(4, 2, 6, 7);

    expectComponents(vec4.max(vec4.create(), a, b), 4, 5, 6, 8);
  });
});

describe('floor', () => {
  test('rounds every component down and returns out', () => {
    const out = vec4.create();
    const result = vec4.floor(out, vec4.create(1.5, 2.75, 3.25, 4.5));

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3, 4);
  });

  test('rounds negative values toward negative infinity, not toward zero', () => {
    const out = vec4.floor(vec4.create(), vec4.create(-1.5, -0.25, -2.75, -3.5));

    expectComponents(out, -2, -1, -3, -4);
  });

  test('leaves whole numbers alone', () => {
    expectComponents(vec4.floor(vec4.create(), vec4.create(3, -3, 4, -4)), 3, -3, 4, -4);
  });

  test('NaN stays NaN and Infinity stays Infinity', () => {
    const a = vec4.create(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5);
    const out = vec4.floor(vec4.create(), a);

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(Number.POSITIVE_INFINITY);
    expect(out[2]).toBe(Number.NEGATIVE_INFINITY);
    expect(out[3]).toBe(1);
  });

  test('never writes to the input', () => {
    const a = vec4.create(1.5, 2.5, 3.5, 4.5);
    vec4.floor(vec4.create(), a);

    expectComponents(a, 1.5, 2.5, 3.5, 4.5);
  });

  test('out may be the input', () => {
    const a = vec4.create(1.5, 2.5, 3.5, 4.5);
    vec4.floor(a, a);

    expectComponents(a, 1, 2, 3, 4);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.floor(out, viewAt(buffer, 0));

    expectComponents(out, 1, 2, 3, 4);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.floor(out, viewAt(buffer, 1));

    expectComponents(out, 2, 3, 4, 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    vec4.floor(viewAt(pool, 2), vec4.create(9.5, 9.5, 9.5, 9.5));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 9, 9, 9, 9, 7, 8]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(1.5, 2.5, 3.5, 4.5);

    expectComponents(vec4.floor(vec4.create(), a), 1, 2, 3, 4);
  });
});

describe('ceil', () => {
  test('rounds every component up and returns out', () => {
    const out = vec4.create();
    const result = vec4.ceil(out, vec4.create(1.5, 2.25, 3.75, 4.5));

    expect(result).toBe(out);
    expectComponents(out, 2, 3, 4, 5);
  });

  test('rounds negative values toward positive infinity', () => {
    const out = vec4.ceil(vec4.create(), vec4.create(-1.5, -2.75, -3.25, -4.5));

    expectComponents(out, -1, -2, -3, -4);
  });

  test('leaves whole numbers alone', () => {
    expectComponents(vec4.ceil(vec4.create(), vec4.create(3, -3, 4, -4)), 3, -3, 4, -4);
  });

  test('a value between -1 and 0 becomes -0, which isEqual still treats as zero', () => {
    const out = vec4.ceil(vec4.create(), vec4.create(-0.5, -0.25, -0.75, -0.125));

    expect(out[0]).toBe(-0);
    expect(out[1]).toBe(-0);
    expect(out[2]).toBe(-0);
    expect(out[3]).toBe(-0);
    expect(vec4.isEqual(out, vec4.create())).toBe(true);
  });

  test('NaN stays NaN and Infinity stays Infinity', () => {
    const a = vec4.create(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5);
    const out = vec4.ceil(vec4.create(), a);

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(Number.POSITIVE_INFINITY);
    expect(out[2]).toBe(Number.NEGATIVE_INFINITY);
    expect(out[3]).toBe(2);
  });

  test('never writes to the input', () => {
    const a = vec4.create(1.5, 2.5, 3.5, 4.5);
    vec4.ceil(vec4.create(), a);

    expectComponents(a, 1.5, 2.5, 3.5, 4.5);
  });

  test('out may be the input', () => {
    const a = vec4.create(1.5, 2.5, 3.5, 4.5);
    vec4.ceil(a, a);

    expectComponents(a, 2, 3, 4, 5);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.ceil(out, viewAt(buffer, 0));

    expectComponents(out, 1, 2, 3, 4);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.ceil(out, viewAt(buffer, 1));

    expectComponents(out, 2, 3, 4, 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    vec4.ceil(viewAt(pool, 2), vec4.create(8.5, 8.5, 8.5, 8.5));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 9, 9, 9, 9, 7, 8]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(1.5, 2.5, 3.5, 4.5);

    expectComponents(vec4.ceil(vec4.create(), a), 2, 3, 4, 5);
  });
});

describe('round', () => {
  test('rounds every component to the nearest whole number and returns out', () => {
    const out = vec4.create();
    const result = vec4.round(out, vec4.create(1.25, 2.75, 3.25, 4.75));

    expect(result).toBe(out);
    expectComponents(out, 1, 3, 3, 5);
  });

  test('halves round toward positive infinity, not away from zero', () => {
    expectComponents(vec4.round(vec4.create(), vec4.create(1.5, -1.5, 2.5, -2.5)), 2, -1, 3, -2);
  });

  test('leaves whole numbers alone', () => {
    expectComponents(vec4.round(vec4.create(), vec4.create(3, -3, 4, -4)), 3, -3, 4, -4);
  });

  test('a value from -0.5 up to 0 becomes -0, which isEqual still treats as zero', () => {
    const out = vec4.round(vec4.create(), vec4.create(-0.5, -0.25, -0.125, -0.375));

    expect(out[0]).toBe(-0);
    expect(out[1]).toBe(-0);
    expect(out[2]).toBe(-0);
    expect(out[3]).toBe(-0);
    expect(vec4.isEqual(out, vec4.create())).toBe(true);
  });

  test('NaN stays NaN and Infinity stays Infinity', () => {
    const a = vec4.create(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.25);
    const out = vec4.round(vec4.create(), a);

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(Number.POSITIVE_INFINITY);
    expect(out[2]).toBe(Number.NEGATIVE_INFINITY);
    expect(out[3]).toBe(1);
  });

  test('never writes to the input', () => {
    const a = vec4.create(1.25, 2.75, 3.25, 4.75);
    vec4.round(vec4.create(), a);

    expectComponents(a, 1.25, 2.75, 3.25, 4.75);
  });

  test('out may be the input', () => {
    const a = vec4.create(1.25, 2.75, 3.25, 4.75);
    vec4.round(a, a);

    expectComponents(a, 1, 3, 3, 5);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec4.round(out, viewAt(buffer, 0));

    expectComponents(out, 1, 2, 3, 4);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec4.round(out, viewAt(buffer, 1));

    expectComponents(out, 2, 3, 4, 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    vec4.round(viewAt(pool, 2), vec4.create(9.25, 9.25, 9.25, 9.25));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 9, 9, 9, 9, 7, 8]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec4 = vec4.create(1.25, 2.75, 3.25, 4.75);

    expectComponents(vec4.round(vec4.create(), a), 1, 3, 3, 5);
  });
});

describe('lerp', () => {
  test('moves every component from a towards b, and returns out', () => {
    const out = vec4.create();
    const result = vec4.lerp(out, vec4.create(1, 2, 3, 4), vec4.create(10, 20, 30, 40), 0.25);

    expect(result).toBe(out);
    expectComponents(out, 3.25, 6.5, 9.75, 13);
  });

  test('t of 0 gives a and t of 1 gives b, exactly', () => {
    const a = vec4.create(0.1);
    const b = vec4.create(0.7);

    expect(vec4.isEqual(vec4.lerp(vec4.create(), a, b, 0), a)).toBe(true);
    expect(vec4.isEqual(vec4.lerp(vec4.create(), a, b, 1), b)).toBe(true);
  });

  test('does not clamp t, so it carries on past either end', () => {
    const a = vec4.create(1, 2, 3, 4);
    const b = vec4.create(10, 20, 30, 40);

    expectComponents(vec4.lerp(vec4.create(), a, b, 2), 19, 38, 57, 76);
    expectComponents(vec4.lerp(vec4.create(), a, b, -1), -8, -16, -24, -32);
  });

  test('stays on a when a and b are equal', () => {
    const a = vec4.create(0.1);

    expect(vec4.isEqual(vec4.lerp(vec4.create(), a, a, 0.3), a)).toBe(true);
  });

  test('handles the extremes of float32 without overflowing', () => {
    const out = vec4.lerp(vec4.create(), vec4.create(3e38), vec4.create(-3e38), 0.5);

    expect(out[0]).toBe(0);
  });

  test('only misses b at t of 1 when the two differ enormously in scale', () => {
    const close = vec4.lerp(vec4.create(), vec4.create(1e6), vec4.create(0.1), 1);
    const far = vec4.lerp(vec4.create(), vec4.create(1e8), vec4.create(0.1), 1);

    expect(close[0]).toBe(Math.fround(0.1));
    expect(far[0]).not.toBe(Math.fround(0.1));
    expect(far[0]).toBeCloseTo(0.1, 6);
  });

  test('blending directions does not keep their length', () => {
    const halfway = vec4.lerp(vec4.create(), vec4.create(1, 0, 0, 0), vec4.create(0, 1, 0, 0), 0.5);

    expect(vec4.magnitude(halfway)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(
      vec4.magnitude(
        vec4.lerp(vec4.create(), vec4.create(1, 0, 0, 0), vec4.create(-1, 0, 0, 0), 0.5)
      )
    ).toBe(0);
  });

  test('a fixed t depends on the step count, and an exponential t does not', () => {
    const reachedAfter = (steps: number, t: number): number => {
      const current = vec4.create();
      const target = vec4.create(1);
      for (let i = 0; i < steps; i++) vec4.lerp(current, current, target, t);
      return current[0];
    };
    const rate = 6;

    expect(reachedAfter(30, 0.1)).toBeCloseTo(0.958, 3);
    expect(reachedAfter(60, 0.1)).toBeCloseTo(0.998, 3);
    expect(reachedAfter(30, 1 - Math.exp(-rate / 30))).toBeCloseTo(
      reachedAfter(60, 1 - Math.exp(-rate / 60)),
      5
    );
  });

  test('a NaN t makes the whole result NaN', () => {
    const out = vec4.lerp(
      vec4.create(),
      vec4.create(1, 2, 3, 4),
      vec4.create(10, 20, 30, 40),
      Number.NaN
    );

    expectComponents(out, Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  });

  test('an infinite component in a gives NaN from t of 0 upwards', () => {
    const a = vec4.create(Number.POSITIVE_INFINITY);
    const b = vec4.create(1, 1, 1, 1);

    expect(vec4.lerp(vec4.create(), a, b, 0)[0]).toBeNaN();
    expect(vec4.lerp(vec4.create(), a, b, 0.5)[0]).toBeNaN();
    expect(vec4.lerp(vec4.create(), a, b, 1)[0]).toBeNaN();
  });

  test('an infinite component in b gives NaN at t of 0 and Infinity above it', () => {
    const a = vec4.create(1, 1, 1, 1);
    const b = vec4.create(Number.POSITIVE_INFINITY);

    expect(vec4.lerp(vec4.create(), a, b, 0)[0]).toBeNaN();
    expect(vec4.lerp(vec4.create(), a, b, 0.5)[0]).toBe(Number.POSITIVE_INFINITY);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(1, 2, 3, 4);
    const b = vec4.create(10, 20, 30, 40);
    vec4.lerp(vec4.create(), a, b, 0.5);

    expectComponents(a, 1, 2, 3, 4);
    expectComponents(b, 10, 20, 30, 40);
  });

  test('out may be the first input', () => {
    const a = vec4.create(1, 2, 3, 4);
    vec4.lerp(a, a, vec4.create(10, 20, 30, 40), 0.5);

    expectComponents(a, 5.5, 11, 16.5, 22);
  });

  test('out may be the second input', () => {
    const b = vec4.create(10, 20, 30, 40);
    vec4.lerp(b, vec4.create(1, 2, 3, 4), b, 0.5);

    expectComponents(b, 5.5, 11, 16.5, 22);
  });

  test('overlapping views: out one element ahead of the first input', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 1);
    vec4.lerp(out, viewAt(buffer, 0), viewAt(buffer, 4), 0.75);

    expectComponents(out, 4, 5, 6, 7);
  });

  test('overlapping views: out one element behind the first input', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 0);
    vec4.lerp(out, viewAt(buffer, 1), viewAt(buffer, 5), 0.75);

    expectComponents(out, 5, 6, 7, 8);
  });

  test('overlapping views: out one element ahead of the second input', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 5);
    vec4.lerp(out, viewAt(buffer, 0), viewAt(buffer, 4), 0.75);

    expectComponents(out, 4, 5, 6, 7);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.lerp(viewAt(pool, 4), vec4.create(0, 0, 0, 0), vec4.create(1, 1, 1, 1), 0.5);

    expect(Array.from(new Float32Array(pool))).toEqual([
      1, 2, 3, 4, 0.5, 0.5, 0.5, 0.5, 9, 10, 11, 12,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(1, 2, 3, 4);
    const b: ReadonlyVec4 = vec4.create(10, 20, 30, 40);

    expectComponents(vec4.lerp(vec4.create(), a, b, 0.5), 5.5, 11, 16.5, 22);
  });
});

describe('reflect', () => {
  test('flips the part along the normal, keeps the rest, and returns out', () => {
    const out = vec4.create();
    const result = vec4.reflect(out, vec4.create(1, -1, 0, 0), vec4.create(0, 1, 0, 0));

    expect(result).toBe(out);
    expectComponents(out, 1, 1, 0, 0);
  });

  test('a normal along each axis flips only that component', () => {
    const a = vec4.create(1, 2, 3, 4);

    expectComponents(vec4.reflect(vec4.create(), a, vec4.create(1, 0, 0, 0)), -1, 2, 3, 4);
    expectComponents(vec4.reflect(vec4.create(), a, vec4.create(0, 1, 0, 0)), 1, -2, 3, 4);
    expectComponents(vec4.reflect(vec4.create(), a, vec4.create(0, 0, 1, 0)), 1, 2, -3, 4);
    expectComponents(vec4.reflect(vec4.create(), a, vec4.create(0, 0, 0, 1)), 1, 2, 3, -4);
  });

  test('uses every component of a diagonal normal', () => {
    const normal = vec4.normalize(vec4.create(), vec4.create(1, 2, 3, 4));
    const out = vec4.reflect(vec4.create(), vec4.create(1, 2, 3, 4), normal);

    // A vector along the normal comes straight back.
    expect(out[0]).toBeCloseTo(-1, 5);
    expect(out[1]).toBeCloseTo(-2, 5);
    expect(out[2]).toBeCloseTo(-3, 5);
    expect(out[3]).toBeCloseTo(-4, 5);
  });

  test('a vector along the surface is unchanged', () => {
    const out = vec4.reflect(vec4.create(), vec4.create(3, 0, 0, 0), vec4.create(0, 1, 0, 0));

    expectComponents(out, 3, 0, 0, 0);
  });

  test('a head-on vector comes straight back', () => {
    const out = vec4.reflect(vec4.create(), vec4.create(0, -2, 0, 0), vec4.create(0, 1, 0, 0));

    expectComponents(out, 0, 2, 0, 0);
  });

  test('which side the normal points to does not matter', () => {
    const a = vec4.create(1, -1, 0, 0);
    const up = vec4.reflect(vec4.create(), a, vec4.create(0, 1, 0, 0));
    const down = vec4.reflect(vec4.create(), a, vec4.create(0, -1, 0, 0));

    expect(vec4.isEqual(up, down)).toBe(true);
  });

  test('keeps the length apart from rounding', () => {
    const a = vec4.create(1, 2, 3, 4);
    const normal = vec4.normalize(vec4.create(), vec4.create(7, 6, 5, 4));

    expect(vec4.magnitude(vec4.reflect(vec4.create(), a, normal))).toBeCloseTo(
      vec4.magnitude(a),
      5
    );
  });

  test('reflecting twice gives the original back', () => {
    const a = vec4.create(1, 2, 3, 4);
    const normal = vec4.create(0, 1, 0, 0);
    const once = vec4.reflect(vec4.create(), a, normal);

    expectComponents(vec4.reflect(once, once, normal), 1, 2, 3, 4);
  });

  test('a normal of the wrong length changes the direction too', () => {
    const a = vec4.create(1, -1, 0, 0);

    expectComponents(vec4.reflect(vec4.create(), a, vec4.create(0, 2, 0, 0)), 1, 7, 0, 0);
    expectComponents(vec4.reflect(vec4.create(), a, vec4.create(0, 0.5, 0, 0)), 1, -0.5, 0, 0);
  });

  test('a zero normal leaves a unchanged', () => {
    const out = vec4.reflect(vec4.create(), vec4.create(1, 2, 3, 4), vec4.create());

    expectComponents(out, 1, 2, 3, 4);
  });

  test('a zero vector stays zero', () => {
    const out = vec4.reflect(vec4.create(), vec4.create(), vec4.create(0, 1, 0, 0));

    expect(vec4.isEqual(out, vec4.create())).toBe(true);
  });

  test('flips a vector that is already heading away from the surface', () => {
    const out = vec4.reflect(vec4.create(), vec4.create(1, 1, 0, 0), vec4.create(0, 1, 0, 0));

    expectComponents(out, 1, -1, 0, 0);
  });

  test('intermediate values do not overflow float32', () => {
    const out = vec4.reflect(vec4.create(), vec4.create(3e38, 3e38, 0, 0), vec4.create(0, 1, 0, 0));

    expectComponents(out, 3e38, -3e38, 0, 0);
  });

  test('a NaN component makes the whole result NaN', () => {
    const out = vec4.reflect(
      vec4.create(),
      vec4.create(Number.NaN, -1, 0, 0),
      vec4.create(0, 1, 0, 0)
    );

    expectComponents(out, Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  });

  test('an infinite component that meets zero makes the whole result NaN', () => {
    const out = vec4.reflect(
      vec4.create(),
      vec4.create(Number.POSITIVE_INFINITY, -1, 0, 0),
      vec4.create(0, 1, 0, 0)
    );

    expectComponents(out, Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  });

  test('a normal whose w is 0 leaves w alone, and any other w mixes it in', () => {
    const point = vec4.create(1, -1, 0, 1);

    expectComponents(vec4.reflect(vec4.create(), point, vec4.create(0, 1, 0, 0)), 1, 1, 0, 1);
    expectComponents(vec4.reflect(vec4.create(), point, vec4.create(0, 0, 0, 1)), 1, -1, 0, -1);
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(1, 2, 3, 4);
    const normal = vec4.create(0, 1, 0, 0);
    vec4.reflect(vec4.create(), a, normal);

    expectComponents(a, 1, 2, 3, 4);
    expectComponents(normal, 0, 1, 0, 0);
  });

  test('out may be the incoming vector', () => {
    const a = vec4.create(1, 2, 3, 4);
    vec4.reflect(a, a, vec4.create(5, 6, 7, 8));

    expectComponents(a, -699, -838, -977, -1116);
  });

  test('out may be the normal', () => {
    const normal = vec4.create(5, 6, 7, 8);
    vec4.reflect(normal, vec4.create(1, 2, 3, 4), normal);

    expectComponents(normal, -699, -838, -977, -1116);
  });

  test('out may be both inputs', () => {
    const normal = vec4.create(0, 1, 0, 0);
    vec4.reflect(normal, normal, normal);

    expectComponents(normal, 0, -1, 0, 0);
  });

  test('overlapping views: out one element ahead of the incoming vector', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 1);
    vec4.reflect(out, viewAt(buffer, 0), viewAt(buffer, 4));

    expectComponents(out, -699, -838, -977, -1116);
  });

  test('overlapping views: out one element behind the incoming vector', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 0);
    vec4.reflect(out, viewAt(buffer, 1), viewAt(buffer, 5));

    expectComponents(out, -1318, -1537, -1756, -1975);
  });

  test('overlapping views: out one element ahead of the normal', () => {
    const buffer = sequentialBuffer(9);
    const out = viewAt(buffer, 5);
    vec4.reflect(out, viewAt(buffer, 0), viewAt(buffer, 4));

    expectComponents(out, -699, -838, -977, -1116);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(12);
    vec4.reflect(viewAt(pool, 4), vec4.create(1, -1, 0, 0), vec4.create(0, 1, 0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 4, 1, 1, 0, 0, 9, 10, 11, 12]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(1, -1, 0, 0);
    const normal: ReadonlyVec4 = vec4.create(0, 1, 0, 0);

    expectComponents(vec4.reflect(vec4.create(), a, normal), 1, 1, 0, 0);
  });
});

describe('angle', () => {
  test('is 0 for the same direction and pi for the opposite one', () => {
    const x = vec4.create(1, 0, 0, 0);

    expect(vec4.angle(x, x)).toBe(0);
    expect(vec4.angle(x, vec4.create(-1, 0, 0, 0))).toBe(Math.PI);
  });

  test('every axis counts', () => {
    const x = vec4.create(1, 0, 0, 0);

    expect(vec4.angle(x, vec4.create(0, 1, 0, 0))).toBe(Math.PI / 2);
    expect(vec4.angle(x, vec4.create(1, 1, 0, 0))).toBeCloseTo(Math.PI / 4, 12);
    expect(vec4.angle(x, vec4.create(0, 0, 1, 0))).toBe(Math.PI / 2);
    expect(vec4.angle(x, vec4.create(1, 0, 1, 0))).toBeCloseTo(Math.PI / 4, 12);
    expect(vec4.angle(x, vec4.create(0, 0, 0, 1))).toBe(Math.PI / 2);
    expect(vec4.angle(x, vec4.create(1, 0, 0, 1))).toBeCloseTo(Math.PI / 4, 12);
  });

  test('the order does not matter', () => {
    const a = vec4.create(1, 2, 3, 4);
    const b = vec4.create(7, 6, 5, 4);

    expect(vec4.angle(a, b)).toBe(vec4.angle(b, a));
  });

  test('lengths do not matter', () => {
    expect(vec4.angle(vec4.create(500, 0, 0, 0), vec4.create(0.01, 0.01, 0, 0))).toBeCloseTo(
      Math.PI / 4,
      6
    );
    expect(vec4.angle(vec4.create(500, 0, 0, 0), vec4.create(-0.01, 0.01, 0, 0))).toBeCloseTo(
      (3 * Math.PI) / 4,
      6
    );
  });

  test('a zero vector gives 0', () => {
    const zero = vec4.create();
    const x = vec4.create(1, 0, 0, 0);

    expect(vec4.angle(zero, x)).toBe(0);
    expect(vec4.angle(x, zero)).toBe(0);
    expect(vec4.angle(zero, zero)).toBe(0);
  });

  test('very short vectors still give the right angle', () => {
    const y = vec4.create(0, 1, 0, 0);

    expect(vec4.angle(vec4.create(1e-7, 0, 0, 0), y)).toBe(Math.PI / 2);
    expect(vec4.angle(vec4.create(1e-7, 0, 0, 0), vec4.create(0, 1e-7, 0, 0))).toBe(Math.PI / 2);
  });

  test('handles the extremes of float32', () => {
    expect(vec4.angle(vec4.create(1e-45, 0, 0, 0), vec4.create(0, 1e-45, 0, 0))).toBe(Math.PI / 2);
    expect(vec4.angle(vec4.create(3e38, 0, 0, 0), vec4.create(0, 3e38, 0, 0))).toBe(Math.PI / 2);
    expect(vec4.angle(vec4.create(3e38, 0, 0, 0), vec4.create(3e38, 3e38, 0, 0))).toBeCloseTo(
      Math.PI / 4,
      12
    );
  });

  test('a cosine rounded just above 1 is clamped rather than giving NaN', () => {
    const a = vec4.create(1, 2, 2, 8);
    const b = vec4.scale(vec4.create(), a, 0.1);

    expect(vec4.dot(a, b) / Math.sqrt(vec4.magnitudeSq(a) * vec4.magnitudeSq(b))).toBeGreaterThan(
      1
    );
    expect(vec4.angle(a, b)).toBe(0);
  });

  test('rounding can leave parallel vectors very slightly apart', () => {
    const a = vec4.create(1, 1, 1, 3);
    const result = vec4.angle(a, vec4.scale(vec4.create(), a, 0.3));

    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1e-7);
  });

  test('the dot comparison in the docs agrees with the angle', () => {
    const facing = vec4.create(1, 0, 0, 0);
    const limit = Math.PI / 4;
    const inside = vec4.normalize(vec4.create(), vec4.create(2, 1, 0, 0));
    const outside = vec4.normalize(vec4.create(), vec4.create(1, 2, 0, 0));

    expect(vec4.angle(facing, inside)).toBeLessThan(limit);
    expect(vec4.dot(facing, inside)).toBeGreaterThan(Math.cos(limit));
    expect(vec4.angle(facing, outside)).toBeGreaterThan(limit);
    expect(vec4.dot(facing, outside)).toBeLessThan(Math.cos(limit));
  });

  test('a NaN or infinite component gives NaN', () => {
    const y = vec4.create(0, 1, 0, 0);

    expect(vec4.angle(vec4.create(Number.NaN, 1, 0, 0), y)).toBeNaN();
    expect(vec4.angle(vec4.create(Number.POSITIVE_INFINITY, 1, 0, 0), y)).toBeNaN();
  });

  test('w counts like any other component', () => {
    expect(vec4.angle(vec4.create(1, 0, 0, 1), vec4.create(0, 1, 0, 1))).toBeCloseTo(
      Math.PI / 3,
      12
    );
    expect(vec4.angle(vec4.create(1, 0, 0, 1), vec4.create(1, 0, 0, 0))).toBeCloseTo(
      Math.PI / 4,
      12
    );
  });

  test('never writes to the inputs', () => {
    const a = vec4.create(1, 2, 3, 4);
    const b = vec4.create(5, 6, 7, 8);
    vec4.angle(a, b);

    expectComponents(a, 1, 2, 3, 4);
    expectComponents(b, 5, 6, 7, 8);
  });

  test('reads only its own slots when the inputs are pooled views', () => {
    const pool = sequentialBuffer(9);
    const direct = vec4.angle(vec4.create(2, 3, 4, 5), vec4.create(6, 7, 8, 9));

    expect(vec4.angle(viewAt(pool, 1), viewAt(pool, 5))).toBe(direct);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec4 = vec4.create(1, 0, 0, 0);
    const b: ReadonlyVec4 = vec4.create(0, 1, 0, 0);

    expect(vec4.angle(a, b)).toBe(Math.PI / 2);
  });
});

describe('constants', () => {
  test('ZERO has every component at zero', () => {
    expectComponents(vec4.ZERO, 0, 0, 0, 0);
  });

  test('ONE has every component at one', () => {
    expectComponents(vec4.ONE, 1, 1, 1, 1);
  });

  test('are shared instances that clone into standalone vectors', () => {
    const copy = vec4.clone(vec4.ONE);

    expect(copy).not.toBe(vec4.ONE);
    expect(copy.buffer).not.toBe(vec4.ONE.buffer);
    expectComponents(copy, 1, 1, 1, 1);
  });
});

describe('SIZE', () => {
  test('matches the length of a created vector', () => {
    expect(vec4.SIZE).toBe(4);
    expect(vec4.create().length).toBe(vec4.SIZE);
  });
});

describe('fromPacked', () => {
  test('copies the requested row in x, y, z, w order', () => {
    const packed = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    expectComponents(vec4.fromPacked(vec4.create(), packed, 0), 1, 2, 3, 4);
    expectComponents(vec4.fromPacked(vec4.create(), packed, 1), 5, 6, 7, 8);
    expectComponents(vec4.fromPacked(vec4.create(), packed, 2), 9, 10, 11, 12);
  });

  test('returns out', () => {
    const out = vec4.create();

    expect(vec4.fromPacked(out, new Float32Array(4), 0)).toBe(out);
  });

  test('never writes to the packed array', () => {
    const packed = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
    vec4.fromPacked(vec4.create(), packed, 1);

    expect(Array.from(packed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec4.fromPacked(viewAt(pool, 1), new Float32Array([10, 20, 30, 40]), 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 10, 20, 30, 40, 6]);
  });

  test('handles out overlapping the row from behind', () => {
    const pool = sequentialBuffer(9);
    vec4.fromPacked(viewAt(pool, 3), new Float32Array(pool), 1);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 5, 6, 7, 8, 8, 9]);
  });

  test('handles out overlapping the row from ahead', () => {
    const pool = sequentialBuffer(9);
    vec4.fromPacked(viewAt(pool, 5), new Float32Array(pool), 1);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 4, 5, 5, 6, 7, 8]);
  });

  test('reads from a plain array, rounding to float32', () => {
    expectComponents(vec4.fromPacked(vec4.create(), [0.1, 0.2, 0.3, 0.4], 0), 0.1, 0.2, 0.3, 0.4);
  });

  test('reads from a readonly vector', () => {
    const source: ReadonlyVec4 = vec4.create(1, 2, 3, 4);

    expectComponents(vec4.fromPacked(vec4.create(), source, 0), 1, 2, 3, 4);
  });

  test('reads from a SharedArrayBuffer', () => {
    const packed = new Float32Array(new SharedArrayBuffer(8 * FLOAT_BYTES));
    packed.set([1, 2, 3, 4, 5, 6, 7, 8]);

    expectComponents(vec4.fromPacked(vec4.create(), packed, 1), 5, 6, 7, 8);
  });

  test('writes NaN for a row past the end', () => {
    const out = vec4.fromPacked(vec4.create(), new Float32Array(4), 1);

    expect(out[0]).toBeNaN();
    expect(out[1]).toBeNaN();
    expect(out[2]).toBeNaN();
    expect(out[3]).toBeNaN();
  });

  test('writes NaN for a negative row', () => {
    const out = vec4.fromPacked(vec4.create(), new Float32Array(4), -1);

    expect(out[0]).toBeNaN();
    expect(out[1]).toBeNaN();
    expect(out[2]).toBeNaN();
    expect(out[3]).toBeNaN();
  });

  test('writes NaN only for the components past the end', () => {
    const out = vec4.fromPacked(vec4.create(), new Float32Array([1, 2, 3, 4, 5, 6, 7]), 1);

    expect(out[0]).toBe(5);
    expect(out[1]).toBe(6);
    expect(out[2]).toBe(7);
    expect(out[3]).toBeNaN();
  });
});
