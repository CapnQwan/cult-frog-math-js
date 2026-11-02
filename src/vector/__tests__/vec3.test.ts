// src/vector/__tests__/vec3.test.ts
import { describe, expect, test } from 'vitest';

import { clamp } from '../../scalars.js';
import * as vec3 from '../vec3.js';

import type { ReadonlyVec3, Vec3 } from '../_types/vec3.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/**
 * Exact comparison against float32-rounded expectations, so tests can use
 * natural literals like 0.1 without encoding the rounding by hand.
 */
function expectComponents(v: ReadonlyVec3, x: number, y: number, z: number): void {
  expect([v[0], v[1], v[2]]).toEqual([Math.fround(x), Math.fround(y), Math.fround(z)]);
}

/**
 * Test-only cast site: a Vec3 view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBufferLike, index: number): Vec3 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 3) as Vec3;
}

/** A buffer of `count` floats initialised to 1, 2, 3, ... so every slot is distinguishable. */
function sequentialBuffer(count: number, shared = false): ArrayBufferLike {
  const bytes = count * FLOAT_BYTES;
  const buffer = shared ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = i + 1;
  return buffer;
}

describe('create', () => {
  test('defaults every component to zero', () => {
    expectComponents(vec3.create(), 0, 0, 0);
  });

  test('stores provided components in x, y, z order', () => {
    expectComponents(vec3.create(1, 2, 3), 1, 2, 3);
  });

  test('defaults only the omitted components', () => {
    expectComponents(vec3.create(5), 5, 0, 0);
    expectComponents(vec3.create(5, 6), 5, 6, 0);
  });

  test('rounds components to float32', () => {
    const v = vec3.create(0.1, 0, 0);
    expect(v[0]).not.toBe(0.1);
    expect(v[0]).toBe(Math.fround(0.1));
  });

  test('allocates a standalone three-element buffer', () => {
    const v = vec3.create();
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(3);
    expect(v.byteOffset).toBe(0);
    expect(v.buffer.byteLength).toBe(3 * FLOAT_BYTES);
  });
});

describe('clone', () => {
  test('copies components into a new vector with its own buffer', () => {
    const source = vec3.create(1, 2, 3);
    const result = vec3.clone(source);

    expectComponents(result, 1, 2, 3);
    expect(result).not.toBe(source);
    expect(result.buffer).not.toBe(source.buffer);
  });

  test('round-trips float32 values exactly', () => {
    const source = vec3.create(0.1, -0.7, 1e-7);
    const result = vec3.clone(source);

    expect(result[0]).toBe(source[0]);
    expect(result[1]).toBe(source[1]);
    expect(result[2]).toBe(source[2]);
  });

  test('result and source are independent after cloning', () => {
    const source = vec3.create(1, 2, 3);
    const result = vec3.clone(source);

    vec3.set(source, 9, 9, 9);
    expectComponents(result, 1, 2, 3);

    vec3.set(result, 4, 5, 6);
    expectComponents(source, 9, 9, 9);
  });

  test('accepts a readonly input', () => {
    const frozen: ReadonlyVec3 = vec3.create(1, 2, 3);
    expectComponents(vec3.clone(frozen), 1, 2, 3);
  });

  test('cloning a pooled view produces a standalone vector', () => {
    const pool = sequentialBuffer(9);
    const view = viewAt(pool, 3);
    const snapshot = vec3.clone(view);

    expect(snapshot.buffer).not.toBe(pool);
    expect(snapshot.byteOffset).toBe(0);
    expect(snapshot.buffer.byteLength).toBe(3 * FLOAT_BYTES);

    // The owning system writes to the pool; the snapshot must not move.
    vec3.set(view, 0, 0, 0);
    expectComponents(snapshot, 4, 5, 6);
  });
});

describe('set', () => {
  test('writes components and returns out', () => {
    const out = vec3.create();
    const result = vec3.set(out, 1, 2, 3);

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3);
  });

  test('overwrites existing values', () => {
    const out = vec3.create(7, 8, 9);
    vec3.set(out, -1, 0, 1);
    expectComponents(out, -1, 0, 1);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.set(viewAt(pool, 3), 0, 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 0, 0, 0, 7, 8, 9]);
  });
});

