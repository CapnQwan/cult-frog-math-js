// src/vector/__tests__/vec2.test.ts
import { describe, expect, test } from 'vitest';

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
