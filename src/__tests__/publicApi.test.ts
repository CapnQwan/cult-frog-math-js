import { describe, expect, test } from 'vitest';

import * as colorEntry from '../colors/color/index.js';
import * as color32Entry from '../colors/color32/index.js';
import * as easingEntry from '../easing/index.js';
import * as root from '../index.js';
import * as mat2Entry from '../matrix/mat2/index.js';
import * as mat3Entry from '../matrix/mat3/index.js';
import * as mat4Entry from '../matrix/mat4/index.js';
import * as quatEntry from '../quaternion/index.js';
import * as vec2Entry from '../vector/vec2/index.js';
import * as vec3Entry from '../vector/vec3/index.js';
import * as vec4Entry from '../vector/vec4/index.js';

import pkg from '../../package.json' with { type: 'json' };

/**
 * Every per-type entry point, keyed by the namespace it exposes. The subpath is
 * the same name in lowercase, and `file` is the entry's path under `src/` (and
 * so under `dist/`) without its extension. These are what consumers import, so
 * the tests go through them rather than the internal function modules the rest
 * of the suite uses.
 */
const entries: [name: string, entry: Record<string, unknown>, file: string][] = [
  ['Vec2', vec2Entry, 'vector/vec2/index'],
  ['Vec3', vec3Entry, 'vector/vec3/index'],
  ['Vec4', vec4Entry, 'vector/vec4/index'],
  ['Mat2', mat2Entry, 'matrix/mat2/index'],
  ['Mat3', mat3Entry, 'matrix/mat3/index'],
  ['Mat4', mat4Entry, 'matrix/mat4/index'],
  ['Quat', quatEntry, 'quaternion/index'],
  ['Color', colorEntry, 'colors/color/index'],
];

describe('per-type entry points', () => {
  test.each(entries)('%s exports only its namespace at runtime', (name, entry) => {
    expect(Object.keys(entry)).toEqual([name]);
  });

  test.each(entries)('%s namespace exposes the core functions', (name, entry) => {
    const namespace = entry[name] as Record<string, unknown>;
    for (const fn of ['create', 'clone', 'set', 'copy']) {
      expect(namespace[fn], `${name}.${fn}`).toBeTypeOf('function');
    }
  });

  test.each(entries)('the root exports the same %s namespace object', (name, entry) => {
    expect((root as Record<string, unknown>)[name]).toBe(entry[name]);
  });
});

// Color32 is a packed number, so it has no `clone`, `set` or `copy` and sits
// outside `entries`.
describe('color32 entry point', () => {
  test('exports only its namespace at runtime', () => {
    expect(Object.keys(color32Entry)).toEqual(['Color32']);
  });

  test('namespace exposes create and the channel getters', () => {
    for (const fn of ['create', 'red', 'green', 'blue', 'alpha']) {
      expect(color32Entry.Color32[fn as keyof typeof color32Entry.Color32], fn).toBeTypeOf(
        'function'
      );
    }
  });

  test('the root exports the same Color32 namespace object', () => {
    expect(root.Color32).toBe(color32Entry.Color32);
  });
});

describe('easing entry point', () => {
  test('exports only its namespace at runtime', () => {
    expect(Object.keys(easingEntry)).toEqual(['Easing']);
  });

  test('namespace exposes every curve family', () => {
    const { Cubic, Quad, Quart, Quint, Smooth } = easingEntry.Easing;
    for (const family of [Quad, Cubic, Quart, Quint]) {
      expect(family.easeIn).toBeTypeOf('function');
      expect(family.easeOut).toBeTypeOf('function');
      expect(family.easeInOut).toBeTypeOf('function');
    }
    expect(Smooth.smoothstep).toBeTypeOf('function');
    expect(Smooth.smootherstep).toBeTypeOf('function');
  });

  test('the root exports the same Easing namespace object', () => {
    expect(root.Easing).toBe(easingEntry.Easing);
  });
});

describe('package.json exports', () => {
  const exportsMap = pkg.exports as Record<string, unknown>;

  test('./easing points at its entry file', () => {
    expect(exportsMap['./easing']).toEqual({
      types: './dist/easing/index.d.ts',
      default: './dist/easing/index.js',
    });
  });

  test('./color32 points at its entry file', () => {
    expect(exportsMap['./color32']).toEqual({
      types: './dist/colors/color32/index.d.ts',
      default: './dist/colors/color32/index.js',
    });
  });

  test.each(entries)('./%s points at its entry file', (name, _entry, file) => {
    expect(exportsMap[`./${name.toLowerCase()}`]).toEqual({
      types: `./dist/${file}.d.ts`,
      default: `./dist/${file}.js`,
    });
  });

  test.each([
    './vector',
    './vectors',
    './matrix',
    './matrices',
    './quaternion',
    './quaternions',
    './colors',
  ])('has no per-family subpath %s', (subpath) => {
    expect(Object.keys(exportsMap)).not.toContain(subpath);
  });
});