describe('copy', () => {
  test('copies components and returns out', () => {
    const out = vec3.create();
    const source = vec3.create(1, 2, 3);
    const result = vec3.copy(out, source);

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3);
  });

  test('never writes to the input', () => {
    const out = vec3.create(7, 8, 9);
    const source = vec3.create(1, 2, 3);
    vec3.copy(out, source);
    expectComponents(source, 1, 2, 3);
  });

  test('supports chaining through nested calls', () => {
    const a = vec3.create();
    const b = vec3.create();
    vec3.copy(b, vec3.set(a, 1, 2, 3));
    expectComponents(b, 1, 2, 3);
  });

  test('out === input is a no-op', () => {
    const v = vec3.create(1, 2, 3);
    vec3.copy(v, v);
    expectComponents(v, 1, 2, 3);
  });

  test('overlapping views: out one element ahead of input', () => {
    // Buffer [1, 2, 3, 4]; input covers [0..2], out covers [1..3].
    const buffer = sequentialBuffer(4);
    vec3.copy(viewAt(buffer, 1), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([1, 1, 2, 3]);
  });

  test('overlapping views: out one element behind input', () => {
    // Buffer [1, 2, 3, 4]; input covers [1..3], out covers [0..2].
    const buffer = sequentialBuffer(4);
    vec3.copy(viewAt(buffer, 0), viewAt(buffer, 1));

    expect(Array.from(new Float32Array(buffer))).toEqual([2, 3, 4, 4]);
  });

  test('overlapping views over a SharedArrayBuffer behave the same', () => {
    // Buffer [1, 2, 3, 4]; input covers [0..2], out covers [1..3].
    const buffer = sequentialBuffer(4, true);
    vec3.copy(viewAt(buffer, 1), viewAt(buffer, 0));

    expect(buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(Array.from(new Float32Array(buffer))).toEqual([1, 1, 2, 3]);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.copy(viewAt(pool, 3), vec3.create(0, 0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 0, 0, 0, 7, 8, 9]);
  });
});

describe('isEqual', () => {
  test('vectors with the same components are equal', () => {
    expect(vec3.isEqual(vec3.create(1, 2, 3), vec3.create(1, 2, 3))).toBe(true);
  });

  test('a vector equals itself', () => {
    const v = vec3.create(1, 2, 3);
    expect(vec3.isEqual(v, v)).toBe(true);
  });

  test('a difference in any single component makes them unequal', () => {
    const a = vec3.create(1, 2, 3);
    for (let i = 0; i < 3; i++) {
      const b = vec3.clone(a);
      b[i] = 99;
      expect(vec3.isEqual(a, b)).toBe(false);
    }
  });

  test('is exact: a float32-sized difference is unequal', () => {
    expect(vec3.isEqual(vec3.create(1, 0, 0), vec3.create(1 + 2 ** -23, 0, 0))).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(vec3.isEqual(vec3.create(-0, 0, -0), vec3.create(0, -0, 0))).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const v = vec3.create(0, 0, Number.NaN);
    expect(vec3.isEqual(v, v)).toBe(false);
  });

  test('compares only the slots of each view', () => {
    // Buffer [1, 2, 3, 1, 2, 3]; views at 0 and 3 hold the same components.
    const buffer = new Float32Array([1, 2, 3, 1, 2, 3]).buffer;
    expect(vec3.isEqual(viewAt(buffer, 0), viewAt(buffer, 3))).toBe(true);
    expect(vec3.isEqual(viewAt(buffer, 0), viewAt(buffer, 1))).toBe(false);
  });

  test('accepts readonly inputs', () => {
    expect(vec3.isEqual(vec3.ZERO, vec3.create())).toBe(true);
  });
});

describe('isEqualEpsilon', () => {
  test('vectors with the same components are equal', () => {
    expect(vec3.isEqualEpsilon(vec3.create(1, 2, 3), vec3.create(1, 2, 3))).toBe(true);
  });

  test('differences within the default tolerance are equal', () => {
    expect(vec3.isEqualEpsilon(vec3.create(1, 0, 0), vec3.create(1 + 2 ** -23, 1e-7, -1e-7))).toBe(
      true
    );
  });

  test('a difference beyond tolerance in any single component makes them unequal', () => {
    const a = vec3.create(1, 2, 3);
    for (let i = 0; i < 3; i++) {
      const b = vec3.clone(a);
      b[i] = 99;
      expect(vec3.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('tolerance scales with magnitude', () => {
    // Adjacent float32 values near 10,000 are ~0.001 apart, far beyond EPSILON.
    const a = vec3.create(0, 0, 10000.5);
    const b = vec3.create(0, 0, 10000.5 + 0.001);
    expect(vec3.isEqual(a, b)).toBe(false);
    expect(vec3.isEqualEpsilon(a, b)).toBe(true);
  });

  test('accepts a custom tolerance', () => {
    expect(vec3.isEqualEpsilon(vec3.create(0, 0, 0), vec3.create(0, 0, 0.05), 0.1)).toBe(true);
    expect(vec3.isEqualEpsilon(vec3.create(0, 0, 0), vec3.create(0, 0, 0.5), 0.1)).toBe(false);
  });

  test('NaN is never equal', () => {
    const v = vec3.create(0, Number.NaN, 0);
    expect(vec3.isEqualEpsilon(v, v)).toBe(false);
  });
});

describe('isEqualXYZ', () => {
  test('matches the values just written by set', () => {
    const v = vec3.set(vec3.create(), 0.1, 0.2, 0.3);
    expect(v[0]).not.toBe(0.1);
    expect(vec3.isEqualXYZ(v, 0.1, 0.2, 0.3)).toBe(true);
  });

  test('a difference in any single component makes them unequal', () => {
    const v = vec3.create(1, 2, 3);
    expect(vec3.isEqualXYZ(v, 99, 2, 3)).toBe(false);
    expect(vec3.isEqualXYZ(v, 1, 99, 3)).toBe(false);
    expect(vec3.isEqualXYZ(v, 1, 2, 99)).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(vec3.isEqualXYZ(vec3.create(0, -0, 0), -0, 0, -0)).toBe(true);
  });

  test('NaN is never equal', () => {
    expect(vec3.isEqualXYZ(vec3.create(0, 0, Number.NaN), 0, 0, Number.NaN)).toBe(false);
  });

  test('accepts a readonly input', () => {
    expect(vec3.isEqualXYZ(vec3.FORWARD, 0, 0, -1)).toBe(true);
  });
});

describe('add', () => {
  test('works component by component and returns out', () => {
    const out = vec3.create();
    const result = vec3.add(out, vec3.create(8, 18, 32), vec3.create(2, 3, 4));

    expect(result).toBe(out);
    expectComponents(out, 8 + 2, 18 + 3, 32 + 4);
  });

  test('never writes to the inputs', () => {
    const a = vec3.create(8, 18, 32);
    const b = vec3.create(2, 3, 4);
    vec3.add(vec3.create(), a, b);

    expectComponents(a, 8, 18, 32);
    expectComponents(b, 2, 3, 4);
  });

  test('out may be the first input', () => {
    const a = vec3.create(8, 18, 32);
    vec3.add(a, a, vec3.create(2, 3, 4));

    expectComponents(a, 8 + 2, 18 + 3, 32 + 4);
  });

  test('out may be the second input', () => {
    const b = vec3.create(2, 3, 4);
    vec3.add(b, vec3.create(8, 18, 32), b);

    expectComponents(b, 8 + 2, 18 + 3, 32 + 4);
  });

  test('both inputs may be the same vector', () => {
    const v = vec3.create(1, 2, 3);

    expectComponents(vec3.add(vec3.create(), v, v), 1 + 1, 2 + 2, 3 + 3);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.add(out, viewAt(buffer, 0), vec3.create(10, 20, 30));

    expectComponents(out, 1 + 10, 2 + 20, 3 + 30);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.add(out, viewAt(buffer, 1), vec3.create(10, 20, 30));

    expectComponents(out, 2 + 10, 3 + 20, 4 + 30);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.add(out, vec3.create(10, 20, 30), viewAt(buffer, 0));

    expectComponents(out, 10 + 1, 20 + 2, 30 + 3);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.add(out, vec3.create(10, 20, 30), viewAt(buffer, 1));

    expectComponents(out, 10 + 2, 20 + 3, 30 + 4);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec3.add(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 + 3, 2 + 4, 3 + 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.add(viewAt(pool, 3), vec3.create(8, 18, 32), vec3.create(2, 3, 4));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      3,
      Math.fround(8 + 2),
      Math.fround(18 + 3),
      Math.fround(32 + 4),
      7,
      8,
      9,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(8, 18, 32);
    const b: ReadonlyVec3 = vec3.create(2, 3, 4);

    expectComponents(vec3.add(vec3.create(), a, b), 8 + 2, 18 + 3, 32 + 4);
  });

  test('a small step can vanish against a large value', () => {
    const large = vec3.create(16777216, 16777216, 16777216);
    const out = vec3.add(vec3.create(), large, vec3.create(1, 1, 1));

    expect(vec3.isEqual(out, large)).toBe(true);
  });
});

describe('sub', () => {
  test('works component by component and returns out', () => {
    const out = vec3.create();
    const result = vec3.sub(out, vec3.create(8, 18, 32), vec3.create(2, 3, 4));

    expect(result).toBe(out);
    expectComponents(out, 8 - 2, 18 - 3, 32 - 4);
  });

  test('never writes to the inputs', () => {
    const a = vec3.create(8, 18, 32);
    const b = vec3.create(2, 3, 4);
    vec3.sub(vec3.create(), a, b);

    expectComponents(a, 8, 18, 32);
    expectComponents(b, 2, 3, 4);
  });

  test('out may be the first input', () => {
    const a = vec3.create(8, 18, 32);
    vec3.sub(a, a, vec3.create(2, 3, 4));

    expectComponents(a, 8 - 2, 18 - 3, 32 - 4);
  });

  test('out may be the second input', () => {
    const b = vec3.create(2, 3, 4);
    vec3.sub(b, vec3.create(8, 18, 32), b);

    expectComponents(b, 8 - 2, 18 - 3, 32 - 4);
  });

  test('both inputs may be the same vector', () => {
    const v = vec3.create(1, 2, 3);

    expectComponents(vec3.sub(vec3.create(), v, v), 1 - 1, 2 - 2, 3 - 3);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.sub(out, viewAt(buffer, 0), vec3.create(10, 20, 30));

    expectComponents(out, 1 - 10, 2 - 20, 3 - 30);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.sub(out, viewAt(buffer, 1), vec3.create(10, 20, 30));

    expectComponents(out, 2 - 10, 3 - 20, 4 - 30);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.sub(out, vec3.create(10, 20, 30), viewAt(buffer, 0));

    expectComponents(out, 10 - 1, 20 - 2, 30 - 3);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.sub(out, vec3.create(10, 20, 30), viewAt(buffer, 1));

    expectComponents(out, 10 - 2, 20 - 3, 30 - 4);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec3.sub(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 - 3, 2 - 4, 3 - 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.sub(viewAt(pool, 3), vec3.create(8, 18, 32), vec3.create(2, 3, 4));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      3,
      Math.fround(8 - 2),
      Math.fround(18 - 3),
      Math.fround(32 - 4),
      7,
      8,
      9,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(8, 18, 32);
    const b: ReadonlyVec3 = vec3.create(2, 3, 4);

    expectComponents(vec3.sub(vec3.create(), a, b), 8 - 2, 18 - 3, 32 - 4);
  });
});

describe('mul', () => {
  test('works component by component and returns out', () => {
    const out = vec3.create();
    const result = vec3.mul(out, vec3.create(8, 18, 32), vec3.create(2, 3, 4));

    expect(result).toBe(out);
    expectComponents(out, 8 * 2, 18 * 3, 32 * 4);
  });

  test('never writes to the inputs', () => {
    const a = vec3.create(8, 18, 32);
    const b = vec3.create(2, 3, 4);
    vec3.mul(vec3.create(), a, b);

    expectComponents(a, 8, 18, 32);
    expectComponents(b, 2, 3, 4);
  });

  test('out may be the first input', () => {
    const a = vec3.create(8, 18, 32);
    vec3.mul(a, a, vec3.create(2, 3, 4));

    expectComponents(a, 8 * 2, 18 * 3, 32 * 4);
  });

  test('out may be the second input', () => {
    const b = vec3.create(2, 3, 4);
    vec3.mul(b, vec3.create(8, 18, 32), b);

    expectComponents(b, 8 * 2, 18 * 3, 32 * 4);
  });

  test('both inputs may be the same vector', () => {
    const v = vec3.create(1, 2, 3);

    expectComponents(vec3.mul(vec3.create(), v, v), 1 * 1, 2 * 2, 3 * 3);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.mul(out, viewAt(buffer, 0), vec3.create(10, 20, 30));

    expectComponents(out, 1 * 10, 2 * 20, 3 * 30);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.mul(out, viewAt(buffer, 1), vec3.create(10, 20, 30));

    expectComponents(out, 2 * 10, 3 * 20, 4 * 30);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.mul(out, vec3.create(10, 20, 30), viewAt(buffer, 0));

    expectComponents(out, 10 * 1, 20 * 2, 30 * 3);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.mul(out, vec3.create(10, 20, 30), viewAt(buffer, 1));

    expectComponents(out, 10 * 2, 20 * 3, 30 * 4);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec3.mul(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 * 3, 2 * 4, 3 * 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.mul(viewAt(pool, 3), vec3.create(8, 18, 32), vec3.create(2, 3, 4));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      3,
      Math.fround(8 * 2),
      Math.fround(18 * 3),
      Math.fround(32 * 4),
      7,
      8,
      9,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(8, 18, 32);
    const b: ReadonlyVec3 = vec3.create(2, 3, 4);

    expectComponents(vec3.mul(vec3.create(), a, b), 8 * 2, 18 * 3, 32 * 4);
  });
});

describe('div', () => {
  test('works component by component and returns out', () => {
    const out = vec3.create();
    const result = vec3.div(out, vec3.create(8, 18, 32), vec3.create(2, 3, 4));

    expect(result).toBe(out);
    expectComponents(out, 8 / 2, 18 / 3, 32 / 4);
  });

  test('never writes to the inputs', () => {
    const a = vec3.create(8, 18, 32);
    const b = vec3.create(2, 3, 4);
    vec3.div(vec3.create(), a, b);

    expectComponents(a, 8, 18, 32);
    expectComponents(b, 2, 3, 4);
  });

  test('out may be the first input', () => {
    const a = vec3.create(8, 18, 32);
    vec3.div(a, a, vec3.create(2, 3, 4));

    expectComponents(a, 8 / 2, 18 / 3, 32 / 4);
  });

  test('out may be the second input', () => {
    const b = vec3.create(2, 3, 4);
    vec3.div(b, vec3.create(8, 18, 32), b);

    expectComponents(b, 8 / 2, 18 / 3, 32 / 4);
  });

  test('both inputs may be the same vector', () => {
    const v = vec3.create(1, 2, 3);

    expectComponents(vec3.div(vec3.create(), v, v), 1 / 1, 2 / 2, 3 / 3);
  });

  test('overlapping views: out one element ahead of a', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.div(out, viewAt(buffer, 0), vec3.create(10, 20, 30));

    expectComponents(out, 1 / 10, 2 / 20, 3 / 30);
  });

  test('overlapping views: out one element behind a', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.div(out, viewAt(buffer, 1), vec3.create(10, 20, 30));

    expectComponents(out, 2 / 10, 3 / 20, 4 / 30);
  });

  test('overlapping views: out one element ahead of b', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.div(out, vec3.create(10, 20, 30), viewAt(buffer, 0));

    expectComponents(out, 10 / 1, 20 / 2, 30 / 3);
  });

  test('overlapping views: out one element behind b', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.div(out, vec3.create(10, 20, 30), viewAt(buffer, 1));

    expectComponents(out, 10 / 2, 20 / 3, 30 / 4);
  });

  test('overlapping views: out overlaps both inputs', () => {
    // a starts at slot 0, out at slot 1 and b at slot 2.
    const buffer = sequentialBuffer(5);
    const out = viewAt(buffer, 1);
    vec3.div(out, viewAt(buffer, 0), viewAt(buffer, 2));

    expectComponents(out, 1 / 3, 2 / 4, 3 / 5);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.div(viewAt(pool, 3), vec3.create(8, 18, 32), vec3.create(2, 3, 4));

    expect(Array.from(new Float32Array(pool))).toEqual([
      1,
      2,
      3,
      Math.fround(8 / 2),
      Math.fround(18 / 3),
      Math.fround(32 / 4),
      7,
      8,
      9,
    ]);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(8, 18, 32);
    const b: ReadonlyVec3 = vec3.create(2, 3, 4);

    expectComponents(vec3.div(vec3.create(), a, b), 8 / 2, 18 / 3, 32 / 4);
  });

  test('a zero divisor gives a signed Infinity', () => {
    const out = vec3.create();
    vec3.div(out, vec3.create(1, -1, 1), vec3.create());

    expectComponents(
      out,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY
    );
  });

  test('a negative zero divisor flips the sign of Infinity', () => {
    const out = vec3.create();
    vec3.div(out, vec3.create(1, 1, 1), vec3.create(-0, -0, -0));

    expectComponents(
      out,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    );
  });

  test('zero divided by zero is NaN', () => {
    const out = vec3.div(vec3.create(), vec3.create(), vec3.create());

    expectComponents(out, Number.NaN, Number.NaN, Number.NaN);
  });

  test('a zero divisor only affects its own component', () => {
    const divisor = vec3.create(2, 3, 4);
    divisor[2] = 0;
    const out = vec3.div(vec3.create(), vec3.create(8, 18, 32), divisor);

    expectComponents(out, 8 / 2, 18 / 3, Number.POSITIVE_INFINITY);
  });

  test('small divisors divide normally rather than being treated as zero', () => {
    const tiny = vec3.create(1e-7, 1e-7, 1e-7);
    const out = vec3.div(vec3.create(), tiny, tiny);

    expectComponents(out, 1, 1, 1);
  });

  test('a quotient too large for float32 becomes Infinity', () => {
    const out = vec3.div(
      vec3.create(),
      vec3.create(1e30, 1e30, 1e30),
      vec3.create(1e-30, 1e-30, 1e-30)
    );

    expectComponents(
      out,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY
    );
  });
});

describe('scale', () => {
  test('multiplies every component and returns out', () => {
    const out = vec3.create();
    const result = vec3.scale(out, vec3.create(8, 18, 32), 2.5);

    expect(result).toBe(out);
    expectComponents(out, 8 * 2.5, 18 * 2.5, 32 * 2.5);
  });

  test('never writes to the input', () => {
    const a = vec3.create(8, 18, 32);
    vec3.scale(vec3.create(), a, 2);

    expectComponents(a, 8, 18, 32);
  });

  test('out may be the input', () => {
    const a = vec3.create(8, 18, 32);
    vec3.scale(a, a, 2);

    expectComponents(a, 8 * 2, 18 * 2, 32 * 2);
  });

  test('a negative scalar flips every component', () => {
    expectComponents(vec3.scale(vec3.create(), vec3.create(8, 18, 32), -1), -8, -18, -32);
  });

  test('a scalar of zero clears every component', () => {
    expectComponents(vec3.scale(vec3.create(), vec3.create(8, 18, 32), 0), 0, 0, 0);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.scale(out, viewAt(buffer, 0), 10);

    expectComponents(out, 1 * 10, 2 * 10, 3 * 10);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.scale(out, viewAt(buffer, 1), 10);

    expectComponents(out, 2 * 10, 3 * 10, 4 * 10);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.scale(viewAt(pool, 3), vec3.create(8, 18, 32), 2);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 16, 36, 64, 7, 8, 9]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec3 = vec3.create(8, 18, 32);

    expectComponents(vec3.scale(vec3.create(), a, 2), 8 * 2, 18 * 2, 32 * 2);
  });
});

describe('magnitudeSq', () => {
  test('sums the squared components', () => {
    expect(vec3.magnitudeSq(vec3.create(3, 4, 12))).toBe(169);
  });

  test('every axis counts', () => {
    for (let i = 0; i < 3; i++) {
      const v = vec3.create();
      v[i] = 3;
      expect(vec3.magnitudeSq(v)).toBe(9);
    }
  });

  test('negative components square to the same result', () => {
    expect(vec3.magnitudeSq(vec3.create(-3, -4, -12))).toBe(169);
  });

  test('a zero vector has a squared length of zero', () => {
    expect(vec3.magnitudeSq(vec3.create())).toBe(0);
  });

  test('stays in range at the extremes of float32', () => {
    expect(vec3.magnitudeSq(vec3.create(3e38, 3e38, 3e38))).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(vec3.magnitudeSq(vec3.create(1e-45, 1e-45, 1e-45))).toBeGreaterThan(0);
  });

  test('reads only the slots of a pooled view', () => {
    const pool = sequentialBuffer(9);
    expect(vec3.magnitudeSq(viewAt(pool, 3))).toBe(4 * 4 + 5 * 5 + 6 * 6);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec3 = vec3.create(3, 4, 12);
    expect(vec3.magnitudeSq(a)).toBe(169);
  });
});

describe('magnitude', () => {
  test('returns the length', () => {
    expect(vec3.magnitude(vec3.create(3, 4, 12))).toBe(13);
  });

  test('every axis counts', () => {
    for (let i = 0; i < 3; i++) {
      const v = vec3.create();
      v[i] = 3;
      expect(vec3.magnitude(v)).toBe(3);
    }
  });

  test('a zero vector has a length of zero', () => {
    expect(vec3.magnitude(vec3.create())).toBe(0);
  });

  test('works on the stored float32 value', () => {
    expect(vec3.magnitude(vec3.create(0.1, 0, 0))).toBe(Math.fround(0.1));
  });

  test('stays in range at the extremes of float32', () => {
    expect(vec3.magnitude(vec3.create(3e38, 3e38, 3e38))).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(vec3.magnitude(vec3.create(1e-45, 1e-45, 1e-45))).toBeGreaterThan(0);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec3 = vec3.create(3, 4, 12);
    expect(vec3.magnitude(a)).toBe(13);
  });
});

describe('distanceSq', () => {
  test('sums the squared differences', () => {
    expect(vec3.distanceSq(vec3.create(4, 6, 15), vec3.create(1, 2, 3))).toBe(169);
  });

  test('the order does not matter', () => {
    const a = vec3.create(4, 6, 15);
    const b = vec3.create(1, 2, 3);
    expect(vec3.distanceSq(b, a)).toBe(vec3.distanceSq(a, b));
  });

  test('every axis counts', () => {
    for (let i = 0; i < 3; i++) {
      const v = vec3.create();
      v[i] = 3;
      expect(vec3.distanceSq(v, vec3.create())).toBe(9);
    }
  });

  test('a vector is no distance from itself', () => {
    const v = vec3.create(3, 4, 12);
    expect(vec3.distanceSq(v, v)).toBe(0);
  });

  test('works with overlapping views', () => {
    const buffer = sequentialBuffer(4);
    expect(vec3.distanceSq(viewAt(buffer, 1), viewAt(buffer, 0))).toBe(3);
  });

  test('keeps float64 precision instead of rounding the difference to float32', () => {
    const a = vec3.create(0, 0, 10000000);
    const b = vec3.create(0, 0, 0.1);
    const difference = Math.fround(1e7) - Math.fround(0.1);

    expect(vec3.distanceSq(a, b)).toBe(difference * difference);
  });

  test('does not overflow at opposite ends of float32', () => {
    const a = vec3.create(0, 0, 3e38);
    const b = vec3.create(0, 0, -3e38);

    expect(vec3.distanceSq(a, b)).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(4, 6, 15);
    const b: ReadonlyVec3 = vec3.create(1, 2, 3);
    expect(vec3.distanceSq(a, b)).toBe(169);
  });
});

describe('distance', () => {
  test('returns the distance', () => {
    expect(vec3.distance(vec3.create(4, 6, 15), vec3.create(1, 2, 3))).toBe(13);
  });

  test('the order does not matter', () => {
    const a = vec3.create(4, 6, 15);
    const b = vec3.create(1, 2, 3);
    expect(vec3.distance(b, a)).toBe(vec3.distance(a, b));
  });

  test('every axis counts', () => {
    for (let i = 0; i < 3; i++) {
      const v = vec3.create();
      v[i] = 3;
      expect(vec3.distance(vec3.create(), v)).toBe(3);
    }
  });

  test('a vector is no distance from itself', () => {
    const v = vec3.create(3, 4, 12);
    expect(vec3.distance(v, v)).toBe(0);
  });

  test('keeps float64 precision instead of rounding the difference to float32', () => {
    const a = vec3.create(0, 0, 10000000);
    const b = vec3.create(0, 0, 0.1);

    expect(vec3.distance(a, b)).toBe(Math.fround(1e7) - Math.fround(0.1));
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(4, 6, 15);
    const b: ReadonlyVec3 = vec3.create(1, 2, 3);
    expect(vec3.distance(a, b)).toBe(13);
  });
});

describe('normalize', () => {
  test('keeps the direction, shortens to unit length and returns out', () => {
    const out = vec3.create();
    const result = vec3.normalize(out, vec3.create(3, 4, 12));

    expect(result).toBe(out);
    expectComponents(out, 3 / 13, 4 / 13, 12 / 13);
  });

  test('every axis normalizes to that unit axis', () => {
    for (let i = 0; i < 3; i++) {
      const v = vec3.create();
      v[i] = -3;
      const out = vec3.normalize(vec3.create(), v);

      expect(out[i]).toBe(-1);
      expect(vec3.magnitude(out)).toBe(1);
    }
  });

  test.each([1e-30, 1e-3, 1, 1e3, 1e30])('gives unit length for inputs of scale %d', (size) => {
    const out = vec3.normalize(vec3.create(), vec3.create(3 * size, 4 * size, 12 * size));
    expect(vec3.magnitude(out)).toBeCloseTo(1, 6);
  });

  test('a zero vector stays zero rather than becoming NaN', () => {
    expectComponents(vec3.normalize(vec3.create(), vec3.create()), 0, 0, 0);
  });

  test('a zero vector still overwrites whatever out held', () => {
    expectComponents(vec3.normalize(vec3.create(9, 9, 9), vec3.create()), 0, 0, 0);
  });

  test('negative zero counts as a zero vector', () => {
    const out = vec3.normalize(vec3.create(), vec3.create(-0, -0, -0));

    for (let i = 0; i < 3; i++) expect(out[i]).toBe(-0);
  });

  test('very short vectors still normalize rather than being treated as zero', () => {
    const out = vec3.normalize(vec3.create(), vec3.create(0, 0, 1e-7));
    expectComponents(out, 0, 0, 1);
  });

  test('handles the extremes of float32', () => {
    const large = vec3.create(0, 0, 3e38);
    const small = vec3.create(0, 0, 1e-45);

    expectComponents(vec3.normalize(vec3.create(), large), 0, 0, 1);
    expectComponents(vec3.normalize(vec3.create(), small), 0, 0, 1);
  });

  test('a NaN component makes the whole result NaN', () => {
    const out = vec3.normalize(vec3.create(), vec3.create(Number.NaN, 1, 1));
    expectComponents(out, Number.NaN, Number.NaN, Number.NaN);
  });

  test('an infinite component gives NaN in its slot and zero in the finite ones', () => {
    const out = vec3.normalize(vec3.create(), vec3.create(Number.POSITIVE_INFINITY, 1, 1));
    expectComponents(out, Number.NaN, 0, 0);
  });

  test('never writes to the input', () => {
    const a = vec3.create(3, 4, 12);
    vec3.normalize(vec3.create(), a);

    expectComponents(a, 3, 4, 12);
  });

  test('out may be the input', () => {
    const a = vec3.create(3, 4, 12);
    vec3.normalize(a, a);

    expectComponents(a, 3 / 13, 4 / 13, 12 / 13);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.normalize(out, viewAt(buffer, 0));

    const mag = Math.sqrt(1 * 1 + 2 * 2 + 3 * 3);
    expectComponents(out, 1 / mag, 2 / mag, 3 / mag);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.normalize(out, viewAt(buffer, 1));

    const mag = Math.sqrt(2 * 2 + 3 * 3 + 4 * 4);
    expectComponents(out, 2 / mag, 3 / mag, 4 / mag);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.normalize(viewAt(pool, 3), vec3.create());

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 0, 0, 0, 7, 8, 9]);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec3 = vec3.create(3, 4, 12);

    expectComponents(vec3.normalize(vec3.create(), a), 3 / 13, 4 / 13, 12 / 13);
  });
});

describe('dot', () => {
  test('multiplies matching components and adds the results', () => {
    expect(vec3.dot(vec3.create(1, 2, 3), vec3.create(4, 5, 6))).toBe(32);
  });

  test('the order does not matter', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(4, 5, 6);

    expect(vec3.dot(a, b)).toBe(vec3.dot(b, a));
  });

  test('a vector dotted with itself is its squared magnitude', () => {
    const a = vec3.create(1, 2, 3);

    expect(vec3.dot(a, a)).toBe(vec3.magnitudeSq(a));
  });

  test('unit vectors give the cosine of the angle between them', () => {
    const x = vec3.create(1, 0, 0);

    expect(vec3.dot(x, x)).toBe(1);
    expect(vec3.dot(x, vec3.create(0, 1, 0))).toBe(0);
    expect(vec3.dot(x, vec3.create(-1, 0, 0))).toBe(-1);
  });

  test('the sign holds at any length', () => {
    const long = vec3.create(10, 0, 0);

    expect(vec3.dot(long, vec3.create(0.5, 0.5, 0))).toBe(5);
    expect(vec3.dot(long, vec3.create(0, 0.5, 0))).toBe(0);
    expect(vec3.dot(long, vec3.create(-0.5, 0.5, 0))).toBe(-5);
  });

  test('a zero vector gives zero', () => {
    expect(vec3.dot(vec3.create(1, 2, 3), vec3.create())).toBe(0);
  });

  test('gives -0 when every product is -0', () => {
    expect(vec3.dot(vec3.create(-1, -1, -1), vec3.create())).toBe(-0);
  });

  test('does not round the result to float32', () => {
    const tenth = Math.fround(0.1);
    const result = vec3.dot(vec3.create(0.1), vec3.create(0.1));

    expect(result).toBe(tenth * tenth);
    expect(result).not.toBe(Math.fround(result));
  });

  test('is not limited to the float32 range', () => {
    const large = Math.fround(3e38);

    expect(vec3.dot(vec3.create(3e38), vec3.create(3e38))).toBe(large * large);
  });

  test('normalized vectors can exceed 1, so the result needs clamping before acos', () => {
    const a = vec3.normalize(vec3.create(), vec3.create(1, 2, 3));
    const result = vec3.dot(a, a);

    expect(result).toBeGreaterThan(1);
    expect(Math.acos(result)).toBeNaN();
    expect(Math.acos(clamp(result, -1, 1))).toBe(0);
  });

  test('a NaN component gives NaN', () => {
    expect(vec3.dot(vec3.create(Number.NaN), vec3.create(1, 1, 1))).toBeNaN();
  });

  test('an infinite component gives NaN against zero and Infinity otherwise', () => {
    const infinite = vec3.create(Number.POSITIVE_INFINITY);

    expect(vec3.dot(infinite, vec3.create(0, 1, 0))).toBeNaN();
    expect(vec3.dot(infinite, vec3.create(1, 0, 0))).toBe(Number.POSITIVE_INFINITY);
  });

  test('never writes to the inputs', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(4, 5, 6);
    vec3.dot(a, b);

    expectComponents(a, 1, 2, 3);
    expectComponents(b, 4, 5, 6);
  });

  test('reads only its own slots when the inputs are pooled views', () => {
    const pool = sequentialBuffer(7);

    expect(vec3.dot(viewAt(pool, 1), viewAt(pool, 4))).toBe(56);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(1, 2, 3);
    const b: ReadonlyVec3 = vec3.create(4, 5, 6);

    expect(vec3.dot(a, b)).toBe(32);
  });
});

