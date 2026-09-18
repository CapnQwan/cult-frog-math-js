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
 * **Everything is a `Float32Array`.** Values can be uploaded to the GPU as-is,
 * and can be views into larger pooled buffers (e.g. component storage) instead
 * of individual allocations. The cost is precision: about 7 significant digits,
 * so values are rounded on write and large world coordinates lose accuracy.
 *
 * **Layouts match the GPU.** Every value here is laid out so it can be handed
 * to WebGPU or WebGL verbatim: no transposing, no reordering, no per-frame
 * conversion pass. Matrices are **column major** — a `Mat4` is 16 contiguous
 * floats, column 0 first, which puts the translation column at indices 12, 13
 * and 14, exactly where `mat4x4<f32>` and `uniformMatrix4fv` expect it. `Vec4`
 * and `Quat` are **`[x, y, z, w]`**, so a quaternion is byte-identical to a
 * `vec4<f32>`, and the two share a layout with the rest of the ecosystem
 * (gl-matrix, three.js, glTF).
 *
 * The one value that isn't a straight `writeBuffer` / `bufferSubData` is
 * `Mat3`: it's stored tightly packed as 9 floats, while WGSL's `mat3x3<f32>`
 * and std140 pad every column out to 16 bytes. Upload a `Mat3` column by
 * column, or promote it to a `Mat4`.
 *
 * **Matrices read as rows and store as columns.** `create` and `set` take
 * their arguments in row-major order — `a01` is row 0, column 1 — so a matrix
 * spelled out in source looks the way it does on paper, and the function
 * transposes on the way into memory. Element subscripts are always
 * `a<row><col>`; raw indices are always column major.
 *
 * **Y is up.** Direction constants such as `vec2.UP` assume a y-up coordinate
 * system. In screen or canvas space, where y grows downward, `UP` points down
 * the screen.
 *
 * **Types are branded.** A plain `Float32Array` won't type-check as a `Vec3`.
 * Use `create` for new values, or cast when wrapping existing memory such as a
 * pooled view.
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

export * from './constants.js';
export * from './matrix/index.js';
export * from './quaternion/index.js';
export * from './scalars.js';
export * from './vector/index.js';
