// src/quaternion/__tests__/quat.test.ts
import { describe, expect, test } from 'vitest';

import * as vec3 from '../../vector/vec3/vec3.js';
import * as vec4 from '../../vector/vec4/vec4.js';
import * as quat from '../quat.js';

import type { Vec3 } from '../../vector/vec3/_types/vec3.js';
import type { Quat, ReadonlyQuat } from '../_types/quat.js';

const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

/**
 * Exact comparison against float32-rounded expectations, so tests can use
 * natural literals like 0.1 without encoding the rounding by hand.
 *
 * Components are listed in storage order: x, y, z, then the scalar w last.
 */
function expectComponents(q: ReadonlyQuat, x: number, y: number, z: number, w: number): void {
  expect([q[0], q[1], q[2], q[3]]).toEqual([x, y, z, w].map((n) => Math.fround(n)));
}

/**
 * Test-only cast site: a Quat view over element `index` of a shared buffer,
 * standing in for a view into pooled component storage.
 */
function viewAt(buffer: ArrayBuffer, index: number): Quat {
  return new Float32Array(buffer, index * FLOAT_BYTES, 4) as Quat;
}

/** A buffer of `count` floats initialised to 1, 2, 3, ... so every slot is distinguishable. */
function sequentialBuffer(count: number): ArrayBuffer {
  const buffer = new ArrayBuffer(count * FLOAT_BYTES);
  const floats = new Float32Array(buffer);
  for (let i = 0; i < count; i++) floats[i] = i + 1;
  return buffer;
}

describe('create', () => {
  test('defaults to the identity rotation', () => {
    expectComponents(quat.create(), 0, 0, 0, 1);
    expect(quat.isEqual(quat.create(), quat.IDENTITY)).toBe(true);
  });

  test('gives the zero quaternion only when w is passed as 0', () => {
    expectComponents(quat.create(0, 0, 0, 0), 0, 0, 0, 0);
  });

  test('stores provided components in x, y, z, w order with the scalar last', () => {
    expectComponents(quat.create(1, 2, 3, 4), 1, 2, 3, 4);
  });

  test('defaults only the omitted components', () => {
    expectComponents(quat.create(1, 2), 1, 2, 0, 1);
  });

  test('takes components raw, without normalising', () => {
    // Length 2, not 1: nothing in this module enforces unit length.
    const q = quat.create(0, 0, 0, 2);
    expectComponents(q, 0, 0, 0, 2);
  });

  test('encodes a rotation as xyz = axis * sin(theta/2), w = cos(theta/2)', () => {
    // A quarter turn about +Y.
    const half = Math.PI / 4;
    const q = quat.create(0, Math.sin(half), 0, Math.cos(half));

    expect(q[1]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(q[3]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2).toBeCloseTo(1, 6);
  });

  test('rounds components to float32', () => {
    const q = quat.create(0.1);
    expect(q[0]).not.toBe(0.1);
    expect(q[0]).toBe(Math.fround(0.1));
  });

  test('allocates a standalone four-element buffer', () => {
    const q = quat.create();
    expect(q).toBeInstanceOf(Float32Array);
    expect(q.length).toBe(4);
    expect(q.byteOffset).toBe(0);
    expect(q.buffer.byteLength).toBe(4 * FLOAT_BYTES);
  });

  test('is byte-identical to the equivalent Vec4', () => {
    // The reason w is stored last: a Quat uploads as a vec4<f32> untouched.
    const q = quat.create(0.1, 0.2, 0.3, 0.4);
    const v = vec4.create(0.1, 0.2, 0.3, 0.4);

    expect(new Uint8Array(q.buffer)).toEqual(new Uint8Array(v.buffer));
  });
});

describe('clone', () => {
  test('copies components into a new quaternion with its own buffer', () => {
    const source = quat.create(1, 2, 3, 4);
    const result = quat.clone(source);

    expectComponents(result, 1, 2, 3, 4);
    expect(result).not.toBe(source);
    expect(result.buffer).not.toBe(source.buffer);
  });

  test('round-trips float32 values exactly', () => {
    const source = quat.create(0.1, -0.7, 0.3, 0.9);
    const result = quat.clone(source);

    for (let i = 0; i < 4; i++) expect(result[i]).toBe(source[i]);
  });

  test('result and source are independent after cloning', () => {
    const source = quat.create(1, 2, 3, 4);
    const result = quat.clone(source);

    quat.set(source, 9, 9, 9, 9);
    expectComponents(result, 1, 2, 3, 4);
  });

  test('accepts a readonly input', () => {
    const frozen: ReadonlyQuat = quat.create(1, 2, 3, 4);
    expectComponents(quat.clone(frozen), 1, 2, 3, 4);
  });

  test('cloning a pooled view produces a standalone quaternion', () => {
    const pool = sequentialBuffer(8);
    const view = viewAt(pool, 2);
    const snapshot = quat.clone(view);

    expect(snapshot.buffer).not.toBe(pool);
    expect(snapshot.byteOffset).toBe(0);
    expect(snapshot.buffer.byteLength).toBe(4 * FLOAT_BYTES);

    // The owning system writes to the pool; the snapshot must not move.
    quat.identity(view);
    expectComponents(snapshot, 3, 4, 5, 6);
  });

  test('cloning IDENTITY yields an independent mutable copy', () => {
    const q = quat.clone(quat.IDENTITY);

    expectComponents(q, 0, 0, 0, 1);

    // Writing through the copy must not disturb the shared constant.
    quat.set(q, 9, 9, 9, 9);
    expectComponents(quat.IDENTITY, 0, 0, 0, 1);
  });
});

describe('set', () => {
  test('writes components and returns out', () => {
    const out = quat.create();
    const result = quat.set(out, 1, 2, 3, 4);

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3, 4);
  });

  test('overwrites existing values, including the scalar', () => {
    const out = quat.create(7, 7, 7, 7);
    quat.set(out, -1, 1, -2, 0);
    expectComponents(out, -1, 1, -2, 0);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.set(viewAt(pool, 2), 0, 0, 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 0, 7, 8]);
  });
});

describe('copy', () => {
  test('copies components and returns out', () => {
    const out = quat.create();
    const source = quat.create(1, 2, 3, 4);
    const result = quat.copy(out, source);

    expect(result).toBe(out);
    expectComponents(out, 1, 2, 3, 4);
  });

  test('never writes to the input', () => {
    const source = quat.create(1, 2, 3, 4);
    quat.copy(quat.create(7, 7, 7, 7), source);
    expectComponents(source, 1, 2, 3, 4);
  });

  test('supports chaining through nested calls', () => {
    const a = quat.create();
    const b = quat.create();
    quat.copy(b, quat.set(a, 1, 2, 3, 4));
    expectComponents(b, 1, 2, 3, 4);
  });

  test('out === input is a no-op', () => {
    const q = quat.create(1, 2, 3, 4);
    quat.copy(q, q);
    expectComponents(q, 1, 2, 3, 4);
  });

  test('overlapping views: out one element ahead of input', () => {
    // Buffer [1..5]; input covers [0..3], out covers [1..4].
    const buffer = sequentialBuffer(5);
    quat.copy(viewAt(buffer, 1), viewAt(buffer, 0));

    expect(Array.from(new Float32Array(buffer))).toEqual([1, 1, 2, 3, 4]);
  });

  test('overlapping views: out one element behind input', () => {
    // Buffer [1..5]; input covers [1..4], out covers [0..3].
    const buffer = sequentialBuffer(5);
    quat.copy(viewAt(buffer, 0), viewAt(buffer, 1));

    expect(Array.from(new Float32Array(buffer))).toEqual([2, 3, 4, 5, 5]);
  });

  test('every overlap of two distinct views is exact', () => {
    // Components must be staged through locals before any write, so that no
    // component can be clobbered before it has been read, at any offset.
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(8);
        const input = viewAt(buffer, inputOffset);
        const expected = [input[0], input[1], input[2], input[3]] as const;

        quat.copy(viewAt(buffer, outOffset), input);

        expectComponents(viewAt(buffer, outOffset), ...expected);
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.copy(viewAt(pool, 2), quat.create(0, 0, 0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 0, 7, 8]);
  });
});

