import { describe, expect, test } from 'vitest';

import * as easingEntry from '../easing/index.js';
import * as root from '../index.js';
import * as mat2Entry from '../mat2.js';
import * as mat3Entry from '../mat3.js';
import * as mat4Entry from '../mat4.js';
import * as quatEntry from '../quat.js';
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
  ['Mat2', mat2Entry, 'mat2'],
  ['Mat3', mat3Entry, 'mat3'],
  ['Mat4', mat4Entry, 'mat4'],
  ['Quat', quatEntry, 'quat'],
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

  test.each(entries)('./%s points at its entry file', (name, _entry, file) => {
    expect(exportsMap[`./${name.toLowerCase()}`]).toEqual({
      types: `./dist/${file}.d.ts`,
      default: `./dist/${file}.js`,
    });
  });

  test.each(['./vector', './vectors', './matrix', './matrices', './quaternion', './quaternions'])(
    'has no per-family subpath %s',
    (subpath) => {
      expect(Object.keys(exportsMap)).not.toContain(subpath);
    }
  );
});
