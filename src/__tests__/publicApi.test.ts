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
 * Every per-type entry point, keyed by the namespace (and subpath) it exposes.
 * These are what consumers import, so the tests go through them rather than the
 * internal function modules the rest of the suite uses.
 */
const entries: [name: string, entry: Record<string, unknown>][] = [
  ['vec2', vec2Entry],
  ['vec3', vec3Entry],
  ['vec4', vec4Entry],
  ['mat2', mat2Entry],
  ['mat3', mat3Entry],
  ['mat4', mat4Entry],
  ['quat', quatEntry],
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
    expect(exportsMap[`./${name}`]).toEqual({
      types: `./dist/${name}.d.ts`,
      default: `./dist/${name}.js`,
    });
  });

  test('has no per-family subpaths', () => {
    expect(Object.keys(exportsMap)).not.toContain('./vector');
    expect(Object.keys(exportsMap)).not.toContain('./matrix');
    expect(Object.keys(exportsMap)).not.toContain('./quaternion');
  });
});
