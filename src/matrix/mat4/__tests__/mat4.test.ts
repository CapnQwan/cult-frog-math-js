// src/matrix/mat4/__tests__/mat4.test.ts
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
  test('is the identity by default', () => {
    expectStorage(mat4.create(), IDENTITY_STORAGE);
    expect(mat4.isEqual(mat4.create(), mat4.IDENTITY)).toBe(true);
  });

  test('gives the zero matrix only when every element is passed as 0', () => {
    // biome-ignore format: visual alignment with the matrix
    const zero = mat4.create(
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0
    );
    expectStorage(zero, ZEROS);
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

  test('defaults only the omitted elements, to the identity', () => {
    expectStorage(mat4.create(5), [5, ...IDENTITY_STORAGE.slice(1)]);
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

  test('clone(IDENTITY) gives a mutable identity with its own buffer', () => {
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

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(32, 2, IDENTITY_STORAGE));
  });
});

describe('identity', () => {
  test('writes the identity matrix and returns out', () => {
    const out = mat4.create(...ROW_MAJOR_ARGS);
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

describe('SIZE', () => {
  test('matches the length of an allocated matrix', () => {
    expect(mat4.SIZE).toBe(ELEMENTS);
    expect(mat4.create().length).toBe(mat4.SIZE);
  });
});

describe('isEqual', () => {
  test('matrices with the same elements are equal', () => {
    expect(mat4.isEqual(mat4.create(...ROW_MAJOR_ARGS), mat4.create(...ROW_MAJOR_ARGS))).toBe(true);
  });

  test('a matrix equals itself', () => {
    const m = mat4.create(...ROW_MAJOR_ARGS);
    expect(mat4.isEqual(m, m)).toBe(true);
  });

  test('a difference in any single element makes them unequal', () => {
    const a = mat4.create(...ROW_MAJOR_ARGS);
    for (let i = 0; i < mat4.SIZE; i++) {
      const b = mat4.clone(a);
      b[i] = 99;
      expect(mat4.isEqual(a, b)).toBe(false);
    }
  });

  test('a matrix is not equal to its transpose', () => {
    // Passing the storage order as row-major arguments builds the transpose.
    expect(mat4.isEqual(mat4.create(...ROW_MAJOR_ARGS), mat4.create(...COLUMN_MAJOR_STORAGE))).toBe(
      false
    );
  });

  test('treats -0 and 0 as equal', () => {
    const negativeZeros = mat4.create();
    negativeZeros.fill(-0);
    const zeros = mat4.create();
    zeros.fill(0);
    expect(mat4.isEqual(negativeZeros, zeros)).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const m = mat4.identity(mat4.create());
    m[15] = Number.NaN;
    expect(mat4.isEqual(m, m)).toBe(false);
  });

  test('IDENTITY equals a freshly written identity', () => {
    expect(mat4.isEqual(mat4.IDENTITY, mat4.identity(mat4.create()))).toBe(true);
  });
});

describe('isEqualEpsilon', () => {
  test('matrices with the same elements are equal', () => {
    expect(
      mat4.isEqualEpsilon(mat4.create(...ROW_MAJOR_ARGS), mat4.create(...ROW_MAJOR_ARGS))
    ).toBe(true);
  });

  test('differences within the default tolerance are equal', () => {
    const m = mat4.identity(mat4.create());
    m[0] = 1 + 2 ** -23;
    m[1] = 1e-7;
    m[14] = -1e-7;
    expect(mat4.isEqualEpsilon(mat4.IDENTITY, m)).toBe(true);
  });

  test('a difference beyond tolerance in any single element makes them unequal', () => {
    const a = mat4.create(...ROW_MAJOR_ARGS);
    for (let i = 0; i < mat4.SIZE; i++) {
      const b = mat4.clone(a);
      b[i] = 99;
      expect(mat4.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('tolerance scales with magnitude', () => {
    // A translation near 10,000: adjacent float32 values are ~0.001 apart there.
    const a = mat4.identity(mat4.create());
    const b = mat4.identity(mat4.create());
    a[12] = 10000.5;
    b[12] = 10000.5 + 0.001;
    expect(mat4.isEqual(a, b)).toBe(false);
    expect(mat4.isEqualEpsilon(a, b)).toBe(true);
  });

  test('accepts a custom tolerance', () => {
    const near = mat4.create();
    const far = mat4.create();
    near[4] = 0.05;
    far[4] = 0.5;
    expect(mat4.isEqualEpsilon(mat4.create(), near, 0.1)).toBe(true);
    expect(mat4.isEqualEpsilon(mat4.create(), far, 0.1)).toBe(false);
  });

  test('NaN is never equal', () => {
    const m = mat4.identity(mat4.create());
    m[0] = Number.NaN;
    expect(mat4.isEqualEpsilon(m, m)).toBe(false);
  });
});

describe('multiply', () => {
  const a = mat4.create(...ROW_MAJOR_ARGS);
  // Rows:  16 15 14 13
  //        12 11 10  9
  //         8  7  6  5
  //         4  3  2  1
  const b = mat4.create(16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1);
  // Rows:   80  70  60  50
  //        240 214 188 162
  //        400 358 316 274
  //        560 502 444 386
  // biome-ignore format: visual alignment with the matrix
  const abStorage = [
    80,  240, 400, 560,
    70,  214, 358, 502,
    60,  188, 316, 444,
    50,  162, 274, 386,
  ] as const;

  test('writes a * b and returns out', () => {
    const out = mat4.create();
    const result = mat4.multiply(out, a, b);

    expect(result).toBe(out);
    expectStorage(out, abStorage);
  });

  test('order matters: b * a is a different matrix', () => {
    expect(
      mat4.isEqual(mat4.multiply(mat4.create(), b, a), mat4.multiply(mat4.create(), a, b))
    ).toBe(false);
  });

  test('IDENTITY leaves the other input unchanged on either side', () => {
    expectStorage(mat4.multiply(mat4.create(), mat4.IDENTITY, a), COLUMN_MAJOR_STORAGE);
    expectStorage(mat4.multiply(mat4.create(), a, mat4.IDENTITY), COLUMN_MAJOR_STORAGE);
  });

  test('applies b first, then a', () => {
    // biome-ignore format: visual alignment with the matrix
    const translate = mat4.create(
      1, 0, 0, 10,
      0, 1, 0, 20,
      0, 0, 1, 30,
      0, 0, 0, 1,
    );
    // biome-ignore format: visual alignment with the matrix
    const scale = mat4.create(
      2, 0, 0, 0,
      0, 2, 0, 0,
      0, 0, 2, 0,
      0, 0, 0, 1,
    );

    // Scale then translate: the translation is untouched.
    const scaleThenTranslate = mat4.multiply(mat4.create(), translate, scale);
    expect([scaleThenTranslate[12], scaleThenTranslate[13], scaleThenTranslate[14]]).toEqual([
      10, 20, 30,
    ]);

    // Translate then scale: the translation is scaled too.
    const translateThenScale = mat4.multiply(mat4.create(), scale, translate);
    expect([translateThenScale[12], translateThenScale[13], translateThenScale[14]]).toEqual([
      20, 40, 60,
    ]);
  });

  test('never writes to the inputs', () => {
    mat4.multiply(mat4.create(), a, b);
    expectStorage(a, COLUMN_MAJOR_STORAGE);
    expectStorage(b, [16, 12, 8, 4, 15, 11, 7, 3, 14, 10, 6, 2, 13, 9, 5, 1]);
  });

  test('out === a', () => {
    const m = mat4.clone(a);
    mat4.multiply(m, m, b);
    expectStorage(m, abStorage);
  });

  test('out === b', () => {
    const m = mat4.clone(b);
    mat4.multiply(m, a, m);
    expectStorage(m, abStorage);
  });

  test('out === a === b squares in place', () => {
    const expected = mat4.multiply(mat4.create(), mat4.clone(a), mat4.clone(a));
    const m = mat4.clone(a);
    mat4.multiply(m, m, m);
    expect(mat4.isEqual(m, expected)).toBe(true);
  });

  test('every overlap of out with either input is exact', () => {
    for (let outOffset = 0; outOffset < ELEMENTS; outOffset++) {
      for (let inputOffset = 0; inputOffset < ELEMENTS; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const leftBuffer = sequentialBuffer(ELEMENTS * 2);
        const left = viewAt(leftBuffer, inputOffset);
        const leftExpected = mat4.multiply(mat4.create(), mat4.clone(left), b);
        mat4.multiply(viewAt(leftBuffer, outOffset), left, b);
        expect(mat4.isEqual(viewAt(leftBuffer, outOffset), leftExpected)).toBe(true);

        const rightBuffer = sequentialBuffer(ELEMENTS * 2);
        const right = viewAt(rightBuffer, inputOffset);
        const rightExpected = mat4.multiply(mat4.create(), a, mat4.clone(right));
        mat4.multiply(viewAt(rightBuffer, outOffset), a, right);
        expect(mat4.isEqual(viewAt(rightBuffer, outOffset), rightExpected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(32);
    mat4.multiply(viewAt(pool, 2), a, b);

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(32, 2, abStorage));
  });
});

describe('transpose', () => {
  const a = mat4.create(...ROW_MAJOR_ARGS);

  /** Rotation about z, then about x, so every element of the upper 3x3 is in play. */
  function rotation(): Mat4 {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    const rotZ = mat4.create(c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const rotX = mat4.create(1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1);
    return mat4.multiply(mat4.create(), rotX, rotZ);
  }

  test('swaps rows and columns and returns out', () => {
    const out = mat4.create();
    const result = mat4.transpose(out, a);

    expect(result).toBe(out);
    // Rows:  1 5  9 13
    //        2 6 10 14
    //        3 7 11 15
    //        4 8 12 16
    expectStorage(out, ROW_MAJOR_ARGS);
  });

  test('agrees with create given the off-diagonal elements swapped', () => {
    const swapped = mat4.create(...COLUMN_MAJOR_STORAGE);
    expect(mat4.isEqual(mat4.transpose(mat4.create(), a), swapped)).toBe(true);
  });

  test('transposing twice gives back the original', () => {
    const m = mat4.create(...FRACTIONAL_ARGS);
    const twice = mat4.transpose(mat4.create(), mat4.transpose(mat4.create(), m));

    expect(mat4.isEqual(twice, m)).toBe(true);
  });

  test('IDENTITY and other symmetric matrices transpose to themselves', () => {
    expectStorage(mat4.transpose(mat4.create(), mat4.IDENTITY), IDENTITY_STORAGE);

    const symmetric = mat4.create(1, 2, 3, 4, 2, 5, 6, 7, 3, 6, 8, 9, 4, 7, 9, 10);
    expect(mat4.isEqual(mat4.transpose(mat4.create(), symmetric), symmetric)).toBe(true);
  });

  test('copies elements bit for bit, including NaN, -0 and infinities', () => {
    const inf = Number.POSITIVE_INFINITY;
    const nan = Number.NaN;
    // Rows:     1   -0  NaN  Inf
    //        -Inf    2   -0  NaN
    //         Inf -Inf    3   -0
    //         NaN  Inf -Inf    4
    // biome-ignore format: visual alignment with the matrix
    const special = [
      1,    -0,   nan,  inf,
      -inf, 2,    -0,   nan,
      inf,  -inf, 3,    -0,
      nan,  inf,  -inf, 4,
    ] as const;
    const t = mat4.transpose(mat4.create(), mat4.create(...special));

    // The transpose's storage is the original's row-major argument order.
    for (let i = 0; i < ELEMENTS; i++) {
      expect(Object.is(t[i], special[i]), `index ${i}`).toBe(true);
    }
  });

  test('the transpose of a rotation is its inverse', () => {
    const r = rotation();
    const t = mat4.transpose(mat4.create(), r);

    expect(mat4.isEqualEpsilon(mat4.multiply(mat4.create(), t, r), mat4.IDENTITY)).toBe(true);
    expect(mat4.isEqualEpsilon(mat4.multiply(mat4.create(), r, t), mat4.IDENTITY)).toBe(true);
  });

  test('the transpose of a scaled rotation is not its inverse', () => {
    const scale = mat4.create(2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1);
    const scaled = mat4.multiply(mat4.create(), rotation(), scale);
    const product = mat4.multiply(mat4.create(), mat4.transpose(mat4.create(), scaled), scaled);

    // The scale is applied twice rather than undone.
    const scaleSquared = mat4.create(4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1);
    expect(mat4.isEqualEpsilon(product, scaleSquared)).toBe(true);
  });

  test('moves a translation into the bottom row, so it is not the inverse', () => {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    // Rows:  c -s 0  5
    //        s  c 0 -3
    //        0  0 1  2
    //        0  0 0  1
    const m = mat4.create(c, -s, 0, 5, s, c, 0, -3, 0, 0, 1, 2, 0, 0, 0, 1);
    const t = mat4.transpose(mat4.create(), m);

    // a30, a31 and a32 hold the translation; the last column has none.
    expect([t[3], t[7], t[11]]).toEqual([5, -3, 2]);
    expect([t[12], t[13], t[14]]).toEqual([0, 0, 0]);
    expect(mat4.isEqualEpsilon(mat4.multiply(mat4.create(), t, m), mat4.IDENTITY)).toBe(false);
  });

  test('turns row-major data into column-major storage', () => {
    // Floats 1 to 16 read in row-major order describe the rows of `a`.
    const rowMajor = viewAt(sequentialBuffer(ELEMENTS), 0);
    mat4.transpose(rowMajor, rowMajor);

    expect(mat4.isEqual(rowMajor, a)).toBe(true);
  });

  test('never writes to the input', () => {
    mat4.transpose(mat4.create(), a);
    expectStorage(a, COLUMN_MAJOR_STORAGE);
  });

  test('out === a transposes in place', () => {
    const m = mat4.clone(a);
    mat4.transpose(m, m);
    expectStorage(m, ROW_MAJOR_ARGS);
  });

  test('every overlap of out with the input is exact', () => {
    for (let outOffset = 0; outOffset < ELEMENTS; outOffset++) {
      for (let inputOffset = 0; inputOffset < ELEMENTS; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(ELEMENTS * 2);
        const input = viewAt(buffer, inputOffset);
        const expected = mat4.transpose(mat4.create(), mat4.clone(input));

        mat4.transpose(viewAt(buffer, outOffset), input);

        expect(mat4.isEqual(viewAt(buffer, outOffset), expected)).toBe(true);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(32);
    mat4.transpose(viewAt(pool, 2), a);

    expect(Array.from(new Float32Array(pool))).toEqual(poolAfter(32, 2, ROW_MAJOR_ARGS));
  });
});
