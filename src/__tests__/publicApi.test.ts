import { describe, expect, test } from 'vitest';

import * as root from '../index.js';
import * as mat2Entry from '../mat2.js';
import * as mat3Entry from '../mat3.js';
import * as mat4Entry from '../mat4.js';
import * as quatEntry from '../quat.js';
import * as vec2Entry from '../vec2.js';
import * as vec3Entry from '../vec3.js';
import * as vec4Entry from '../vec4.js';

import pkg from '../../package.json' with { type: 'json' };

/**
 * Every per-type entry point, keyed by the namespace it exposes. The subpath is
 * the same name in lowercase. These are what consumers import, so the tests go
 * through them rather than the internal function modules the rest of the suite
 * uses.
 */
const entries: [name: string, entry: Record<string, unknown>][] = [
  ['Vec2', vec2Entry],
  ['Vec3', vec3Entry],
  ['Vec4', vec4Entry],
  ['Mat2', mat2Entry],
  ['Mat3', mat3Entry],
  ['Mat4', mat4Entry],
  ['Quat', quatEntry],
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

describe('package.json exports', () => {
  const exportsMap = pkg.exports as Record<string, unknown>;

  test.each(entries)('./%s points at its entry file', (name) => {
    const subpath = name.toLowerCase();
    expect(exportsMap[`./${subpath}`]).toEqual({
      types: `./dist/${subpath}.d.ts`,
      default: `./dist/${subpath}.js`,
    });
  });

  test('has no per-family subpaths', () => {
    expect(Object.keys(exportsMap)).not.toContain('./vector');
    expect(Object.keys(exportsMap)).not.toContain('./matrix');
    expect(Object.keys(exportsMap)).not.toContain('./quaternion');
  });
});