describe('identity', () => {
  test('writes the identity rotation and returns out', () => {
    const out = quat.create(1, 2, 3, 4);
    const result = quat.identity(out);

    expect(result).toBe(out);
    expectComponents(out, 0, 0, 0, 1);
  });

  test('allocates nothing', () => {
    const out = quat.create();
    expect(quat.identity(out).buffer).toBe(out.buffer);
  });

  test('agrees with clone(IDENTITY)', () => {
    expect(Array.from(quat.identity(quat.create(1, 2, 3, 4)))).toEqual(
      Array.from(quat.clone(quat.IDENTITY))
    );
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.identity(viewAt(pool, 2));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 1, 7, 8]);
  });
});

describe('IDENTITY', () => {
  test('is the rotation that changes nothing', () => {
    expectComponents(quat.IDENTITY, 0, 0, 0, 1);
  });

  test('has the scalar last, at index 3', () => {
    expect(quat.IDENTITY[3]).toBe(1);
  });

  test('is a unit quaternion', () => {
    const [x, y, z, w] = [quat.IDENTITY[0], quat.IDENTITY[1], quat.IDENTITY[2], quat.IDENTITY[3]];
    expect(x ** 2 + y ** 2 + z ** 2 + w ** 2).toBe(1);
  });

  test('is a single shared instance', () => {
    expect(quat.IDENTITY).toBe(quat.IDENTITY);
  });
});

describe('isEqual', () => {
  test('quaternions with the same components are equal', () => {
    expect(quat.isEqual(quat.create(1, 2, 3, 4), quat.create(1, 2, 3, 4))).toBe(true);
  });

  test('a quaternion equals itself', () => {
    const q = quat.create(1, 2, 3, 4);
    expect(quat.isEqual(q, q)).toBe(true);
  });

  test('a difference in any single component makes them unequal', () => {
    const a = quat.create(1, 2, 3, 4);
    for (let i = 0; i < 4; i++) {
      const b = quat.clone(a);
      b[i] = 99;
      expect(quat.isEqual(a, b)).toBe(false);
    }
  });

  test('compares components, not rotations: q and -q are unequal', () => {
    expect(quat.isEqual(quat.IDENTITY, quat.create(0, 0, 0, -1))).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(quat.isEqual(quat.create(-0, 0, -0, 1), quat.IDENTITY)).toBe(true);
  });

  test('NaN is never equal, even to itself', () => {
    const q = quat.create(0, 0, 0, Number.NaN);
    expect(quat.isEqual(q, q)).toBe(false);
  });

  test('IDENTITY equals a freshly written identity', () => {
    expect(quat.isEqual(quat.IDENTITY, quat.identity(quat.create()))).toBe(true);
  });
});

describe('isEqualEpsilon', () => {
  test('quaternions with the same components are equal', () => {
    expect(quat.isEqualEpsilon(quat.create(1, 2, 3, 4), quat.create(1, 2, 3, 4))).toBe(true);
  });

  test('differences within the default tolerance are equal', () => {
    expect(quat.isEqualEpsilon(quat.IDENTITY, quat.create(1e-7, -1e-7, 0, 1 + 2 ** -23))).toBe(
      true
    );
  });

  test('a difference beyond tolerance in any single component makes them unequal', () => {
    const a = quat.create(1, 2, 3, 4);
    for (let i = 0; i < 4; i++) {
      const b = quat.clone(a);
      b[i] = 99;
      expect(quat.isEqualEpsilon(a, b)).toBe(false);
    }
  });

  test('compares components, not rotations: q and -q are unequal', () => {
    expect(quat.isEqualEpsilon(quat.IDENTITY, quat.create(0, 0, 0, -1))).toBe(false);
  });

  test('accepts a custom tolerance', () => {
    expect(quat.isEqualEpsilon(quat.IDENTITY, quat.create(0.05, 0, 0, 1), 0.1)).toBe(true);
    expect(quat.isEqualEpsilon(quat.IDENTITY, quat.create(0.5, 0, 0, 1), 0.1)).toBe(false);
  });

  test('NaN is never equal', () => {
    const q = quat.create(Number.NaN, 0, 0, 1);
    expect(quat.isEqualEpsilon(q, q)).toBe(false);
  });
});

describe('isEqualXYZW', () => {
  test('matches the values just written by set', () => {
    const q = quat.set(quat.create(), 0.1, 0.2, 0.3, 0.4);
    expect(q[0]).not.toBe(0.1);
    expect(quat.isEqualXYZW(q, 0.1, 0.2, 0.3, 0.4)).toBe(true);
  });

  test('takes the scalar last', () => {
    expect(quat.isEqualXYZW(quat.IDENTITY, 0, 0, 0, 1)).toBe(true);
    expect(quat.isEqualXYZW(quat.IDENTITY, 1, 0, 0, 0)).toBe(false);
  });

  test('a difference in any single component makes them unequal', () => {
    const q = quat.create(1, 2, 3, 4);
    expect(quat.isEqualXYZW(q, 99, 2, 3, 4)).toBe(false);
    expect(quat.isEqualXYZW(q, 1, 99, 3, 4)).toBe(false);
    expect(quat.isEqualXYZW(q, 1, 2, 99, 4)).toBe(false);
    expect(quat.isEqualXYZW(q, 1, 2, 3, 99)).toBe(false);
  });

  test('treats -0 and 0 as equal', () => {
    expect(quat.isEqualXYZW(quat.IDENTITY, -0, -0, -0, 1)).toBe(true);
  });

  test('NaN is never equal', () => {
    expect(quat.isEqualXYZW(quat.create(0, 0, 0, Number.NaN), 0, 0, 0, Number.NaN)).toBe(false);
  });
});

