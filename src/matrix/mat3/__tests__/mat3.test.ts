// src/matrix/mat3/__tests__/mat3.test.ts
import { describe, expect, test } from 'vitest';

import * as quat from '../../../quaternion/quat.js';
import * as vec2 from '../../../vector/vec2/vec2.js';
import * as vec3 from '../../../vector/vec3/vec3.js';
import * as mat2 from '../../mat2/mat2.js';
import * as mat4 from '../../mat4/mat4.js';
import * as mat3 from '../mat3.js';

import type { Quat, ReadonlyQuat } from '../../../quaternion/_types/quat.js';
import type { ReadonlyVec2, Vec2 } from '../../../vector/vec2/_types/vec2.js';
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
  test('is the identity by default', () => {
    expectStorage(mat3.create(), IDENTITY_STORAGE);
    expect(mat3.isEqual(mat3.create(), mat3.IDENTITY)).toBe(true);
  });

  test('gives the zero matrix only when every element is passed as 0', () => {
    expectStorage(mat3.create(0, 0, 0, 0, 0, 0, 0, 0, 0), new Array(ELEMENTS).fill(0));
  });

  test('takes row-major arguments and stores them column major', () => {
    expectStorage(mat3.create(...ROW_MAJOR_ARGS), COLUMN_MAJOR_STORAGE);
  });

  test('defaults only the omitted elements, to the identity', () => {
    expectStorage(mat3.create(5), [5, 0, 0, 0, 1, 0, 0, 0, 1]);
    // Rows:  5 2 3
    //        0 1 0
    //        0 0 1
    expectStorage(mat3.create(5, 2, 3), [5, 0, 0, 2, 1, 0, 3, 0, 1]);
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

  test('clone(IDENTITY) gives a mutable identity with its own buffer', () => {
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

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(18, 2, IDENTITY_STORAGE));
  });
});

