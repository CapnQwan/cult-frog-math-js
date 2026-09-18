// src/matrix/__tests__/mat3.test.ts
import { describe, expect, test } from 'vitest';

import * as mat3 from '../mat3.js';

import type { Mat3, ReadonlyMat3 } from '../_types/mat3.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const ELEMENTS = 9;

/** The raw column-major storage of `m`, in index order. */
function storageOf(m: ReadonlyMat3): number[] {
  return [m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]];
}

/**
 * Compares the raw column-major storage against float32-rounded expectations,
 * so tests can use natural literals without encoding the rounding by hand.
 *
 * Expectations are written in *storage* order, not argument order: that is the
 * whole point of these tests, so the transpose must never be hidden here.
 */
function expectStorage(m: ReadonlyMat3, expected: readonly number[]): void {
  expect(storageOf(m)).toEqual(expected.map((n) => Math.fround(n)));
}

/**
 * Test-only cast site: a Mat3 view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBuffer, index: number): Mat3 {
  return new Float32Array(buffer, index * FLOAT_BYTES, ELEMENTS) as Mat3;
}

/** A buffer of `count` floats initialised to 1, 2, 3, ... so every slot is distinguishable. */
function sequentialBuffer(count: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * FLOAT_BYTES);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = i + 1;
  return buffer;
}

/** The expected contents of a `sequentialBuffer(count)` after `written` lands at `offset`. */
function poolAfter(count: number, offset: number, written: readonly number[]): number[] {
  const expected = Array.from({ length: count }, (_, i) => i + 1);
  written.forEach((value, i) => {
    expected[offset + i] = value;
  });
  return expected;
}

// Rows:  1 2 3
//        4 5 6
//        7 8 9
const ROW_MAJOR_ARGS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const COLUMN_MAJOR_STORAGE = [1, 4, 7, 2, 5, 8, 3, 6, 9] as const;
const IDENTITY_STORAGE = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;