describe('multiply', () => {
  const S = Math.SQRT1_2;
  /** A quarter turn about +X. */
  const X90 = quat.create(S, 0, 0, S);
  /** A quarter turn about +Z. */
  const Z90 = quat.create(0, 0, S, S);

  /** Element-wise closeness, for results that pick up float32 rounding. */
  function expectComponentsClose(q: ReadonlyQuat, x: number, y: number, z: number, w: number) {
    expect(q[0]).toBeCloseTo(x, 6);
    expect(q[1]).toBeCloseTo(y, 6);
    expect(q[2]).toBeCloseTo(z, 6);
    expect(q[3]).toBeCloseTo(w, 6);
  }

  /**
   * Rotates `v` by the unit quaternion `q` as `q * (v, 0) * conjugate(q)`, so
   * composition order can be checked against where a vector actually ends up.
   */
  function rotate(q: ReadonlyQuat, v: [number, number, number]): [number, number, number] {
    const conjugate = quat.create(-q[0], -q[1], -q[2], q[3]);
    const p = quat.create(v[0], v[1], v[2], 0);
    const r = quat.multiply(quat.create(), quat.multiply(quat.create(), q, p), conjugate);
    return [r[0], r[1], r[2]];
  }

  test('writes into out and returns it', () => {
    const out = quat.create();
    expect(quat.multiply(out, X90, Z90)).toBe(out);
  });

  test('follows the Hamilton rules for the basis units, with the scalar last', () => {
    const i = quat.create(1, 0, 0, 0);
    const j = quat.create(0, 1, 0, 0);
    const k = quat.create(0, 0, 1, 0);

    expectComponents(quat.multiply(quat.create(), i, j), 0, 0, 1, 0);
    expectComponents(quat.multiply(quat.create(), j, k), 1, 0, 0, 0);
    expectComponents(quat.multiply(quat.create(), k, i), 0, 1, 0, 0);
    expectComponents(quat.multiply(quat.create(), j, i), 0, 0, -1, 0);
    expectComponents(quat.multiply(quat.create(), i, i), 0, 0, 0, -1);
  });

  test('IDENTITY leaves the other input unchanged on either side', () => {
    const q = quat.create(0.1, 0.2, 0.3, 0.4);
    expect(Array.from(quat.multiply(quat.create(), quat.IDENTITY, q))).toEqual(Array.from(q));
    expect(Array.from(quat.multiply(quat.create(), q, quat.IDENTITY))).toEqual(Array.from(q));
  });

  test('composes rotations: two quarter turns make a half turn', () => {
    expectComponentsClose(quat.multiply(quat.create(), Z90, Z90), 0, 0, 1, 0);
  });

  test('applies b first, then a', () => {
    // X90 first takes +Y to +Z, which Z90 then leaves alone. The other order
    // would send +Y to -X with Z90 and leave it there.
    const [x, y, z] = rotate(quat.multiply(quat.create(), Z90, X90), [0, 1, 0]);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(1, 6);
  });

  test('is not commutative', () => {
    const ab = quat.multiply(quat.create(), Z90, X90);
    const ba = quat.multiply(quat.create(), X90, Z90);
    expect(quat.isEqualEpsilon(ab, ba)).toBe(false);
  });

  test('the product of unit quaternions is a unit quaternion', () => {
    const q = quat.multiply(quat.create(), Z90, X90);
    expect(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2).toBeCloseTo(1, 6);
  });

  test('out may be the same object as either input, or both', () => {
    const expected = quat.multiply(quat.create(), Z90, X90);

    const a = quat.clone(Z90);
    quat.multiply(a, a, X90);
    expect(Array.from(a)).toEqual(Array.from(expected));

    const b = quat.clone(X90);
    quat.multiply(b, Z90, b);
    expect(Array.from(b)).toEqual(Array.from(expected));

    const both = quat.clone(Z90);
    quat.multiply(both, both, both);
    expect(Array.from(both)).toEqual(Array.from(quat.multiply(quat.create(), Z90, Z90)));
  });

  test('overlapping views: out one element ahead of a', () => {
    // Buffer [1, 2, 3, 4, 5]; a covers [0..3], out covers [1..4].
    const buffer = sequentialBuffer(5);
    const a = viewAt(buffer, 0);
    const expected = quat.multiply(quat.create(), quat.clone(a), X90);
    quat.multiply(viewAt(buffer, 1), a, X90);

    expect(Array.from(viewAt(buffer, 1))).toEqual(Array.from(expected));
  });

  test('overlapping views: out one element behind b', () => {
    // Buffer [1, 2, 3, 4, 5]; b covers [1..4], out covers [0..3].
    const buffer = sequentialBuffer(5);
    const b = viewAt(buffer, 1);
    const expected = quat.multiply(quat.create(), Z90, quat.clone(b));
    quat.multiply(viewAt(buffer, 0), Z90, b);

    expect(Array.from(viewAt(buffer, 0))).toEqual(Array.from(expected));
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.multiply(viewAt(pool, 2), quat.IDENTITY, quat.IDENTITY);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 1, 7, 8]);
  });
});

/** Element-wise closeness, for results that pick up float32 or trigonometric rounding. */
function expectClose(q: ReadonlyQuat, x: number, y: number, z: number, w: number): void {
  expect(q[0]).toBeCloseTo(x, 6);
  expect(q[1]).toBeCloseTo(y, 6);
  expect(q[2]).toBeCloseTo(z, 6);
  expect(q[3]).toBeCloseTo(w, 6);
}

/**
 * Rotates `v` by the unit quaternion `q` as `q * (v, 0) * conjugate(q)`, so a
 * rotation can be checked against where a vector actually ends up.
 */
function rotate(q: ReadonlyQuat, v: readonly [number, number, number]): [number, number, number] {
  const p = quat.create(v[0], v[1], v[2], 0);
  const qp = quat.multiply(quat.create(), q, p);
  const r = quat.multiply(quat.create(), qp, quat.conjugate(quat.create(), q));
  return [r[0], r[1], r[2]];
}

/** Test-only cast site: a Vec3 view over element `index` of a shared buffer. */
function vec3ViewAt(buffer: ArrayBuffer, index: number): Vec3 {
  return new Float32Array(buffer, index * FLOAT_BYTES, 3) as Vec3;
}

describe('SIZE', () => {
  test('is the element count of a quaternion', () => {
    expect(quat.SIZE).toBe(4);
    expect(quat.create().length).toBe(quat.SIZE);
  });
});

describe('magnitudeSq', () => {
  test('is 1 for the identity', () => {
    expect(quat.magnitudeSq(quat.IDENTITY)).toBe(1);
  });

  test('sums the squares of all four components', () => {
    expect(quat.magnitudeSq(quat.create(1, 2, 3, 4))).toBe(30);
  });

  test('is 0 for the zero quaternion', () => {
    expect(quat.magnitudeSq(quat.create(0, 0, 0, 0))).toBe(0);
  });

  test('is calculated in float64, so it cannot overflow at the float32 extremes', () => {
    const big = Math.fround(3e38);
    const result = quat.magnitudeSq(quat.create(big, big, big, big));
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBe(4 * big * big);
  });

  test('never writes to the input', () => {
    const source = quat.create(1, 2, 3, 4);
    quat.magnitudeSq(source);
    expectComponents(source, 1, 2, 3, 4);
  });
});

describe('magnitude', () => {
  test('is 1 for the identity', () => {
    expect(quat.magnitude(quat.IDENTITY)).toBe(1);
  });

  test('is the square root of magnitudeSq', () => {
    expect(quat.magnitude(quat.create(1, 2, 3, 4))).toBe(Math.sqrt(30));
    expect(quat.magnitude(quat.create(0, 0, 0, 2))).toBe(2);
  });

  test('is 0 for the zero quaternion', () => {
    expect(quat.magnitude(quat.create(0, 0, 0, 0))).toBe(0);
  });
});

describe('normalize', () => {
  const S = Math.SQRT1_2;

  test('writes into out and returns it', () => {
    const out = quat.create();
    expect(quat.normalize(out, quat.create(1, 2, 3, 4))).toBe(out);
  });

  test('scales to unit length', () => {
    const inv = 1 / Math.sqrt(30);
    const q = quat.normalize(quat.create(), quat.create(1, 2, 3, 4));
    expectClose(q, inv, 2 * inv, 3 * inv, 4 * inv);
    expect(quat.magnitude(q)).toBeCloseTo(1, 6);
  });

  test('a scaled identity normalizes exactly to the identity', () => {
    expectComponents(quat.normalize(quat.create(), quat.create(0, 0, 0, 2)), 0, 0, 0, 1);
  });

  test('keeps the rotation of a quaternion that has drifted', () => {
    // A quarter turn about +X, scaled to length 3.
    const drifted = quat.create(3 * S, 0, 0, 3 * S);
    expectClose(quat.normalize(quat.create(), drifted), S, 0, 0, S);
  });

  test('leaves an already-unit quaternion unchanged', () => {
    const q = quat.create(0, 0, 0, 1);
    expectComponents(quat.normalize(quat.create(), q), 0, 0, 0, 1);
  });

  test('the zero quaternion gives the identity, overwriting whatever out held', () => {
    const out = quat.create(7, 7, 7, 7);
    quat.normalize(out, quat.create(0, 0, 0, 0));
    expectComponents(out, 0, 0, 0, 1);
  });

  test('only an exact zero falls back: very short quaternions still normalize', () => {
    expectClose(quat.normalize(quat.create(), quat.create(1e-30, 0, 0, 1e-30)), S, 0, 0, S);
  });

  test('a NaN component makes the whole result NaN', () => {
    const q = quat.normalize(quat.create(), quat.create(1, 0, 0, Number.NaN));
    expect(Array.from(q).every(Number.isNaN)).toBe(true);
  });

  test('an infinite component gives NaN in that slot and 0 in the finite ones', () => {
    const q = quat.normalize(quat.create(), quat.create(Infinity, 1, 2, 3));
    expect(q[0]).toBeNaN();
    expect([q[1], q[2], q[3]]).toEqual([0, 0, 0]);
  });

  test('never writes to the input', () => {
    const source = quat.create(1, 2, 3, 4);
    quat.normalize(quat.create(), source);
    expectComponents(source, 1, 2, 3, 4);
  });

  test('out may be the same object as the input', () => {
    const expected = quat.normalize(quat.create(), quat.create(1, 2, 3, 4));
    const q = quat.create(1, 2, 3, 4);
    quat.normalize(q, q);
    expect(Array.from(q)).toEqual(Array.from(expected));
  });

  test('every overlap of two distinct views is exact', () => {
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(8);
        const input = viewAt(buffer, inputOffset);
        const expected = quat.normalize(quat.create(), quat.clone(input));

        quat.normalize(viewAt(buffer, outOffset), input);

        expect(Array.from(viewAt(buffer, outOffset))).toEqual(Array.from(expected));
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.normalize(viewAt(pool, 2), quat.create(0, 0, 0, 2));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 1, 7, 8]);
  });
});

