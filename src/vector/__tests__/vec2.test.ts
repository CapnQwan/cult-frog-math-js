// src/vector/__tests__/vec2.test.ts
import { describe, expect, test } from 'vitest';

import { clamp } from '../../scalars.js';
import * as vec2 from '../vec2.js';

import type { ReadonlyVec2, Vec2 } from '../_types/vec2.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/**
 * Exact comparison against float32-rounded expectations, so tests can use
 * natural literals like 0.1 without encoding the rounding by hand.
 */
function expectComponents(v: ReadonlyVec2, x: number, y: number): void {
  expect([v[0], v[1]]).toEqual([Math.fround(x), Math.fround(y)]);
}

/**
 * Test-only cast site: a Vec2 view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBuffer, index: number): Vec2 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 2) as Vec2;
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
    expectComponents(vec2.create(), 0, 0);
  });

  test('stores provided components in x, y order', () => {
    expectComponents(vec2.create(1, 2), 1, 2);
  });

  test('defaults only the omitted components', () => {
    expectComponents(vec2.create(5), 5, 0);
  });

  test('rounds components to float32', () => {
    const v = vec2.create(0.1, 0);
    expect(v[0]).not.toBe(0.1);
    expect(v[0]).toBe(Math.fround(0.1));
  });

  test('allocates a standalone two-element buffer', () => {
    const v = vec2.create();
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(2);
    expect(v.byteOffset).toBe(0);
    expect(v.buffer.byteLength).toBe(2 * FLOAT_BYTES);
  });
});

describe('clone', () => {
  test('copies components into a new vector with its own buffer', () => {
    const source = vec2.create(1, 2);
    const result = vec2.clone(source);

    expectComponents(result, 1, 2);
    expect(result).not.toBe(source);
    expect(result.buffer).not.toBe(source.buffer);
  });

  test('round-trips float32 values exactly', () => {
    const source = vec2.create(0.1, -0.7);
    const result = vec2.clone(source);

    expect(result[0]).toBe(source[0]);
    expect(result[1]).toBe(source[1]);
  });

  test('result and source are independent after cloning', () => {
    const source = vec2.create(1, 2);
    const result = vec2.clone(source);

    vec2.set(source, 9, 9);
    expectComponents(result, 1, 2);

    vec2.set(result, 4, 5);
    expectComponents(source, 9, 9);
  });

  test('accepts a readonly input', () => {
    const frozen: ReadonlyVec2 = vec2.create(1, 2);
    expectComponents(vec2.clone(frozen), 1, 2);
  });

  test('cloning a pooled view produces a standalone vector', () => {
    const pool = sequentialBuffer(6);
    const view = viewAt(pool, 2);
    const snapshot = vec2.clone(view);

    expect(snapshot.buffer).not.toBe(pool);
    expect(snapshot.byteOffset).toBe(0);
    expect(snapshot.buffer.byteLength).toBe(2 * FLOAT_BYTES);

    // The owning system writes to the pool; the snapshot must not move.
    vec2.set(view, 0, 0);
    expectComponents(snapshot, 3, 4);
  });
});

describe('set', () => {
  test('writes components and returns out', () => {
    const out = vec2.create();
    const result = vec2.set(out, 1, 2);

    expect(result).toBe(out);
    expectComponents(out, 1, 2);
  });

  test('overwrites existing values', () => {
    const out = vec2.create(7, 8);
    vec2.set(out, -1, 1);
    expectComponents(out, -1, 1);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.set(viewAt(pool, 2), 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 5, 6]);
  });
});

describe('copy', () => {
  test('copies components and returns out', () => {
    const out = vec2.create();
    const source = vec2.create(1, 2);
    const result = vec2.copy(out, source);

    expect(result).toBe(out);
    expectComponents(out, 1, 2);
  });

  test('never writes to the input', () => {
    const out = vec2.create(7, 8);
    const source = vec2.create(1, 2);
    vec2.copy(out, source);
    expectComponents(source, 1, 2);
  });

  test('supports chaining through nested calls', () => {
    const a = vec2.create();
    const b = vec2.create();
    vec2.copy(b, vec2.set(a, 1, 2));
    expectComponents(b, 1, 2);
  });

  test('out === input is a no-op', () => {
    const v = vec2.create(1, 2);
    vec2.copy(v, v);
    expectComponents(v, 1, 2);
  });

  test('overlapping views: out one element ahead of input', () => {
    // Buffer [1, 2, 3]; input covers [0..1], out covers [1..2].
    const buffer = sequentialBuffer(3);
    vec2.copy(viewAt(buffer, 1), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([1, 1, 2]);
  });

  test('overlapping views: out one element behind input', () => {
    // Buffer [1, 2, 3]; input covers [1..2], out covers [0..1].
    const buffer = sequentialBuffer(3);
    vec2.copy(viewAt(buffer, 0), viewAt(buffer, 1));

    expect(Array.from(new Float32Array(buffer))).toEqual([2, 3, 3]);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.copy(viewAt(pool, 2), vec2.create(0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 5, 6]);
  });
});

describe('isEqual', () => {
  test('vectors with the same components are equal', () => {
    expect(vec2.isEqual(vec2.create(1, 2), vec2.create(1, 2))).toBe(true);
  });

  test('a vector equals itself', () => {
    const v = vec2.create(1, 2);
    expect(vec2.isEqual(v, v)).toBe(true);
  });

  test('a difference in any single component makes them unequal', () => {
    const a = vec2.create(1, 2);
    for (let i = 0; i < 2; i++) {
      const b = vec2.clone(a);
      b[i] = 99;
      expect(vec2.isEqual(a, b)).toBe(false);
    }
  });

  test('is exact: a float32-sized difference is unequal', () => {
    expect(vec2.isEqual(vec2.create(1, 0), vec2.create(1 + 2 ** -23, 0))).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(vec2.isEqual(vec2.create(-0, 0), vec2.create(0, -0))).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const v = vec2.create(Number.NaN, 0);
    expect(vec2.isEqual(v, v)).toBe(false);
  });

  test('compares only the slots of each view', () => {
    // Buffer [1, 2, 1, 2]; views at 0 and 2 hold the same components.
    const buffer = new Float32Array([1, 2, 1, 2]).buffer;
    expect(vec2.isEqual(viewAt(buffer, 0), viewAt(buffer, 2))).toBe(true);
    expect(vec2.isEqual(viewAt(buffer, 0), viewAt(buffer, 1))).toBe(false);
  });

  test('accepts readonly inputs', () => {
    expect(vec2.isEqual(vec2.ZERO, vec2.create())).toBe(true);
  });
});

describe('isEqualEpsilon', () => {
  test('vectors with the same components are equal', () => {
    expect(vec2.isEqualEpsilon(vec2.create(1, 2), vec2.create(1, 2))).toBe(true);
  });

  test('differences within the default tolerance are equal', () => {
    expect(vec2.isEqualEpsilon(vec2.create(1, 0), vec2.create(1 + 2 ** -23, 1e-7))).toBe(true);
  });

  test('a difference beyond tolerance in any single component makes them unequal', () => {
    const a = vec2.create(1, 2);
    for (let i = 0; i < 2; i++) {
      const b = vec2.clone(a);
      b[i] = 99;
      expect(vec2.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('tolerance scales with magnitude', () => {
    // Adjacent float32 values near 10,000 are ~0.001 apart, far beyond EPSILON.
    const a = vec2.create(10000.5, 0);
    const b = vec2.create(10000.5 + 0.001, 0);
    expect(vec2.isEqual(a, b)).toBe(false);
    expect(vec2.isEqualEpsilon(a, b)).toBe(true);
  });

  test('accepts a custom tolerance', () => {
    expect(vec2.isEqualEpsilon(vec2.create(0, 0), vec2.create(0.05, 0), 0.1)).toBe(true);
    expect(vec2.isEqualEpsilon(vec2.create(0, 0), vec2.create(0.5, 0), 0.1)).toBe(false);
  });

  test('NaN is never equal', () => {
    const v = vec2.create(Number.NaN, 0);
    expect(vec2.isEqualEpsilon(v, v)).toBe(false);
  });
});

describe('isEqualXY', () => {
  test('matches the values just written by set', () => {
    const v = vec2.set(vec2.create(), 0.1, 0.2);
    expect(v[0]).not.toBe(0.1);
    expect(vec2.isEqualXY(v, 0.1, 0.2)).toBe(true);
  });

  test('a difference in any single component makes them unequal', () => {
    const v = vec2.create(1, 2);
    expect(vec2.isEqualXY(v, 99, 2)).toBe(false);
    expect(vec2.isEqualXY(v, 1, 99)).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(vec2.isEqualXY(vec2.create(0, -0), -0, 0)).toBe(true);
  });

  test('NaN is never equal', () => {
    expect(vec2.isEqualXY(vec2.create(Number.NaN, 0), Number.NaN, 0)).toBe(false);
  });

  test('accepts a readonly input', () => {
    expect(vec2.isEqualXY(vec2.UP, 0, 1)).toBe(true);
  });
});

describe('add', () => {
  test('works component by component and returns out', () => {
    const out = vec2.create();
    const result = vec2.add(out, vec2.create(8, 18), vec2.create(2, 3));

    expect(result).toBe(out);
    expectComponents(out, 8 + 2, 18 + 3);
  });

  test('never writes to the inputs', () => {
    const a = vec2.create(8, 18);
    const b = vec2.create(2, 3);
    vec2.add(vec2.create(), a, b);

    expectComponents(a, 8, 18);
    expectComponents(b, 2, 3);
  });

  test('out may be the first input', () => {
    const a = vec2.create(8, 18);
    vec2.add(a, a, vec2.create(2, 3));

    expectComponents(a, 8 + 2, 18 + 3);
  });

  test('out may be the second input', () => {
    const b = vec2.create(2, 3);
    vec2.add(b, vec2.create(8, 18), b);

    expectComponents(b, 8 + 2, 18 + 3);
  });

  test('both inputs may be the same vector', () => {
    const v = vec2.create(1, 2);

    expectComponents(vec2.add(vec2.create(), v, v), 1 + 1, 2 + 2);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.add(out, viewAt(buffer, 0), vec2.create(10, 20));

    expectComponents(out, 1 + 10, 2 + 20);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.add(out, viewAt(buffer, 1), vec2.create(10, 20));

    expectComponents(out, 2 + 10, 3 + 20);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.add(out, vec2.create(10, 20), viewAt(buffer, 0));

    expectComponents(out, 10 + 1, 20 + 2);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.add(out, vec2.create(10, 20), viewAt(buffer, 1));

    expectComponents(out, 10 + 2, 20 + 3);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec2.add(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 + 3, 2 + 4);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.add(viewAt(pool, 2), vec2.create(8, 18), vec2.create(2, 3));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      Math.fround(8 + 2),
      Math.fround(18 + 3),
      5,
      6,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(8, 18);
    const b: ReadonlyVec2 = vec2.create(2, 3);

    expectComponents(vec2.add(vec2.create(), a, b), 8 + 2, 18 + 3);
  });

  test('a small step can vanish against a large value', () => {
    const large = vec2.create(16777216, 16777216);
    const out = vec2.add(vec2.create(), large, vec2.create(1, 1));

    expect(vec2.isEqual(out, large)).toBe(true);
  });
});

describe('sub', () => {
  test('works component by component and returns out', () => {
    const out = vec2.create();
    const result = vec2.sub(out, vec2.create(8, 18), vec2.create(2, 3));

    expect(result).toBe(out);
    expectComponents(out, 8 - 2, 18 - 3);
  });

  test('never writes to the inputs', () => {
    const a = vec2.create(8, 18);
    const b = vec2.create(2, 3);
    vec2.sub(vec2.create(), a, b);

    expectComponents(a, 8, 18);
    expectComponents(b, 2, 3);
  });

  test('out may be the first input', () => {
    const a = vec2.create(8, 18);
    vec2.sub(a, a, vec2.create(2, 3));

    expectComponents(a, 8 - 2, 18 - 3);
  });

  test('out may be the second input', () => {
    const b = vec2.create(2, 3);
    vec2.sub(b, vec2.create(8, 18), b);

    expectComponents(b, 8 - 2, 18 - 3);
  });

  test('both inputs may be the same vector', () => {
    const v = vec2.create(1, 2);

    expectComponents(vec2.sub(vec2.create(), v, v), 1 - 1, 2 - 2);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.sub(out, viewAt(buffer, 0), vec2.create(10, 20));

    expectComponents(out, 1 - 10, 2 - 20);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.sub(out, viewAt(buffer, 1), vec2.create(10, 20));

    expectComponents(out, 2 - 10, 3 - 20);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.sub(out, vec2.create(10, 20), viewAt(buffer, 0));

    expectComponents(out, 10 - 1, 20 - 2);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.sub(out, vec2.create(10, 20), viewAt(buffer, 1));

    expectComponents(out, 10 - 2, 20 - 3);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec2.sub(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 - 3, 2 - 4);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.sub(viewAt(pool, 2), vec2.create(8, 18), vec2.create(2, 3));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      Math.fround(8 - 2),
      Math.fround(18 - 3),
      5,
      6,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(8, 18);
    const b: ReadonlyVec2 = vec2.create(2, 3);

    expectComponents(vec2.sub(vec2.create(), a, b), 8 - 2, 18 - 3);
  });
});

describe('mul', () => {
  test('works component by component and returns out', () => {
    const out = vec2.create();
    const result = vec2.mul(out, vec2.create(8, 18), vec2.create(2, 3));

    expect(result).toBe(out);
    expectComponents(out, 8 * 2, 18 * 3);
  });

  test('never writes to the inputs', () => {
    const a = vec2.create(8, 18);
    const b = vec2.create(2, 3);
    vec2.mul(vec2.create(), a, b);

    expectComponents(a, 8, 18);
    expectComponents(b, 2, 3);
  });

  test('out may be the first input', () => {
    const a = vec2.create(8, 18);
    vec2.mul(a, a, vec2.create(2, 3));

    expectComponents(a, 8 * 2, 18 * 3);
  });

  test('out may be the second input', () => {
    const b = vec2.create(2, 3);
    vec2.mul(b, vec2.create(8, 18), b);

    expectComponents(b, 8 * 2, 18 * 3);
  });

  test('both inputs may be the same vector', () => {
    const v = vec2.create(1, 2);

    expectComponents(vec2.mul(vec2.create(), v, v), 1 * 1, 2 * 2);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.mul(out, viewAt(buffer, 0), vec2.create(10, 20));

    expectComponents(out, 1 * 10, 2 * 20);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.mul(out, viewAt(buffer, 1), vec2.create(10, 20));

    expectComponents(out, 2 * 10, 3 * 20);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.mul(out, vec2.create(10, 20), viewAt(buffer, 0));

    expectComponents(out, 10 * 1, 20 * 2);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.mul(out, vec2.create(10, 20), viewAt(buffer, 1));

    expectComponents(out, 10 * 2, 20 * 3);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec2.mul(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 * 3, 2 * 4);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.mul(viewAt(pool, 2), vec2.create(8, 18), vec2.create(2, 3));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      Math.fround(8 * 2),
      Math.fround(18 * 3),
      5,
      6,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(8, 18);
    const b: ReadonlyVec2 = vec2.create(2, 3);

    expectComponents(vec2.mul(vec2.create(), a, b), 8 * 2, 18 * 3);
  });
});

describe('div', () => {
  test('works component by component and returns out', () => {
    const out = vec2.create();
    const result = vec2.div(out, vec2.create(8, 18), vec2.create(2, 3));

    expect(result).toBe(out);
    expectComponents(out, 8 / 2, 18 / 3);
  });

  test('never writes to the inputs', () => {
    const a = vec2.create(8, 18);
    const b = vec2.create(2, 3);
    vec2.div(vec2.create(), a, b);

    expectComponents(a, 8, 18);
    expectComponents(b, 2, 3);
  });

  test('out may be the first input', () => {
    const a = vec2.create(8, 18);
    vec2.div(a, a, vec2.create(2, 3));

    expectComponents(a, 8 / 2, 18 / 3);
  });

  test('out may be the second input', () => {
    const b = vec2.create(2, 3);
    vec2.div(b, vec2.create(8, 18), b);

    expectComponents(b, 8 / 2, 18 / 3);
  });

  test('both inputs may be the same vector', () => {
    const v = vec2.create(1, 2);

    expectComponents(vec2.div(vec2.create(), v, v), 1 / 1, 2 / 2);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.div(out, viewAt(buffer, 0), vec2.create(10, 20));

    expectComponents(out, 1 / 10, 2 / 20);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.div(out, viewAt(buffer, 1), vec2.create(10, 20));

    expectComponents(out, 2 / 10, 3 / 20);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.div(out, vec2.create(10, 20), viewAt(buffer, 0));

    expectComponents(out, 10 / 1, 20 / 2);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.div(out, vec2.create(10, 20), viewAt(buffer, 1));

    expectComponents(out, 10 / 2, 20 / 3);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec2.div(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 / 3, 2 / 4);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.div(viewAt(pool, 2), vec2.create(8, 18), vec2.create(2, 3));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      Math.fround(8 / 2),
      Math.fround(18 / 3),
      5,
      6,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(8, 18);
    const b: ReadonlyVec2 = vec2.create(2, 3);

    expectComponents(vec2.div(vec2.create(), a, b), 8 / 2, 18 / 3);
  });

  test('a zero divisor gives a signed Infinity', () => {
    const out = vec2.create();
    vec2.div(out, vec2.create(1, -1), vec2.create());

    expectComponents(out, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);
  });

  test('a negative zero divisor flips the sign of Infinity', () => {
    const out = vec2.create();
    vec2.div(out, vec2.create(1, 1), vec2.create(-0, -0));

    expectComponents(out, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  });

  test('zero divided by zero is NaN', () => {
    const out = vec2.div(vec2.create(), vec2.create(), vec2.create());

    expectComponents(out, Number.NaN, Number.NaN);
  });

  test('a zero divisor only affects its own component', () => {
    const divisor = vec2.create(2, 3);
    divisor[1] = 0;
    const out = vec2.div(vec2.create(), vec2.create(8, 18), divisor);

    expectComponents(out, 8 / 2, Number.POSITIVE_INFINITY);
  });

  test('small divisors divide normally rather than being treated as zero', () => {
    const tiny = vec2.create(1e-7, 1e-7);
    const out = vec2.div(vec2.create(), tiny, tiny);

    expectComponents(out, 1, 1);
  });

  test('a quotient too large for float32 becomes Infinity', () => {
    const out = vec2.div(vec2.create(), vec2.create(1e30, 1e30), vec2.create(1e-30, 1e-30));

    expectComponents(out, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  });
});

describe('scale', () => {
  test('multiplies every component and returns out', () => {
    const out = vec2.create();
    const result = vec2.scale(out, vec2.create(8, 18), 2.5);

    expect(result).toBe(out);
    expectComponents(out, 8 * 2.5, 18 * 2.5);
  });

  test('never writes to the input', () => {
    const a = vec2.create(8, 18);
    vec2.scale(vec2.create(), a, 2);

    expectComponents(a, 8, 18);
  });

  test('out may be the input', () => {
    const a = vec2.create(8, 18);
    vec2.scale(a, a, 2);

    expectComponents(a, 8 * 2, 18 * 2);
  });

  test('a negative scalar flips every component', () => {
    expectComponents(vec2.scale(vec2.create(), vec2.create(8, 18), -1), -8, -18);
  });

  test('a scalar of zero clears every component', () => {
    expectComponents(vec2.scale(vec2.create(), vec2.create(8, 18), 0), 0, 0);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.scale(out, viewAt(buffer, 0), 10);

    expectComponents(out, 1 * 10, 2 * 10);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.scale(out, viewAt(buffer, 1), 10);

    expectComponents(out, 2 * 10, 3 * 10);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.scale(viewAt(pool, 2), vec2.create(8, 18), 2);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 16, 36, 5, 6]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec2 = vec2.create(8, 18);

    expectComponents(vec2.scale(vec2.create(), a, 2), 8 * 2, 18 * 2);
  });
});

describe('magnitudeSq', () => {
  test('sums the squared components', () => {
    expect(vec2.magnitudeSq(vec2.create(3, 4))).toBe(25);
  });

  test('every axis counts', () => {
    for (let i = 0; i < 2; i++) {
      const v = vec2.create();
      v[i] = 3;
      expect(vec2.magnitudeSq(v)).toBe(9);
    }
  });

  test('negative components square to the same result', () => {
    expect(vec2.magnitudeSq(vec2.create(-3, -4))).toBe(25);
  });

  test('a zero vector has a squared length of zero', () => {
    expect(vec2.magnitudeSq(vec2.create())).toBe(0);
  });

  test('stays in range at the extremes of float32', () => {
    expect(vec2.magnitudeSq(vec2.create(3e38, 3e38))).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(vec2.magnitudeSq(vec2.create(1e-45, 1e-45))).toBeGreaterThan(0);
  });

  test('reads only the slots of a pooled view', () => {
    const pool = sequentialBuffer(6);
    expect(vec2.magnitudeSq(viewAt(pool, 2))).toBe(3 * 3 + 4 * 4);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec2 = vec2.create(3, 4);
    expect(vec2.magnitudeSq(a)).toBe(25);
  });
});

describe('magnitude', () => {
  test('returns the length', () => {
    expect(vec2.magnitude(vec2.create(3, 4))).toBe(5);
  });

  test('every axis counts', () => {
    for (let i = 0; i < 2; i++) {
      const v = vec2.create();
      v[i] = 3;
      expect(vec2.magnitude(v)).toBe(3);
    }
  });

  test('a zero vector has a length of zero', () => {
    expect(vec2.magnitude(vec2.create())).toBe(0);
  });

  test('works on the stored float32 value', () => {
    expect(vec2.magnitude(vec2.create(0.1, 0))).toBe(Math.fround(0.1));
  });

  test('stays in range at the extremes of float32', () => {
    expect(vec2.magnitude(vec2.create(3e38, 3e38))).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(vec2.magnitude(vec2.create(1e-45, 1e-45))).toBeGreaterThan(0);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec2 = vec2.create(3, 4);
    expect(vec2.magnitude(a)).toBe(5);
  });
});

describe('distanceSq', () => {
  test('sums the squared differences', () => {
    expect(vec2.distanceSq(vec2.create(4, 6), vec2.create(1, 2))).toBe(25);
  });

  test('the order does not matter', () => {
    const a = vec2.create(4, 6);
    const b = vec2.create(1, 2);
    expect(vec2.distanceSq(b, a)).toBe(vec2.distanceSq(a, b));
  });

  test('every axis counts', () => {
    for (let i = 0; i < 2; i++) {
      const v = vec2.create();
      v[i] = 3;
      expect(vec2.distanceSq(v, vec2.create())).toBe(9);
    }
  });

  test('a vector is no distance from itself', () => {
    const v = vec2.create(3, 4);
    expect(vec2.distanceSq(v, v)).toBe(0);
  });

  test('works with overlapping views', () => {
    const buffer = sequentialBuffer(3);
    expect(vec2.distanceSq(viewAt(buffer, 1), viewAt(buffer, 0))).toBe(2);
  });

  test('keeps float64 precision instead of rounding the difference to float32', () => {
    const a = vec2.create(0, 10000000);
    const b = vec2.create(0, 0.1);
    const difference = Math.fround(1e7) - Math.fround(0.1);

    expect(vec2.distanceSq(a, b)).toBe(difference * difference);
  });

  test('does not overflow at opposite ends of float32', () => {
    const a = vec2.create(0, 3e38);
    const b = vec2.create(0, -3e38);

    expect(vec2.distanceSq(a, b)).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(4, 6);
    const b: ReadonlyVec2 = vec2.create(1, 2);
    expect(vec2.distanceSq(a, b)).toBe(25);
  });
});

describe('distance', () => {
  test('returns the distance', () => {
    expect(vec2.distance(vec2.create(4, 6), vec2.create(1, 2))).toBe(5);
  });

  test('the order does not matter', () => {
    const a = vec2.create(4, 6);
    const b = vec2.create(1, 2);
    expect(vec2.distance(b, a)).toBe(vec2.distance(a, b));
  });

  test('every axis counts', () => {
    for (let i = 0; i < 2; i++) {
      const v = vec2.create();
      v[i] = 3;
      expect(vec2.distance(vec2.create(), v)).toBe(3);
    }
  });

  test('a vector is no distance from itself', () => {
    const v = vec2.create(3, 4);
    expect(vec2.distance(v, v)).toBe(0);
  });

  test('keeps float64 precision instead of rounding the difference to float32', () => {
    const a = vec2.create(0, 10000000);
    const b = vec2.create(0, 0.1);

    expect(vec2.distance(a, b)).toBe(Math.fround(1e7) - Math.fround(0.1));
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(4, 6);
    const b: ReadonlyVec2 = vec2.create(1, 2);
    expect(vec2.distance(a, b)).toBe(5);
  });
});

describe('normalize', () => {
  test('keeps the direction, shortens to unit length and returns out', () => {
    const out = vec2.create();
    const result = vec2.normalize(out, vec2.create(3, 4));

    expect(result).toBe(out);
    expectComponents(out, 3 / 5, 4 / 5);
  });

  test('every axis normalizes to that unit axis', () => {
    for (let i = 0; i < 2; i++) {
      const v = vec2.create();
      v[i] = -3;
      const out = vec2.normalize(vec2.create(), v);

      expect(out[i]).toBe(-1);
      expect(vec2.magnitude(out)).toBe(1);
    }
  });

  test.each([1e-30, 1e-3, 1, 1e3, 1e30])('gives unit length for inputs of scale %d', (size) => {
    const out = vec2.normalize(vec2.create(), vec2.create(3 * size, 4 * size));
    expect(vec2.magnitude(out)).toBeCloseTo(1, 6);
  });

  test('a zero vector stays zero rather than becoming NaN', () => {
    expectComponents(vec2.normalize(vec2.create(), vec2.create()), 0, 0);
  });

  test('a zero vector still overwrites whatever out held', () => {
    expectComponents(vec2.normalize(vec2.create(9, 9), vec2.create()), 0, 0);
  });

  test('negative zero counts as a zero vector', () => {
    const out = vec2.normalize(vec2.create(), vec2.create(-0, -0));

    for (let i = 0; i < 2; i++) expect(out[i]).toBe(-0);
  });

  test('very short vectors still normalize rather than being treated as zero', () => {
    const out = vec2.normalize(vec2.create(), vec2.create(0, 1e-7));
    expectComponents(out, 0, 1);
  });

  test('handles the extremes of float32', () => {
    const large = vec2.create(0, 3e38);
    const small = vec2.create(0, 1e-45);

    expectComponents(vec2.normalize(vec2.create(), large), 0, 1);
    expectComponents(vec2.normalize(vec2.create(), small), 0, 1);
  });

  test('a NaN component makes the whole result NaN', () => {
    const out = vec2.normalize(vec2.create(), vec2.create(Number.NaN, 1));
    expectComponents(out, Number.NaN, Number.NaN);
  });

  test('an infinite component gives NaN in its slot and zero in the finite ones', () => {
    const out = vec2.normalize(vec2.create(), vec2.create(Number.POSITIVE_INFINITY, 1));
    expectComponents(out, Number.NaN, 0);
  });

  test('never writes to the input', () => {
    const a = vec2.create(3, 4);
    vec2.normalize(vec2.create(), a);

    expectComponents(a, 3, 4);
  });

  test('out may be the input', () => {
    const a = vec2.create(3, 4);
    vec2.normalize(a, a);

    expectComponents(a, 3 / 5, 4 / 5);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.normalize(out, viewAt(buffer, 0));

    const mag = Math.sqrt(1 * 1 + 2 * 2);
    expectComponents(out, 1 / mag, 2 / mag);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.normalize(out, viewAt(buffer, 1));

    const mag = Math.sqrt(2 * 2 + 3 * 3);
    expectComponents(out, 2 / mag, 3 / mag);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.normalize(viewAt(pool, 2), vec2.create());

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 5, 6]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec2 = vec2.create(3, 4);

    expectComponents(vec2.normalize(vec2.create(), a), 3 / 5, 4 / 5);
  });
});

describe('dot', () => {
  test('multiplies matching components and adds the results', () => {
    expect(vec2.dot(vec2.create(1, 2), vec2.create(3, 4))).toBe(11);
  });

  test('the order does not matter', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(3, 4);

    expect(vec2.dot(a, b)).toBe(vec2.dot(b, a));
  });

  test('a vector dotted with itself is its squared magnitude', () => {
    const a = vec2.create(1, 2);

    expect(vec2.dot(a, a)).toBe(vec2.magnitudeSq(a));
  });

  test('unit vectors give the cosine of the angle between them', () => {
    const x = vec2.create(1, 0);

    expect(vec2.dot(x, x)).toBe(1);
    expect(vec2.dot(x, vec2.create(0, 1))).toBe(0);
    expect(vec2.dot(x, vec2.create(-1, 0))).toBe(-1);
  });

  test('the sign holds at any length', () => {
    const long = vec2.create(10, 0);

    expect(vec2.dot(long, vec2.create(0.5, 0.5))).toBe(5);
    expect(vec2.dot(long, vec2.create(0, 0.5))).toBe(0);
    expect(vec2.dot(long, vec2.create(-0.5, 0.5))).toBe(-5);
  });

  test('a zero vector gives zero', () => {
    expect(vec2.dot(vec2.create(1, 2), vec2.create())).toBe(0);
  });

  test('gives -0 when every product is -0', () => {
    expect(vec2.dot(vec2.create(-1, -1), vec2.create())).toBe(-0);
  });

  test('does not round the result to float32', () => {
    const tenth = Math.fround(0.1);
    const result = vec2.dot(vec2.create(0.1), vec2.create(0.1));

    expect(result).toBe(tenth * tenth);
    expect(result).not.toBe(Math.fround(result));
  });

  test('is not limited to the float32 range', () => {
    const large = Math.fround(3e38);

    expect(vec2.dot(vec2.create(3e38), vec2.create(3e38))).toBe(large * large);
  });

  test('normalized vectors can exceed 1, so the result needs clamping before acos', () => {
    const a = vec2.normalize(vec2.create(), vec2.create(3, 4));
    const result = vec2.dot(a, a);

    expect(result).toBeGreaterThan(1);
    expect(Math.acos(result)).toBeNaN();
    expect(Math.acos(clamp(result, -1, 1))).toBe(0);
  });

  test('a NaN component gives NaN', () => {
    expect(vec2.dot(vec2.create(Number.NaN), vec2.create(1, 1))).toBeNaN();
  });

  test('an infinite component gives NaN against zero and Infinity otherwise', () => {
    const infinite = vec2.create(Number.POSITIVE_INFINITY);

    expect(vec2.dot(infinite, vec2.create(0, 1))).toBeNaN();
    expect(vec2.dot(infinite, vec2.create(1, 0))).toBe(Number.POSITIVE_INFINITY);
  });

  test('never writes to the inputs', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(3, 4);
    vec2.dot(a, b);

    expectComponents(a, 1, 2);
    expectComponents(b, 3, 4);
  });

  test('reads only its own slots when the inputs are pooled views', () => {
    const pool = sequentialBuffer(5);

    expect(vec2.dot(viewAt(pool, 1), viewAt(pool, 3))).toBe(23);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(1, 2);
    const b: ReadonlyVec2 = vec2.create(3, 4);

    expect(vec2.dot(a, b)).toBe(11);
  });
});

describe('scaleAndAdd', () => {
  test('adds b times the scalar to a, and returns out', () => {
    const out = vec2.create();
    const result = vec2.scaleAndAdd(out, vec2.create(1, 2), vec2.create(10, 20), 0.5);

    expect(result).toBe(out);
    expectComponents(out, 6, 12);
  });

  test('a scalar of 0 gives a, and a scalar of 1 gives a + b', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(10, 20);

    expectComponents(vec2.scaleAndAdd(vec2.create(), a, b, 0), 1, 2);
    expectComponents(vec2.scaleAndAdd(vec2.create(), a, b, 1), 11, 22);
  });

  test('a negative scalar steps backwards', () => {
    const out = vec2.scaleAndAdd(vec2.create(), vec2.create(1, 2), vec2.create(10, 20), -1);

    expectComponents(out, -9, -18);
  });

  test('rounds once, so it can differ from scale followed by add', () => {
    const a = vec2.create(1);
    const b = vec2.create(9.81);
    const dt = 1 / 60;
    const once = vec2.scaleAndAdd(vec2.create(), a, b, dt);
    const twice = vec2.add(vec2.create(), a, vec2.scale(vec2.create(), b, dt));

    expect(once[0]).toBe(Math.fround(1 + Math.fround(9.81) * dt));
    expect(once[0]).not.toBe(twice[0]);
  });

  test('b times the scalar does not overflow before the sum', () => {
    const out = vec2.scaleAndAdd(vec2.create(), vec2.create(-3e38), vec2.create(3e38), 2);

    expect(out[0]).toBe(Math.fround(3e38));
  });

  test('a result too large for float32 becomes Infinity', () => {
    const out = vec2.scaleAndAdd(vec2.create(), vec2.create(3e38), vec2.create(3e38), 1);

    expect(out[0]).toBe(Number.POSITIVE_INFINITY);
  });

  test('a small step can vanish against a large value', () => {
    const out = vec2.scaleAndAdd(vec2.create(), vec2.create(16777216), vec2.create(1), 1);

    expect(out[0]).toBe(16777216);
  });

  test('a NaN scalar makes the whole result NaN', () => {
    const out = vec2.scaleAndAdd(vec2.create(), vec2.create(1, 2), vec2.create(10, 20), Number.NaN);

    expectComponents(out, Number.NaN, Number.NaN);
  });

  test('an infinite component in b gives NaN when the scalar is 0', () => {
    const out = vec2.scaleAndAdd(
      vec2.create(),
      vec2.create(1, 2),
      vec2.create(Number.POSITIVE_INFINITY),
      0
    );

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(2);
  });

  test('never writes to the inputs', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(10, 20);
    vec2.scaleAndAdd(vec2.create(), a, b, 2);

    expectComponents(a, 1, 2);
    expectComponents(b, 10, 20);
  });

  test('out may be the first input', () => {
    const a = vec2.create(1, 2);
    vec2.scaleAndAdd(a, a, vec2.create(10, 20), 2);

    expectComponents(a, 21, 42);
  });

  test('out may be the second input', () => {
    const b = vec2.create(10, 20);
    vec2.scaleAndAdd(b, vec2.create(1, 2), b, 2);

    expectComponents(b, 21, 42);
  });

  test('out may be both inputs', () => {
    const a = vec2.create(1, 2);
    vec2.scaleAndAdd(a, a, a, 2);

    expectComponents(a, 3, 6);
  });

  test('overlapping views: out one element ahead of the first input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec2.scaleAndAdd(out, viewAt(buffer, 0), viewAt(buffer, 2), 2);

    expectComponents(out, 7, 10);
  });

  test('overlapping views: out one element behind the first input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec2.scaleAndAdd(out, viewAt(buffer, 1), viewAt(buffer, 3), 2);

    expectComponents(out, 10, 13);
  });

  test('overlapping views: out one element ahead of the second input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 3);
    vec2.scaleAndAdd(out, viewAt(buffer, 0), viewAt(buffer, 2), 2);

    expectComponents(out, 7, 10);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.scaleAndAdd(viewAt(pool, 2), vec2.create(0, 0), vec2.create(1, 1), 1);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 1, 1, 5, 6]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(1, 2);
    const b: ReadonlyVec2 = vec2.create(10, 20);

    expectComponents(vec2.scaleAndAdd(vec2.create(), a, b, 2), 21, 42);
  });
});

describe('negate', () => {
  test('flips the sign of every component and returns out', () => {
    const out = vec2.create();
    const result = vec2.negate(out, vec2.create(1, -2));

    expect(result).toBe(out);
    expectComponents(out, -1, 2);
  });

  test('negating twice gives the original back', () => {
    const a = vec2.create(1, 2);

    expectComponents(vec2.negate(a, vec2.negate(a, a)), 1, 2);
  });

  test('a zero component becomes -0, which isEqual still treats as zero', () => {
    const zero = vec2.create();
    const out = vec2.negate(vec2.create(), zero);

    expect(out[0]).toBe(-0);
    expect(vec2.isEqual(out, zero)).toBe(true);
  });

  test('-0 becomes 0', () => {
    const out = vec2.negate(vec2.create(), vec2.create(-0));

    expect(out[0]).toBe(0);
  });

  test('NaN stays NaN and Infinity flips', () => {
    const out = vec2.negate(vec2.create(), vec2.create(Number.NaN, Number.POSITIVE_INFINITY));

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(Number.NEGATIVE_INFINITY);
  });

  test('never writes to the input', () => {
    const a = vec2.create(1, 2);
    vec2.negate(vec2.create(), a);

    expectComponents(a, 1, 2);
  });

  test('out may be the input', () => {
    const a = vec2.create(1, 2);
    vec2.negate(a, a);

    expectComponents(a, -1, -2);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 1);
    vec2.negate(out, viewAt(buffer, 0));

    expectComponents(out, -1, -2);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(3);
    const out = viewAt(buffer, 0);
    vec2.negate(out, viewAt(buffer, 1));

    expectComponents(out, -2, -3);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.negate(viewAt(pool, 2), vec2.create(1, 1));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, -1, -1, 5, 6]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec2 = vec2.create(1, 2);

    expectComponents(vec2.negate(vec2.create(), a), -1, -2);
  });
});

describe('lerp', () => {
  test('moves every component from a towards b, and returns out', () => {
    const out = vec2.create();
    const result = vec2.lerp(out, vec2.create(1, 2), vec2.create(10, 20), 0.25);

    expect(result).toBe(out);
    expectComponents(out, 3.25, 6.5);
  });

  test('t of 0 gives a and t of 1 gives b, exactly', () => {
    const a = vec2.create(0.1);
    const b = vec2.create(0.7);

    expect(vec2.isEqual(vec2.lerp(vec2.create(), a, b, 0), a)).toBe(true);
    expect(vec2.isEqual(vec2.lerp(vec2.create(), a, b, 1), b)).toBe(true);
  });

  test('does not clamp t, so it carries on past either end', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(10, 20);

    expectComponents(vec2.lerp(vec2.create(), a, b, 2), 19, 38);
    expectComponents(vec2.lerp(vec2.create(), a, b, -1), -8, -16);
  });

  test('stays on a when a and b are equal', () => {
    const a = vec2.create(0.1);

    expect(vec2.isEqual(vec2.lerp(vec2.create(), a, a, 0.3), a)).toBe(true);
  });

  test('handles the extremes of float32 without overflowing', () => {
    const out = vec2.lerp(vec2.create(), vec2.create(3e38), vec2.create(-3e38), 0.5);

    expect(out[0]).toBe(0);
  });

  test('only misses b at t of 1 when the two differ enormously in scale', () => {
    const close = vec2.lerp(vec2.create(), vec2.create(1e6), vec2.create(0.1), 1);
    const far = vec2.lerp(vec2.create(), vec2.create(1e8), vec2.create(0.1), 1);

    expect(close[0]).toBe(Math.fround(0.1));
    expect(far[0]).not.toBe(Math.fround(0.1));
    expect(far[0]).toBeCloseTo(0.1, 6);
  });

  test('blending directions does not keep their length', () => {
    const halfway = vec2.lerp(vec2.create(), vec2.create(1, 0), vec2.create(0, 1), 0.5);

    expect(vec2.magnitude(halfway)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(
      vec2.magnitude(vec2.lerp(vec2.create(), vec2.create(1, 0), vec2.create(-1, 0), 0.5))
    ).toBe(0);
  });

  test('a fixed t depends on the step count, and an exponential t does not', () => {
    const reachedAfter = (steps: number, t: number): number => {
      const current = vec2.create();
      const target = vec2.create(1);
      for (let i = 0; i < steps; i++) vec2.lerp(current, current, target, t);
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
    const out = vec2.lerp(vec2.create(), vec2.create(1, 2), vec2.create(10, 20), Number.NaN);

    expectComponents(out, Number.NaN, Number.NaN);
  });

  test('an infinite component in a gives NaN from t of 0 upwards', () => {
    const a = vec2.create(Number.POSITIVE_INFINITY);
    const b = vec2.create(1, 1);

    expect(vec2.lerp(vec2.create(), a, b, 0)[0]).toBeNaN();
    expect(vec2.lerp(vec2.create(), a, b, 0.5)[0]).toBeNaN();
    expect(vec2.lerp(vec2.create(), a, b, 1)[0]).toBeNaN();
  });

  test('an infinite component in b gives NaN at t of 0 and Infinity above it', () => {
    const a = vec2.create(1, 1);
    const b = vec2.create(Number.POSITIVE_INFINITY);

    expect(vec2.lerp(vec2.create(), a, b, 0)[0]).toBeNaN();
    expect(vec2.lerp(vec2.create(), a, b, 0.5)[0]).toBe(Number.POSITIVE_INFINITY);
  });

  test('never writes to the inputs', () => {
    const a = vec2.create(1, 2);
    const b = vec2.create(10, 20);
    vec2.lerp(vec2.create(), a, b, 0.5);

    expectComponents(a, 1, 2);
    expectComponents(b, 10, 20);
  });

  test('out may be the first input', () => {
    const a = vec2.create(1, 2);
    vec2.lerp(a, a, vec2.create(10, 20), 0.5);

    expectComponents(a, 5.5, 11);
  });

  test('out may be the second input', () => {
    const b = vec2.create(10, 20);
    vec2.lerp(b, vec2.create(1, 2), b, 0.5);

    expectComponents(b, 5.5, 11);
  });

  test('overlapping views: out one element ahead of the first input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec2.lerp(out, viewAt(buffer, 0), viewAt(buffer, 2), 0.75);

    expectComponents(out, 2.5, 3.5);
  });

  test('overlapping views: out one element behind the first input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 0);
    vec2.lerp(out, viewAt(buffer, 1), viewAt(buffer, 3), 0.75);

    expectComponents(out, 3.5, 4.5);
  });

  test('overlapping views: out one element ahead of the second input', () => {
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 3);
    vec2.lerp(out, viewAt(buffer, 0), viewAt(buffer, 2), 0.75);

    expectComponents(out, 2.5, 3.5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(6);
    vec2.lerp(viewAt(pool, 2), vec2.create(0, 0), vec2.create(1, 1), 0.5);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0.5, 0.5, 5, 6]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec2 = vec2.create(1, 2);
    const b: ReadonlyVec2 = vec2.create(10, 20);

    expectComponents(vec2.lerp(vec2.create(), a, b, 0.5), 5.5, 11);
  });
});
