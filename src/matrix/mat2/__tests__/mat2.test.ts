// src/matrix/mat2/__tests__/mat2.test.ts
import { describe, expect, test } from 'vitest';

import * as vec2 from '../../../vector/vec2/vec2.js';
import * as mat2 from '../mat2.js';

import type { ReadonlyVec2, Vec2 } from '../../../vector/vec2/_types/vec2.js';
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
  test('is the identity by default', () => {
    expectStorage(mat2.create(), [1, 0, 0, 1]);
    expect(mat2.isEqual(mat2.create(), mat2.IDENTITY)).toBe(true);
  });

  test('gives the zero matrix only when every element is passed as 0', () => {
    expectStorage(mat2.create(0, 0, 0, 0), [0, 0, 0, 0]);
  });

  test('takes row-major arguments and stores them column major', () => {
    // Rows:  1 2
    //        3 4
    expectStorage(mat2.create(1, 2, 3, 4), [1, 3, 2, 4]);
  });

  test('defaults only the omitted elements, to the identity', () => {
    expectStorage(mat2.create(5), [5, 0, 0, 1]);
    // Rows:  5 2
    //        0 1
    expectStorage(mat2.create(5, 2), [5, 0, 2, 1]);
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

  test('clone(IDENTITY) gives a mutable identity with its own buffer', () => {
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

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 1, 0, 0, 1, 7, 8]);
  });
});