describe('create', () => {
  test('is the zero matrix by default, not the identity', () => {
    expectStorage(mat3.create(), new Array(ELEMENTS).fill(0));
  });

  test('takes row-major arguments and stores them column major', () => {
    expectStorage(mat3.create(...ROW_MAJOR_ARGS), COLUMN_MAJOR_STORAGE);
  });

  test('defaults only the omitted elements', () => {
    expectStorage(mat3.create(5), [5, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test('rounds elements to float32', () => {
    const m = mat3.create(0.1);
    expect(m[0]).not.toBe(0.1);
    expect(m[0]).toBe(Math.fround(0.1));
  });

  test('allocates a standalone, tightly packed nine-element buffer', () => {
    const m = mat3.create();
    expect(m).toBeInstanceOf(Float32Array);
    expect(m.length).toBe(ELEMENTS);
    expect(m.byteOffset).toBe(0);
    // Tightly packed: no std140-style padding to 3 x vec4.
    expect(m.buffer.byteLength).toBe(ELEMENTS * FLOAT_BYTES);
  });
});

describe('clone', () => {
  test('copies elements into a new matrix with its own buffer', () => {
    const source = mat3.create(...ROW_MAJOR_ARGS);
    const result = mat3.clone(source);

    expectStorage(result, COLUMN_MAJOR_STORAGE);
    expect(result).not.toBe(source);
    expect(result.buffer).not.toBe(source.buffer);
  });

  test('preserves storage order rather than transposing', () => {
    const source = mat3.create(...ROW_MAJOR_ARGS);
    expect(storageOf(mat3.clone(source))).toEqual(storageOf(source));
  });

  test('round-trips float32 values exactly', () => {
    const source = mat3.create(0.1, -0.7, 1.3, 2.9, 0.3, -1.1, 7.7, 0.02, -3.5);
    const result = mat3.clone(source);

    for (let i = 0; i < ELEMENTS; i++) expect(result[i]).toBe(source[i]);
  });

  test('result and source are independent after cloning', () => {
    const source = mat3.create(...ROW_MAJOR_ARGS);
    const result = mat3.clone(source);

    mat3.set(source, 9, 9, 9, 9, 9, 9, 9, 9, 9);
    expectStorage(result, COLUMN_MAJOR_STORAGE);
  });

  test('accepts a readonly input', () => {
    const frozen: ReadonlyMat3 = mat3.create(...ROW_MAJOR_ARGS);
    expectStorage(mat3.clone(frozen), COLUMN_MAJOR_STORAGE);
  });

  test('cloning a pooled view produces a standalone matrix', () => {
    const pool = sequentialBuffer(18);
    const view = viewAt(pool, 2);
    const snapshot = mat3.clone(view);

    expect(snapshot.buffer).not.toBe(pool);
    expect(snapshot.byteOffset).toBe(0);
    expect(snapshot.buffer.byteLength).toBe(ELEMENTS * FLOAT_BYTES);

    // The owning system writes to the pool; the snapshot must not move.
    mat3.set(view, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    expectStorage(snapshot, [3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test('clone(IDENTITY) is the documented way to get a mutable identity', () => {
    const m = mat3.clone(mat3.IDENTITY);

    expectStorage(m, IDENTITY_STORAGE);

    // Writing through the copy must not disturb the shared constant.
    mat3.set(m, 9, 9, 9, 9, 9, 9, 9, 9, 9);
    expectStorage(mat3.IDENTITY, IDENTITY_STORAGE);
  });
});

describe('set', () => {
  test('writes elements and returns out', () => {
    const out = mat3.create();
    const result = mat3.set(out, ...ROW_MAJOR_ARGS);

    expect(result).toBe(out);
    expectStorage(out, COLUMN_MAJOR_STORAGE);
  });

  test('agrees with create for the same arguments', () => {
    expect(storageOf(mat3.set(mat3.create(), ...ROW_MAJOR_ARGS))).toEqual(
      storageOf(mat3.create(...ROW_MAJOR_ARGS))
    );
  });

  test('overwrites every element', () => {
    const out = mat3.create(7, 7, 7, 7, 7, 7, 7, 7, 7);
    mat3.set(out, ...ROW_MAJOR_ARGS);
    expectStorage(out, COLUMN_MAJOR_STORAGE);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(18);
    mat3.set(viewAt(pool, 2), 0, 0, 0, 0, 0, 0, 0, 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual(
      poolAfter(18, 2, new Array(ELEMENTS).fill(0))
    );
  });
});

describe('copy', () => {
  test('copies elements and returns out', () => {
    const out = mat3.create();
    const source = mat3.create(...ROW_MAJOR_ARGS);
    const result = mat3.copy(out, source);

    expect(result).toBe(out);
    expectStorage(out, COLUMN_MAJOR_STORAGE);
  });

  test('never writes to the input', () => {
    const source = mat3.create(...ROW_MAJOR_ARGS);
    mat3.copy(mat3.create(7, 7, 7, 7, 7, 7, 7, 7, 7), source);
    expectStorage(source, COLUMN_MAJOR_STORAGE);
  });

  test('supports chaining through nested calls', () => {
    const a = mat3.create();
    const b = mat3.create();
    mat3.copy(b, mat3.set(a, ...ROW_MAJOR_ARGS));
    expectStorage(b, COLUMN_MAJOR_STORAGE);
  });

  test('out === input is a no-op', () => {
    const m = mat3.create(...ROW_MAJOR_ARGS);
    mat3.copy(m, m);
    expectStorage(m, COLUMN_MAJOR_STORAGE);
  });

  test('overlapping views: out three elements ahead of input', () => {
    // Buffer [1..12]; input covers [0..8], out covers [3..11].
    const buffer = sequentialBuffer(12);
    mat3.copy(viewAt(buffer, 3), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([1, 2, 3, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('overlapping views: out three elements behind input', () => {
    // Buffer [1..12]; input covers [3..11], out covers [0..8].
    const buffer = sequentialBuffer(12);
    mat3.copy(viewAt(buffer, 0), viewAt(buffer, 3));

    expect(Array.from(new Float32Array(buffer))).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12, 10, 11, 12,
    ]);
  });

  test('every overlap of two distinct views is exact', () => {
    // Elements are staged through locals before any write, so no element can
    // be clobbered before it has been read, at any offset.
    for (let outOffset = 0; outOffset < ELEMENTS; outOffset++) {
      for (let inputOffset = 0; inputOffset < ELEMENTS; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(ELEMENTS * 2);
        const expected = storageOf(viewAt(buffer, inputOffset));

        mat3.copy(viewAt(buffer, outOffset), viewAt(buffer, inputOffset));

        expectStorage(viewAt(buffer, outOffset), expected);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(18);
    mat3.copy(viewAt(pool, 2), mat3.create());

    expect(Array.from(new Float32Array(pool))).toEqual(
      poolAfter(18, 2, new Array(ELEMENTS).fill(0))
    );
  });
});

describe('identity', () => {
  test('writes the identity matrix and returns out', () => {
    const out = mat3.create();
    const result = mat3.identity(out);

    expect(result).toBe(out);
    expectStorage(out, IDENTITY_STORAGE);
  });

  test('discards previous contents', () => {
    expectStorage(mat3.identity(mat3.create(...ROW_MAJOR_ARGS)), IDENTITY_STORAGE);
  });

  test('allocates nothing', () => {
    const out = mat3.create();
    expect(mat3.identity(out).buffer).toBe(out.buffer);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(18);
    mat3.identity(viewAt(pool, 2));

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(18, 2, IDENTITY_STORAGE));
  });
});

describe('IDENTITY', () => {
  test('has ones on the diagonal and zeros elsewhere', () => {
    expectStorage(mat3.IDENTITY, IDENTITY_STORAGE);
  });

  test('the diagonal sits at indices 0, 4 and 8', () => {
    expect([mat3.IDENTITY[0], mat3.IDENTITY[4], mat3.IDENTITY[8]]).toEqual([1, 1, 1]);
  });

  test('is a single shared instance', () => {
    expect(mat3.IDENTITY).toBe(mat3.IDENTITY);
  });
});