describe('conjugate', () => {
  test('writes into out and returns it', () => {
    const out = quat.create();
    expect(quat.conjugate(out, quat.IDENTITY)).toBe(out);
  });

  test('negates the vector part and keeps the scalar w, which is stored last', () => {
    expectComponents(quat.conjugate(quat.create(), quat.create(1, 2, 3, 4)), -1, -2, -3, 4);
  });

  test('the identity is its own conjugate', () => {
    expect(quat.isEqual(quat.conjugate(quat.create(), quat.IDENTITY), quat.IDENTITY)).toBe(true);
  });

  test('conjugating twice gives back the original', () => {
    const q = quat.create(0.1, -0.7, 0.3, 0.9);
    const twice = quat.conjugate(quat.create(), quat.conjugate(quat.create(), q));
    expect(Array.from(twice)).toEqual(Array.from(q));
  });

  test('inverts a unit quaternion on either side', () => {
    const axis = vec3.normalize(vec3.create(), vec3.create(1, 2, 3));
    const q = quat.fromAxisAngle(quat.create(), axis, 1.2);
    const inverse = quat.conjugate(quat.create(), q);

    expectClose(quat.multiply(quat.create(), q, inverse), 0, 0, 0, 1);
    expectClose(quat.multiply(quat.create(), inverse, q), 0, 0, 0, 1);
  });

  test('undoes a rotation applied to a vector', () => {
    const q = quat.fromAxisAngle(quat.create(), vec3.UP, Math.PI / 3);
    const inverse = quat.conjugate(quat.create(), q);
    const [x, y, z] = rotate(inverse, rotate(q, [1, 2, 3]));

    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(2, 5);
    expect(z).toBeCloseTo(3, 5);
  });

  test('only inverts unit quaternions: otherwise the product has the squared length on w', () => {
    const q = quat.create(1, 2, 3, 4);
    const product = quat.multiply(quat.create(), q, quat.conjugate(quat.create(), q));
    expectComponents(product, 0, 0, 0, 30);
  });

  test('never writes to the input', () => {
    const source = quat.create(1, 2, 3, 4);
    quat.conjugate(quat.create(), source);
    expectComponents(source, 1, 2, 3, 4);
  });

  test('out may be the same object as the input', () => {
    const q = quat.create(1, 2, 3, 4);
    quat.conjugate(q, q);
    expectComponents(q, -1, -2, -3, 4);
  });

  test('every overlap of two distinct views is exact', () => {
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(8);
        const input = viewAt(buffer, inputOffset);
        const expected = quat.conjugate(quat.create(), quat.clone(input));

        quat.conjugate(viewAt(buffer, outOffset), input);

        expect(Array.from(viewAt(buffer, outOffset))).toEqual(Array.from(expected));
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.conjugate(viewAt(pool, 2), quat.create(1, 2, 3, 4));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, -1, -2, -3, 4, 7, 8]);
  });
});

describe('invert', () => {
  test('writes into out and returns it', () => {
    const out = quat.create();
    expect(quat.invert(out, quat.IDENTITY)).toBe(out);
  });

  test('is the conjugate divided by the squared length, with w stored last', () => {
    // Squared length 30.
    expectClose(
      quat.invert(quat.create(), quat.create(1, 2, 3, 4)),
      -1 / 30,
      -2 / 30,
      -3 / 30,
      4 / 30
    );
  });

  test('the identity is its own inverse, with a negative-zero vector part', () => {
    const inverse = quat.invert(quat.create(), quat.IDENTITY);
    expect(quat.isEqual(inverse, quat.IDENTITY)).toBe(true);
    expect(Object.is(inverse[0], -0)).toBe(true);
  });

  test('inverts a non-unit quaternion on either side', () => {
    const q = quat.create(1, 2, 3, 4);
    const inverse = quat.invert(quat.create(), q);

    expectClose(quat.multiply(quat.create(), q, inverse), 0, 0, 0, 1);
    expectClose(quat.multiply(quat.create(), inverse, q), 0, 0, 0, 1);
  });

  test('matches the conjugate for a unit quaternion', () => {
    const axis = vec3.normalize(vec3.create(), vec3.create(1, 2, 3));
    const q = quat.fromAxisAngle(quat.create(), axis, 1.2);
    const viaConjugate = quat.conjugate(quat.create(), q);
    expectClose(
      quat.invert(quat.create(), q),
      viaConjugate[0],
      viaConjugate[1],
      viaConjugate[2],
      viaConjugate[3]
    );
  });

  test('is exactly the conjugate when the squared length is exactly 1', () => {
    const halfTurn = quat.create(0, 1, 0, 0);
    expectComponents(quat.invert(quat.create(), halfTurn), -0, -1, -0, 0);
  });

  test('inverting twice gives back the original', () => {
    const q = quat.create(1, 2, 3, 4);
    const twice = quat.invert(quat.create(), quat.invert(quat.create(), q));
    expectClose(twice, 1, 2, 3, 4);
  });

  test('the inverse has length 1 / magnitude(a), so it is not unit for non-unit input', () => {
    const q = quat.create(0, 0, 0, 2);
    const inverse = quat.invert(quat.create(), q);
    expect(quat.magnitude(inverse)).toBe(0.5);
  });

  test('normalise then conjugate is how to undo a drifted rotation', () => {
    const rotation = quat.fromAxisAngle(quat.create(), vec3.UP, Math.PI / 3);
    const drifted = quat.create(
      rotation[0] * 1.01,
      rotation[1] * 1.01,
      rotation[2] * 1.01,
      rotation[3] * 1.01
    );

    const undo = quat.conjugate(quat.create(), quat.normalize(quat.create(), drifted));
    const [x, y, z] = rotate(undo, rotate(rotation, [1, 2, 3]));
    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(2, 5);
    expect(z).toBeCloseTo(3, 5);

    // The inverse of the drifted quaternion has the wrong length for rotating vectors.
    expect(quat.magnitude(quat.invert(quat.create(), drifted))).toBeCloseTo(1 / 1.01, 6);
  });

  test('the zero quaternion gives the identity', () => {
    const zero = quat.create(0, 0, 0, 0);
    expectComponents(quat.invert(quat.create(), zero), 0, 0, 0, 1);
  });

  test('the zero fallback is not an inverse: zero times it is still zero', () => {
    const zero = quat.create(0, 0, 0, 0);
    const product = quat.multiply(quat.create(), zero, quat.invert(quat.create(), zero));
    expect(quat.magnitudeSq(product)).toBe(0);
  });

  test('only an exact zero is special-cased: a very short quaternion gives a very long inverse', () => {
    const inverse = quat.invert(quat.create(), quat.create(0, 0, 0, 1e-20));
    expect(inverse[3] / 1e20).toBeCloseTo(1, 6);
  });

  test('a subnormal length overflows to Infinity', () => {
    const inverse = quat.invert(quat.create(), quat.create(0, 0, 0, 1e-40));
    expect(inverse[3]).toBe(Number.POSITIVE_INFINITY);
  });

  test('a NaN component makes every component NaN', () => {
    const inverse = quat.invert(quat.create(), quat.create(Number.NaN, 0, 0, 1));
    expect(Array.from(inverse).every(Number.isNaN)).toBe(true);
  });

  test('an infinite component gives NaN in its own slot', () => {
    const inverse = quat.invert(quat.create(), quat.create(Number.POSITIVE_INFINITY, 0, 0, 1));
    expect(Number.isNaN(inverse[0])).toBe(true);
  });

  test('never writes to the input', () => {
    const source = quat.create(1, 2, 3, 4);
    quat.invert(quat.create(), source);
    expectComponents(source, 1, 2, 3, 4);
  });

  test('out may be the same object as the input', () => {
    const q = quat.create(1, 2, 3, 4);
    quat.invert(q, q);
    expectClose(q, -1 / 30, -2 / 30, -3 / 30, 4 / 30);
  });

  test('every overlap of two distinct views is exact', () => {
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        const buffer = sequentialBuffer(8);
        const input = viewAt(buffer, inputOffset);
        const expected = quat.invert(quat.create(), quat.clone(input));

        quat.invert(viewAt(buffer, outOffset), input);

        expect(Array.from(viewAt(buffer, outOffset))).toEqual(Array.from(expected));
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.invert(viewAt(pool, 2), quat.create(0, 2, 0, 0));

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, -0, -0.5, -0, 0, 7, 8]);
  });
});