describe('cross', () => {
  test('follows the right-hand rule on the axes and returns out', () => {
    const out = vec3.create();
    const result = vec3.cross(out, vec3.create(1, 0, 0), vec3.create(0, 1, 0));

    expect(result).toBe(out);
    expectComponents(out, 0, 0, 1);
    expectComponents(vec3.cross(out, vec3.create(0, 1, 0), vec3.create(0, 0, 1)), 1, 0, 0);
    expectComponents(vec3.cross(out, vec3.create(0, 0, 1), vec3.create(1, 0, 0)), 0, 1, 0);
  });

  test('matches the documented right-handed direction constants', () => {
    const out = vec3.create();

    expect(vec3.isEqualXYZ(vec3.FORWARD, 0, 0, -1)).toBe(true);
    expect(vec3.isEqualXYZ(vec3.BACK, 0, 0, 1)).toBe(true);
    expect(vec3.isEqual(vec3.cross(out, vec3.RIGHT, vec3.UP), vec3.BACK)).toBe(true);
    expect(vec3.isEqual(vec3.cross(out, vec3.UP, vec3.BACK), vec3.RIGHT)).toBe(true);
    expect(vec3.isEqual(vec3.cross(out, vec3.BACK, vec3.RIGHT), vec3.UP)).toBe(true);
    expect(vec3.isEqual(vec3.cross(out, vec3.FORWARD, vec3.UP), vec3.RIGHT)).toBe(true);
  });

  test('uses every component in the right place', () => {
    const out = vec3.cross(vec3.create(), vec3.create(1, 2, 3), vec3.create(4, -5, 7));

    expectComponents(out, 29, 5, -13);
  });

  test('swapping the inputs negates the result', () => {
    const out = vec3.cross(vec3.create(), vec3.create(4, -5, 7), vec3.create(1, 2, 3));

    expectComponents(out, -29, -5, 13);
  });

  test('the result is perpendicular to both inputs', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(4, -5, 7);
    const out = vec3.cross(vec3.create(), a, b);

    expect(vec3.dot(out, a)).toBe(0);
    expect(vec3.dot(out, b)).toBe(0);
  });

  test('two unit vectors only give a unit vector when perpendicular', () => {
    const diagonal = vec3.normalize(vec3.create(), vec3.create(1, 1, 0));

    expect(vec3.magnitude(vec3.cross(vec3.create(), vec3.RIGHT, vec3.UP))).toBe(1);
    expect(vec3.magnitude(vec3.cross(vec3.create(), vec3.RIGHT, diagonal))).toBeCloseTo(
      Math.SQRT1_2,
      6
    );
  });

  test('parallel, opposite and zero inputs give a zero vector', () => {
    const a = vec3.create(1, 2, 3);

    expect(vec3.isEqualXYZ(vec3.cross(vec3.create(), a, a), 0, 0, 0)).toBe(true);
    expect(vec3.isEqualXYZ(vec3.cross(vec3.create(), a, vec3.create(2, 4, 6)), 0, 0, 0)).toBe(true);
    expect(vec3.isEqualXYZ(vec3.cross(vec3.create(), a, vec3.create(-1, -2, -3)), 0, 0, 0)).toBe(
      true
    );
    expect(vec3.isEqualXYZ(vec3.cross(vec3.create(), a, vec3.create()), 0, 0, 0)).toBe(true);
  });

  test('normalizing the result of parallel inputs stays zero', () => {
    const out = vec3.cross(vec3.create(), vec3.UP, vec3.UP);

    expect(vec3.isEqualXYZ(vec3.normalize(out, out), 0, 0, 0)).toBe(true);
  });

  test('can produce -0 components', () => {
    const out = vec3.cross(vec3.create(), vec3.create(0, -1, 0), vec3.create(0, 1, 0));

    expect(out[0]).toBe(-0);
  });

  test('keeps float64 precision through the subtraction', () => {
    const e = 2 ** -23;
    const out = vec3.cross(
      vec3.create(),
      vec3.create(1 + e, 1 + 2 * e, 0),
      vec3.create(1, 1 + e, 0)
    );

    // In float32 both products round to 1 + 2e and the difference is lost.
    expectComponents(out, 0, 0, e * e);
  });

  test('rounds the result to float32 when stored', () => {
    const tenth = Math.fround(0.1);
    const out = vec3.cross(vec3.create(), vec3.create(0.1, 0, 0), vec3.create(0, 0.1, 0));

    expect(out[2]).toBe(Math.fround(tenth * tenth));
  });

  test('a result too large for float32 becomes Infinity', () => {
    const out = vec3.cross(vec3.create(), vec3.create(3e38, 0, 0), vec3.create(0, 3e38, 0));

    expectComponents(out, 0, 0, Number.POSITIVE_INFINITY);
  });

  test('a NaN component spreads to the two components that use it', () => {
    const out = vec3.cross(vec3.create(), vec3.create(Number.NaN, 1, 1), vec3.create(1, 1, 1));

    expectComponents(out, 0, Number.NaN, Number.NaN);
  });

  test('an infinite input gives NaN where it meets zero', () => {
    const out = vec3.cross(
      vec3.create(),
      vec3.create(Number.POSITIVE_INFINITY, 0, 0),
      vec3.create(0, 1, 0)
    );

    expectComponents(out, 0, Number.NaN, Number.POSITIVE_INFINITY);
  });

  test('never writes to the inputs', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(4, -5, 7);
    vec3.cross(vec3.create(), a, b);

    expectComponents(a, 1, 2, 3);
    expectComponents(b, 4, -5, 7);
  });

  test('out may be the first input', () => {
    const a = vec3.create(1, 2, 3);
    vec3.cross(a, a, vec3.create(4, -5, 7));

    expectComponents(a, 29, 5, -13);
  });

  test('out may be the second input', () => {
    const b = vec3.create(4, -5, 7);
    vec3.cross(b, vec3.create(1, 2, 3), b);

    expectComponents(b, 29, 5, -13);
  });

  test('out may be both inputs', () => {
    const a = vec3.create(1, 2, 3);
    vec3.cross(a, a, a);

    expect(vec3.isEqualXYZ(a, 0, 0, 0)).toBe(true);
  });

  test('overlapping views: out overlaps both inputs', () => {
    const buffer = sequentialBuffer(6);
    const out = viewAt(buffer, 2);
    vec3.cross(out, viewAt(buffer, 0), viewAt(buffer, 3));

    // a = (1, 2, 3), b = (4, 5, 6)
    expectComponents(out, -3, 6, -3);
  });

  test('overlapping views: out one element ahead of the first input', () => {
    const buffer = sequentialBuffer(7);
    const out = viewAt(buffer, 1);
    vec3.cross(out, viewAt(buffer, 0), viewAt(buffer, 4));

    // a = (1, 2, 3), b = (5, 6, 7)
    expectComponents(out, -4, 8, -4);
  });

  test('overlapping views: out one element behind the second input', () => {
    const buffer = sequentialBuffer(7);
    const out = viewAt(buffer, 3);
    vec3.cross(out, viewAt(buffer, 0), viewAt(buffer, 4));

    // a = (1, 2, 3), b = (5, 6, 7)
    expectComponents(out, -4, 8, -4);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.cross(viewAt(pool, 3), vec3.create(1, 0, 0), vec3.create(0, 1, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 0, 0, 1, 7, 8, 9]);
  });

  test('works on views over a SharedArrayBuffer', () => {
    const pool = sequentialBuffer(6, true);
    const out = vec3.cross(vec3.create(), viewAt(pool, 0), viewAt(pool, 3));

    expectComponents(out, -3, 6, -3);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(1, 2, 3);
    const b: ReadonlyVec3 = vec3.create(4, -5, 7);

    expectComponents(vec3.cross(vec3.create(), a, b), 29, 5, -13);
  });
});

