/**
 * Vector and matrix math for Cult Frog Studios.
 *
 * Every type in this package is a `Float32Array` with a fixed length. Functions
 * are free functions grouped by module and are meant to be imported as a
 * namespace:
 *
 * ```ts
 * import { vec3 } from '@cult-frog/math/vec3';
 *
 * const velocity = vec3.create(0, -9.81, 0);
 * vec3.copy(scratch, transform.getPosition(e));
 * ```
 *
 * ## Conventions
 *
 * **Output first.** Any function that produces a vector or matrix writes the
 * result into its first parameter, `out`, and returns `out`. This lets calls be
 * nested without allocating.
 *
 * **Inputs are read-only.** Every other vector or matrix parameter uses the
 * `Readonly*` type and is never written to. Mutable values can be passed
 * anywhere a readonly one is accepted. A readonly value can never be passed as
 * `out`.
 *
 * **Aliasing is allowed.** `out` may be the same object as any input, or a
 * different view that overlaps the same memory. `vec3.cross(a, a, b)` is valid
 * and gives the same result as writing to a separate vector. Functions read all
 * inputs into locals before writing anything, and new functions must do the same.
 *
 * **Only `create` and `clone` allocate.** Everything else works on memory the
 * caller already owns. Use `clone` to take a standalone copy of a view.
 *
 * @packageDocumentation
 */

export * from './vector/index.js';