describe('fromAxisAngle', () => {
  const S = Math.SQRT1_2;

  test('writes into out and returns it', () => {
    const out = quat.create();
    expect(quat.fromAxisAngle(out, vec3.UP, 1)).toBe(out);
  });

  test('a zero angle gives the identity, whatever the axis', () => {
    expect(quat.isEqual(quat.fromAxisAngle(quat.create(), vec3.UP, 0), quat.IDENTITY)).toBe(true);
    expect(quat.isEqual(quat.fromAxisAngle(quat.create(), vec3.RIGHT, 0), quat.IDENTITY)).toBe(
      true
    );
  });

  test('stores the scalar cos(angle/2) last, after the vector part', () => {
    // A quarter turn about +Y.
    expectClose(quat.fromAxisAngle(quat.create(), vec3.UP, Math.PI / 2), 0, S, 0, S);
  });

  test('encodes xyz = axis * sin(angle/2), w = cos(angle/2)', () => {
    const axis = vec3.normalize(vec3.create(), vec3.create(1, 2, 3));
    const angle = 1.2;
    const sin = Math.sin(angle / 2);
    const q = quat.fromAxisAngle(quat.create(), axis, angle);

    expectClose(q, axis[0] * sin, axis[1] * sin, axis[2] * sin, Math.cos(angle / 2));
  });

  test('a unit axis gives a unit quaternion', () => {
    const axis = vec3.normalize(vec3.create(), vec3.create(-4, 1, 7));
    expect(quat.magnitude(quat.fromAxisAngle(quat.create(), axis, 2.5))).toBeCloseTo(1, 6);
  });

  test('follows the right-hand rule: a positive turn about UP takes FORWARD to LEFT', () => {
    const q = quat.fromAxisAngle(quat.create(), vec3.UP, Math.PI / 2);
    const [x, y, z] = rotate(q, [vec3.FORWARD[0], vec3.FORWARD[1], vec3.FORWARD[2]]);

    expect(x).toBeCloseTo(vec3.LEFT[0], 6);
    expect(y).toBeCloseTo(vec3.LEFT[1], 6);
    expect(z).toBeCloseTo(vec3.LEFT[2], 6);
  });

  test('a positive turn about +Z takes +X to +Y', () => {
    const q = quat.fromAxisAngle(quat.create(), vec3.create(0, 0, 1), Math.PI / 2);
    const [x, y, z] = rotate(q, [1, 0, 0]);

    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(1, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  test('a negative angle gives the conjugate', () => {
    const forward = quat.fromAxisAngle(quat.create(), vec3.UP, 0.8);
    const backward = quat.fromAxisAngle(quat.create(), vec3.UP, -0.8);
    const conjugate = quat.conjugate(quat.create(), forward);

    expectClose(backward, conjugate[0], conjugate[1], conjugate[2], conjugate[3]);
  });

  test('composes with multiply: two eighth turns make a quarter turn', () => {
    const eighth = quat.fromAxisAngle(quat.create(), vec3.UP, Math.PI / 4);
    const quarter = quat.fromAxisAngle(quat.create(), vec3.UP, Math.PI / 2);
    const composed = quat.multiply(quat.create(), eighth, eighth);

    expectClose(composed, quarter[0], quarter[1], quarter[2], quarter[3]);
  });

  test('angles a full turn apart give opposite quaternions for the same rotation', () => {
    const q = quat.fromAxisAngle(quat.create(), vec3.UP, 0.8);
    const turned = quat.fromAxisAngle(quat.create(), vec3.UP, 0.8 + 2 * Math.PI);

    expectClose(turned, -q[0], -q[1], -q[2], -q[3]);
    expect(quat.isEqualEpsilon(q, turned)).toBe(false);

    const [ax, ay, az] = rotate(q, [1, 2, 3]);
    const [bx, by, bz] = rotate(turned, [1, 2, 3]);
    expect(bx).toBeCloseTo(ax, 5);
    expect(by).toBeCloseTo(ay, 5);
    expect(bz).toBeCloseTo(az, 5);
  });

  test('does not normalise the axis: a longer axis gives a longer quaternion', () => {
    const q = quat.fromAxisAngle(quat.create(), vec3.create(0, 2, 0), Math.PI);
    expectClose(q, 0, 2, 0, 0);
    expect(quat.magnitude(q)).toBeCloseTo(2, 6);
  });

  test('a zero axis gives (0, 0, 0, cos(angle/2)), which is not a rotation', () => {
    const q = quat.fromAxisAngle(quat.create(), vec3.ZERO, Math.PI / 2);
    expectClose(q, 0, 0, 0, S);
  });

  test('never writes to the axis', () => {
    const axis = vec3.create(0, 1, 0);
    quat.fromAxisAngle(quat.create(), axis, 1);
    expect(Array.from(axis)).toEqual([0, 1, 0]);
  });

  test('overwrites every component of out', () => {
    const out = quat.create(7, 7, 7, 7);
    quat.fromAxisAngle(out, vec3.UP, 0);
    expect(quat.isEqual(out, quat.IDENTITY)).toBe(true);
  });

  test('the axis may be a view overlapping out', () => {
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let axisOffset = 0; axisOffset < 5; axisOffset++) {
        const buffer = sequentialBuffer(8);
        const axis = vec3ViewAt(buffer, axisOffset);
        const expected = quat.fromAxisAngle(quat.create(), vec3.clone(axis), 0.7);

        quat.fromAxisAngle(viewAt(buffer, outOffset), axis, 0.7);

        expect(Array.from(viewAt(buffer, outOffset))).toEqual(Array.from(expected));
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.fromAxisAngle(viewAt(pool, 2), vec3.UP, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 1, 7, 8]);
  });
});

describe('dot', () => {
  test('sums the products of all four components', () => {
    expect(quat.dot(quat.create(1, 2, 3, 4), quat.create(5, 6, 7, 8))).toBe(70);
  });

  test('does not depend on the order', () => {
    const a = quat.create(0.1, -0.7, 0.3, 0.9);
    const b = quat.create(-0.4, 0.2, 0.8, 0.5);
    expect(quat.dot(a, b)).toBe(quat.dot(b, a));
  });

  test('a unit quaternion with itself is 1', () => {
    expect(quat.dot(quat.IDENTITY, quat.IDENTITY)).toBe(1);
    const q = quat.fromAxisAngle(quat.create(), vec3.UP, 1.3);
    expect(quat.dot(q, q)).toBeCloseTo(1, 6);
  });

  test('is cos(θ/2) of the angle between two rotations', () => {
    for (const angle of [0.2, 1, Math.PI / 2, 2.5]) {
      const q = quat.fromAxisAngle(quat.create(), vec3.RIGHT, angle);
      expect(quat.dot(quat.IDENTITY, q)).toBeCloseTo(Math.cos(angle / 2), 6);
    }
  });

  test('the documented angle recovery gives the angle between rotations', () => {
    const a = quat.fromAxisAngle(quat.create(), vec3.UP, 0.3);
    const b = quat.fromAxisAngle(quat.create(), vec3.UP, 1.5);
    const d = quat.dot(a, b);
    expect(2 * Math.acos(Math.min(Math.abs(d), 1))).toBeCloseTo(1.2, 5);
  });

  test('is 0 for rotations half a turn apart', () => {
    const half = quat.fromAxisAngle(quat.create(), vec3.UP, Math.PI);
    expect(quat.dot(quat.IDENTITY, half)).toBeCloseTo(0, 6);
  });

  test('q and -q are the same rotation but have a dot product of -1', () => {
    const q = quat.fromAxisAngle(quat.create(), vec3.UP, 0.8);
    const negated = quat.create(-q[0], -q[1], -q[2], -q[3]);
    expect(quat.dot(q, negated)).toBeCloseTo(-1, 6);
    expect(Math.abs(quat.dot(q, negated))).toBeCloseTo(1, 6);
  });

  test('a NaN component gives NaN', () => {
    expect(quat.dot(quat.create(Number.NaN, 0, 0, 1), quat.IDENTITY)).toBeNaN();
  });

  test('an infinite component multiplied by 0 gives NaN', () => {
    expect(quat.dot(quat.create(Infinity, 0, 0, 1), quat.IDENTITY)).toBeNaN();
  });

  test('is not rounded to float32', () => {
    const a = quat.create(0.1, 0, 0, 0);
    expect(quat.dot(a, a)).toBe(a[0] * a[0]);
    expect(quat.dot(a, a)).not.toBe(Math.fround(a[0] * a[0]));
  });

  test('never writes to either input', () => {
    const a = quat.create(1, 2, 3, 4);
    const b = quat.create(5, 6, 7, 8);
    quat.dot(a, b);
    expectComponents(a, 1, 2, 3, 4);
    expectComponents(b, 5, 6, 7, 8);
  });
});

describe('fromEuler', () => {
  const X = vec3.create(1, 0, 0);
  const Y = vec3.create(0, 1, 0);
  const Z = vec3.create(0, 0, 1);
  const about = (axis: Vec3, angle: number): Quat => quat.fromAxisAngle(quat.create(), axis, angle);

  /** The documented order, built from single-axis rotations: `qy * qx * qz`. */
  function reference(x: number, y: number, z: number): Quat {
    const yx = quat.multiply(quat.create(), about(Y, y), about(X, x));
    return quat.multiply(quat.create(), yx, about(Z, z));
  }

  function expectQuatClose(actual: ReadonlyQuat, expected: ReadonlyQuat): void {
    expectClose(actual, expected[0], expected[1], expected[2], expected[3]);
  }

  function expectVecClose(actual: readonly number[], expected: ArrayLike<number>): void {
    expect(actual[0]).toBeCloseTo(expected[0] as number, 6);
    expect(actual[1]).toBeCloseTo(expected[1] as number, 6);
    expect(actual[2]).toBeCloseTo(expected[2] as number, 6);
  }

  const asTuple = (v: ArrayLike<number>): [number, number, number] => [
    v[0] as number,
    v[1] as number,
    v[2] as number,
  ];

  test('writes into out and returns it', () => {
    const out = quat.create();
    expect(quat.fromEuler(out, 0.1, 0.2, 0.3)).toBe(out);
  });

  test('zero angles give exactly the identity', () => {
    expect(quat.isEqual(quat.fromEuler(quat.create(), 0, 0, 0), quat.IDENTITY)).toBe(true);
  });

  test('each angle alone is a rotation about its own axis', () => {
    expectQuatClose(quat.fromEuler(quat.create(), 0.9, 0, 0), about(X, 0.9));
    expectQuatClose(quat.fromEuler(quat.create(), 0, 0.9, 0), about(Y, 0.9));
    expectQuatClose(quat.fromEuler(quat.create(), 0, 0, 0.9), about(Z, 0.9));
  });

  test('is qy * qx * qz for mixed angles', () => {
    const cases: [number, number, number][] = [
      [0.3, -1.1, 0.7],
      [-2.4, 0.5, 3],
      [1.2, 2.8, -0.6],
      [Math.PI / 2, 0.4, -0.9],
    ];
    for (const [x, y, z] of cases) {
      expectQuatClose(quat.fromEuler(quat.create(), x, y, z), reference(x, y, z));
    }
  });

  test('applies roll before yaw, about the world axes', () => {
    // Roll takes UP to LEFT, then yaw takes LEFT to BACK. Yawing first would
    // leave UP alone and end at LEFT.
    const q = quat.fromEuler(quat.create(), 0, Math.PI / 2, Math.PI / 2);
    expectVecClose(rotate(q, asTuple(vec3.UP)), vec3.BACK);
  });

  test('pitches about the yawed right axis', () => {
    // Yaw a quarter turn to face LEFT, then pitch up an eighth turn: up and to the left.
    const S = Math.SQRT1_2;
    const q = quat.fromEuler(quat.create(), Math.PI / 4, Math.PI / 2, 0);
    expectVecClose(rotate(q, asTuple(vec3.FORWARD)), [-S, S, 0]);
  });

  test('a positive yaw turns FORWARD towards LEFT', () => {
    const q = quat.fromEuler(quat.create(), 0, Math.PI / 2, 0);
    expectVecClose(rotate(q, asTuple(vec3.FORWARD)), vec3.LEFT);
  });

  test('a positive pitch tilts FORWARD towards UP', () => {
    const q = quat.fromEuler(quat.create(), Math.PI / 2, 0, 0);
    expectVecClose(rotate(q, asTuple(vec3.FORWARD)), vec3.UP);
  });

  test('a positive roll tips UP towards LEFT', () => {
    const q = quat.fromEuler(quat.create(), 0, 0, Math.PI / 2);
    expectVecClose(rotate(q, asTuple(vec3.UP)), vec3.LEFT);
  });

  test('gives a unit quaternion', () => {
    expect(quat.magnitude(quat.fromEuler(quat.create(), 0.3, -1.1, 0.7))).toBeCloseTo(1, 6);
    expect(quat.magnitude(quat.fromEuler(quat.create(), -2.4, 5, 3))).toBeCloseTo(1, 6);
  });

  test('at +90° pitch only yaw minus roll matters (gimbal lock)', () => {
    const a = quat.fromEuler(quat.create(), Math.PI / 2, 0.5, 0.2);
    const b = quat.fromEuler(quat.create(), Math.PI / 2, 0.3, 0);
    expectQuatClose(a, b);
  });

  test('at -90° pitch only yaw plus roll matters (gimbal lock)', () => {
    const a = quat.fromEuler(quat.create(), -Math.PI / 2, 0.5, 0.2);
    const b = quat.fromEuler(quat.create(), -Math.PI / 2, 0.7, 0);
    expectQuatClose(a, b);
  });

  test('angles a full turn apart give opposite quaternions for the same rotation', () => {
    const q = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    const turned = quat.fromEuler(quat.create(), 0.3, -1.1 + 2 * Math.PI, 0.7);

    expectClose(turned, -q[0], -q[1], -q[2], -q[3]);

    const [ax, ay, az] = rotate(q, [1, 2, 3]);
    const [bx, by, bz] = rotate(turned, [1, 2, 3]);
    expect(bx).toBeCloseTo(ax, 5);
    expect(by).toBeCloseTo(ay, 5);
    expect(bz).toBeCloseTo(az, 5);
  });

  test('a NaN angle gives NaN', () => {
    const q = quat.fromEuler(quat.create(), 0, Number.NaN, 0);
    expect(Array.from(q).every(Number.isNaN)).toBe(true);
  });

  test('overwrites every component of out', () => {
    const out = quat.create(7, 7, 7, 7);
    quat.fromEuler(out, 0, 0, 0);
    expect(quat.isEqual(out, quat.IDENTITY)).toBe(true);
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.fromEuler(viewAt(pool, 2), 0, 0, 0);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 1, 7, 8]);
  });
});