describe('scaleAndAdd', () => {
  test('adds b times the scalar to a, and returns out', () => {
    const out = vec3.create();
    const result = vec3.scaleAndAdd(out, vec3.create(1, 2, 3), vec3.create(10, 20, 30), 0.5);

    expect(result).toBe(out);
    expectComponents(out, 6, 12, 18);
  });

  test('a scalar of 0 gives a, and a scalar of 1 gives a + b', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(10, 20, 30);

    expectComponents(vec3.scaleAndAdd(vec3.create(), a, b, 0), 1, 2, 3);
    expectComponents(vec3.scaleAndAdd(vec3.create(), a, b, 1), 11, 22, 33);
  });

  test('a negative scalar steps backwards', () => {
    const out = vec3.scaleAndAdd(vec3.create(), vec3.create(1, 2, 3), vec3.create(10, 20, 30), -1);

    expectComponents(out, -9, -18, -27);
  });

  test('rounds once, so it can differ from scale followed by add', () => {
    const a = vec3.create(1);
    const b = vec3.create(9.81);
    const dt = 1 / 60;
    const once = vec3.scaleAndAdd(vec3.create(), a, b, dt);
    const twice = vec3.add(vec3.create(), a, vec3.scale(vec3.create(), b, dt));

    expect(once[0]).toBe(Math.fround(1 + Math.fround(9.81) * dt));
    expect(once[0]).not.toBe(twice[0]);
  });

  test('b times the scalar does not overflow before the sum', () => {
    const out = vec3.scaleAndAdd(vec3.create(), vec3.create(-3e38), vec3.create(3e38), 2);

    expect(out[0]).toBe(Math.fround(3e38));
  });

  test('a result too large for float32 becomes Infinity', () => {
    const out = vec3.scaleAndAdd(vec3.create(), vec3.create(3e38), vec3.create(3e38), 1);

    expect(out[0]).toBe(Number.POSITIVE_INFINITY);
  });

  test('a small step can vanish against a large value', () => {
    const out = vec3.scaleAndAdd(vec3.create(), vec3.create(16777216), vec3.create(1), 1);

    expect(out[0]).toBe(16777216);
  });

  test('a NaN scalar makes the whole result NaN', () => {
    const out = vec3.scaleAndAdd(
      vec3.create(),
      vec3.create(1, 2, 3),
      vec3.create(10, 20, 30),
      Number.NaN
    );

    expectComponents(out, Number.NaN, Number.NaN, Number.NaN);
  });

  test('an infinite component in b gives NaN when the scalar is 0', () => {
    const out = vec3.scaleAndAdd(
      vec3.create(),
      vec3.create(1, 2, 3),
      vec3.create(Number.POSITIVE_INFINITY),
      0
    );

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(2);
  });

  test('never writes to the inputs', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(10, 20, 30);
    vec3.scaleAndAdd(vec3.create(), a, b, 2);

    expectComponents(a, 1, 2, 3);
    expectComponents(b, 10, 20, 30);
  });

  test('out may be the first input', () => {
    const a = vec3.create(1, 2, 3);
    vec3.scaleAndAdd(a, a, vec3.create(10, 20, 30), 2);

    expectComponents(a, 21, 42, 63);
  });

  test('out may be the second input', () => {
    const b = vec3.create(10, 20, 30);
    vec3.scaleAndAdd(b, vec3.create(1, 2, 3), b, 2);

    expectComponents(b, 21, 42, 63);
  });

  test('out may be both inputs', () => {
    const a = vec3.create(1, 2, 3);
    vec3.scaleAndAdd(a, a, a, 2);

    expectComponents(a, 3, 6, 9);
  });

  test('overlapping views: out one element ahead of the first input', () => {
    const buffer = sequentialBuffer(7);
    const out = viewAt(buffer, 1);
    vec3.scaleAndAdd(out, viewAt(buffer, 0), viewAt(buffer, 3), 2);

    expectComponents(out, 9, 12, 15);
  });

  test('overlapping views: out one element behind the first input', () => {
    const buffer = sequentialBuffer(7);
    const out = viewAt(buffer, 0);
    vec3.scaleAndAdd(out, viewAt(buffer, 1), viewAt(buffer, 4), 2);

    expectComponents(out, 12, 15, 18);
  });

  test('overlapping views: out one element ahead of the second input', () => {
    const buffer = sequentialBuffer(7);
    const out = viewAt(buffer, 4);
    vec3.scaleAndAdd(out, viewAt(buffer, 0), viewAt(buffer, 3), 2);

    expectComponents(out, 9, 12, 15);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.scaleAndAdd(viewAt(pool, 3), vec3.create(0, 0, 0), vec3.create(1, 1, 1), 1);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 1, 1, 1, 7, 8, 9]);
  });

  test('works on views over a SharedArrayBuffer', () => {
    const pool = sequentialBuffer(6, true);
    const out = vec3.scaleAndAdd(vec3.create(), viewAt(pool, 0), viewAt(pool, 3), 2);

    expectComponents(out, 9, 12, 15);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(1, 2, 3);
    const b: ReadonlyVec3 = vec3.create(10, 20, 30);

    expectComponents(vec3.scaleAndAdd(vec3.create(), a, b, 2), 21, 42, 63);
  });
});

