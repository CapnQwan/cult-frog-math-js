// src/matrix/mat3x2/__tests__/mat3x2.test.ts
import { describe, expect, test } from 'vitest';

import * as mat3x2 from '../mat3x2.js';

import type { Mat3x2, ReadonlyMat3x2 } from '../_types/mat3x2.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/**
 * The raw column-major storage, compared against float32-rounded expectations
 * so tests can use natural literals without encoding the rounding by hand.
 *
 * Expectations are written in *storage* order, not argument order: that is the
 * whole point of these tests, so the transpose must never be hidden behind a
 * helper.
 */
function expectStorage(m: ReadonlyMat3x2, expected: readonly number[]): void {
  expect([m[0], m[1], m[2], m[3], m[4], m[5]]).toEqual(expected.map((n) => Math.fround(n)));
}

/**
 * Test-only cast site: a Mat3x2 view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBuffer, index: number): Mat3x2 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 6) as Mat3x2;
}

/** A buffer of `count` floats initialised to 1, 2, 3, ... so every slot is distinguishable. */
function sequentialBuffer(count: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * FLOAT_BYTES);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = i + 1;
  return buffer;
}

describe('create', () => {
  test('is the identity by default', () => {
    expectStorage(mat3x2.create(), [1, 0, 0, 1, 0, 0]);
    expect(mat3x2.isEqual(mat3x2.create(), mat3x2.IDENTITY)).toBe(true);
  });

  test('gives the zero matrix only when every element is passed as 0', () => {
    expectStorage(mat3x2.create(0, 0, 0, 0, 0, 0), [0, 0, 0, 0, 0, 0]);
  });

  test('takes row-major arguments and stores them column major', () => {
    // Rows:  1 2 3
    //        4 5 6
    expectStorage(mat3x2.create(1, 2, 3, 4, 5, 6), [1, 4, 2, 5, 3, 6]);
  });

  test('puts the translation column at indices 4 and 5', () => {
    // Rows:  1 0  7
    //        0 1 -3
    const m = mat3x2.create(1, 0, 7, 0, 1, -3);
    expect([m[4], m[5]]).toEqual([7, -3]);
  });

  test('defaults only the omitted elements, to the identity', () => {
    expectStorage(mat3x2.create(5), [5, 0, 0, 1, 0, 0]);
    // Rows:  5 0 2
    //        0 1 0
    expectStorage(mat3x2.create(5, 0, 2), [5, 0, 0, 1, 2, 0]);
  });

  test('rounds elements to float32', () => {
    const m = mat3x2.create(0.1);
    expect(m[0]).not.toBe(0.1);
    expect(m[0]).toBe(Math.fround(0.1));
  });

  test('allocates a standalone six-element buffer', () => {
    const m = mat3x2.create();
    expect(m).toBeInstanceOf(Float32Array);
    expect(m.length).toBe(6);
    expect(m.byteOffset).toBe(0);
    expect(m.buffer.byteLength).toBe(6 * FLOAT_BYTES);
  });
});

describe('clone', () => {
  test('copies elements into a new matrix with its own buffer', () => {
    const source = mat3x2.create(1, 2, 3, 4, 5, 6);
    const result = mat3x2.clone(source);

    expectStorage(result, [1, 4, 2, 5, 3, 6]);
    expect(result).not.toBe(source);
    expect(result.buffer).not.toBe(source.buffer);
  });

  test('preserves storage order rather than transposing', () => {
    const source = mat3x2.create(1, 2, 3, 4, 5, 6);
    const result = mat3x2.clone(source);

    expect(Array.from(result)).toEqual(Array.from(source));
  });

  test('round-trips float32 values exactly', () => {
    const source = mat3x2.create(0.1, -0.7, 1.3, 2.9, -4.1, 1e6 + 0.3);
    const result = mat3x2.clone(source);

    for (let i = 0; i < 6; i++) expect(result[i]).toBe(source[i]);
  });

  test('result and source are independent after cloning', () => {
    const source = mat3x2.create(1, 2, 3, 4, 5, 6);
    const result = mat3x2.clone(source);

    mat3x2.set(source, 9, 9, 9, 9, 9, 9);
    expectStorage(result, [1, 4, 2, 5, 3, 6]);
  });

  test('accepts a readonly input', () => {
    const frozen: ReadonlyMat3x2 = mat3x2.create(1, 2, 3, 4, 5, 6);
    expectStorage(mat3x2.clone(frozen), [1, 4, 2, 5, 3, 6]);
  });

  test('cloning a pooled view produces a standalone matrix', () => {
    const pool = sequentialBuffer(10);
    const view = viewAt(pool, 2);
    const snapshot = mat3x2.clone(view);

    expect(snapshot.buffer).not.toBe(pool);
    expect(snapshot.byteOffset).toBe(0);
    expect(snapshot.buffer.byteLength).toBe(6 * FLOAT_BYTES);

    // The owning system writes to the pool; the snapshot must not move.
    mat3x2.set(view, 0, 0, 0, 0, 0, 0);
    expectStorage(snapshot, [3, 4, 5, 6, 7, 8]);
  });

  test('clone(IDENTITY) gives a mutable identity with its own buffer', () => {
    const m = mat3x2.clone(mat3x2.IDENTITY);

    expectStorage(m, [1, 0, 0, 1, 0, 0]);

    // Writing through the copy must not disturb the shared constant.
    mat3x2.set(m, 9, 9, 9, 9, 9, 9);
    expectStorage(mat3x2.IDENTITY, [1, 0, 0, 1, 0, 0]);
  });
});

