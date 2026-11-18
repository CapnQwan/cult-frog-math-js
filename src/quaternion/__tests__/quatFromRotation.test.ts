// src/quaternion/__tests__/quatFromRotation.test.ts
import { describe, expect, test } from 'vitest';

import * as vec3 from '../../vector/vec3/vec3.js';
import * as quat from '../quat.js';
import { quatFromRotation } from '../quatFromRotation.js';

import type { ReadonlyQuat } from '../_types/quat.js';

type Rotation = readonly [number, number, number, number, number, number, number, number, number];

/** The rotation matrix of the unit quaternion `q`, as `r<row><col>` in row-major order, in float64. */
function rotationOf(q: ReadonlyQuat): Rotation {
  const x = q[0] as number;
  const y = q[1] as number;
  const z = q[2] as number;
  const w = q[3] as number;
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - w * z),
    2 * (x * z + w * y),
    2 * (x * y + w * z),
    1 - 2 * (x * x + z * z),
    2 * (y * z - w * x),
    2 * (x * z - w * y),
    2 * (y * z + w * x),
    1 - 2 * (x * x + y * y),
  ];
}

/** Converts `r`, nine elements in row-major order, into a fresh quaternion. */
function convert(r: readonly number[]) {
  const [r00, r01, r02, r10, r11, r12, r20, r21, r22] = r as Rotation;
  return quatFromRotation(quat.create(7, 7, 7, 7), r00, r01, r02, r10, r11, r12, r20, r21, r22);
}

function turn(x: number, y: number, z: number, angle: number) {
  return quat.fromAxisAngle(
    quat.create(),
    vec3.normalize(vec3.create(), vec3.create(x, y, z)),
    angle
  );
}

// biome-ignore format: visual alignment with the matrix
const HALF_TURN_X: Rotation = [
  1,  0,  0,
  0, -1,  0,
  0,  0, -1,
];
// biome-ignore format: visual alignment with the matrix
const HALF_TURN_Y: Rotation = [
  -1, 0,  0,
   0, 1,  0,
   0, 0, -1,
];
// biome-ignore format: visual alignment with the matrix
const HALF_TURN_Z: Rotation = [
  -1,  0, 0,
   0, -1, 0,
   0,  0, 1,
];

describe('quatFromRotation', () => {
  test('writes into out and returns it', () => {
    const out = quat.create(7, 7, 7, 7);
    expect(quatFromRotation(out, 1, 0, 0, 0, 1, 0, 0, 0, 1)).toBe(out);
  });

  test('the identity matrix gives exactly the identity', () => {
    expect(quat.isEqual(convert([1, 0, 0, 0, 1, 0, 0, 0, 1]), quat.IDENTITY)).toBe(true);
  });

  test('half turns about each axis give that axis exactly', () => {
    // Each has a trace of -1, so the largest component is x, y or z, not w.
    expect(quat.isEqualXYZW(convert(HALF_TURN_X), 1, 0, 0, 0)).toBe(true);
    expect(quat.isEqualXYZW(convert(HALF_TURN_Y), 0, 1, 0, 0)).toBe(true);
    expect(quat.isEqualXYZW(convert(HALF_TURN_Z), 0, 0, 1, 0)).toBe(true);
  });

  test('recovers every rotation, from no turn to a full one about several axes', () => {
    const axes = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 2, 3],
      [-2, 0.5, 1],
      [1, -1, -1],
    ] as const;
    for (const [x, y, z] of axes) {
      for (let angle = -2 * Math.PI; angle <= 2 * Math.PI; angle += 0.37) {
        const q = turn(x, y, z, angle);
        expect(quat.isEqualRotation(convert(rotationOf(q)), q, 1e-6)).toBe(true);
      }
    }
  });

  test('stays accurate within a hair of a half turn', () => {
    for (const offset of [1e-3, 1e-5, 1e-7]) {
      for (const [x, y, z] of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1],
      ] as const) {
        const q = turn(x, y, z, Math.PI - offset);
        expect(quat.isEqualRotation(convert(rotationOf(q)), q, 1e-6)).toBe(true);
      }
    }
  });

  test('the component it recovers first is positive, so the sign is fixed', () => {
    // Built from w < 0, the trace is positive, so w comes back positive.
    const negative = quat.create(0.1, 0.2, 0.3, -0.9);
    quat.normalize(negative, negative);
    const result = convert(rotationOf(negative));

    expect(result[3]).toBeGreaterThan(0);
    expect(quat.isEqualRotation(result, negative, 1e-6)).toBe(true);
  });

  test('normalises the result when the matrix has drifted from a rotation', () => {
    const q = turn(1, 2, 3, 2.2);
    const drifted = rotationOf(q).map((n) => n * 1.0001);

    expect(quat.magnitude(convert(drifted))).toBeCloseTo(1, 6);
  });

  test('a NaN element makes every component NaN', () => {
    for (let i = 0; i < 9; i++) {
      const r = [...rotationOf(turn(1, 2, 3, 0.7))];
      r[i] = Number.NaN;
      expect(Array.from(convert(r)).every(Number.isNaN)).toBe(true);
    }
  });
});
