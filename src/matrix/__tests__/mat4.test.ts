// src/matrix/__tests__/mat4.test.ts
import { describe, expect, test } from 'vitest';

import * as mat4 from '../mat4.js';

import type { Mat4, ReadonlyMat4 } from '../_types/mat4.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const ELEMENTS = 16;

/** The raw column-major storage of `m`, in index order. */
function storageOf(m: ReadonlyMat4): number[] {
  const elements: number[] = [];
  for (let i = 0; i < ELEMENTS; i++) elements.push(m[i] as number);
  return elements;
}

/**
 * Compares the raw column-major storage against float32-rounded expectations,
 * so tests can use natural literals without encoding the rounding by hand.
 *
 * Expectations are written in *storage* order, not argument order: that is the
 * whole point of these tests, so the transpose must never be hidden here.
 */
function expectStorage(m: ReadonlyMat4, expected: readonly number[]): void {
  expect(storageOf(m)).toEqual(expected.map((n) => Math.fround(n)));
}

/**
 * Test-only cast site: a Mat4 view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBuffer, index: number): Mat4 {
  return new Float32Array(buffer, index * FLOAT_BYTES, ELEMENTS) as Mat4;
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

// Rows:   1  2  3  4
//         5  6  7  8
//         9 10 11 12
//        13 14 15 16
const ROW_MAJOR_ARGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
const COLUMN_MAJOR_STORAGE = [1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15, 4, 8, 12, 16] as const;
const FRACTIONAL_ARGS = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6,
] as const;
const ZEROS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as const;
const SEVENS = [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7] as const;
// biome-ignore format: visual alignment with the matrix
const IDENTITY_STORAGE = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

describe('create', () => {
  test('is the zero matrix by default, not the identity', () => {
    expectStorage(mat4.create(), ZEROS);
  });

  test('takes row-major arguments and stores them column major', () => {
    expectStorage(mat4.create(...ROW_MAJOR_ARGS), COLUMN_MAJOR_STORAGE);
  });

  test('puts the translation column at indices 12, 13 and 14', () => {
    // biome-ignore format: visual alignment with the matrix
    const transform = mat4.create(
      1, 0, 0, 10,
      0, 1, 0, 20,
      0, 0, 1, 30,
      0, 0, 0, 1,
    );

    // This is the layout mat4x4<f32> and uniformMatrix4fv expect.
    expect([transform[12], transform[13], transform[14], transform[15]]).toEqual([10, 20, 30, 1]);
  });

  test('defaults only the omitted elements', () => {
    expectStorage(mat4.create(5), [5, ...ZEROS.slice(1)]);
  });

  test('rounds elements to float32', () => {
    const m = mat4.create(0.1);
    expect(m[0]).not.toBe(0.1);
    expect(m[0]).toBe(Math.fround(0.1));
  });

  test('allocates a standalone sixteen-element buffer', () => {
    const m = mat4.create();
    expect(m).toBeInstanceOf(Float32Array);
    expect(m.length).toBe(ELEMENTS);
    expect(m.byteOffset).toBe(0);
    expect(m.buffer.byteLength).toBe(ELEMENTS * FLOAT_BYTES);
  });
});

describe('clone', () => {
  test('copies elements into a new matrix with its own buffer', () => {
    const source = mat4.create(...ROW_MAJOR_ARGS);
    const result = mat4.clone(source);

    expectStorage(result, COLUMN_MAJOR_STORAGE);
    expect(result).not.toBe(source);
    expect(result.buffer).not.toBe(source.buffer);
  });

  test('preserves storage order rather than transposing', () => {
    const source = mat4.create(...ROW_MAJOR_ARGS);
    expect(storageOf(mat4.clone(source))).toEqual(storageOf(source));
  });

  test('round-trips float32 values exactly', () => {
    const source = mat4.create(...FRACTIONAL_ARGS);
    const result = mat4.clone(source);

    for (let i = 0; i < ELEMENTS; i++) expect(result[i]).toBe(source[i]);
  });

  test('result and source are independent after cloning', () => {
    const source = mat4.create(...ROW_MAJOR_ARGS);
    const result = mat4.clone(source);

    mat4.identity(source);
    expectStorage(result, COLUMN_MAJOR_STORAGE);
  });

  test('accepts a readonly input', () => {
    const frozen: ReadonlyMat4 = mat4.create(...ROW_MAJOR_ARGS);
    expectStorage(mat4.clone(frozen), COLUMN_MAJOR_STORAGE);
  });

  test('cloning a pooled view produces a standalone matrix', () => {
    const pool = sequentialBuffer(32);
    const view = viewAt(pool, 2);
    const snapshot = mat4.clone(view);

    expect(snapshot.buffer).not.toBe(pool);
    expect(snapshot.byteOffset).toBe(0);
    expect(snapshot.buffer.byteLength).toBe(ELEMENTS * FLOAT_BYTES);

    // The owning system writes to the pool; the snapshot must not move.
    mat4.identity(view);
    expectStorage(
      snapshot,
      Array.from({ length: ELEMENTS }, (_, i) => i + 3)
    );
  });

  test('clone(IDENTITY) is the documented way to get a mutable identity', () => {
    const m = mat4.clone(mat4.IDENTITY);

    expectStorage(m, IDENTITY_STORAGE);

    // Writing through the copy must not disturb the shared constant.
    mat4.set(m, ...ROW_MAJOR_ARGS);
    expectStorage(mat4.IDENTITY, IDENTITY_STORAGE);
  });
});

describe('set', () => {
  test('writes elements and returns out', () => {
    const out = mat4.create();
    const result = mat4.set(out, ...ROW_MAJOR_ARGS);

    expect(result).toBe(out);
    expectStorage(out, COLUMN_MAJOR_STORAGE);
  });

  test('agrees with create for the same arguments', () => {
    expect(storageOf(mat4.set(mat4.create(), ...ROW_MAJOR_ARGS))).toEqual(
      storageOf(mat4.create(...ROW_MAJOR_ARGS))
    );
  });

  test('overwrites every element', () => {
    const out = mat4.create(...SEVENS);
    mat4.set(out, ...ROW_MAJOR_ARGS);
    expectStorage(out, COLUMN_MAJOR_STORAGE);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(32);
    mat4.set(viewAt(pool, 2), ...ZEROS);

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(32, 2, ZEROS));
  });
});

describe('copy', () => {
  test('copies elements and returns out', () => {
    const out = mat4.create();
    const source = mat4.create(...ROW_MAJOR_ARGS);
    const result = mat4.copy(out, source);

    expect(result).toBe(out);
    expectStorage(out, COLUMN_MAJOR_STORAGE);
  });

  test('never writes to the input', () => {
    const source = mat4.create(...ROW_MAJOR_ARGS);
    mat4.copy(mat4.create(), source);
    expectStorage(source, COLUMN_MAJOR_STORAGE);
  });

  test('supports chaining through nested calls', () => {
    const a = mat4.create();
    const b = mat4.create();
    mat4.copy(b, mat4.set(a, ...ROW_MAJOR_ARGS));
    expectStorage(b, COLUMN_MAJOR_STORAGE);
  });

  test('out === input is a no-op', () => {
    const m = mat4.create(...ROW_MAJOR_ARGS);
    mat4.copy(m, m);
    expectStorage(m, COLUMN_MAJOR_STORAGE);
  });

  test('overlapping views: out four elements ahead of input', () => {
    // Buffer [1..20]; input covers [0..15], out covers [4..19].
    const buffer = sequentialBuffer(20);
    mat4.copy(viewAt(buffer, 4), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([
      1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });

  test('overlapping views: out four elements behind input', () => {
    // Buffer [1..20]; input covers [4..19], out covers [0..15].
    const buffer = sequentialBuffer(20);
    mat4.copy(viewAt(buffer, 0), viewAt(buffer, 4));

    expect(Array.from(new Float32Array(buffer))).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 17, 18, 19, 20,
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

        mat4.copy(viewAt(buffer, outOffset), viewAt(buffer, inputOffset));

        expectStorage(viewAt(buffer, outOffset), expected);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(32);
    mat4.copy(viewAt(pool, 2), mat4.create());

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(32, 2, ZEROS));
  });
});

describe('identity', () => {
  test('writes the identity matrix and returns out', () => {
    const out = mat4.create();
    const result = mat4.identity(out);

    expect(result).toBe(out);
    expectStorage(out, IDENTITY_STORAGE);
  });

  test('discards previous contents', () => {
    expectStorage(mat4.identity(mat4.create(...ROW_MAJOR_ARGS)), IDENTITY_STORAGE);
  });

  test('allocates nothing', () => {
    const out = mat4.create();
    expect(mat4.identity(out).buffer).toBe(out.buffer);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(32);
    mat4.identity(viewAt(pool, 2));

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(32, 2, IDENTITY_STORAGE));
  });
});

describe('IDENTITY', () => {
  test('has ones on the diagonal and zeros elsewhere', () => {
    expectStorage(mat4.IDENTITY, IDENTITY_STORAGE);
  });

  test('the diagonal sits at indices 0, 5, 10 and 15', () => {
    expect([mat4.IDENTITY[0], mat4.IDENTITY[5], mat4.IDENTITY[10], mat4.IDENTITY[15]]).toEqual([
      1, 1, 1, 1,
    ]);
  });

  test('has no translation', () => {
    expect([mat4.IDENTITY[12], mat4.IDENTITY[13], mat4.IDENTITY[14]]).toEqual([0, 0, 0]);
  });

  test('is a single shared instance', () => {
    expect(mat4.IDENTITY).toBe(mat4.IDENTITY);
  });
});
