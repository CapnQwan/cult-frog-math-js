// src/quaternion/__tests__/quat.test.ts
import { describe, expect, test } from 'vitest';

import * as vec4 from '../../vector/vec4.js';
import * as quat from '../quat.js';

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
  test('defaults every component to zero, like the rest of the package', () => {
    // A zero quaternion is not a rotation and cannot be normalised, so
    // `clone(IDENTITY)` is the way to get a usable starting value.
    expectComponents(quat.create(), 0, 0, 0, 0);
  });

  test('stores provided components in x, y, z, w order with the scalar last', () => {
    expectComponents(quat.create(1, 2, 3, 4), 1, 2, 3, 4);
  });

  test('defaults only the omitted components', () => {
    expectComponents(quat.create(1, 2), 1, 2, 0, 0);
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