/** The rotation angle between two unit quaternions, in radians. */
function angleBetween(a: ReadonlyQuat, b: ReadonlyQuat): number {
  return 2 * Math.acos(Math.min(Math.abs(quat.dot(a, b)), 1));
}

/** The rotation of `angle` radians about `Vec3.UP`. */
function yaw(angle: number): Quat {
  return quat.fromAxisAngle(quat.create(), vec3.UP, angle);
}

function negated(q: ReadonlyQuat): Quat {
  return quat.create(-q[0], -q[1], -q[2], -q[3]);
}

describe('slerp', () => {
  test('writes into out and returns it', () => {
    const out = quat.create();
    expect(quat.slerp(out, quat.IDENTITY, yaw(1), 0.5)).toBe(out);
  });

  test('t = 0 gives exactly a', () => {
    const a = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    expect(Array.from(quat.slerp(quat.create(), a, yaw(2), 0))).toEqual(Array.from(a));
  });

  test('t = 1 gives b', () => {
    const b = yaw(2);
    expectClose(quat.slerp(quat.create(), quat.IDENTITY, b, 1), b[0], b[1], b[2], b[3]);
  });

  test('turns at a constant angular speed', () => {
    const b = yaw(2);
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const q = quat.slerp(quat.create(), quat.IDENTITY, b, t);
      expect(angleBetween(quat.IDENTITY, q)).toBeCloseTo(2 * t, 5);
    }
  });

  test('stays on the arc: the midpoint is the half-angle rotation about the same axis', () => {
    const half = yaw(1);
    const mid = quat.slerp(quat.create(), quat.IDENTITY, yaw(2), 0.5);
    expectClose(mid, half[0], half[1], half[2], half[3]);
  });

  test('takes the short way round when b is the negated form', () => {
    const viaNegated = quat.slerp(quat.create(), quat.IDENTITY, negated(yaw(2)), 0.5);
    expect(angleBetween(quat.IDENTITY, viaNegated)).toBeCloseTo(1, 5);
  });

  test('t = 1 gives -b when b had to be negated', () => {
    const b = negated(yaw(2));
    const end = quat.slerp(quat.create(), quat.IDENTITY, b, 1);

    expectClose(end, -b[0], -b[1], -b[2], -b[3]);
    expect(quat.isEqualEpsilon(end, b)).toBe(false);
    expect(Math.abs(quat.dot(end, b))).toBeCloseTo(1, 6);
  });

  test('extrapolates along the same arc at the same speed', () => {
    const b = yaw(1);
    const twice = quat.slerp(quat.create(), quat.IDENTITY, b, 2);
    expect(angleBetween(quat.IDENTITY, twice)).toBeCloseTo(2, 5);

    const back = quat.slerp(quat.create(), quat.IDENTITY, b, -0.5);
    const expected = yaw(-0.5);
    expectClose(back, expected[0], expected[1], expected[2], expected[3]);
  });

  test('gives a unit quaternion', () => {
    const a = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    const b = quat.fromEuler(quat.create(), -2.4, 0.5, 3);
    for (const t of [0.2, 0.5, 0.8]) {
      expect(quat.magnitude(quat.slerp(quat.create(), a, b, t))).toBeCloseTo(1, 6);
    }
  });

  test('within the threshold it gives exactly the nlerp result', () => {
    // 3° apart, inside the roughly 3.6° cut-off.
    const a = yaw(0.2);
    const b = yaw(0.2 + (3 * Math.PI) / 180);
    const viaSlerp = quat.slerp(quat.create(), a, b, 0.3);
    const viaNlerp = quat.nlerp(quat.create(), a, b, 0.3);
    expect(Array.from(viaSlerp)).toEqual(Array.from(viaNlerp));
  });

  test('outside the threshold it does not use nlerp', () => {
    // 4° apart, just past the cut-off.
    const a = yaw(0.2);
    const b = yaw(0.2 + (4 * Math.PI) / 180);
    const viaSlerp = quat.slerp(quat.create(), a, b, 0.3);
    const viaNlerp = quat.nlerp(quat.create(), a, b, 0.3);
    expect(Array.from(viaSlerp)).not.toEqual(Array.from(viaNlerp));
  });

  test('is continuous across the threshold', () => {
    const just = (degrees: number): number => {
      const b = yaw((degrees * Math.PI) / 180);
      return angleBetween(quat.IDENTITY, quat.slerp(quat.create(), quat.IDENTITY, b, 0.5));
    };
    expect(just(3.62)).toBeCloseTo(just(3.63), 3);
  });

  test('identical inputs give that rotation', () => {
    const q = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    expectClose(quat.slerp(quat.create(), q, q, 0.4), q[0], q[1], q[2], q[3]);
  });

  test('does not return NaN when rounding pushes the dot product above 1', () => {
    const candidates = [
      quat.create(1, 2, 3, 4),
      quat.create(0.1, 0.2, 0.3, 0.4),
      quat.create(1, 1, 1, 1),
      quat.create(3, -7, 2, 5),
      quat.create(0.7, 0.1, -0.3, 0.2),
    ].map((q) => quat.normalize(q, q));
    const q = candidates.find((c) => quat.dot(c, c) > 1);

    expect(q).toBeDefined();
    const result = quat.slerp(quat.create(), q as Quat, q as Quat, 0.5);
    expect(Array.from(result).some(Number.isNaN)).toBe(false);
  });

  test('non-unit inputs above the threshold quietly take the nlerp path', () => {
    const a = quat.create(0, 0, 0, 2);
    const b = yaw(2);
    const doubledB = quat.create(2 * b[0], 2 * b[1], 2 * b[2], 2 * b[3]);
    // The dot product is about 2.16, so it reads as "nearly identical".
    expect(quat.dot(a, doubledB)).toBeGreaterThan(1);
    expect(Array.from(quat.slerp(quat.create(), a, doubledB, 0.5))).toEqual(
      Array.from(quat.nlerp(quat.create(), a, doubledB, 0.5))
    );
  });

  test('a NaN in either input or in t gives NaN', () => {
    const nanQuat = quat.create(Number.NaN, 0, 0, 1);
    const results = [
      quat.slerp(quat.create(), nanQuat, yaw(2), 0.5),
      quat.slerp(quat.create(), quat.IDENTITY, nanQuat, 0.5),
      quat.slerp(quat.create(), quat.IDENTITY, yaw(2), Number.NaN),
      quat.slerp(quat.create(), quat.IDENTITY, yaw(0.01), Number.NaN),
    ];
    for (const q of results) expect(Array.from(q).every(Number.isNaN)).toBe(true);
  });

  test('never writes to either input', () => {
    const a = quat.create(0, 0, 0, 1);
    const b = quat.create(0, 1, 0, 0);
    quat.slerp(quat.create(), a, b, 0.5);
    expectComponents(a, 0, 0, 0, 1);
    expectComponents(b, 0, 1, 0, 0);
  });

  test('out may be a or b', () => {
    const a = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    const b = yaw(2);
    const expected = Array.from(quat.slerp(quat.create(), a, b, 0.3));

    const intoA = quat.clone(a);
    quat.slerp(intoA, intoA, b, 0.3);
    expect(Array.from(intoA)).toEqual(expected);

    const intoB = quat.clone(b);
    quat.slerp(intoB, a, intoB, 0.3);
    expect(Array.from(intoB)).toEqual(expected);
  });

  test('out may overlap either input', () => {
    const other = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        for (const inputIsA of [true, false]) {
          const buffer = sequentialBuffer(8);
          const input = viewAt(buffer, inputOffset);
          quat.normalize(input, input);
          const a = inputIsA ? input : other;
          const b = inputIsA ? other : input;
          const expected = quat.slerp(quat.create(), quat.clone(a), quat.clone(b), 0.3);

          quat.slerp(viewAt(buffer, outOffset), a, b, 0.3);

          expect(Array.from(viewAt(buffer, outOffset))).toEqual(Array.from(expected));
        }
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.slerp(viewAt(pool, 2), quat.IDENTITY, quat.IDENTITY, 0.5);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 1, 7, 8]);
  });
});

