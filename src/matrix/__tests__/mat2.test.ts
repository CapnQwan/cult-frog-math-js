// src/matrix/__tests__/mat2.test.ts
import { describe, expect, test } from 'vitest';

import * as mat2 from '../mat2.js';

import type { Mat2, ReadonlyMat2 } from '../_types/mat2.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/**
 * The raw column-major storage, compared against float32-rounded expectations
 * so tests can use natural literals without encoding the rounding by hand.
 *
 * Expectations are written in *storage* order, not argument order: that is the
 * whole point of these tests, so the transpose must never be hidden behind a
 * helper.
 */
function expectStorage(m: ReadonlyMat2, expected: readonly number[]): void {
  expect([m[0], m[1], m[2], m[3]]).toEqual(expected.map((n) => Math.fround(n)));
}

/**
 * Test-only cast site: a Mat2 view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBuffer, index: number): Mat2 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 4) as Mat2;
}

/** A buffer of `count` floats initialised to 1, 2, 3, ... so every slot is distinguishable. */
function sequentialBuffer(count: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * FLOAT_BYTES);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = i + 1;
  return buffer;
}

describe('create', () => {
  test('is the zero matrix by default, not the identity', () => {
    expectStorage(mat2.create(), [0, 0, 0, 0]);
  });

  test('takes row-major arguments and stores them column major', () => {
    // Rows:  1 2
    //        3 4
    expectStorage(mat2.create(1, 2, 3, 4), [1, 3, 2, 4]);
  });

  test('defaults only the omitted elements', () => {
    expectStorage(mat2.create(5), [5, 0, 0, 0]);
  });

  test('rounds elements to float32', () => {
    const m = mat2.create(0.1);
    expect(m[0]).not.toBe(0.1);
    expect(m[0]).toBe(Math.fround(0.1));
  });

  test('allocates a standalone four-element buffer', () => {
    const m = mat2.create();
    expect(m).toBeInstanceOf(Float32Array);
    expect(m.length).toBe(4);
    expect(m.byteOffset).toBe(0);
    expect(m.buffer.byteLength).toBe(4 * FLOAT_BYTES);
  });
});

describe('clone', () => {
  test('copies elements into a new matrix with its own buffer', () => {
    const source = mat2.create(1, 2, 3, 4);
    const result = mat2.clone(source);

    expectStorage(result, [1, 3, 2, 4]);
    expect(result).not.toBe(source);
    expect(result.buffer).not.toBe(source.buffer);
  });

  test('preserves storage order rather than transposing', () => {
    const source = mat2.create(1, 2, 3, 4);
    const result = mat2.clone(source);

    expect([result[0], result[1], result[2], result[3]]).toEqual([
      source[0],
      source[1],
      source[2],
      source[3],
    ]);
  });

  test('round-trips float32 values exactly', () => {
    const source = mat2.create(0.1, -0.7, 1.3, 2.9);
    const result = mat2.clone(source);

    for (let i = 0; i < 4; i++) expect(result[i]).toBe(source[i]);
  });

  test('result and source are independent after cloning', () => {
    const source = mat2.create(1, 2, 3, 4);
    const result = mat2.clone(source);

    mat2.set(source, 9, 9, 9, 9);
    expectStorage(result, [1, 3, 2, 4]);
  });

  test('accepts a readonly input', () => {
    const frozen: ReadonlyMat2 = mat2.create(1, 2, 3, 4);
    expectStorage(mat2.clone(frozen), [1, 3, 2, 4]);
  });

  test('cloning a pooled view produces a standalone matrix', () => {
    const pool = sequentialBuffer(8);
    const view = viewAt(pool, 2);
    const snapshot = mat2.clone(view);

    expect(snapshot.buffer).not.toBe(pool);
    expect(snapshot.byteOffset).toBe(0);
    expect(snapshot.buffer.byteLength).toBe(4 * FLOAT_BYTES);

    // The owning system writes to the pool; the snapshot must not move.
    mat2.set(view, 0, 0, 0, 0);
    expectStorage(snapshot, [3, 4, 5, 6]);
  });

  test('clone(IDENTITY) is the documented way to get a mutable identity', () => {
    const m = mat2.clone(mat2.IDENTITY);

    expectStorage(m, [1, 0, 0, 1]);

    // Writing through the copy must not disturb the shared constant.
    mat2.set(m, 9, 9, 9, 9);
    expectStorage(mat2.IDENTITY, [1, 0, 0, 1]);
  });
});