describe('identity', () => {
  test('writes the identity matrix and returns out', () => {
    const out = mat3.create(...ROW_MAJOR_ARGS);
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

describe('SIZE', () => {
  test('matches the length of an allocated matrix', () => {
    expect(mat3.SIZE).toBe(ELEMENTS);
    expect(mat3.create().length).toBe(mat3.SIZE);
  });
});

describe('isEqual', () => {
  test('matrices with the same elements are equal', () => {
    expect(mat3.isEqual(mat3.create(...ROW_MAJOR_ARGS), mat3.create(...ROW_MAJOR_ARGS))).toBe(true);
  });

  test('a matrix equals itself', () => {
    const m = mat3.create(...ROW_MAJOR_ARGS);
    expect(mat3.isEqual(m, m)).toBe(true);
  });

  test('a difference in any single element makes them unequal', () => {
    const a = mat3.create(...ROW_MAJOR_ARGS);
    for (let i = 0; i < mat3.SIZE; i++) {
      const b = mat3.clone(a);
      b[i] = 99;
      expect(mat3.isEqual(a, b)).toBe(false);
    }
  });

  test('a matrix is not equal to its transpose', () => {
    // Passing the storage order as row-major arguments builds the transpose.
    expect(mat3.isEqual(mat3.create(...ROW_MAJOR_ARGS), mat3.create(...COLUMN_MAJOR_STORAGE))).toBe(
      false
    );
  });

  test('treats -0 and 0 as equal', () => {
    const negativeZeros = mat3.create();
    negativeZeros.fill(-0);
    const zeros = mat3.create();
    zeros.fill(0);
    expect(mat3.isEqual(negativeZeros, zeros)).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const m = mat3.identity(mat3.create());
    m[8] = Number.NaN;
    expect(mat3.isEqual(m, m)).toBe(false);
  });

  test('IDENTITY equals a freshly written identity', () => {
    expect(mat3.isEqual(mat3.IDENTITY, mat3.identity(mat3.create()))).toBe(true);
  });
});

describe('isEqualEpsilon', () => {
  test('matrices with the same elements are equal', () => {
    expect(
      mat3.isEqualEpsilon(mat3.create(...ROW_MAJOR_ARGS), mat3.create(...ROW_MAJOR_ARGS))
    ).toBe(true);
  });

  test('differences within the default tolerance are equal', () => {
    const m = mat3.identity(mat3.create());
    m[0] = 1 + 2 ** -23;
    m[1] = 1e-7;
    m[5] = -1e-7;
    expect(mat3.isEqualEpsilon(mat3.IDENTITY, m)).toBe(true);
  });

  test('a difference beyond tolerance in any single element makes them unequal', () => {
    const a = mat3.create(...ROW_MAJOR_ARGS);
    for (let i = 0; i < mat3.SIZE; i++) {
      const b = mat3.clone(a);
      b[i] = 99;
      expect(mat3.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('tolerance scales with magnitude', () => {
    // Adjacent float32 values near 10,000 are ~0.001 apart, far beyond EPSILON.
    const a = mat3.identity(mat3.create());
    const b = mat3.identity(mat3.create());
    a[6] = 10000.5;
    b[6] = 10000.5 + 0.001;
    expect(mat3.isEqual(a, b)).toBe(false);
    expect(mat3.isEqualEpsilon(a, b)).toBe(true);
  });

  test('accepts a custom tolerance', () => {
    const near = mat3.create();
    const far = mat3.create();
    near[3] = 0.05;
    far[3] = 0.5;
    expect(mat3.isEqualEpsilon(mat3.create(), near, 0.1)).toBe(true);
    expect(mat3.isEqualEpsilon(mat3.create(), far, 0.1)).toBe(false);
  });

  test('NaN is never equal', () => {
    const m = mat3.identity(mat3.create());
    m[0] = Number.NaN;
    expect(mat3.isEqualEpsilon(m, m)).toBe(false);
  });
});

describe('multiply', () => {
  const a = mat3.create(...ROW_MAJOR_ARGS);
  // Rows:  9 8 7
  //        6 5 4
  //        3 2 1
  const b = mat3.create(9, 8, 7, 6, 5, 4, 3, 2, 1);
  // Rows:  30  24 18
  //        84  69 54
  //       138 114 90
  const abStorage = [30, 84, 138, 24, 69, 114, 18, 54, 90] as const;

  test('writes a * b and returns out', () => {
    const out = mat3.create();
    const result = mat3.multiply(out, a, b);

    expect(result).toBe(out);
    expectStorage(out, abStorage);
  });

  test('order matters: b * a is a different matrix', () => {
    // Rows:  90 114 138
    //        54  69  84
    //        18  24  30
    expectStorage(mat3.multiply(mat3.create(), b, a), [90, 54, 18, 114, 69, 24, 138, 84, 30]);
  });

  test('IDENTITY leaves the other input unchanged on either side', () => {
    expectStorage(mat3.multiply(mat3.create(), mat3.IDENTITY, a), COLUMN_MAJOR_STORAGE);
    expectStorage(mat3.multiply(mat3.create(), a, mat3.IDENTITY), COLUMN_MAJOR_STORAGE);
  });

  test('never writes to the inputs', () => {
    mat3.multiply(mat3.create(), a, b);
    expectStorage(a, COLUMN_MAJOR_STORAGE);
    expectStorage(b, [9, 6, 3, 8, 5, 2, 7, 4, 1]);
  });

  test('out === a', () => {
    const m = mat3.clone(a);
    mat3.multiply(m, m, b);
    expectStorage(m, abStorage);
  });

  test('out === b', () => {
    const m = mat3.clone(b);
    mat3.multiply(m, a, m);
    expectStorage(m, abStorage);
  });

  test('out === a === b squares in place', () => {
    const m = mat3.clone(a);
    mat3.multiply(m, m, m);
    // Rows:  30  36  42
    //        66  81  96
    //       102 126 150
    expectStorage(m, [30, 66, 102, 36, 81, 126, 42, 96, 150]);
  });

  test('every overlap of out with either input is exact', () => {
    for (let outOffset = 0; outOffset < ELEMENTS; outOffset++) {
      for (let inputOffset = 0; inputOffset < ELEMENTS; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const leftBuffer = sequentialBuffer(ELEMENTS * 2);
        const left = viewAt(leftBuffer, inputOffset);
        const leftExpected = mat3.multiply(mat3.create(), mat3.clone(left), b);
        mat3.multiply(viewAt(leftBuffer, outOffset), left, b);
        expect(mat3.isEqual(viewAt(leftBuffer, outOffset), leftExpected)).toBe(true);

        const rightBuffer = sequentialBuffer(ELEMENTS * 2);
        const right = viewAt(rightBuffer, inputOffset);
        const rightExpected = mat3.multiply(mat3.create(), a, mat3.clone(right));
        mat3.multiply(viewAt(rightBuffer, outOffset), a, right);
        expect(mat3.isEqual(viewAt(rightBuffer, outOffset), rightExpected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(18);
    mat3.multiply(viewAt(pool, 2), a, b);

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(18, 2, abStorage));
  });
});

/** Rotation about z, then about x, so every element of the result is in play. */
function rotation(): Mat3 {
  const c = Math.cos(0.7);
  const s = Math.sin(0.7);
  const rotZ = mat3.create(c, -s, 0, s, c, 0, 0, 0, 1);
  const rotX = mat3.create(1, 0, 0, 0, c, -s, 0, s, c);
  return mat3.multiply(mat3.create(), rotX, rotZ);
}

describe('transpose', () => {
  const a = mat3.create(...ROW_MAJOR_ARGS);

  test('swaps rows and columns and returns out', () => {
    const out = mat3.create();
    const result = mat3.transpose(out, a);

    expect(result).toBe(out);
    // Rows:  1 4 7
    //        2 5 8
    //        3 6 9
    expectStorage(out, ROW_MAJOR_ARGS);
  });

  test('agrees with create given the off-diagonal elements swapped', () => {
    expect(
      mat3.isEqual(mat3.transpose(mat3.create(), a), mat3.create(1, 4, 7, 2, 5, 8, 3, 6, 9))
    ).toBe(true);
  });

  test('transposing twice gives back the original', () => {
    const m = mat3.create(0.1, -0.7, 1.3, 2.9, 0.3, -1.1, 4.7, 0.05, -2.2);
    const twice = mat3.transpose(mat3.create(), mat3.transpose(mat3.create(), m));

    expect(mat3.isEqual(twice, m)).toBe(true);
  });

  test('IDENTITY and other symmetric matrices transpose to themselves', () => {
    expectStorage(mat3.transpose(mat3.create(), mat3.IDENTITY), IDENTITY_STORAGE);

    const symmetric = mat3.create(1, 2, 3, 2, 4, 5, 3, 5, 6);
    expect(mat3.isEqual(mat3.transpose(mat3.create(), symmetric), symmetric)).toBe(true);
  });

  test('copies elements bit for bit, including NaN, -0 and infinities', () => {
    const inf = Number.POSITIVE_INFINITY;
    const nan = Number.NaN;
    // Rows:     1   -0  NaN
    //         Inf    2 -Inf
    //          -0  NaN    3
    const special = [1, -0, nan, inf, 2, -inf, -0, nan, 3] as const;
    const t = mat3.transpose(mat3.create(), mat3.create(...special));

    // The transpose's storage is the original's row-major argument order.
    for (let i = 0; i < ELEMENTS; i++) {
      expect(Object.is(t[i], special[i]), `index ${i}`).toBe(true);
    }
  });

  test('the transpose of a rotation is its inverse', () => {
    const r = rotation();
    const t = mat3.transpose(mat3.create(), r);

    expect(mat3.isEqualEpsilon(mat3.multiply(mat3.create(), t, r), mat3.IDENTITY)).toBe(true);
    expect(mat3.isEqualEpsilon(mat3.multiply(mat3.create(), r, t), mat3.IDENTITY)).toBe(true);
  });

  test('the transpose of a scaled rotation is not its inverse', () => {
    const scale = mat3.create(2, 0, 0, 0, 2, 0, 0, 0, 2);
    const scaled = mat3.multiply(mat3.create(), rotation(), scale);
    const product = mat3.multiply(mat3.create(), mat3.transpose(mat3.create(), scaled), scaled);

    // The scale is applied twice rather than undone.
    expect(mat3.isEqualEpsilon(product, mat3.create(4, 0, 0, 0, 4, 0, 0, 0, 4))).toBe(true);
  });

  test('moves a 2D translation into the bottom row, so it is not the inverse', () => {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    // Rows:  c -s  5
    //        s  c -3
    //        0  0  1
    const m = mat3.create(c, -s, 5, s, c, -3, 0, 0, 1);
    const t = mat3.transpose(mat3.create(), m);

    // a20 and a21 hold the translation; the last column has none.
    expect([t[2], t[5]]).toEqual([5, -3]);
    expect([t[6], t[7]]).toEqual([0, 0]);
    expect(mat3.isEqualEpsilon(mat3.multiply(mat3.create(), t, m), mat3.IDENTITY)).toBe(false);
  });

  test('turns row-major data into column-major storage', () => {
    // Floats 1 to 9 read in row-major order describe the rows of `a`.
    const rowMajor = viewAt(sequentialBuffer(ELEMENTS), 0);
    mat3.transpose(rowMajor, rowMajor);

    expect(mat3.isEqual(rowMajor, a)).toBe(true);
  });

  test('never writes to the input', () => {
    mat3.transpose(mat3.create(), a);
    expectStorage(a, COLUMN_MAJOR_STORAGE);
  });

  test('out === a transposes in place', () => {
    const m = mat3.clone(a);
    mat3.transpose(m, m);
    expectStorage(m, ROW_MAJOR_ARGS);
  });

  test('every overlap of out with the input is exact', () => {
    for (let outOffset = 0; outOffset < ELEMENTS; outOffset++) {
      for (let inputOffset = 0; inputOffset < ELEMENTS; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(ELEMENTS * 2);
        const input = viewAt(buffer, inputOffset);
        const expected = mat3.transpose(mat3.create(), mat3.clone(input));

        mat3.transpose(viewAt(buffer, outOffset), input);

        expect(mat3.isEqual(viewAt(buffer, outOffset), expected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(18);
    mat3.transpose(viewAt(pool, 2), a);

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(18, 2, ROW_MAJOR_ARGS));
  });
});

describe('determinant', () => {
  // Rows:  2 -3  1
  //        2  0 -1
  //        1  4  5
  const a = mat3.create(2, -3, 1, 2, 0, -1, 1, 4, 5);

  test('gives the cofactor expansion of a known matrix', () => {
    expect(mat3.determinant(a)).toBe(49);
  });

  test('IDENTITY gives 1 and the zero matrix gives 0', () => {
    expect(mat3.determinant(mat3.IDENTITY)).toBe(1);
    expect(mat3.determinant(mat3.create(0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe(0);
  });

  test('dependent rows give 0', () => {
    // The middle row is the average of the other two.
    expect(mat3.determinant(mat3.create(...ROW_MAJOR_ARGS))).toBe(0);
  });

  test('is the volume scale', () => {
    expect(mat3.determinant(mat3.create(3, 0, 0, 0, 3, 0, 0, 0, 3))).toBe(27);
    expect(mat3.determinant(mat3.create(2, 0, 0, 0, 3, 0, 0, 0, 4))).toBe(24);
  });

  test('a rotation gives 1, up to rounding', () => {
    expect(mat3.determinant(rotation())).toBeCloseTo(1, 6);
  });

  test('a mirror gives a negative determinant', () => {
    const mirror = mat3.create(1, 0, 0, 0, 1, 0, 0, 0, -1);

    expect(mat3.determinant(mirror)).toBe(-1);
    expect(mat3.determinant(mat3.multiply(mat3.create(), rotation(), mirror))).toBeCloseTo(-1, 6);
  });

  test('swapping two rows flips the sign', () => {
    expect(mat3.determinant(mat3.create(2, 0, -1, 2, -3, 1, 1, 4, 5))).toBe(-49);
  });

  test('the determinant of a product is the product of the determinants', () => {
    // Rows:  1 2 0
    //        0 1 3
    //        4 0 1
    const b = mat3.create(1, 2, 0, 0, 1, 3, 4, 0, 1);
    const product = mat3.multiply(mat3.create(), a, b);

    expect(mat3.determinant(b)).toBe(25);
    expect(mat3.determinant(product)).toBe(49 * 25);
  });

  test('two mirrors cancel out', () => {
    const mirrorX = mat3.create(-1, 0, 0, 0, 1, 0, 0, 0, 1);
    const mirrorY = mat3.create(1, 0, 0, 0, -1, 0, 0, 0, 1);

    expect(mat3.determinant(mat3.multiply(mat3.create(), mirrorX, mirrorY))).toBe(1);
  });

  test('transposing does not change it', () => {
    expect(mat3.determinant(mat3.transpose(mat3.create(), a))).toBe(49);
  });

  test('a 2D translation does not change it', () => {
    // Rows:  2 0  5
    //        0 3 -3
    //        0 0  1
    expect(mat3.determinant(mat3.create(2, 0, 5, 0, 3, -3, 0, 0, 1))).toBe(6);
  });

  test('is computed in float64, not rounded to float32', () => {
    const f = Math.fround(0.1);

    expect(mat3.determinant(mat3.create(0.1, 0, 0, 0, 0.1, 0, 0, 0, 1))).toBe(f * f);
    expect(Math.fround(f * f)).not.toBe(f * f);
  });

  test('a NaN element gives NaN', () => {
    expect(mat3.determinant(mat3.create(1, 0, 0, 0, Number.NaN, 0, 0, 0, 1))).toBeNaN();
  });

  test('reads only its own slots from a pooled view', () => {
    const pool = sequentialBuffer(18);
    const view = viewAt(pool, 2);
    mat3.copy(view, a);

    expect(mat3.determinant(view)).toBe(49);
  });
});

describe('invert', () => {
  // Rows:  1 2 3
  //        0 1 4
  //        5 6 0
  const a = mat3.create(1, 2, 3, 0, 1, 4, 5, 6, 0);
  // Rows: -24  18  5
  //        20 -15 -4
  //        -5   4  1
  const inverseStorage = [-24, 20, -5, 18, -15, 4, 5, -4, 1] as const;
  // Rows:  2 -3  1
  //        2  0 -1
  //        1  4  5
  const dense = mat3.create(2, -3, 1, 2, 0, -1, 1, 4, 5);
  // Float32 rounding in the inverse leaves products a little further from exact.
  const ProductEpsilon = 1e-5;

  /** `expectStorage`, counting `-0` as `0`: a zero cofactor term can come out as `-0`. */
  function expectInverseStorage(m: ReadonlyMat3, expected: readonly number[]): void {
    expect(storageOf(m).map((n) => n + 0)).toEqual(expected.map((n) => Math.fround(n)));
  }
  /** The inverse of a matrix the test knows is invertible. */
  function inverseOf(m: ReadonlyMat3): Mat3 {
    const inverse = mat3.invert(mat3.create(), m);
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
    const out = mat3.create();
    const result = mat3.invert(out, a);

    expect(result).toBe(out);
    expectInverseStorage(out, inverseStorage);
  });

  test('a * inverse and inverse * a both give the identity', () => {
    const inverse = inverseOf(dense);

    const after = mat3.multiply(mat3.create(), dense, inverse);
    const before = mat3.multiply(mat3.create(), inverse, dense);
    expect(mat3.isEqualEpsilon(after, mat3.IDENTITY, ProductEpsilon)).toBe(true);
    expect(mat3.isEqualEpsilon(before, mat3.IDENTITY, ProductEpsilon)).toBe(true);
  });

  test('IDENTITY inverts to itself', () => {
    expectInverseStorage(inverseOf(mat3.IDENTITY), IDENTITY_STORAGE);
  });

  test('the inverse of a rotation is its transpose', () => {
    const r = rotation();
    expect(mat3.isEqualEpsilon(inverseOf(r), mat3.transpose(mat3.create(), r))).toBe(true);
  });

  test('inverting twice gives back the original', () => {
    expect(mat3.isEqualEpsilon(inverseOf(inverseOf(dense)), dense)).toBe(true);
  });

  test('the determinant of the inverse is the reciprocal', () => {
    expect(mat3.determinant(inverseOf(dense))).toBeCloseTo(1 / mat3.determinant(dense), 7);
  });

  test('a small uniform scale still inverts', () => {
    // The determinant is 1e-6, far below any fixed tolerance, yet the inverse is exact enough.
    const inverse = inverseOf(mat3.create(0.01, 0, 0, 0, 0.01, 0, 0, 0, 0.01));
    expect(mat3.isEqualEpsilon(inverse, mat3.create(100, 0, 0, 0, 100, 0, 0, 0, 100))).toBe(true);
  });

  test('undoes a 2D translation', () => {
    // Rows:  1 0  5
    //        0 1 -3
    //        0 0  1
    const translation = mat3.create(1, 0, 5, 0, 1, -3, 0, 0, 1);
    expectInverseStorage(inverseOf(translation), [1, 0, 0, 0, 1, 0, -5, 3, 1]);
  });

  test('returns null and leaves out untouched for a singular matrix', () => {
    const singular = [
      mat3.create(0, 0, 0, 0, 0, 0, 0, 0, 0),
      // The middle row is the average of the other two.
      mat3.create(...ROW_MAJOR_ARGS),
      // One axis scaled to zero.
      mat3.create(1, 0, 0, 0, 0, 0, 0, 0, 1),
    ];
    const sevens = new Array(ELEMENTS).fill(7);

    for (const m of singular) {
      const out = mat3.create(...(sevens as [number]));
      expect(mat3.invert(out, m)).toBeNull();
      expectStorage(out, sevens);
    }
  });

  test('returns null and leaves out untouched when any element is NaN', () => {
    const sevens = new Array(ELEMENTS).fill(7);

    for (let i = 0; i < mat3.SIZE; i++) {
      const m = mat3.clone(a);
      m[i] = Number.NaN;
      const out = mat3.create(...(sevens as [number]));
      expect(mat3.invert(out, m)).toBeNull();
      expectStorage(out, sevens);
    }
  });

  test('an infinite determinant is not caught', () => {
    const inverse = mat3.invert(
      mat3.create(),
      mat3.create(Number.POSITIVE_INFINITY, 0, 0, 0, 1, 0, 0, 0, 1)
    );
    expect(inverse).not.toBeNull();
    expect(Array.from(inverse ?? []).some(Number.isNaN)).toBe(true);
  });

  test('never writes to the input', () => {
    mat3.invert(mat3.create(), a);
    expectStorage(a, [1, 0, 5, 2, 1, 6, 3, 4, 0]);
  });

  test('out === a inverts in place', () => {
    const m = mat3.clone(a);
    mat3.invert(m, m);
    expectInverseStorage(m, inverseStorage);
  });

  test('every overlap of out with the input is exact', () => {
    for (let outOffset = 0; outOffset < ELEMENTS; outOffset++) {
      for (let inputOffset = 0; inputOffset < ELEMENTS; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = irregularBuffer(ELEMENTS * 2);
        const input = viewAt(buffer, inputOffset);
        const expected = inverseOf(mat3.clone(input));

        mat3.invert(viewAt(buffer, outOffset), input);

        expect(mat3.isEqual(viewAt(buffer, outOffset), expected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(18);
    mat3.invert(viewAt(pool, 2), a);

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(18, 2, inverseStorage));
  });
});

/** Test-only cast site: a Vec2 view over element `index` of a shared buffer. */
function vec2At(buffer: ArrayBuffer, index: number): Vec2 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 2) as Vec2;
}

/** Test-only cast site: a Quat view over element `index` of a shared buffer. */
function quatAt(buffer: ArrayBuffer, index: number): Quat {
  return new Float32Array(buffer, index * FLOAT_BYTES, 4) as Quat;
}

/** A buffer of `count` irregular floats, so every slot holds a distinct value. */
function irregularFloats(count: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * FLOAT_BYTES);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = Math.sin(i + 1);
  return buffer;
}

/**
 * Builds with the input as a view at every offset around `out`, overlapping
 * it or not, and checks each result against building from an untouched copy.
 */
function expectOverlapSafe<T>(
  size: number,
  view: (buffer: ArrayBuffer, index: number) => T,
  build: (out: Mat3, input: T) => Mat3
): void {
  const count = ELEMENTS + 8;
  for (let index = 0; index <= count - size; index++) {
    const buffer = irregularFloats(count);
    const expected = build(mat3.create(), view(buffer.slice(0), index));

    build(viewAt(buffer, 4), view(buffer, index));

    expect(storageOf(viewAt(buffer, 4))).toEqual(storageOf(expected));
  }
}

/** Checks that building into a pooled view writes its own 9 slots and nothing else. */
function expectPooledWrite(build: (out: Mat3) => Mat3): void {
  const pool = sequentialBuffer(24);
  const expected = storageOf(build(mat3.create()));

  build(viewAt(pool, 2));

  expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(24, 2, expected));
}

/** Expects every storage element to agree with `expected` to 6 decimal places. */
function expectStorageNear(m: ReadonlyMat3, expected: readonly number[]): void {
  storageOf(m).forEach((n, i) => {
    expect(n).toBeCloseTo(expected[i] as number, 6);
  });
}

/** Expects two vectors to agree to 5 decimal places. */
function expectVec2Near(actual: ReadonlyVec2, expected: ReadonlyVec2): void {
  expect(actual[0]).toBeCloseTo(expected[0], 5);
  expect(actual[1]).toBeCloseTo(expected[1], 5);
}

/** Expects the last row and column to be exactly the identity's. */
function expectAffineEdges(m: ReadonlyMat3): void {
  expect([m[2], m[5], m[8]]).toEqual([0, 0, 1]);
}

const SEVENS = [7, 7, 7, 7, 7, 7, 7, 7, 7] as const;
const POINT_2D = vec2.create(0.3, -1.2);
// Float32 rounding in rotation products leaves results a little further from exact.
const RotationEpsilon = 1e-5;

describe('fromTranslation', () => {
  const t = vec2.create(5, -3);

  test('writes the translation into the last column and returns out', () => {
    const out = mat3.create(...SEVENS);
    const result = mat3.fromTranslation(out, t);

    expect(result).toBe(out);
    expectStorage(out, [1, 0, 0, 0, 1, 0, 5, -3, 1]);
  });

  test('matches the translation spelled out in row-major order', () => {
    const expected = mat3.create(1, 0, 5, 0, 1, -3, 0, 0, 1);
    expect(mat3.isEqual(mat3.fromTranslation(mat3.create(), t), expected)).toBe(true);
  });

  test('moves 2D points and leaves 2D directions unchanged', () => {
    const m = mat3.fromTranslation(mat3.create(), t);

    const moved = vec2.transformMat3(vec2.create(), POINT_2D, m);
    const turned = vec2.transformDirectionMat3(vec2.create(), POINT_2D, m);
    expect(vec2.isEqual(moved, vec2.add(vec2.create(), POINT_2D, t))).toBe(true);
    expect(vec2.isEqual(turned, POINT_2D)).toBe(true);
  });

  test('the negated translation is its exact inverse', () => {
    const inverse = mat3.invert(mat3.create(), mat3.fromTranslation(mat3.create(), t));
    const negated = mat3.fromTranslation(mat3.create(), vec2.negate(vec2.create(), t));

    expect(inverse).not.toBeNull();
    expect(mat3.isEqual(inverse ?? mat3.create(), negated)).toBe(true);
  });

  test('translations compose by adding', () => {
    const other = vec2.create(-1, 4);
    const product = mat3.multiply(
      mat3.create(),
      mat3.fromTranslation(mat3.create(), t),
      mat3.fromTranslation(mat3.create(), other)
    );
    const sum = mat3.fromTranslation(mat3.create(), vec2.add(vec2.create(), t, other));

    expect(mat3.isEqual(product, sum)).toBe(true);
  });

  test('never writes to the input', () => {
    mat3.fromTranslation(mat3.create(), t);
    expect(vec2.isEqualXY(t, 5, -3)).toBe(true);
  });

  test('the input may overlap out', () => {
    expectOverlapSafe(2, vec2At, mat3.fromTranslation);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3.fromTranslation(out, t));
  });
});

describe('fromRotation', () => {
  test('a quarter turn is written column major and returns out', () => {
    // Rows:  0 -1 0
    //        1  0 0
    //        0  0 1
    const out = mat3.create(...SEVENS);
    const result = mat3.fromRotation(out, Math.PI / 2);

    expect(result).toBe(out);
    expectStorageNear(out, [0, 1, 0, -1, 0, 0, 0, 0, 1]);
  });

  test('the upper-left 2x2 is exactly Mat2.fromRotation', () => {
    const m = mat3.fromRotation(mat3.create(), 0.7);
    const r = mat2.fromRotation(mat2.create(), 0.7);

    expect([m[0], m[1], m[3], m[4]]).toEqual([r[0], r[1], r[2], r[3]]);
  });

  test('leaves the last row and column exactly as the identity, translating nothing', () => {
    const m = mat3.fromRotation(mat3.create(...SEVENS), 2.4);

    expectAffineEdges(m);
    expect([m[6], m[7]]).toEqual([0, 0]);
  });

  test('a zero angle gives the identity', () => {
    expect(mat3.isEqual(mat3.fromRotation(mat3.create(...SEVENS), 0), mat3.IDENTITY)).toBe(true);
  });

  test('a positive angle turns counter-clockwise: RIGHT towards UP', () => {
    const m = mat3.fromRotation(mat3.create(), Math.PI / 2);
    expectVec2Near(vec2.transformMat3(vec2.create(), vec2.RIGHT, m), vec2.UP);
  });

  test('negating the angle gives exactly the transpose', () => {
    const forward = mat3.fromRotation(mat3.create(), 0.7);
    const back = mat3.fromRotation(mat3.create(), -0.7);

    expect(mat3.isEqual(back, mat3.transpose(mat3.create(), forward))).toBe(true);
  });

  test('a NaN angle spreads into the rotation', () => {
    expect(storageOf(mat3.fromRotation(mat3.create(), Number.NaN)).some(Number.isNaN)).toBe(true);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3.fromRotation(out, 0.7));
  });
});

describe('fromScale', () => {
  const s = vec2.create(2, 0.5);

  test('writes the scale onto the diagonal and returns out', () => {
    const out = mat3.create(...SEVENS);
    const result = mat3.fromScale(out, s);

    expect(result).toBe(out);
    expectStorage(out, [2, 0, 0, 0, 0.5, 0, 0, 0, 1]);
  });

  test('scales each axis of a 2D point, and translates nothing', () => {
    const m = mat3.fromScale(mat3.create(), s);

    const scaled = vec2.transformMat3(vec2.create(), POINT_2D, m);
    expect(vec2.isEqual(scaled, vec2.mul(vec2.create(), POINT_2D, s))).toBe(true);
    expect(vec2.isEqual(vec2.transformMat3(vec2.create(), vec2.ZERO, m), vec2.ZERO)).toBe(true);
  });

  test('the reciprocal scale is its exact inverse', () => {
    const inverse = mat3.invert(mat3.create(), mat3.fromScale(mat3.create(), s));
    const reciprocal = mat3.fromScale(mat3.create(), vec2.create(0.5, 2));

    expect(inverse).not.toBeNull();
    expect(mat3.isEqual(inverse ?? mat3.create(), reciprocal)).toBe(true);
  });

  test('a zero component leaves no inverse', () => {
    for (let i = 0; i < 2; i++) {
      const flat = vec2.clone(s);
      flat[i] = 0;
      expect(mat3.invert(mat3.create(), mat3.fromScale(mat3.create(), flat))).toBeNull();
    }
  });

  test('never writes to the input', () => {
    mat3.fromScale(mat3.create(), s);
    expect(vec2.isEqualXY(s, 2, 0.5)).toBe(true);
  });

  test('the input may overlap out', () => {
    expectOverlapSafe(2, vec2At, mat3.fromScale);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3.fromScale(out, s));
  });
});

describe('fromTRS', () => {
  const t = vec2.create(4, -6);
  const angle = 0.7;
  const s = vec2.create(2, 0.5);
  const Angles = [0.7, 2.4, -1.1, 4] as const;

  /** `T * R * S`, built from the single-part builders with `multiply`. */
  function composed(turn: number): Mat3 {
    const rs = mat3.multiply(
      mat3.create(),
      mat3.fromRotation(mat3.create(), turn),
      mat3.fromScale(mat3.create(), s)
    );
    return mat3.multiply(mat3.create(), mat3.fromTranslation(mat3.create(), t), rs);
  }

  test('returns out and overwrites every element', () => {
    const out = mat3.create(...SEVENS);
    const result = mat3.fromTRS(out, vec2.ZERO, 0, vec2.ONE);

    expect(result).toBe(out);
    expect(mat3.isEqual(out, mat3.IDENTITY)).toBe(true);
  });

  test('equals T * R * S built with multiply', () => {
    for (const turn of Angles) {
      expect(
        mat3.isEqualEpsilon(
          mat3.fromTRS(mat3.create(), t, turn, s),
          composed(turn),
          RotationEpsilon
        )
      ).toBe(true);
    }
  });

  test('scales, then rotates, then translates a 2D point', () => {
    for (const turn of Angles) {
      const m = mat3.fromTRS(mat3.create(), t, turn, s);

      const scaled = vec2.mul(vec2.create(), POINT_2D, s);
      const rotated = vec2.transformMat2(
        vec2.create(),
        scaled,
        mat2.fromRotation(mat2.create(), turn)
      );
      const expected = vec2.add(vec2.create(), rotated, t);
      expectVec2Near(vec2.transformMat3(vec2.create(), POINT_2D, m), expected);
    }
  });

  test('a non-uniform scale stretches along the object axes, before the rotation', () => {
    // Stretch x by 2, then turn a quarter: x ends up along y, still doubled.
    const m = mat3.fromTRS(mat3.create(), vec2.ZERO, Math.PI / 2, vec2.create(2, 1));
    expectVec2Near(vec2.transformMat3(vec2.create(), vec2.RIGHT, m), vec2.create(0, 2));
  });

  test('with no translation or scale it is exactly fromRotation', () => {
    for (const turn of Angles) {
      const trs = mat3.fromTRS(mat3.create(), vec2.ZERO, turn, vec2.ONE);
      expect(mat3.isEqual(trs, mat3.fromRotation(mat3.create(), turn))).toBe(true);
    }
  });

  test('with no rotation it is exactly the scale with the translation added', () => {
    const expected = mat3.create(2, 0, 4, 0, 0.5, -6, 0, 0, 1);
    expect(mat3.isEqual(mat3.fromTRS(mat3.create(), t, 0, s), expected)).toBe(true);
  });

  test('the translation is written untouched by the rotation and scale', () => {
    const m = mat3.fromTRS(mat3.create(), t, angle, s);

    expect([m[6], m[7]]).toEqual([4, -6]);
    expectAffineEdges(m);
  });

  test('a zero scale component leaves no inverse', () => {
    for (let i = 0; i < 2; i++) {
      const flat = vec2.clone(s);
      flat[i] = 0;
      expect(mat3.invert(mat3.create(), mat3.fromTRS(mat3.create(), t, angle, flat))).toBeNull();
    }
  });

  test('a NaN in any input appears in the result', () => {
    for (let i = 0; i < 2; i++) {
      const badT = vec2.clone(t);
      badT[i] = Number.NaN;
      const badS = vec2.clone(s);
      badS[i] = Number.NaN;
      expect(storageOf(mat3.fromTRS(mat3.create(), badT, angle, s)).some(Number.isNaN)).toBe(true);
      expect(storageOf(mat3.fromTRS(mat3.create(), t, angle, badS)).some(Number.isNaN)).toBe(true);
    }
    expect(storageOf(mat3.fromTRS(mat3.create(), t, Number.NaN, s)).some(Number.isNaN)).toBe(true);
  });

  test('never writes to the inputs', () => {
    mat3.fromTRS(mat3.create(), t, angle, s);

    expect(vec2.isEqualXY(t, 4, -6)).toBe(true);
    expect(vec2.isEqualXY(s, 2, 0.5)).toBe(true);
  });

  test('each input may overlap out', () => {
    expectOverlapSafe(2, vec2At, (out, translation) => mat3.fromTRS(out, translation, angle, s));
    expectOverlapSafe(2, vec2At, (out, scale) => mat3.fromTRS(out, t, angle, scale));
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3.fromTRS(out, t, angle, s));
  });
});

describe('fromQuat', () => {
  const Rotations: readonly ReadonlyQuat[] = (
    [
      [1, 2, 3, 0.7],
      [-2, 0.5, 1, 2.4],
      [0, 0, 1, -1.1],
      [1, -1, -1, 4],
    ] as const
  ).map(([x, y, z, turn]) =>
    quat.fromAxisAngle(quat.create(), vec3.normalize(vec3.create(), vec3.create(x, y, z)), turn)
  );
  const Point3d = vec3.create(0.3, -1.2, 2.5);

  test('the identity quaternion gives the identity matrix and returns out', () => {
    const out = mat3.create(...SEVENS);
    const result = mat3.fromQuat(out, quat.IDENTITY);

    expect(result).toBe(out);
    expect(mat3.isEqual(out, mat3.IDENTITY)).toBe(true);
  });

  test('a quarter turn about z is written column major', () => {
    const q = quat.fromAxisAngle(quat.create(), vec3.create(0, 0, 1), Math.PI / 2);
    expectStorageNear(mat3.fromQuat(mat3.create(), q), [0, 1, 0, -1, 0, 0, 0, 0, 1]);
  });

  test('is exactly the upper-left 3x3 of Mat4.fromQuat', () => {
    for (const q of Rotations) {
      const m3 = mat3.fromQuat(mat3.create(), q);
      const m4 = mat4.fromQuat(mat4.create(), q);
      const upperLeft = [m4[0], m4[1], m4[2], m4[4], m4[5], m4[6], m4[8], m4[9], m4[10]];

      expect(storageOf(m3)).toEqual(upperLeft);
    }
  });

  test('rotates 3D vectors the same way as Vec3.transformQuat', () => {
    for (const q of Rotations) {
      const rotated = vec3.transformMat3(vec3.create(), Point3d, mat3.fromQuat(mat3.create(), q));
      const expected = vec3.transformQuat(vec3.create(), Point3d, q);
      for (let i = 0; i < 3; i++) expect(rotated[i]).toBeCloseTo(expected[i] as number, 5);
    }
  });

  test('composes in the same order as Quat.multiply', () => {
    const a = Rotations[0] as ReadonlyQuat;
    const b = Rotations[1] as ReadonlyQuat;

    const fromProduct = mat3.fromQuat(mat3.create(), quat.multiply(quat.create(), a, b));
    const product = mat3.multiply(
      mat3.create(),
      mat3.fromQuat(mat3.create(), a),
      mat3.fromQuat(mat3.create(), b)
    );

    expect(mat3.isEqualEpsilon(fromProduct, product, RotationEpsilon)).toBe(true);
  });

  test('the transpose is fromQuat of the conjugate', () => {
    for (const q of Rotations) {
      const transposed = mat3.transpose(mat3.create(), mat3.fromQuat(mat3.create(), q));
      const conjugated = mat3.fromQuat(mat3.create(), quat.conjugate(quat.create(), q));

      expect(mat3.isEqualEpsilon(transposed, conjugated, RotationEpsilon)).toBe(true);
    }
  });

  test('q and -q give exactly the same matrix', () => {
    for (const q of Rotations) {
      const negated = quat.create(
        -(q[0] as number),
        -(q[1] as number),
        -(q[2] as number),
        -(q[3] as number)
      );
      expect(
        mat3.isEqual(mat3.fromQuat(mat3.create(), q), mat3.fromQuat(mat3.create(), negated))
      ).toBe(true);
    }
  });

  test('a NaN component spreads into the rotation', () => {
    for (let i = 0; i < 4; i++) {
      const q = quat.clone(Rotations[0] as ReadonlyQuat);
      q[i] = Number.NaN;
      expect(storageOf(mat3.fromQuat(mat3.create(), q)).some(Number.isNaN)).toBe(true);
    }
  });

  test('never writes to the input', () => {
    const q = quat.clone(Rotations[0] as ReadonlyQuat);
    mat3.fromQuat(mat3.create(), q);
    expect(quat.isEqual(q, Rotations[0] as ReadonlyQuat)).toBe(true);
  });

  test('the input may overlap out', () => {
    expectOverlapSafe(4, quatAt, mat3.fromQuat);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3.fromQuat(out, Rotations[0] as ReadonlyQuat));
  });
});
