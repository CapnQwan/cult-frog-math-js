// src/matrix/mat3x2/__tests__/mat3x2.test.ts
import { describe, expect, test } from 'vitest';

import * as vec2 from '../../../vector/vec2/vec2.js';
import * as mat2 from '../../mat2/mat2.js';
import * as mat3 from '../../mat3/mat3.js';
import * as mat3x2 from '../mat3x2.js';

import type { ReadonlyVec2, Vec2 } from '../../../vector/vec2/_types/vec2.js';
import type { Mat3 } from '../../mat3/_types/mat3.js';
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

/** The full 3x3 matrix `m` stands for, with its implied `0 0 1` bottom row written out. */
// biome-ignore format: visual alignment with the matrix
function toMat3(m: ReadonlyMat3x2): Mat3 {
  return mat3.create(
    m[0], m[2], m[4],
    m[1], m[3], m[5],
    0,    0,    1,
  );
}

/** A buffer of `count` irregular floats, so no view over it is singular. */
function irregularBuffer(count: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * FLOAT_BYTES);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = Math.sin(i + 1);
  return buffer;
}

describe('multiply', () => {
  // Rows:  1 2 3      7  8  9
  //        4 5 6     10 11 12
  const a = mat3x2.create(1, 2, 3, 4, 5, 6);
  const b = mat3x2.create(7, 8, 9, 10, 11, 12);

  test('writes a * b and returns out', () => {
    const out = mat3x2.create();
    const result = mat3x2.multiply(out, a, b);

    expect(result).toBe(out);
    // Rows: 27 30  36
    //       78 87 102
    expectStorage(out, [27, 78, 30, 87, 36, 102]);
  });

  test('order matters: b * a is a different matrix', () => {
    // Rows: 39 54  78
    //       54 75 108
    expectStorage(mat3x2.multiply(mat3x2.create(), b, a), [39, 54, 54, 75, 78, 108]);
  });

  test('matches the 3x3 product with the implied bottom row, exactly', () => {
    const pairs: [ReadonlyMat3x2, ReadonlyMat3x2][] = [
      [a, b],
      [b, a],
      [mat3x2.create(0.5, -1.25, 3, 2, 0.75, -8), mat3x2.create(-3, 0.1, 40, 0.2, 7, -0.3)],
    ];

    for (const [left, right] of pairs) {
      const product = mat3x2.multiply(mat3x2.create(), left, right);
      const full = mat3.multiply(mat3.create(), toMat3(left), toMat3(right));
      expect(mat3.isEqual(toMat3(product), full)).toBe(true);
    }
  });

  test('carries the right translation through the left linear part, then adds the left translation', () => {
    // Rows:  2 0 10       1 0 3
    //        0 3 20       0 1 4
    const scaleThenMove = mat3x2.create(2, 0, 10, 0, 3, 20);
    const move = mat3x2.create(1, 0, 3, 0, 1, 4);

    // The move happens first, so it is scaled: (2 * 3 + 10, 3 * 4 + 20).
    expectStorage(mat3x2.multiply(mat3x2.create(), scaleThenMove, move), [2, 0, 0, 3, 16, 32]);
    // The move happens last, so it is added as-is: (10 + 3, 20 + 4).
    expectStorage(mat3x2.multiply(mat3x2.create(), move, scaleThenMove), [2, 0, 0, 3, 13, 24]);
  });

  test('IDENTITY leaves the other input unchanged on either side', () => {
    expectStorage(mat3x2.multiply(mat3x2.create(), mat3x2.IDENTITY, a), [1, 4, 2, 5, 3, 6]);
    expectStorage(mat3x2.multiply(mat3x2.create(), a, mat3x2.IDENTITY), [1, 4, 2, 5, 3, 6]);
  });

  test('never writes to the inputs', () => {
    mat3x2.multiply(mat3x2.create(), a, b);
    expectStorage(a, [1, 4, 2, 5, 3, 6]);
    expectStorage(b, [7, 10, 8, 11, 9, 12]);
  });

  test('out === a', () => {
    const m = mat3x2.clone(a);
    mat3x2.multiply(m, m, b);
    expectStorage(m, [27, 78, 30, 87, 36, 102]);
  });

  test('out === b', () => {
    const m = mat3x2.clone(b);
    mat3x2.multiply(m, a, m);
    expectStorage(m, [27, 78, 30, 87, 36, 102]);
  });

  test('out === a === b squares in place', () => {
    const m = mat3x2.clone(a);
    mat3x2.multiply(m, m, m);
    // Rows:  9 12 18
    //       24 33 48
    expectStorage(m, [9, 24, 12, 33, 18, 48]);
  });

  test('every overlap of out with either input is exact', () => {
    for (let outOffset = 0; outOffset < 6; outOffset++) {
      for (let inputOffset = 0; inputOffset < 6; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const leftBuffer = sequentialBuffer(12);
        const left = viewAt(leftBuffer, inputOffset);
        const leftExpected = mat3x2.multiply(mat3x2.create(), mat3x2.clone(left), b);
        mat3x2.multiply(viewAt(leftBuffer, outOffset), left, b);
        expect(mat3x2.isEqual(viewAt(leftBuffer, outOffset), leftExpected)).toBe(true);

        const rightBuffer = sequentialBuffer(12);
        const right = viewAt(rightBuffer, inputOffset);
        const rightExpected = mat3x2.multiply(mat3x2.create(), a, mat3x2.clone(right));
        mat3x2.multiply(viewAt(rightBuffer, outOffset), a, right);
        expect(mat3x2.isEqual(viewAt(rightBuffer, outOffset), rightExpected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(10);
    mat3x2.multiply(viewAt(pool, 2), a, b);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 27, 78, 30, 87, 36, 102, 9, 10]);
  });
});

describe('determinant', () => {
  test('is the determinant of the linear part, a00 * a11 - a01 * a10', () => {
    // Rows:  1 2 3
    //        4 5 6
    expect(mat3x2.determinant(mat3x2.create(1, 2, 3, 4, 5, 6))).toBe(-3);
  });

  test('matches the 3x3 determinant with the implied bottom row', () => {
    const m = mat3x2.create(0.5, -1.25, 3, 2, 0.75, -8);
    expect(mat3x2.determinant(m)).toBe(mat3.determinant(toMat3(m)));
  });

  test('the translation never affects it', () => {
    const linear = mat3x2.create(2, -3, 0, 5, 7, 0);
    const moved = mat3x2.create(2, -3, 1e6, 5, 7, -4e5);

    expect(mat3x2.determinant(linear)).toBe(29);
    expect(mat3x2.determinant(moved)).toBe(29);
  });

  test('IDENTITY gives 1 and a zero linear part gives 0', () => {
    expect(mat3x2.determinant(mat3x2.IDENTITY)).toBe(1);
    expect(mat3x2.determinant(mat3x2.create(0, 0, 5, 0, 0, 5))).toBe(0);
  });

  test('is the area scale', () => {
    expect(mat3x2.determinant(mat3x2.create(3, 0, 1, 0, 3, 1))).toBe(9);
    expect(mat3x2.determinant(mat3x2.create(2, 0, 1, 0, 5, 1))).toBe(10);
  });

  test('a rotation gives 1, up to rounding', () => {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    expect(mat3x2.determinant(mat3x2.create(c, -s, 4, s, c, -2))).toBeCloseTo(1, 6);
  });

  test('a mirror gives a negative determinant', () => {
    expect(mat3x2.determinant(mat3x2.create(-1, 0, 0, 0, 1, 0))).toBe(-1);
    expect(mat3x2.determinant(mat3x2.create(1, 0, 0, 0, -1, 0))).toBe(-1);
  });

  test('the determinant of a product is the product of the determinants', () => {
    const a = mat3x2.create(1, 2, 3, 4, 5, 6);
    const b = mat3x2.create(7, 8, 9, 10, 11, 12);
    const product = mat3x2.multiply(mat3x2.create(), a, b);

    expect(mat3x2.determinant(product)).toBe(mat3x2.determinant(a) * mat3x2.determinant(b));
  });

  test('is computed in float64, not rounded to float32', () => {
    const f = Math.fround(0.1);

    expect(mat3x2.determinant(mat3x2.create(0.1, 0, 0, 0, 0.1, 0))).toBe(f * f);
    expect(Math.fround(f * f)).not.toBe(f * f);
  });

  test('a NaN in the linear part gives NaN', () => {
    for (const i of [0, 1, 2, 3]) {
      const m = mat3x2.create();
      m[i] = Number.NaN;
      expect(mat3x2.determinant(m)).toBeNaN();
    }
  });

  test('a NaN translation does not reach it', () => {
    expect(mat3x2.determinant(mat3x2.create(1, 0, Number.NaN, 0, 1, Number.NaN))).toBe(1);
  });

  test('reads only its own slots from a pooled view', () => {
    const pool = sequentialBuffer(10);
    const view = viewAt(pool, 2);
    mat3x2.set(view, 1, 2, 3, 4, 5, 6);

    expect(mat3x2.determinant(view)).toBe(-3);
  });
});

describe('invert', () => {
  // Rows:  2 3  5
  //        1 2 -4
  const a = mat3x2.create(2, 3, 5, 1, 2, -4);
  // Rows:  2 -3 -22
  //       -1  2  13
  const inverseStorage = [2, -1, -3, 2, -22, 13] as const;
  // Rows:  4 7  3
  //        2 6 -1
  const dense = mat3x2.create(4, 7, 3, 2, 6, -1);
  // Float32 rounding in the inverse leaves products a little further from exact.
  const ProductEpsilon = 1e-5;

  /** `expectStorage`, counting `-0` as `0`: a zero cofactor term can come out as `-0`. */
  function expectInverseStorage(m: ReadonlyMat3x2, expected: readonly number[]): void {
    expect([m[0], m[1], m[2], m[3], m[4], m[5]].map((n) => n + 0)).toEqual(
      expected.map((n) => Math.fround(n))
    );
  }

  /** The inverse of a matrix the test knows is invertible. */
  function inverseOf(m: ReadonlyMat3x2): Mat3x2 {
    const inverse = mat3x2.invert(mat3x2.create(), m);
    if (!inverse) throw new Error('expected an invertible matrix');
    return inverse;
  }

  test('writes the inverse and returns out', () => {
    const out = mat3x2.create();
    const result = mat3x2.invert(out, a);

    expect(result).toBe(out);
    expectInverseStorage(out, inverseStorage);
  });

  test('a * inverse and inverse * a both give the identity', () => {
    const inverse = inverseOf(dense);

    const after = mat3x2.multiply(mat3x2.create(), dense, inverse);
    const before = mat3x2.multiply(mat3x2.create(), inverse, dense);
    expect(mat3x2.isEqualEpsilon(after, mat3x2.IDENTITY, ProductEpsilon)).toBe(true);
    expect(mat3x2.isEqualEpsilon(before, mat3x2.IDENTITY, ProductEpsilon)).toBe(true);
  });

  test('matches the 3x3 inverse with the implied bottom row', () => {
    const full = mat3.invert(mat3.create(), toMat3(dense));
    if (!full) throw new Error('expected an invertible matrix');

    expect(mat3.isEqualEpsilon(toMat3(inverseOf(dense)), full)).toBe(true);
  });

  test('IDENTITY inverts to itself', () => {
    expectInverseStorage(inverseOf(mat3x2.IDENTITY), [1, 0, 0, 1, 0, 0]);
  });

  test('a pure translation inverts exactly, to its negation', () => {
    // Rows:  1 0  5.5
    //        0 1 -3.25
    const translation = mat3x2.create(1, 0, 5.5, 0, 1, -3.25);
    expectInverseStorage(inverseOf(translation), [1, 0, 0, 1, -5.5, 3.25]);
  });

  test('removes the translation, then undoes the linear part', () => {
    // Scale by 2, then move by (10, 20): the inverse moves by (-10, -20), then halves.
    const scaleThenMove = mat3x2.create(2, 0, 10, 0, 2, 20);
    expectInverseStorage(inverseOf(scaleThenMove), [0.5, 0, 0, 0.5, -5, -10]);
  });

  test('inverting twice gives back the original', () => {
    expect(mat3x2.isEqualEpsilon(inverseOf(inverseOf(dense)), dense)).toBe(true);
  });

  test('the determinant of the inverse is the reciprocal', () => {
    expect(mat3x2.determinant(inverseOf(dense))).toBeCloseTo(1 / mat3x2.determinant(dense), 7);
  });

  test('a small uniform scale still inverts', () => {
    // The determinant is 1e-4, far below any fixed tolerance, yet the inverse is exact enough.
    const inverse = inverseOf(mat3x2.create(0.01, 0, 0, 0, 0.01, 0));
    expect(mat3x2.isEqualEpsilon(inverse, mat3x2.create(100, 0, 0, 0, 100, 0))).toBe(true);
  });

  test('returns null and leaves out untouched for a singular linear part, whatever the translation', () => {
    const singular = [
      mat3x2.create(0, 0, 0, 0, 0, 0),
      // A translation alone can't make the matrix invertible.
      mat3x2.create(0, 0, 5, 0, 0, -5),
      // Dependent rows.
      mat3x2.create(1, 2, 3, 2, 4, 6),
      // One axis scaled to zero.
      mat3x2.create(1, 0, 7, 0, 0, 7),
    ];

    for (const m of singular) {
      const out = mat3x2.create(7, 7, 7, 7, 7, 7);
      expect(mat3x2.invert(out, m)).toBeNull();
      expectStorage(out, [7, 7, 7, 7, 7, 7]);
    }
  });

  test('returns null and leaves out untouched when the linear part has a NaN', () => {
    for (const i of [0, 1, 2, 3]) {
      const m = mat3x2.clone(a);
      m[i] = Number.NaN;
      const out = mat3x2.create(7, 7, 7, 7, 7, 7);
      expect(mat3x2.invert(out, m)).toBeNull();
      expectStorage(out, [7, 7, 7, 7, 7, 7]);
    }
  });

  test('a NaN translation inverts to a NaN translation, not null', () => {
    for (const i of [4, 5]) {
      const m = mat3x2.clone(a);
      m[i] = Number.NaN;
      const inverse = mat3x2.invert(mat3x2.create(), m);

      expect(inverse).not.toBeNull();
      expect([inverse?.[0], inverse?.[1], inverse?.[2], inverse?.[3]]).toEqual([2, -1, -3, 2]);
      expect(inverse?.[4]).toBeNaN();
      expect(inverse?.[5]).toBeNaN();
    }
  });

  test('an infinite determinant is not caught', () => {
    const infinite = mat3x2.create(Number.POSITIVE_INFINITY, 0, 0, 0, 1, 0);
    const inverse = mat3x2.invert(mat3x2.create(), infinite);
    expect(inverse).not.toBeNull();
    expect(Array.from(inverse ?? []).some(Number.isNaN)).toBe(true);
  });

  test('never writes to the input', () => {
    mat3x2.invert(mat3x2.create(), a);
    expectStorage(a, [2, 1, 3, 2, 5, -4]);
  });

  test('out === a inverts in place', () => {
    const m = mat3x2.clone(a);
    mat3x2.invert(m, m);
    expectInverseStorage(m, inverseStorage);
  });

  test('every overlap of out with the input is exact', () => {
    for (let outOffset = 0; outOffset < 6; outOffset++) {
      for (let inputOffset = 0; inputOffset < 6; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = irregularBuffer(12);
        const input = viewAt(buffer, inputOffset);
        const expected = inverseOf(mat3x2.clone(input));

        mat3x2.invert(viewAt(buffer, outOffset), input);

        expect(mat3x2.isEqual(viewAt(buffer, outOffset), expected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(10);
    mat3x2.invert(viewAt(pool, 2), a);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 2, -1, -3, 2, -22, 13, 9, 10]);
  });
});

/** The raw column-major storage of `m`, in index order. */
function storageOf(m: ReadonlyMat3x2): number[] {
  return [m[0], m[1], m[2], m[3], m[4], m[5]];
}

/** Test-only cast site: a Vec2 view over element `index` of a shared buffer. */
function vec2At(buffer: ArrayBuffer, index: number): Vec2 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 2) as Vec2;
}

/**
 * Builds with the input as a view at every offset around `out`, overlapping
 * it or not, and checks each result against building from an untouched copy.
 */
function expectOverlapSafe(build: (out: Mat3x2, input: Vec2) => Mat3x2): void {
  const count = mat3x2.SIZE + 8;
  for (let index = 0; index <= count - 2; index++) {
    const buffer = irregularBuffer(count);
    const expected = build(mat3x2.create(), vec2At(buffer.slice(0), index));

    build(viewAt(buffer, 4), vec2At(buffer, index));

    expect(storageOf(viewAt(buffer, 4))).toEqual(storageOf(expected));
  }
}

/** Checks that building into a pooled view writes its own 6 slots and nothing else. */
function expectPooledWrite(build: (out: Mat3x2) => Mat3x2): void {
  const pool = sequentialBuffer(12);
  const written = storageOf(build(mat3x2.create()));

  build(viewAt(pool, 2));

  expect(Array.from(new Float32Array(pool))).toEqual([1, 2, ...written, 9, 10, 11, 12]);
}

/** Expects every storage element to agree with `expected` to 6 decimal places. */
function expectStorageNear(m: ReadonlyMat3x2, expected: readonly number[]): void {
  storageOf(m).forEach((n, i) => {
    expect(n).toBeCloseTo(expected[i] as number, 6);
  });
}

/** Expects two vectors to agree to 5 decimal places. */
function expectVec2Near(actual: ReadonlyVec2, expected: ReadonlyVec2): void {
  expect(actual[0]).toBeCloseTo(expected[0], 5);
  expect(actual[1]).toBeCloseTo(expected[1], 5);
}

const SEVENS = [7, 7, 7, 7, 7, 7] as const;
const POINT = vec2.create(0.3, -1.2);
// Float32 rounding in rotation products leaves results a little further from exact.
const RotationEpsilon = 1e-5;

describe('fromTranslation', () => {
  const t = vec2.create(5, -3);

  test('writes the translation into the last column and returns out', () => {
    const out = mat3x2.create(...SEVENS);
    const result = mat3x2.fromTranslation(out, t);

    expect(result).toBe(out);
    expectStorage(out, [1, 0, 0, 1, 5, -3]);
  });

  test('matches the translation spelled out in row-major order', () => {
    const expected = mat3x2.create(1, 0, 5, 0, 1, -3);
    expect(mat3x2.isEqual(mat3x2.fromTranslation(mat3x2.create(), t), expected)).toBe(true);
  });

  test('moves points and leaves directions unchanged', () => {
    const m = mat3x2.fromTranslation(mat3x2.create(), t);

    const moved = vec2.transformMat3x2(vec2.create(), POINT, m);
    const turned = vec2.transformDirectionMat3x2(vec2.create(), POINT, m);
    expect(vec2.isEqual(moved, vec2.add(vec2.create(), POINT, t))).toBe(true);
    expect(vec2.isEqual(turned, POINT)).toBe(true);
  });

  test('the negated translation is its exact inverse', () => {
    const inverse = mat3x2.invert(mat3x2.create(), mat3x2.fromTranslation(mat3x2.create(), t));
    const negated = mat3x2.fromTranslation(mat3x2.create(), vec2.negate(vec2.create(), t));

    expect(inverse).not.toBeNull();
    expect(mat3x2.isEqual(inverse ?? mat3x2.create(), negated)).toBe(true);
  });

  test('translations compose by adding', () => {
    const other = vec2.create(-1, 4);
    const product = mat3x2.multiply(
      mat3x2.create(),
      mat3x2.fromTranslation(mat3x2.create(), t),
      mat3x2.fromTranslation(mat3x2.create(), other)
    );
    const sum = mat3x2.fromTranslation(mat3x2.create(), vec2.add(vec2.create(), t, other));

    expect(mat3x2.isEqual(product, sum)).toBe(true);
  });

  test('never writes to the input', () => {
    mat3x2.fromTranslation(mat3x2.create(), t);
    expect(vec2.isEqualXY(t, 5, -3)).toBe(true);
  });

  test('the input may overlap out', () => {
    expectOverlapSafe(mat3x2.fromTranslation);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3x2.fromTranslation(out, t));
  });
});

describe('fromRotation', () => {
  test('a quarter turn is written column major and returns out', () => {
    // Rows:  0 -1 0
    //        1  0 0
    const out = mat3x2.create(...SEVENS);
    const result = mat3x2.fromRotation(out, Math.PI / 2);

    expect(result).toBe(out);
    expectStorageNear(out, [0, 1, -1, 0, 0, 0]);
  });

  test('the linear part is exactly Mat2.fromRotation', () => {
    const m = mat3x2.fromRotation(mat3x2.create(), 0.7);
    const r = mat2.fromRotation(mat2.create(), 0.7);

    expect([m[0], m[1], m[2], m[3]]).toEqual([r[0], r[1], r[2], r[3]]);
  });

  test('translates nothing', () => {
    const m = mat3x2.fromRotation(mat3x2.create(...SEVENS), 2.4);
    expect([m[4], m[5]]).toEqual([0, 0]);
  });

  test('a zero angle gives the identity', () => {
    const m = mat3x2.fromRotation(mat3x2.create(...SEVENS), 0);
    expect(mat3x2.isEqual(m, mat3x2.IDENTITY)).toBe(true);
  });

  test('a positive angle turns counter-clockwise: RIGHT towards UP', () => {
    const m = mat3x2.fromRotation(mat3x2.create(), Math.PI / 2);
    expectVec2Near(vec2.transformMat3x2(vec2.create(), vec2.RIGHT, m), vec2.UP);
  });

  test('negating the angle transposes the linear part exactly, which is the inverse', () => {
    const forward = mat3x2.fromRotation(mat3x2.create(), 0.7);
    const back = mat3x2.fromRotation(mat3x2.create(), -0.7);
    const inverse = mat3x2.invert(mat3x2.create(), forward);

    expect(storageOf(back)).toEqual([forward[0], forward[2], forward[1], forward[3], 0, 0]);
    expect(mat3x2.isEqualEpsilon(back, inverse ?? mat3x2.create())).toBe(true);
  });

  test('a NaN angle spreads into the rotation', () => {
    const m = mat3x2.fromRotation(mat3x2.create(), Number.NaN);
    expect(storageOf(m).some(Number.isNaN)).toBe(true);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3x2.fromRotation(out, 0.7));
  });
});