describe('negate', () => {
  test('flips the sign of every component and returns out', () => {
    const out = vec3.create();
    const result = vec3.negate(out, vec3.create(1, -2, 3));

    expect(result).toBe(out);
    expectComponents(out, -1, 2, -3);
  });

  test('negating twice gives the original back', () => {
    const a = vec3.create(1, 2, 3);

    expectComponents(vec3.negate(a, vec3.negate(a, a)), 1, 2, 3);
  });

  test('a zero component becomes -0, which isEqual still treats as zero', () => {
    const zero = vec3.create();
    const out = vec3.negate(vec3.create(), zero);

    expect(out[0]).toBe(-0);
    expect(vec3.isEqual(out, zero)).toBe(true);
  });

  test('-0 becomes 0', () => {
    const out = vec3.negate(vec3.create(), vec3.create(-0));

    expect(out[0]).toBe(0);
  });

  test('NaN stays NaN and Infinity flips', () => {
    const out = vec3.negate(vec3.create(), vec3.create(Number.NaN, Number.POSITIVE_INFINITY));

    expect(out[0]).toBeNaN();
    expect(out[1]).toBe(Number.NEGATIVE_INFINITY);
  });

  test('never writes to the input', () => {
    const a = vec3.create(1, 2, 3);
    vec3.negate(vec3.create(), a);

    expectComponents(a, 1, 2, 3);
  });

  test('out may be the input', () => {
    const a = vec3.create(1, 2, 3);
    vec3.negate(a, a);

    expectComponents(a, -1, -2, -3);
  });

  test('overlapping views: out one element ahead of the input', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 1);
    vec3.negate(out, viewAt(buffer, 0));

    expectComponents(out, -1, -2, -3);
  });

  test('overlapping views: out one element behind the input', () => {
    const buffer = sequentialBuffer(4);
    const out = viewAt(buffer, 0);
    vec3.negate(out, viewAt(buffer, 1));

    expectComponents(out, -2, -3, -4);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.negate(viewAt(pool, 3), vec3.create(1, 1, 1));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, -1, -1, -1, 7, 8, 9]);
  });

  test('works on views over a SharedArrayBuffer', () => {
    const pool = sequentialBuffer(3, true);

    expectComponents(vec3.negate(vec3.create(), viewAt(pool, 0)), -1, -2, -3);
  });

  test('accepts a readonly input', () => {
    const a: ReadonlyVec3 = vec3.create(1, 2, 3);

    expectComponents(vec3.negate(vec3.create(), a), -1, -2, -3);
  });
});