describe('set', () => {
  test('writes elements and returns out', () => {
    const out = mat3x2.create();
    const result = mat3x2.set(out, 1, 2, 3, 4, 5, 6);

    expect(result).toBe(out);
    expectStorage(out, [1, 4, 2, 5, 3, 6]);
  });

  test('agrees with create for the same arguments', () => {
    expectStorage(mat3x2.set(mat3x2.create(), 1, 2, 3, 4, 5, 6), [1, 4, 2, 5, 3, 6]);
  });

  test('overwrites every element', () => {
    const out = mat3x2.create(7, 7, 7, 7, 7, 7);
    mat3x2.set(out, -1, 1, -2, 2, -3, 3);
    expectStorage(out, [-1, 2, 1, -3, -2, 3]);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(10);
    mat3x2.set(viewAt(pool, 2), 0, 0, 0, 0, 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 9, 10]);
  });
});

describe('copy', () => {
  test('copies elements and returns out', () => {
    const out = mat3x2.create();
    const source = mat3x2.create(1, 2, 3, 4, 5, 6);
    const result = mat3x2.copy(out, source);

    expect(result).toBe(out);
    expectStorage(out, [1, 4, 2, 5, 3, 6]);
  });

  test('never writes to the input', () => {
    const out = mat3x2.create(7, 7, 7, 7, 7, 7);
    const source = mat3x2.create(1, 2, 3, 4, 5, 6);
    mat3x2.copy(out, source);
    expectStorage(source, [1, 4, 2, 5, 3, 6]);
  });

  test('supports chaining through nested calls', () => {
    const a = mat3x2.create();
    const b = mat3x2.create();
    mat3x2.copy(b, mat3x2.set(a, 1, 2, 3, 4, 5, 6));
    expectStorage(b, [1, 4, 2, 5, 3, 6]);
  });

  test('out === input is a no-op', () => {
    const m = mat3x2.create(1, 2, 3, 4, 5, 6);
    mat3x2.copy(m, m);
    expectStorage(m, [1, 4, 2, 5, 3, 6]);
  });

  test('overlapping views: out one element ahead of input', () => {
    // Buffer [1..7]; input covers [0..5], out covers [1..6].
    const buffer = sequentialBuffer(7);
    mat3x2.copy(viewAt(buffer, 1), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([1, 1, 2, 3, 4, 5, 6]);
  });

  test('overlapping views: out one element behind input', () => {
    // Buffer [1..7]; input covers [1..6], out covers [0..5].
    const buffer = sequentialBuffer(7);
    mat3x2.copy(viewAt(buffer, 0), viewAt(buffer, 1));

    expect(Array.from(new Float32Array(buffer))).toEqual([2, 3, 4, 5, 6, 7, 7]);
  });

  test('every overlap of two distinct views is exact', () => {
    // Elements are staged through locals before any write, so no element can
    // be clobbered before it has been read, at any offset.
    for (let outOffset = 0; outOffset < 6; outOffset++) {
      for (let inputOffset = 0; inputOffset < 6; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(12);
        const input = viewAt(buffer, inputOffset);
        const expected = Array.from(input);

        mat3x2.copy(viewAt(buffer, outOffset), input);

        expectStorage(viewAt(buffer, outOffset), expected);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(10);
    mat3x2.copy(viewAt(pool, 2), mat3x2.create());

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 1, 0, 0, 1, 0, 0, 9, 10]);
  });
});

describe('identity', () => {
  test('writes the identity transform and returns out', () => {
    const out = mat3x2.create(1, 2, 3, 4, 5, 6);
    const result = mat3x2.identity(out);

    expect(result).toBe(out);
    expectStorage(out, [1, 0, 0, 1, 0, 0]);
  });

  test('clears the translation as well as the linear part', () => {
    const out = mat3x2.create(1, 0, 7, 0, 1, -3);
    mat3x2.identity(out);
    expect([out[4], out[5]]).toEqual([0, 0]);
  });

  test('allocates nothing', () => {
    const out = mat3x2.create();
    expect(mat3x2.identity(out).buffer).toBe(out.buffer);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(10);
    mat3x2.identity(viewAt(pool, 2));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 1, 0, 0, 1, 0, 0, 9, 10]);
  });
});