describe('fromScale', () => {
  const s = vec2.create(2, 0.5);

  test('writes the scale onto the diagonal and returns out', () => {
    const out = mat3x2.create(...SEVENS);
    const result = mat3x2.fromScale(out, s);

    expect(result).toBe(out);
    expectStorage(out, [2, 0, 0, 0.5, 0, 0]);
  });

  test('scales each axis of a point, and translates nothing', () => {
    const m = mat3x2.fromScale(mat3x2.create(), s);

    const scaled = vec2.transformMat3x2(vec2.create(), POINT, m);
    expect(vec2.isEqual(scaled, vec2.mul(vec2.create(), POINT, s))).toBe(true);
    expect(vec2.isEqual(vec2.transformMat3x2(vec2.create(), vec2.ZERO, m), vec2.ZERO)).toBe(true);
  });

  test('the reciprocal scale is its exact inverse', () => {
    const inverse = mat3x2.invert(mat3x2.create(), mat3x2.fromScale(mat3x2.create(), s));
    const reciprocal = mat3x2.fromScale(mat3x2.create(), vec2.create(0.5, 2));

    expect(inverse).not.toBeNull();
    expect(mat3x2.isEqual(inverse ?? mat3x2.create(), reciprocal)).toBe(true);
  });

  test('a zero component leaves no inverse', () => {
    for (let i = 0; i < 2; i++) {
      const flat = vec2.clone(s);
      flat[i] = 0;
      expect(mat3x2.invert(mat3x2.create(), mat3x2.fromScale(mat3x2.create(), flat))).toBeNull();
    }
  });

  test('never writes to the input', () => {
    mat3x2.fromScale(mat3x2.create(), s);
    expect(vec2.isEqualXY(s, 2, 0.5)).toBe(true);
  });

  test('the input may overlap out', () => {
    expectOverlapSafe(mat3x2.fromScale);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3x2.fromScale(out, s));
  });
});