describe('nlerp', () => {
  test('writes into out and returns it', () => {
    const out = quat.create();
    expect(quat.nlerp(out, quat.IDENTITY, yaw(1), 0.5)).toBe(out);
  });

  test('t = 0 and t = 1 give the endpoints', () => {
    // A positive dot product, so b is not negated.
    const a = quat.fromEuler(quat.create(), 0.3, 0.4, -0.2);
    const b = yaw(2);
    expect(quat.dot(a, b)).toBeGreaterThan(0);
    expectClose(quat.nlerp(quat.create(), a, b, 0), a[0], a[1], a[2], a[3]);
    expectClose(quat.nlerp(quat.create(), a, b, 1), b[0], b[1], b[2], b[3]);
  });

  test('t = 0.5 is exactly halfway, like slerp', () => {
    const viaNlerp = quat.nlerp(quat.create(), quat.IDENTITY, yaw(2), 0.5);
    const viaSlerp = quat.slerp(quat.create(), quat.IDENTITY, yaw(2), 0.5);
    expectClose(viaNlerp, viaSlerp[0], viaSlerp[1], viaSlerp[2], viaSlerp[3]);
  });

  test('is slower near the ends than slerp: a quarter of a 2-radian turn covers about 0.47', () => {
    const quarter = quat.nlerp(quat.create(), quat.IDENTITY, yaw(2), 0.25);
    const angle = angleBetween(quat.IDENTITY, quarter);
    expect(angle).toBeCloseTo(0.467, 3);
    expect(angle).toBeLessThan(0.5);
  });

  test('stays on the same arc as slerp', () => {
    // Every result is a rotation about the same axis, just at a different angle.
    const q = quat.nlerp(quat.create(), quat.IDENTITY, yaw(2), 0.25);
    expect(q[0]).toBeCloseTo(0, 6);
    expect(q[2]).toBeCloseTo(0, 6);
  });

  test('takes the short way round when b is the negated form', () => {
    const viaNegated = quat.nlerp(quat.create(), quat.IDENTITY, negated(yaw(2)), 0.5);
    expect(angleBetween(quat.IDENTITY, viaNegated)).toBeCloseTo(1, 5);
  });

  test('t = 1 gives -b when b had to be negated', () => {
    const b = negated(yaw(2));
    expectClose(quat.nlerp(quat.create(), quat.IDENTITY, b, 1), -b[0], -b[1], -b[2], -b[3]);
  });

  test('falls short when extrapolating: t = 2 on a 1-radian turn reaches about 1.81', () => {
    const twice = quat.nlerp(quat.create(), quat.IDENTITY, yaw(1), 2);
    const angle = angleBetween(quat.IDENTITY, twice);
    expect(angle).toBeCloseTo(1.807, 3);
  });

  test('gives a unit quaternion', () => {
    const a = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    const b = quat.fromEuler(quat.create(), -2.4, 0.5, 3);
    for (const t of [0.2, 0.5, 0.8, 1.5]) {
      expect(quat.magnitude(quat.nlerp(quat.create(), a, b, t))).toBeCloseTo(1, 6);
    }
  });

  test('non-unit inputs still give a unit result, weighted towards the longer input', () => {
    const doubledIdentity = quat.create(0, 0, 0, 2);
    const q = quat.nlerp(quat.create(), doubledIdentity, yaw(2), 0.5);
    expect(quat.magnitude(q)).toBeCloseTo(1, 6);
    expect(angleBetween(quat.IDENTITY, q)).toBeLessThan(1);
  });

  test('a NaN in either input or in t gives NaN', () => {
    const nanQuat = quat.create(Number.NaN, 0, 0, 1);
    const results = [
      quat.nlerp(quat.create(), nanQuat, yaw(2), 0.5),
      quat.nlerp(quat.create(), quat.IDENTITY, nanQuat, 0.5),
      quat.nlerp(quat.create(), quat.IDENTITY, yaw(2), Number.NaN),
    ];
    for (const q of results) expect(Array.from(q).every(Number.isNaN)).toBe(true);
  });

  test('never writes to either input', () => {
    const a = quat.create(0, 0, 0, 1);
    const b = quat.create(0, 1, 0, 0);
    quat.nlerp(quat.create(), a, b, 0.5);
    expectComponents(a, 0, 0, 0, 1);
    expectComponents(b, 0, 1, 0, 0);
  });

  test('out may be a or b', () => {
    const a = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    const b = yaw(2);
    const expected = Array.from(quat.nlerp(quat.create(), a, b, 0.3));

    const intoA = quat.clone(a);
    quat.nlerp(intoA, intoA, b, 0.3);
    expect(Array.from(intoA)).toEqual(expected);

    const intoB = quat.clone(b);
    quat.nlerp(intoB, a, intoB, 0.3);
    expect(Array.from(intoB)).toEqual(expected);
  });

  test('out may overlap either input', () => {
    const other = quat.fromEuler(quat.create(), 0.3, -1.1, 0.7);
    for (let outOffset = 0; outOffset < 4; outOffset++) {
      for (let inputOffset = 0; inputOffset < 4; inputOffset++) {
        if (outOffset === inputOffset) continue;

        for (const inputIsA of [true, false]) {
          const buffer = sequentialBuffer(8);
          const input = viewAt(buffer, inputOffset);
          quat.normalize(input, input);
          const a = inputIsA ? input : other;
          const b = inputIsA ? other : input;
          const expected = quat.nlerp(quat.create(), quat.clone(a), quat.clone(b), 0.3);

          quat.nlerp(viewAt(buffer, outOffset), a, b, 0.3);

          expect(Array.from(viewAt(buffer, outOffset))).toEqual(Array.from(expected));
        }
      }
    }
  });

  test('writes only its own slots when out is a pooled view', () => {
    const pool = sequentialBuffer(8);
    quat.nlerp(viewAt(pool, 2), quat.IDENTITY, quat.IDENTITY, 0.5);

    expect(Array.from(new Float32Array(pool))).toEqual([1, 2, 0, 0, 0, 1, 7, 8]);
  });
});