describe('identity', () => {
  test('writes the identity matrix and returns out', () => {
    const out = mat2.create(1, 2, 3, 4);
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

describe('SIZE', () => {
  test('matches the length of an allocated matrix', () => {
    expect(mat2.SIZE).toBe(4);
    expect(mat2.create().length).toBe(mat2.SIZE);
  });
});

describe('isEqual', () => {
  test('matrices with the same elements are equal', () => {
    expect(mat2.isEqual(mat2.create(1, 2, 3, 4), mat2.create(1, 2, 3, 4))).toBe(true);
  });

  test('a matrix equals itself', () => {
    const m = mat2.create(1, 2, 3, 4);
    expect(mat2.isEqual(m, m)).toBe(true);
  });

  test('a difference in any single element makes them unequal', () => {
    const a = mat2.create(1, 2, 3, 4);
    for (let i = 0; i < mat2.SIZE; i++) {
      const b = mat2.clone(a);
      b[i] = 99;
      expect(mat2.isEqual(a, b)).toBe(false);
    }
  });

  test('a matrix is not equal to its transpose', () => {
    expect(mat2.isEqual(mat2.create(1, 2, 3, 4), mat2.create(1, 3, 2, 4))).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(mat2.isEqual(mat2.create(-0, -0, -0, -0), mat2.create(0, 0, 0, 0))).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const m = mat2.create(1, 0, 0, Number.NaN);
    expect(mat2.isEqual(m, m)).toBe(false);
  });

  test('IDENTITY equals a freshly written identity', () => {
    expect(mat2.isEqual(mat2.IDENTITY, mat2.identity(mat2.create()))).toBe(true);
  });
});

describe('isEqualEpsilon', () => {
  test('matrices with the same elements are equal', () => {
    expect(mat2.isEqualEpsilon(mat2.create(1, 2, 3, 4), mat2.create(1, 2, 3, 4))).toBe(true);
  });

  test('differences within the default tolerance are equal', () => {
    expect(mat2.isEqualEpsilon(mat2.IDENTITY, mat2.create(1 + 2 ** -23, 1e-7, -1e-7, 1))).toBe(
      true
    );
  });

  test('a difference beyond tolerance in any single element makes them unequal', () => {
    const a = mat2.create(1, 2, 3, 4);
    for (let i = 0; i < mat2.SIZE; i++) {
      const b = mat2.clone(a);
      b[i] = 99;
      expect(mat2.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('tolerance scales with magnitude', () => {
    // Adjacent float32 values near 10,000 are ~0.001 apart, far beyond EPSILON.
    const a = mat2.create(10000.5, 0, 0, 1);
    const b = mat2.create(10000.5 + 0.001, 0, 0, 1);
    expect(mat2.isEqual(a, b)).toBe(false);
    expect(mat2.isEqualEpsilon(a, b)).toBe(true);
  });

  test('accepts a custom tolerance', () => {
    expect(mat2.isEqualEpsilon(mat2.create(), mat2.create(1, 0.05, 0, 1), 0.1)).toBe(true);
    expect(mat2.isEqualEpsilon(mat2.create(), mat2.create(1, 0.5, 0, 1), 0.1)).toBe(false);
  });

  test('NaN is never equal', () => {
    const m = mat2.create(Number.NaN, 0, 0, 1);
    expect(mat2.isEqualEpsilon(m, m)).toBe(false);
  });
});

describe('multiply', () => {
  // Rows:  1 2      5 6
  //        3 4      7 8
  const a = mat2.create(1, 2, 3, 4);
  const b = mat2.create(5, 6, 7, 8);

  test('writes a * b and returns out', () => {
    const out = mat2.create();
    const result = mat2.multiply(out, a, b);

    expect(result).toBe(out);
    // Rows: 19 22
    //       43 50
    expectStorage(out, [19, 43, 22, 50]);
  });

  test('order matters: b * a is a different matrix', () => {
    // Rows: 23 34
    //       31 46
    expectStorage(mat2.multiply(mat2.create(), b, a), [23, 31, 34, 46]);
  });

  test('IDENTITY leaves the other input unchanged on either side', () => {
    expectStorage(mat2.multiply(mat2.create(), mat2.IDENTITY, a), [1, 3, 2, 4]);
    expectStorage(mat2.multiply(mat2.create(), a, mat2.IDENTITY), [1, 3, 2, 4]);
  });

  test('never writes to the inputs', () => {
    mat2.multiply(mat2.create(), a, b);
    expectStorage(a, [1, 3, 2, 4]);
    expectStorage(b, [5, 7, 6, 8]);
  });

  test('out === a', () => {
    const m = mat2.clone(a);
    mat2.multiply(m, m, b);
    expectStorage(m, [19, 43, 22, 50]);
  });

  test('out === b', () => {
    const m = mat2.clone(b);
    mat2.multiply(m, a, m);
    expectStorage(m, [19, 43, 22, 50]);
  });

  test('out === a === b squares in place', () => {
    const m = mat2.clone(a);
    mat2.multiply(m, m, m);
    // Rows:  7 10
    //       15 22
    expectStorage(m, [7, 15, 10, 22]);
  });

  test('every overlap of out with either input is exact', () => {
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const leftBuffer = sequentialBuffer(8);
        const left = viewAt(leftBuffer, inputOffset);
        const leftExpected = mat2.multiply(mat2.create(), mat2.clone(left), b);
        mat2.multiply(viewAt(leftBuffer, outOffset), left, b);
        expect(mat2.isEqual(viewAt(leftBuffer, outOffset), leftExpected)).toBe(true);

        const rightBuffer = sequentialBuffer(8);
        const right = viewAt(rightBuffer, inputOffset);
        const rightExpected = mat2.multiply(mat2.create(), a, mat2.clone(right));
        mat2.multiply(viewAt(rightBuffer, outOffset), a, right);
        expect(mat2.isEqual(viewAt(rightBuffer, outOffset), rightExpected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    mat2.multiply(viewAt(pool, 2), a, b);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 19, 43, 22, 50, 7, 8]);
  });
});

describe('transpose', () => {
  // Rows:  1 2
  //        3 4
  const a = mat2.create(1, 2, 3, 4);

  test('swaps rows and columns and returns out', () => {
    const out = mat2.create();
    const result = mat2.transpose(out, a);

    expect(result).toBe(out);
    // Rows:  1 3
    //        2 4
    expectStorage(out, [1, 2, 3, 4]);
  });

  test('agrees with create given the off-diagonal elements swapped', () => {
    expect(mat2.isEqual(mat2.transpose(mat2.create(), a), mat2.create(1, 3, 2, 4))).toBe(true);
  });

  test('transposing twice gives back the original', () => {
    const m = mat2.create(0.1, -0.7, 1.3, 2.9);
    const twice = mat2.transpose(mat2.create(), mat2.transpose(mat2.create(), m));

    expect(mat2.isEqual(twice, m)).toBe(true);
  });

  test('IDENTITY and other symmetric matrices transpose to themselves', () => {
    expectStorage(mat2.transpose(mat2.create(), mat2.IDENTITY), [1, 0, 0, 1]);

    const symmetric = mat2.create(1, 2, 2, 3);
    expect(mat2.isEqual(mat2.transpose(mat2.create(), symmetric), symmetric)).toBe(true);
  });

  test('copies elements bit for bit, including NaN, -0 and infinities', () => {
    // Rows:   -0  NaN
    //        Inf -Inf
    const special = [-0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY] as const;
    const t = mat2.transpose(mat2.create(), mat2.create(...special));

    // The transpose's storage is the original's row-major argument order.
    for (let i = 0; i < mat2.SIZE; i++) {
      expect(Object.is(t[i], special[i]), `index ${i}`).toBe(true);
    }
  });

  test('the transpose of a rotation is its inverse', () => {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    const rotation = mat2.create(c, -s, s, c);
    const t = mat2.transpose(mat2.create(), rotation);

    const before = mat2.multiply(mat2.create(), t, rotation);
    const after = mat2.multiply(mat2.create(), rotation, t);
    expect(mat2.isEqualEpsilon(before, mat2.IDENTITY)).toBe(true);
    expect(mat2.isEqualEpsilon(after, mat2.IDENTITY)).toBe(true);
  });

  test('the transpose of a scaled rotation is not its inverse', () => {
    const c = 2 * Math.cos(0.7);
    const s = 2 * Math.sin(0.7);
    const scaled = mat2.create(c, -s, s, c);
    const product = mat2.multiply(mat2.create(), mat2.transpose(mat2.create(), scaled), scaled);

    // The scale is applied twice rather than undone.
    expect(mat2.isEqualEpsilon(product, mat2.create(4, 0, 0, 4))).toBe(true);
  });

  test('turns row-major data into column-major storage', () => {
    // Floats 1, 2, 3, 4 read in row-major order describe rows 1 2 / 3 4.
    const rowMajor = viewAt(sequentialBuffer(4), 0);
    mat2.transpose(rowMajor, rowMajor);

    expect(mat2.isEqual(rowMajor, a)).toBe(true);
  });

  test('never writes to the input', () => {
    mat2.transpose(mat2.create(), a);
    expectStorage(a, [1, 3, 2, 4]);
  });

  test('out === a transposes in place', () => {
    const m = mat2.clone(a);
    mat2.transpose(m, m);
    expectStorage(m, [1, 2, 3, 4]);
  });

  test('every overlap of out with the input is exact', () => {
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(8);
        const input = viewAt(buffer, inputOffset);
        const expected = mat2.transpose(mat2.create(), mat2.clone(input));

        mat2.transpose(viewAt(buffer, outOffset), input);

        expect(mat2.isEqual(viewAt(buffer, outOffset), expected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    mat2.transpose(viewAt(pool, 2), a);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 1, 2, 3, 4, 7, 8]);
  });
});

describe('determinant', () => {
  test('is a00 * a11 - a01 * a10', () => {
    // Rows:  1 2
    //        3 4
    expect(mat2.determinant(mat2.create(1, 2, 3, 4))).toBe(-2);
  });

  test('IDENTITY gives 1 and the zero matrix gives 0', () => {
    expect(mat2.determinant(mat2.IDENTITY)).toBe(1);
    expect(mat2.determinant(mat2.create(0, 0, 0, 0))).toBe(0);
  });

  test('dependent rows give 0', () => {
    expect(mat2.determinant(mat2.create(1, 2, 2, 4))).toBe(0);
  });

  test('is the area scale', () => {
    expect(mat2.determinant(mat2.create(3, 0, 0, 3))).toBe(9);
    expect(mat2.determinant(mat2.create(2, 0, 0, 5))).toBe(10);
  });

  test('a rotation gives 1, up to rounding', () => {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    expect(mat2.determinant(mat2.create(c, -s, s, c))).toBeCloseTo(1, 6);
  });

  test('a mirror gives a negative determinant', () => {
    expect(mat2.determinant(mat2.create(-1, 0, 0, 1))).toBe(-1);
    expect(mat2.determinant(mat2.create(1, 0, 0, -1))).toBe(-1);
  });

  test('swapping the rows flips the sign', () => {
    expect(mat2.determinant(mat2.create(3, 4, 1, 2))).toBe(2);
  });

  test('the determinant of a product is the product of the determinants', () => {
    const a = mat2.create(1, 2, 3, 4);
    const b = mat2.create(5, 6, 7, 8);
    const product = mat2.multiply(mat2.create(), a, b);

    expect(mat2.determinant(product)).toBe(mat2.determinant(a) * mat2.determinant(b));
  });

  test('two mirrors cancel out', () => {
    const mirrorX = mat2.create(-1, 0, 0, 1);
    const mirrorY = mat2.create(1, 0, 0, -1);

    expect(mat2.determinant(mat2.multiply(mat2.create(), mirrorX, mirrorY))).toBe(1);
  });

  test('transposing does not change it', () => {
    const m = mat2.create(2, -3, 5, 7);

    expect(mat2.determinant(m)).toBe(29);
    expect(mat2.determinant(mat2.transpose(mat2.create(), m))).toBe(29);
  });

  test('is computed in float64, not rounded to float32', () => {
    const f = Math.fround(0.1);

    expect(mat2.determinant(mat2.create(0.1, 0, 0, 0.1))).toBe(f * f);
    expect(Math.fround(f * f)).not.toBe(f * f);
  });

  test('a NaN element gives NaN', () => {
    expect(mat2.determinant(mat2.create(1, Number.NaN, 0, 1))).toBeNaN();
  });

  test('reads only its own slots from a pooled view', () => {
    const pool = sequentialBuffer(8);
    const view = viewAt(pool, 2);
    mat2.set(view, 1, 2, 3, 4);

    expect(mat2.determinant(view)).toBe(-2);
  });
});

describe('invert', () => {
  // Rows:  2 3
  //        1 2
  const a = mat2.create(2, 3, 1, 2);
  // Rows:  2 -3
  //       -1  2
  const inverseStorage = [2, -1, -3, 2] as const;
  // Rows:  4 7
  //        2 6
  const dense = mat2.create(4, 7, 2, 6);
  // Float32 rounding in the inverse leaves products a little further from exact.
  const ProductEpsilon = 1e-5;

  /** `expectStorage`, counting `-0` as `0`: a zero cofactor term can come out as `-0`. */
  function expectInverseStorage(m: ReadonlyMat2, expected: readonly number[]): void {
    expect([m[0], m[1], m[2], m[3]].map((n) => n + 0)).toEqual(expected.map((n) => Math.fround(n)));
  }
  /** The inverse of a matrix the test knows is invertible. */
  function inverseOf(m: ReadonlyMat2): Mat2 {
    const inverse = mat2.invert(mat2.create(), m);
    if (!inverse) throw new Error('expected an invertible matrix');
    return inverse;
  }

  /** A buffer of `count` irregular floats, so no view over it is singular. */
  function irregularBuffer(count: number): ArrayBuffer {
    const buffer = new ArrayBuffer(count * FLOAT_BYTES);
    const floats = new Float32Array(buffer);
    for (let i = 0; i < count; i++) floats[i] = Math.sin(i + 1);
    return buffer;
  }

  test('writes the inverse and returns out', () => {
    const out = mat2.create();
    const result = mat2.invert(out, a);

    expect(result).toBe(out);
    expectInverseStorage(out, inverseStorage);
  });

  test('a * inverse and inverse * a both give the identity', () => {
    const inverse = inverseOf(dense);

    const after = mat2.multiply(mat2.create(), dense, inverse);
    const before = mat2.multiply(mat2.create(), inverse, dense);
    expect(mat2.isEqualEpsilon(after, mat2.IDENTITY, ProductEpsilon)).toBe(true);
    expect(mat2.isEqualEpsilon(before, mat2.IDENTITY, ProductEpsilon)).toBe(true);
  });

  test('IDENTITY inverts to itself', () => {
    expectInverseStorage(inverseOf(mat2.IDENTITY), [1, 0, 0, 1]);
  });

  test('the inverse of a rotation is its transpose', () => {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    const rotation = mat2.create(c, -s, s, c);

    const transposed = mat2.transpose(mat2.create(), rotation);
    expect(mat2.isEqualEpsilon(inverseOf(rotation), transposed)).toBe(true);
  });

  test('inverting twice gives back the original', () => {
    expect(mat2.isEqualEpsilon(inverseOf(inverseOf(dense)), dense)).toBe(true);
  });

  test('the determinant of the inverse is the reciprocal', () => {
    expect(mat2.determinant(inverseOf(dense))).toBeCloseTo(1 / mat2.determinant(dense), 7);
  });

  test('a small uniform scale still inverts', () => {
    // The determinant is 1e-4, far below any fixed tolerance, yet the inverse is exact enough.
    const inverse = inverseOf(mat2.create(0.01, 0, 0, 0.01));
    expect(mat2.isEqualEpsilon(inverse, mat2.create(100, 0, 0, 100))).toBe(true);
  });

  test('returns null and leaves out untouched for a singular matrix', () => {
    const singular = [
      mat2.create(0, 0, 0, 0),
      // Dependent rows.
      mat2.create(1, 2, 2, 4),
      // One axis scaled to zero.
      mat2.create(1, 0, 0, 0),
    ];

    for (const m of singular) {
      const out = mat2.create(7, 7, 7, 7);
      expect(mat2.invert(out, m)).toBeNull();
      expectStorage(out, [7, 7, 7, 7]);
    }
  });

  test('returns null and leaves out untouched when any element is NaN', () => {
    for (let i = 0; i < mat2.SIZE; i++) {
      const m = mat2.clone(a);
      m[i] = Number.NaN;
      const out = mat2.create(7, 7, 7, 7);
      expect(mat2.invert(out, m)).toBeNull();
      expectStorage(out, [7, 7, 7, 7]);
    }
  });

  test('an infinite determinant is not caught', () => {
    const inverse = mat2.invert(mat2.create(), mat2.create(Number.POSITIVE_INFINITY, 0, 0, 1));
    expect(inverse).not.toBeNull();
    expect(Array.from(inverse ?? []).some(Number.isNaN)).toBe(true);
  });

  test('never writes to the input', () => {
    mat2.invert(mat2.create(), a);
    expectStorage(a, [2, 1, 3, 2]);
  });

  test('out === a inverts in place', () => {
    const m = mat2.clone(a);
    mat2.invert(m, m);
    expectInverseStorage(m, inverseStorage);
  });

  test('every overlap of out with the input is exact', () => {
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = irregularBuffer(8);
        const input = viewAt(buffer, inputOffset);
        const expected = inverseOf(mat2.clone(input));

        mat2.invert(viewAt(buffer, outOffset), input);

        expect(mat2.isEqual(viewAt(buffer, outOffset), expected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    mat2.invert(viewAt(pool, 2), a);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 2, -1, -3, 2, 7, 8]);
  });
});

/** The raw column-major storage of `m`, in index order. */
function elementsOf(m: ReadonlyMat2): number[] {
  return [m[0], m[1], m[2], m[3]];
}

/** Test-only cast site: a Vec2 view over element `index` of a shared buffer. */
function vec2At(buffer: ArrayBuffer, index: number): Vec2 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 2) as Vec2;
}

/** Expects every storage element to agree with `expected` to 6 decimal places. */
function expectStorageNear(m: ReadonlyMat2, expected: readonly number[]): void {
  elementsOf(m).forEach((n, i) => {
    expect(n).toBeCloseTo(expected[i] as number, 6);
  });
}

/** Expects two vectors to agree to 5 decimal places. */
function expectVec2Near(actual: ReadonlyVec2, expected: ReadonlyVec2): void {
  expect(actual[0]).toBeCloseTo(expected[0], 5);
  expect(actual[1]).toBeCloseTo(expected[1], 5);
}

/** Checks that building into a pooled view writes its own 4 slots and nothing else. */
function expectPooledWrite(build: (out: Mat2) => Mat2): void {
  const pool = sequentialBuffer(12);
  const written = elementsOf(build(mat2.create()));
  const expected = Array.from({ length: 12 }, (_, i) => i + 1);
  written.forEach((value, i) => {
    expected[2 + i] = value;
  });

  build(viewAt(pool, 2));

  expect(Array.from(new Float32Array(pool))).toEqual(expected);
}

const BUILDER_POINT = vec2.create(0.3, -1.2);
// Float32 rounding in rotation products leaves results a little further from exact.
const RotationEpsilon = 1e-5;

describe('fromRotation', () => {
  test('a quarter turn is written column major and returns out', () => {
    // Rows:  0 -1
    //        1  0
    const out = mat2.create(7, 7, 7, 7);
    const result = mat2.fromRotation(out, Math.PI / 2);

    expect(result).toBe(out);
    expectStorageNear(out, [0, 1, -1, 0]);
  });

  test('a zero angle gives the identity', () => {
    expect(mat2.isEqual(mat2.fromRotation(mat2.create(7, 7, 7, 7), 0), mat2.IDENTITY)).toBe(true);
  });

  test('a positive angle turns counter-clockwise: RIGHT towards UP', () => {
    const m = mat2.fromRotation(mat2.create(), Math.PI / 2);
    expectVec2Near(vec2.transformMat2(vec2.create(), vec2.RIGHT, m), vec2.UP);
  });

  test('negating the angle gives exactly the transpose', () => {
    const forward = mat2.fromRotation(mat2.create(), 0.7);
    const back = mat2.fromRotation(mat2.create(), -0.7);

    expect(mat2.isEqual(back, mat2.transpose(mat2.create(), forward))).toBe(true);
  });

  test('rotations compose by adding their angles', () => {
    const product = mat2.multiply(
      mat2.create(),
      mat2.fromRotation(mat2.create(), 0.7),
      mat2.fromRotation(mat2.create(), 2.1)
    );
    const sum = mat2.fromRotation(mat2.create(), 2.8);

    expect(mat2.isEqualEpsilon(product, sum, RotationEpsilon)).toBe(true);
  });

  test('preserves area: the determinant is 1', () => {
    expect(mat2.determinant(mat2.fromRotation(mat2.create(), 2.4))).toBeCloseTo(1, 6);
  });

  test('a NaN angle makes every element NaN', () => {
    expect(elementsOf(mat2.fromRotation(mat2.create(), Number.NaN)).every(Number.isNaN)).toBe(true);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat2.fromRotation(out, 0.7));
  });
});

describe('fromScale', () => {
  const s = vec2.create(2, 0.5);

  test('writes the scale onto the diagonal and returns out', () => {
    const out = mat2.create(7, 7, 7, 7);
    const result = mat2.fromScale(out, s);

    expect(result).toBe(out);
    expectStorage(out, [2, 0, 0, 0.5]);
  });

  test('scales each axis of a point', () => {
    const scaled = vec2.transformMat2(
      vec2.create(),
      BUILDER_POINT,
      mat2.fromScale(mat2.create(), s)
    );
    expect(vec2.isEqual(scaled, vec2.mul(vec2.create(), BUILDER_POINT, s))).toBe(true);
  });

  test('the reciprocal scale is its exact inverse', () => {
    const inverse = mat2.invert(mat2.create(), mat2.fromScale(mat2.create(), s));
    const reciprocal = mat2.fromScale(mat2.create(), vec2.create(0.5, 2));

    expect(inverse).not.toBeNull();
    expect(mat2.isEqual(inverse ?? mat2.create(), reciprocal)).toBe(true);
  });

  test('the determinant is the product of the components, negative when mirrored', () => {
    expect(mat2.determinant(mat2.fromScale(mat2.create(), vec2.create(2, -3)))).toBe(-6);
  });

  test('a zero component leaves no inverse', () => {
    for (let i = 0; i < 2; i++) {
      const flat = vec2.clone(s);
      flat[i] = 0;
      expect(mat2.invert(mat2.create(), mat2.fromScale(mat2.create(), flat))).toBeNull();
    }
  });

  test('never writes to the input', () => {
    mat2.fromScale(mat2.create(), s);
    expect(vec2.isEqualXY(s, 2, 0.5)).toBe(true);
  });

  test('the input may overlap out', () => {
    for (let index = 0; index <= 6; index++) {
      const buffer = sequentialBuffer(8);
      const expected = mat2.fromScale(mat2.create(), vec2At(buffer.slice(0), index));

      mat2.fromScale(viewAt(buffer, 2), vec2At(buffer, index));

      expect(elementsOf(viewAt(buffer, 2))).toEqual(elementsOf(expected));
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat2.fromScale(out, s));
  });
});

describe('fromPacked', () => {
  const N = mat2.SIZE;

  /** `count` rows of N floats, holding 1, 2, 3, ... */
  function packedRows(count: number): Float32Array {
    return new Float32Array(sequentialBuffer(count * N));
  }

  /** The values `packedRows` holds in row `index`. */
  function rowValues(index: number): number[] {
    return Array.from({ length: N }, (_, i) => index * N + i + 1);
  }

  test('copies the requested row element for element, in storage order', () => {
    const packed = packedRows(3);

    for (let row = 0; row < 3; row++) {
      expect(Array.from(mat2.fromPacked(mat2.create(), packed, row))).toEqual(rowValues(row));
    }
  });

  test('returns out', () => {
    const out = mat2.create();

    expect(mat2.fromPacked(out, new Float32Array(N), 0)).toBe(out);
  });

  test('never writes to the packed array', () => {
    const packed = packedRows(2);
    mat2.fromPacked(mat2.create(), packed, 1);

    expect(Array.from(packed)).toEqual([...rowValues(0), ...rowValues(1)]);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(N + 2);
    const source = packedRows(1).map((n) => n * 10);
    mat2.fromPacked(viewAt(pool, 1), source, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, ...source, N + 2]);
  });

  for (const [side, offset] of [
    ['behind', N - 1],
    ['ahead', N + 1],
  ] as const) {
    test(`handles out overlapping the row from ${side}`, () => {
      const pool = sequentialBuffer(3 * N);
      const expected = Array.from(new Float32Array(pool));
      expected.splice(offset, N, ...rowValues(1));

      mat2.fromPacked(viewAt(pool, offset), new Float32Array(pool), 1);

      expect(Array.from(new Float32Array(pool))).toEqual(expected);
    });
  }

  test('reads from a SharedArrayBuffer', () => {
    const packed = new Float32Array(new SharedArrayBuffer(2 * N * FLOAT_BYTES));
    packed.set(packedRows(2));

    expect(Array.from(mat2.fromPacked(mat2.create(), packed, 1))).toEqual(rowValues(1));
  });

  test('writes NaN for a row past the end', () => {
    for (const n of mat2.fromPacked(mat2.create(), new Float32Array(N), 1)) expect(n).toBeNaN();
  });
});
