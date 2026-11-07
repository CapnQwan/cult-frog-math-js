/**
 * Vector, matrix, quaternion and colour math for Cult Frog Studios.
 *
 * Functions are free functions grouped into one PascalCase namespace per type
 * (`Vec3`, `Mat4`, `Quat`, ...), and each namespace shares its name with its
 * type. Each type has its own lowercase subpath exporting that name plus its
 * readonly variant where it has one, and the package root exports all of them
 * under the same names:
 *
 * ```ts
 * import { Vec3 } from '@cult-frog/math/vec3';
 *
 * const velocity: Vec3 = Vec3.create(0, -9.81, 0);
 * Vec3.copy(scratch, transform.getPosition(e));
 * ```
 *
 * ## Conventions
 *
 * **Vectors, matrices, quaternions and `Color` are `Float32Array`s** with a
 * fixed length. Values can be uploaded to the GPU as-is,
 * and can be views into larger pooled buffers (e.g. component storage) instead
 * of individual allocations. Any backing buffer works, `ArrayBuffer` or
 * `SharedArrayBuffer`, so that storage can be shared with workers. The cost is
 * precision: about 7 significant digits, so values are rounded on write and
 * large world coordinates lose accuracy.
 *
 * **`Color32` is the exception.** It packs an 8-bit RGBA colour into one
 * plain number as `0xRRGGBBAA`, so it is immutable, compares with `===`, and
 * its functions return a new value instead of writing to `out`. Nothing in
 * `Color32` allocates. Its packing follows CSS hex, not a GPU byte layout.
 *
 * **`Color` is linear; `Color32` is sRGB-encoded.** `Color` channels are
 * proportional to light, so blending and lighting maths on them are
 * physically meaningful, and they are what a linear shader expects in a
 * uniform. `Color32` holds values as CSS hex, colour pickers and PNGs store
 * them. Moving between the two needs the sRGB transfer function, not just a
 * division by `255`. Neither is premultiplied.
 *
 * **Shared memory is not synchronised.** Views over a `SharedArrayBuffer`
 * type-check and behave like any other, but no function here is atomic: a
 * vector being written on one thread can be read half-updated on another, and
 * `Atomics` doesn't operate on `Float32Array`. Coordinate at a higher level,
 * e.g. frame phases, double buffering, or a lock in an `Int32Array` alongside
 * the data.
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
 * **Y is up.** Direction constants such as `Vec2.UP` assume a y-up coordinate
 * system. In screen or canvas space, where y grows downward, `UP` points down
 * the screen. In 3D the axes are right-handed, with `Vec3.FORWARD` along negative
 * z, so `Vec3.cross(out, Vec3.RIGHT, Vec3.UP)` gives `Vec3.BACK`.
 *
 * **Types are branded.** A plain `Float32Array` won't type-check as a `Vec3`.
 * Use `create` for new values, or cast when wrapping existing memory such as a
 * pooled view.
 *
 * **Output first.** Any function that produces an array value (a vector,
 * matrix, quaternion or `Color`) writes the result into its first parameter,
 * `out`, and returns `out`. This lets calls be nested without allocating.
 *
 * **Inputs are read-only.** Every other vector or matrix parameter uses the
 * `Readonly*` type and is never written to. Mutable values can be passed
 * anywhere a readonly one is accepted. A readonly value can never be passed as
 * `out`.
 *
 * **Aliasing is allowed.** `out` may be the same object as any input, or a
 * different view that overlaps the same memory. `Vec3.cross(a, a, b)` is valid
 * and gives the same result as writing to a separate vector. Functions read all
 * inputs into locals before writing anything, and new functions must do the same.
 *
 * **Only `create` and `clone` allocate.** Everything else works on memory the
 * caller already owns. Use `clone` to take a standalone copy of a view.
 *
 * @packageDocumentation
 */

export * from './colors/index.js';
export * from './constants.js';
export * from './easing/index.js';
export * from './interpolation.js';
export * from './matrix/index.js';
export * from './quaternion/index.js';
export * from './scalars.js';
export * from './vector/index.js';