describe('lerp', () => {
  test('moves every component from a towards b, and returns out', () => {
    const out = vec3.create();
    const result = vec3.lerp(out, vec3.create(1, 2, 3), vec3.create(10, 20, 30), 0.25);

    expect(result).toBe(out);
    expectComponents(out, 3.25, 6.5, 9.75);
  });

  test('t of 0 gives a and t of 1 gives b, exactly', () => {
    const a = vec3.create(0.1);
    const b = vec3.create(0.7);

    expect(vec3.isEqual(vec3.lerp(vec3.create(), a, b, 0), a)).toBe(true);
    expect(vec3.isEqual(vec3.lerp(vec3.create(), a, b, 1), b)).toBe(true);
  });

  test('does not clamp t, so it carries on past either end', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(10, 20, 30);

    expectComponents(vec3.lerp(vec3.create(), a, b, 2), 19, 38, 57);
    expectComponents(vec3.lerp(vec3.create(), a, b, -1), -8, -16, -24);
  });

  test('stays on a when a and b are equal', () => {
    const a = vec3.create(0.1);

    expect(vec3.isEqual(vec3.lerp(vec3.create(), a, a, 0.3), a)).toBe(true);
  });

  test('handles the extremes of float32 without overflowing', () => {
    const out = vec3.lerp(vec3.create(), vec3.create(3e38), vec3.create(-3e38), 0.5);

    expect(out[0]).toBe(0);
  });

  test('only misses b at t of 1 when the two differ enormously in scale', () => {
    const close = vec3.lerp(vec3.create(), vec3.create(1e6), vec3.create(0.1), 1);
    const far = vec3.lerp(vec3.create(), vec3.create(1e8), vec3.create(0.1), 1);

    expect(close[0]).toBe(Math.fround(0.1));
    expect(far[0]).not.toBe(Math.fround(0.1));
    expect(far[0]).toBeCloseTo(0.1, 6);
  });

  test('blending directions does not keep their length', () => {
    const halfway = vec3.lerp(vec3.create(), vec3.create(1, 0, 0), vec3.create(0, 1, 0), 0.5);

    expect(vec3.magnitude(halfway)).toBeCloseTo(Math.SQRT1_2, 6);
    expect(
      vec3.magnitude(vec3.lerp(vec3.create(), vec3.create(1, 0, 0), vec3.create(-1, 0, 0), 0.5))
    ).toBe(0);
  });

  test('a fixed t depends on the step count, and an exponential t does not', () => {
    const reachedAfter = (steps: number, t: number): number => {
      const current = vec3.create();
      const target = vec3.create(1);
      for (let i = 0; i < steps; i++) vec3.lerp(current, current, target, t);
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
    const out = vec3.lerp(vec3.create(), vec3.create(1, 2, 3), vec3.create(10, 20, 30), Number.NaN);

    expectComponents(out, Number.NaN, Number.NaN, Number.NaN);
  });

  test('an infinite component in a gives NaN from t of 0 upwards', () => {
    const a = vec3.create(Number.POSITIVE_INFINITY);
    const b = vec3.create(1, 1, 1);

    expect(vec3.lerp(vec3.create(), a, b, 0)[0]).toBeNaN();
    expect(vec3.lerp(vec3.create(), a, b, 0.5)[0]).toBeNaN();
    expect(vec3.lerp(vec3.create(), a, b, 1)[0]).toBeNaN();
  });

  test('an infinite component in b gives NaN at t of 0 and Infinity above it', () => {
    const a = vec3.create(1, 1, 1);
    const b = vec3.create(Number.POSITIVE_INFINITY);

    expect(vec3.lerp(vec3.create(), a, b, 0)[0]).toBeNaN();
    expect(vec3.lerp(vec3.create(), a, b, 0.5)[0]).toBe(Number.POSITIVE_INFINITY);
  });

  test('never writes to the inputs', () => {
    const a = vec3.create(1, 2, 3);
    const b = vec3.create(10, 20, 30);
    vec3.lerp(vec3.create(), a, b, 0.5);

    expectComponents(a, 1, 2, 3);
    expectComponents(b, 10, 20, 30);
  });

  test('out may be the first input', () => {
    const a = vec3.create(1, 2, 3);
    vec3.lerp(a, a, vec3.create(10, 20, 30), 0.5);

    expectComponents(a, 5.5, 11, 16.5);
  });

  test('out may be the second input', () => {
    const b = vec3.create(10, 20, 30);
    vec3.lerp(b, vec3.create(1, 2, 3), b, 0.5);

    expectComponents(b, 5.5, 11, 16.5);
  });

  test('overlapping views: out one element ahead of the first input', () => {
    const buffer = sequentialBuffer(7);
    const out = viewAt(buffer, 1);
    vec3.lerp(out, viewAt(buffer, 0), viewAt(buffer, 3), 0.75);

    expectComponents(out, 3.25, 4.25, 5.25);
  });

  test('overlapping views: out one element behind the first input', () => {
    const buffer = sequentialBuffer(7);
    const out = viewAt(buffer, 0);
    vec3.lerp(out, viewAt(buffer, 1), viewAt(buffer, 4), 0.75);

    expectComponents(out, 4.25, 5.25, 6.25);
  });

  test('overlapping views: out one element ahead of the second input', () => {
    const buffer = sequentialBuffer(7);
    const out = viewAt(buffer, 4);
    vec3.lerp(out, viewAt(buffer, 0), viewAt(buffer, 3), 0.75);

    expectComponents(out, 3.25, 4.25, 5.25);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.lerp(viewAt(pool, 3), vec3.create(0, 0, 0), vec3.create(1, 1, 1), 0.5);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 0.5, 0.5, 0.5, 7, 8, 9]);
  });

  test('works on views over a SharedArrayBuffer', () => {
    const pool = sequentialBuffer(6, true);
    const out = vec3.lerp(vec3.create(), viewAt(pool, 0), viewAt(pool, 3), 0.5);

    expectComponents(out, 2.5, 3.5, 4.5);
  });

  test('accepts readonly inputs', () => {
    const a: ReadonlyVec3 = vec3.create(1, 2, 3);
    const b: ReadonlyVec3 = vec3.create(10, 20, 30);

    expectComponents(vec3.lerp(vec3.create(), a, b, 0.5), 5.5, 11, 16.5);
  });
});