describe('IDENTITY', () => {
  test('has a unit linear part and no translation', () => {
    expectStorage(mat3x2.IDENTITY, [1, 0, 0, 1, 0, 0]);
  });

  test('is a single shared instance', () => {
    expect(mat3x2.IDENTITY).toBe(mat3x2.IDENTITY);
  });
});

describe('SIZE', () => {
  test('matches the length of an allocated matrix', () => {
    expect(mat3x2.SIZE).toBe(6);
    expect(mat3x2.create().length).toBe(mat3x2.SIZE);
  });
});

describe('isEqual', () => {
  test('matrices with the same elements are equal', () => {
    expect(mat3x2.isEqual(mat3x2.create(1, 2, 3, 4, 5, 6), mat3x2.create(1, 2, 3, 4, 5, 6))).toBe(
      true
    );
  });

  test('a matrix equals itself', () => {
    const m = mat3x2.create(1, 2, 3, 4, 5, 6);
    expect(mat3x2.isEqual(m, m)).toBe(true);
  });

  test('a difference in any single element makes them unequal', () => {
    const a = mat3x2.create(1, 2, 3, 4, 5, 6);
    for (let i = 0; i < mat3x2.SIZE; i++) {
      const b = mat3x2.clone(a);
      b[i] = 99;
      expect(mat3x2.isEqual(a, b)).toBe(false);
    }
  });

  test('treats -0 and 0 as equal', () => {
    expect(
      mat3x2.isEqual(mat3x2.create(-0, -0, -0, -0, -0, -0), mat3x2.create(0, 0, 0, 0, 0, 0))
    ).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const m = mat3x2.create(1, 0, Number.NaN, 0, 1, 0);
    expect(mat3x2.isEqual(m, m)).toBe(false);
  });

  test('IDENTITY equals a freshly written identity', () => {
    expect(mat3x2.isEqual(mat3x2.IDENTITY, mat3x2.identity(mat3x2.create()))).toBe(true);
  });
});

describe('isEqualEpsilon', () => {
  test('matrices with the same elements are equal', () => {
    expect(
      mat3x2.isEqualEpsilon(mat3x2.create(1, 2, 3, 4, 5, 6), mat3x2.create(1, 2, 3, 4, 5, 6))
    ).toBe(true);
  });

  test('differences within the default tolerance are equal', () => {
    expect(
      mat3x2.isEqualEpsilon(mat3x2.IDENTITY, mat3x2.create(1 + 2 ** -23, 1e-7, -1e-7, 0, 1, 1e-7))
    ).toBe(true);
  });

  test('a difference beyond tolerance in any single element makes them unequal', () => {
    const a = mat3x2.create(1, 2, 3, 4, 5, 6);
    for (let i = 0; i < mat3x2.SIZE; i++) {
      const b = mat3x2.clone(a);
      b[i] = 99;
      expect(mat3x2.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('tolerance scales with magnitude, including the translation', () => {
    // Adjacent float32 values near 10,000 are ~0.001 apart, far beyond EPSILON.
    const a = mat3x2.create(1, 0, 10000.5, 0, 1, 0);
    const b = mat3x2.create(1, 0, 10000.5 + 0.001, 0, 1, 0);
    expect(mat3x2.isEqual(a, b)).toBe(false);
    expect(mat3x2.isEqualEpsilon(a, b)).toBe(true);
  });

  test('accepts a custom tolerance', () => {
    expect(mat3x2.isEqualEpsilon(mat3x2.create(), mat3x2.create(1, 0, 0.05, 0, 1, 0), 0.1)).toBe(
      true
    );
    expect(mat3x2.isEqualEpsilon(mat3x2.create(), mat3x2.create(1, 0, 0.5, 0, 1, 0), 0.1)).toBe(
      false
    );
  });

  test('NaN is never equal', () => {
    const m = mat3x2.create(Number.NaN, 0, 0, 0, 1, 0);
    expect(mat3x2.isEqualEpsilon(m, m)).toBe(false);
  });
});
