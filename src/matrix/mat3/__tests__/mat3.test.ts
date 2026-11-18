// src/matrix/mat3/__tests__/mat3.test.ts
import { describe, expect, test } from 'vitest';

import * as quat from '../../../quaternion/quat.js';
import * as vec3 from '../../../vector/vec3/vec3.js';
import * as mat4 from '../../mat4/mat4.js';
import * as mat3 from '../mat3.js';

import type { Quat, ReadonlyQuat } from '../../../quaternion/_types/quat.js';
import type { Mat4, ReadonlyMat4 } from '../../mat4/_types/mat4.js';
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

const SEVENS = [7, 7, 7, 7, 7, 7, 7, 7, 7] as const;
// Float32 rounding in rotation products leaves results a little further from exact.
const RotationEpsilon = 1e-5;

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

/** Test-only cast site: a Mat4 view over element `index` of a shared buffer. */
function mat4At(buffer: ArrayBuffer, index: number): Mat4 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 16) as Mat4;
}

/** The upper-left 3x3 of `m`, in `Mat3` storage order. */
function upperLeftOf(m: ReadonlyMat4): number[] {
  return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
}

/** Model matrices covering rotation, non-uniform and mirroring scales, and translation. */
const Models: readonly ReadonlyMat4[] = (
  [
    [[1, 2, 3], 0.7, [2, 0.5, 3]],
    [[0, 1, 0], 2.4, [-1, 4, 0.25]],
    [[1, -1, -1], 4, [1, 1, 1]],
    [[0, 0, 1], -1.1, [3, 3, 3]],
  ] as const
).map(([axis, turn, [sx, sy, sz]]) =>
  mat4.fromTRS(
    mat4.create(),
    vec3.create(10, -20, 30),
    quat.fromAxisAngle(quat.create(), vec3.normalize(vec3.create(), vec3.create(...axis)), turn),
    vec3.create(sx, sy, sz)
  )
);
const Model = Models[0] as ReadonlyMat4;
// Rows:  1  2  3  4
//        5  6  7  8
//        9 10 11 12
//       13 14 15 16
const Sequential4 = mat4.create(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);

describe('fromMat4', () => {
  test('writes the upper-left 3x3 and returns out', () => {
    const out = mat3.create(...SEVENS);
    const result = mat3.fromMat4(out, Sequential4);

    expect(result).toBe(out);
    // Rows:  1  2  3
    //        5  6  7
    //        9 10 11
    expectStorage(out, [1, 5, 9, 2, 6, 10, 3, 7, 11]);
  });

  test('drops the translation and the bottom row', () => {
    const moved = mat4.fromTranslation(mat4.create(), vec3.create(5, -3, 8));
    moved[3] = 0.25;
    moved[7] = -4;
    moved[11] = 9;

    expect(mat3.isEqual(mat3.fromMat4(mat3.create(), moved), mat3.IDENTITY)).toBe(true);
  });

  test('of Mat4.fromQuat is exactly Mat3.fromQuat', () => {
    const q = quat.fromAxisAngle(
      quat.create(),
      vec3.normalize(vec3.create(), vec3.create(1, 2, 3)),
      0.7
    );
    const fromMatrix = mat3.fromMat4(mat3.create(), mat4.fromQuat(mat4.create(), q));

    expect(mat3.isEqual(fromMatrix, mat3.fromQuat(mat3.create(), q))).toBe(true);
  });

  test('transforms directions the way Vec3.transformDirectionMat4 does', () => {
    const direction = vec3.create(0.3, -1.2, 2.5);
    for (const model of Models) {
      const linear = mat3.fromMat4(mat3.create(), model);
      const viaMat3 = vec3.transformMat3(vec3.create(), direction, linear);
      const viaMat4 = vec3.transformDirectionMat4(vec3.create(), direction, model);

      expect(Array.from(viaMat3)).toEqual(Array.from(viaMat4));
    }
  });

  test('copies every element bit for bit, including NaN, -0 and infinities', () => {
    const m = mat4.create();
    m[4] = Number.NaN;
    m[1] = -0;
    m[10] = Number.POSITIVE_INFINITY;
    const out = mat3.fromMat4(mat3.create(), m);

    expect(out[3]).toBeNaN();
    expect(Object.is(out[1], -0)).toBe(true);
    expect(out[8]).toBe(Number.POSITIVE_INFINITY);
  });

  test('never writes to the input', () => {
    const m = mat4.clone(Sequential4);
    mat3.fromMat4(mat3.create(), m);
    expect(mat4.isEqual(m, Sequential4)).toBe(true);
  });

  test('the input may overlap out', () => {
    expectOverlapSafe(16, mat4At, mat3.fromMat4);
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => mat3.fromMat4(out, Sequential4));
  });
});

