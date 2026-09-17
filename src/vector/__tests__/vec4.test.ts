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
