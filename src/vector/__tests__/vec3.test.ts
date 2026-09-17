// src/vector/__tests__/vec3.test.ts
import { describe, expect, test } from 'vitest';

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
function viewAt(buffer: ArrayBuffer, index: number): Vec3 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 3) as Vec3;
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

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(9);
    vec3.copy(viewAt(pool, 3), vec3.create(0, 0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 3, 0, 0, 0, 7, 8, 9]);
  });
});