describe('fromTRS', () => {
  const t = vec2.create(4, -6);
  const angle = 0.7;
  const s = vec2.create(2, 0.5);
  const Angles = [0.7, 2.4, -1.1, 4] as const;

  /** `T * R * S`, built from the single-part builders with `multiply`. */
  function composed(turn: number): Mat3x2 {
    const rs = mat3x2.multiply(
      mat3x2.create(),
      mat3x2.fromRotation(mat3x2.create(), turn),
      mat3x2.fromScale(mat3x2.create(), s)
    );
    return mat3x2.multiply(mat3x2.create(), mat3x2.fromTranslation(mat3x2.create(), t), rs);
  }

  test('returns out and overwrites every element', () => {
    const out = mat3x2.create(...SEVENS);
    const result = mat3x2.fromTRS(out, vec2.ZERO, 0, vec2.ONE);

    expect(result).toBe(out);
    expect(mat3x2.isEqual(out, mat3x2.IDENTITY)).toBe(true);
  });

  test('equals T * R * S built with multiply', () => {
    for (const turn of Angles) {
      const trs = mat3x2.fromTRS(mat3x2.create(), t, turn, s);
      expect(mat3x2.isEqualEpsilon(trs, composed(turn), RotationEpsilon)).toBe(true);
    }
  });

  test('scales, then rotates, then translates a point', () => {
    for (const turn of Angles) {
      const m = mat3x2.fromTRS(mat3x2.create(), t, turn, s);

      const scaled = vec2.mul(vec2.create(), POINT, s);
      const rotation = mat2.fromRotation(mat2.create(), turn);
      const rotated = vec2.transformMat2(vec2.create(), scaled, rotation);
      const expected = vec2.add(vec2.create(), rotated, t);
      expectVec2Near(vec2.transformMat3x2(vec2.create(), POINT, m), expected);
    }
  });

  test('a non-uniform scale stretches along the object axes, before the rotation', () => {
    // Stretch x by 2, then turn a quarter: x ends up along y, still doubled.
    const m = mat3x2.fromTRS(mat3x2.create(), vec2.ZERO, Math.PI / 2, vec2.create(2, 1));
    expectVec2Near(vec2.transformMat3x2(vec2.create(), vec2.RIGHT, m), vec2.create(0, 2));
  });

  test('with no translation or scale it is exactly fromRotation', () => {
    for (const turn of Angles) {
      const trs = mat3x2.fromTRS(mat3x2.create(), vec2.ZERO, turn, vec2.ONE);
      expect(mat3x2.isEqual(trs, mat3x2.fromRotation(mat3x2.create(), turn))).toBe(true);
    }
  });

  test('with no rotation it is exactly the scale with the translation added', () => {
    const expected = mat3x2.create(2, 0, 4, 0, 0.5, -6);
    expect(mat3x2.isEqual(mat3x2.fromTRS(mat3x2.create(), t, 0, s), expected)).toBe(true);
  });

  test('the translation is written untouched by the rotation and scale', () => {
    const m = mat3x2.fromTRS(mat3x2.create(), t, angle, s);
    expect([m[4], m[5]]).toEqual([4, -6]);
  });

  test('a zero scale component leaves no inverse', () => {
    for (let i = 0; i < 2; i++) {
      const flat = vec2.clone(s);
      flat[i] = 0;
      const m = mat3x2.fromTRS(mat3x2.create(), t, angle, flat);
      expect(mat3x2.invert(mat3x2.create(), m)).toBeNull();
    }
  });

  test('a NaN in any input appears in the result', () => {
    const hasNaN = (m: ReadonlyMat3x2): boolean => storageOf(m).some(Number.isNaN);

    for (let i = 0; i < 2; i++) {
      const badT = vec2.clone(t);
      badT[i] = Number.NaN;
      const badS = vec2.clone(s);
      badS[i] = Number.NaN;
      expect(hasNaN(mat3x2.fromTRS(mat3x2.create(), badT, angle, s))).toBe(true);
      expect(hasNaN(mat3x2.fromTRS(mat3x2.create(), t, angle, badS))).toBe(true);
    }
    expect(hasNaN(mat3x2.fromTRS(mat3x2.create(), t, Number.NaN, s))).toBe(true);
  });

  test('never writes to the inputs', () => {
    mat3x2.fromTRS(mat3x2.create(), t, angle, s);

    expect(vec2.isEqualXY(t, 4, -6)).toBe(true);
    expect(vec2.isEqualXY(s, 2, 0.5)).toBe(true);
  });

  test('each input may overlap out', () => {
    expectOverlapSafe((out, translation) => mat3x2.fromTRS(out, translation, angle, s));
    expectOverlapSafe((out, scale) => mat3x2.fromTRS(out, t, angle, scale));
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3x2.fromTRS(out, t, angle, s));
  });
});