describe('set', () => {
  test('writes elements and returns out', () => {
    const out = mat2.create();
    const result = mat2.set(out, 1, 2, 3, 4);

    expect(result).toBe(out);
    expectStorage(out, [1, 3, 2, 4]);
  });

  test('agrees with create for the same arguments', () => {
    expectStorage(mat2.set(mat2.create(), 1, 2, 3, 4), [1, 3, 2, 4]);
  });

  test('overwrites every element', () => {
    const out = mat2.create(7, 7, 7, 7);
    mat2.set(out, -1, 1, -2, 2);
    expectStorage(out, [-1, -2, 1, 2]);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    mat2.set(viewAt(pool, 2), 0, 0, 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 0, 7, 8]);
  });
});

describe('copy', () => {
  test('copies elements and returns out', () => {
    const out = mat2.create();
    const source = mat2.create(1, 2, 3, 4);
    const result = mat2.copy(out, source);

    expect(result).toBe(out);
    expectStorage(out, [1, 3, 2, 4]);
  });

  test('never writes to the input', () => {
    const out = mat2.create(7, 7, 7, 7);
    const source = mat2.create(1, 2, 3, 4);
    mat2.copy(out, source);
    expectStorage(source, [1, 3, 2, 4]);
  });

  test('supports chaining through nested calls', () => {
    const a = mat2.create();
    const b = mat2.create();
    mat2.copy(b, mat2.set(a, 1, 2, 3, 4));
    expectStorage(b, [1, 3, 2, 4]);
  });

  test('out === input is a no-op', () => {
    const m = mat2.create(1, 2, 3, 4);
    mat2.copy(m, m);
    expectStorage(m, [1, 3, 2, 4]);
  });

  test('overlapping views: out one element ahead of input', () => {
    // Buffer [1..5]; input covers [0..3], out covers [1..4].
    const buffer = sequentialBuffer(5);
    mat2.copy(viewAt(buffer, 1), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([1, 1, 2, 3, 4]);
  });

  test('overlapping views: out one element behind input', () => {
    // Buffer [1..5]; input covers [1..4], out covers [0..3].
    const buffer = sequentialBuffer(5);
    mat2.copy(viewAt(buffer, 0), viewAt(buffer, 1));

    expect(Array.from(new Float32Array(buffer))).toEqual([2, 3, 4, 5, 5]);
  });

  test('every overlap of two distinct views is exact', () => {
    // Elements are staged through locals before any write, so no element can
    // be clobbered before it has been read, at any offset.
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(8);
        const input = viewAt(buffer, inputOffset);
        const expected = [input[0], input[1], input[2], input[3]];

        mat2.copy(viewAt(buffer, outOffset), input);

        expectStorage(viewAt(buffer, outOffset), expected);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    mat2.copy(viewAt(pool, 2), mat2.create());

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 0, 7, 8]);
  });
});

describe('identity', () => {
  test('writes the identity matrix and returns out', () => {
    const out = mat2.create();
    const result = mat2.identity(out);

    expect(result).toBe(out);
    expectStorage(out, [1, 0, 0, 1]);
  });

  test('discards previous contents', () => {
    expectStorage(mat2.identity(mat2.create(1, 2, 3, 4)), [1, 0, 0, 1]);
  });

  test('allocates nothing', () => {
    const out = mat2.create();
    expect(mat2.identity(out).buffer).toBe(out.buffer);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    mat2.identity(viewAt(pool, 2));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 1, 0, 0, 1, 7, 8]);
  });
});

describe('IDENTITY', () => {
  test('has ones on the diagonal and zeros elsewhere', () => {
    expectStorage(mat2.IDENTITY, [1, 0, 0, 1]);
  });

  test('leaves a vector unchanged conceptually: diagonal sits at indices 0 and 3', () => {
    expect([mat2.IDENTITY[0], mat2.IDENTITY[3]]).toEqual([1, 1]);
  });

  test('is a single shared instance', () => {
    expect(mat2.IDENTITY).toBe(mat2.IDENTITY);
  });
});