describe('normalFromMat4', () => {
  /** The normal matrix of a model the test knows is invertible. */
  function normalOf(model: ReadonlyMat4): Mat3 {
    const normal = mat3.normalFromMat4(mat3.create(), model);
    if (!normal) throw new Error('expected an invertible upper-left 3x3');
    return normal;
  }

  test('writes the inverse-transpose of the upper-left 3x3 and returns out', () => {
    for (const model of Models) {
      const out = mat3.create(...SEVENS);
      const result = mat3.normalFromMat4(out, model);

      const inverse = mat3.invert(mat3.create(), mat3.fromMat4(mat3.create(), model));
      if (!inverse) throw new Error('expected an invertible upper-left 3x3');
      const expected = mat3.transpose(mat3.create(), inverse);

      expect(result).toBe(out);
      expect(mat3.isEqualEpsilon(out, expected, RotationEpsilon)).toBe(true);
    }
  });

  test('keeps a normal perpendicular to its surface under a non-uniform scale', () => {
    // A surface containing the tangent (1, 1, 0) has the normal (1, -1, 0).
    const tangent = vec3.create(1, 1, 0);
    const normal = vec3.create(1, -1, 0);
    const stretch = mat4.fromScale(mat4.create(), vec3.create(2, 1, 1));

    const movedTangent = vec3.transformMat3(
      vec3.create(),
      tangent,
      mat3.fromMat4(mat3.create(), stretch)
    );
    const viaNormalMatrix = vec3.transformMat3(vec3.create(), normal, normalOf(stretch));
    const viaLinearPart = vec3.transformMat3(
      vec3.create(),
      normal,
      mat3.fromMat4(mat3.create(), stretch)
    );

    expect(vec3.dot(viaNormalMatrix, movedTangent)).toBe(0);
    // The linear part tilts the normal off the surface.
    expect(vec3.dot(viaLinearPart, movedTangent)).toBe(3);
  });

  test('a pure rotation gives the linear part back', () => {
    const rotation = mat4.fromAxisAngle(mat4.create(), vec3.create(0, 1, 0), 2.4);
    const linear = mat3.fromMat4(mat3.create(), rotation);

    expect(mat3.isEqualEpsilon(normalOf(rotation), linear, RotationEpsilon)).toBe(true);
  });

  test('a uniform scale changes only the length of the normals', () => {
    // The linear part is 3R, so the inverse-transpose is R / 3: the linear part over 9.
    const model = Models[3] as ReadonlyMat4;
    const linear = storageOf(mat3.fromMat4(mat3.create(), model));
    const scaledDown = mat3.create();
    for (let i = 0; i < 9; i++) scaledDown[i] = (linear[i] as number) / 9;

    expect(mat3.isEqualEpsilon(normalOf(model), scaledDown, RotationEpsilon)).toBe(true);
  });

  test('ignores the translation and the bottom row', () => {
    const junk = mat4.clone(Model);
    junk[3] = Number.NaN;
    junk[7] = 5;
    junk[11] = -2;
    junk[12] = Number.NaN;
    junk[13] = 1e9;
    junk[15] = 0;

    expect(mat3.isEqual(normalOf(junk), normalOf(Model))).toBe(true);
  });

  test('returns null and leaves out untouched when the upper-left 3x3 is singular', () => {
    const singular = [
      mat4.fromScale(mat4.create(), vec3.create(1, 0, 1)),
      mat4.create(0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 1),
      // Dependent rows.
      mat4.create(1, 2, 3, 0, 2, 4, 6, 0, 0, 1, 1, 0, 0, 0, 0, 1),
    ];

    for (const model of singular) {
      const out = mat3.create(...SEVENS);
      expect(mat3.normalFromMat4(out, model)).toBeNull();
      expectStorage(out, SEVENS);
    }
  });

  test('returns null and leaves out untouched when the upper-left 3x3 has a NaN', () => {
    for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
      const model = mat4.clone(Model);
      model[i] = Number.NaN;
      const out = mat3.create(...SEVENS);

      expect(mat3.normalFromMat4(out, model)).toBeNull();
      expectStorage(out, SEVENS);
    }
  });

  test('never writes to the input', () => {
    const model = mat4.clone(Model);
    mat3.normalFromMat4(mat3.create(), model);
    expect(mat4.isEqual(model, Model)).toBe(true);
  });

  test('the input may overlap out', () => {
    expectOverlapSafe(16, mat4At, (out, model) => {
      const normal = mat3.normalFromMat4(out, model);
      if (!normal) throw new Error('expected an invertible upper-left 3x3');
      return normal;
    });
  });

  test('writes only its own slots when out is a pooled view', () => {
    expectPooledWrite((out) => {
      const normal = mat3.normalFromMat4(out, Model);
      if (!normal) throw new Error('expected an invertible upper-left 3x3');
      return normal;
    });
  });

  test('reads only the upper-left 3x3 from a pooled view', () => {
    const pool = sequentialBuffer(20);
    const view = mat4At(pool, 2);
    mat4.copy(view, Model);

    expect(mat3.isEqual(normalOf(view), normalOf(Model))).toBe(true);
    expect(upperLeftOf(view)).toEqual(upperLeftOf(Model));
  });
});

describe('fromPacked', () => {
  const N = mat3.SIZE;

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
      expect(Array.from(mat3.fromPacked(mat3.create(), packed, row))).toEqual(rowValues(row));
    }
  });

  test('returns out', () => {
    const out = mat3.create();

    expect(mat3.fromPacked(out, new Float32Array(N), 0)).toBe(out);
  });

  test('never writes to the packed array', () => {
    const packed = packedRows(2);
    mat3.fromPacked(mat3.create(), packed, 1);

    expect(Array.from(packed)).toEqual([...rowValues(0), ...rowValues(1)]);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(N + 2);
    const source = packedRows(1).map((n) => n * 10);
    mat3.fromPacked(viewAt(pool, 1), source, 0);

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

      mat3.fromPacked(viewAt(pool, offset), new Float32Array(pool), 1);

      expect(Array.from(new Float32Array(pool))).toEqual(expected);
    });
  }

  test('reads from a SharedArrayBuffer', () => {
    const packed = new Float32Array(new SharedArrayBuffer(2 * N * FLOAT_BYTES));
    packed.set(packedRows(2));

    expect(Array.from(mat3.fromPacked(mat3.create(), packed, 1))).toEqual(rowValues(1));
  });

  test('writes NaN for a row past the end', () => {
    for (const n of mat3.fromPacked(mat3.create(), new Float32Array(N), 1)) expect(n).toBeNaN();
  });
});
