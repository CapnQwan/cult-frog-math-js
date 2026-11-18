# @cult-frog/math

Vectors, matrices, quaternions and colours for games, built to go straight to the GPU.

Every vector, matrix, quaternion and linear colour is a `Float32Array` laid out the way WebGPU and WebGL expect, so it can be uploaded without conversion and can live as a view inside a larger pooled buffer. Functions write into an `out` parameter you own instead of allocating, so a frame loop can run without producing garbage.

```ts
import { Mat4, Quat, Vec3 } from '@cult-frog/math';

// Allocate once, up front.
const position = Vec3.create(0, 1, 5);
const velocity = Vec3.create(0, 0, -2);
const rotation = Quat.create();
const world = Mat4.create();

// Then update in place every frame, allocating nothing.
function update(dt: number): void {
  Vec3.scaleAndAdd(position, position, velocity, dt);
  Quat.rotateY(rotation, rotation, dt);
  Mat4.fromTRS(world, position, rotation, Vec3.ONE);
}
```

## Features

- **GPU-ready layouts:** column-major matrices and `[x, y, z, w]` quaternions, matching `mat4x4<f32>`, `vec4<f32>`, gl-matrix, three.js and glTF.
- **No allocation in the hot path:** only `create` and `clone` allocate. Everything else writes into memory the caller already owns.
- **Aliasing is safe:** `out` may be the same object as any input, or a view overlapping it, so `Vec3.cross(a, a, b)` just works.
- **Type-safe:** every type is branded, so a `Vec3` can't be passed where a `Vec4` or a `Quat` is expected, and `Readonly*` types can't be passed as `out`.
- **Pooled and shared memory:** values can be views over any `ArrayBuffer` or `SharedArrayBuffer`.
- **Documented edge cases:** zero vectors, singular matrices, `NaN`, infinities and precision limits are handled deliberately, and every function's TSDoc says how.
- **Tree-shakeable:** ES modules with no side effects, plus a subpath export per type.

## Installation

```sh
pnpm add @cult-frog/math
```

```sh
npm install @cult-frog/math
```

### Requirements

- Node.js 20.19 or later, or any modern bundler.
- The package is published as ES modules only, with bundled type declarations.

## Quick start

### Importing

Each type is a namespace of functions with the same name as the type, so one import gives you both:

```ts
import { Vec3 } from '@cult-frog/math';

const up: Vec3 = Vec3.create(0, 1, 0);
```

The package root exports everything. Each type also has its own subpath, which exports the namespace and its types:

```ts
import { Vec3 } from '@cult-frog/math/vec3';
import { Mat4 } from '@cult-frog/math/mat4';
```

The subpaths are `vec2`, `vec3`, `vec4`, `mat2`, `mat3`, `mat3x2`, `mat4`, `quat`, `color`, `color32` and `easing`. The scalar helpers and constants are exported from the root only.

### A camera

```ts
import { Mat4, Vec3 } from '@cult-frog/math';

const eye = Vec3.create(0, 2, 6);
const target = Vec3.create(0, 0, 0);

const view = Mat4.create();
const projection = Mat4.create();
const viewProjection = Mat4.create();

// `lookAt` returns null for a degenerate camera and leaves `view` untouched.
if (Mat4.lookAt(view, eye, target, Vec3.UP)) {
  // `ZO` is the 0-to-1 depth range of WebGPU. Use `perspectiveNO` for WebGL.
  Mat4.perspectiveZO(projection, Math.PI / 3, width / height, 0.1, Infinity);
  Mat4.multiply(viewProjection, projection, view);

  device.queue.writeBuffer(cameraBuffer, 0, viewProjection);
}
```

### Views into pooled storage

A value doesn't have to own its memory. Any three floats in a `Float32Array` can be a `Vec3`, so component storage can be one buffer with no per-entity allocation:

```ts
import { Vec3 } from '@cult-frog/math';

const positions = new Float32Array(1024 * Vec3.SIZE);

// A view: writes through it land in `positions`.
const p = positions.subarray(i * Vec3.SIZE, (i + 1) * Vec3.SIZE) as Vec3;
Vec3.add(p, p, offset);

// A copy: reads entity `i` into a scratch vector without making a view.
const scratch = Vec3.create();
Vec3.fromPacked(scratch, positions, i);
```

Use `clone` to take a standalone copy of a view, one that won't change when the pool is written to.

## Conventions

These hold across the whole package. The TSDoc on each function covers the details and the exceptions.

**Output first.** Every function that produces a vector, matrix, quaternion or `Color` writes it into its first parameter, `out`, and returns `out`, so calls can be nested. The exceptions return a different kind of value instead: `determinant`, `dot` and `angle` return numbers, `Quat.toAxisAngle` returns the angle, and `Mat4.decompose` returns whether it succeeded.

**Inputs are read-only.** Every other array parameter takes the `Readonly*` type and is never written to. A mutable value can go anywhere a readonly one is accepted, but a readonly one can never be passed as `out`. Constants such as `Vec3.UP` and `Mat4.IDENTITY` are readonly at the type level only: never cast them to a mutable type, and `clone` them for a copy.

**Aliasing is allowed.** `out` may be any input, or a view that overlaps one. Every function reads its inputs into locals before writing anything.

**Some functions can fail.** `invert`, `Mat3.normalFromMat4` and `Mat4.lookAt` return `null`, and `Mat4.decompose` returns `false`, when there is no answer, such as a matrix with a zero determinant. They leave `out` untouched, so check the result before using it.

**Values are float32.** About 7 significant digits survive, so values are rounded as they are stored, and world coordinates far from the origin lose precision. Compare computed results with `isEqualEpsilon` rather than `isEqual`.

**Matrices read as rows and store as columns.** `create` and `set` take their elements in row-major order, so a matrix spelled out in source reads the way it does on paper, and they transpose it on the way into memory. Element names are always `a<row><col>`; raw indices are always column major, which puts a `Mat4`'s translation at indices 12, 13 and 14.

**Vectors are columns.** `multiply(out, a, b)` is the product `a * b`, which applies `b` first and then `a`. A model-view-projection matrix is `projection * view * model`. Quaternions compose in the same order.

**Y is up, and 3D is right-handed.** `Vec3.FORWARD` is negative z and `Vec3.RIGHT` is positive x. Positive angles turn counter-clockwise by the right-hand rule. In y-down screen space, `Vec2.UP` points down the screen and 2D rotations look clockwise.

**Padded GPU layouts need care.** Tightly packed values copy verbatim into most GPU layouts, but not all. WGSL's `mat3x3<f32>` and std140 uniform blocks pad every matrix column to 16 bytes, so a 9-float `Mat3` needs uploading column by column, or promoting to a `Mat4`. Each matrix type's TSDoc says what its layout needs.

**`Color` is linear, `Color32` is sRGB.** `Color` holds four float32 channels proportional to light, for blending, lighting and shader uniforms. `Color32` packs an 8-bit sRGB colour into one number as `0xRRGGBBAA`, as CSS hex, colour pickers and PNGs store it. Convert between them with `Color.fromColor32` and `Color32.fromColor`, which apply the sRGB transfer function. Neither is premultiplied.

**Shared memory is not synchronised.** Views over a `SharedArrayBuffer` work like any other, but nothing here is atomic. Coordinate access across threads yourself, for example with frame phases or double buffering.

## API

Every namespace has `create`, `clone`, `set`, `copy`, `isEqual`, `isEqualEpsilon`, `fromPacked` and a `SIZE` constant, except `Color32`, which is a number rather than an array (see [Color32](#color32)).

| Function | Description |
| --- | --- |
| `create(...)` | Allocates a new value. Vectors default to zero, matrices and quaternions to the identity, and colours to opaque black. |
| `clone(a)` | Allocates a copy with its own buffer. |
| `set(out, ...)` | Writes every element or component, in row-major order for matrices. |
| `copy(out, a)` | Copies `a` into `out`. |
| `isEqual(a, b)` | Exact equality, element by element. |
| `isEqualEpsilon(a, b, eps?)` | Equality within a tolerance that widens with magnitude. |
| `fromPacked(out, packed, index)` | Copies value `index` of a tightly packed `Float32Array` into `out`. Bounds aren't checked. |
| `SIZE` | The number of elements: `3` for a `Vec3`, `16` for a `Mat4`. |

### Vectors: `Vec2`, `Vec3`, `Vec4`

| Function | Description |
| --- | --- |
| `add`, `sub`, `mul`, `div` | Per-component arithmetic. Division follows float rules, so a zero divisor gives `Infinity` or `NaN`. |
| `scale(out, a, s)` | Multiplies every component by `s`. |
| `scaleAndAdd(out, a, b, s)` | `a + b * s`, such as `position + velocity * dt`. |
| `negate`, `abs`, `floor`, `ceil`, `round` | Per-component. `round` rounds halves toward positive infinity. |
| `min`, `max` | Per-component minimum or maximum of two vectors. |
| `magnitude`, `magnitudeSq` | Length and squared length. |
| `distance`, `distanceSq` | Distance and squared distance between two points. |
| `normalize(out, a)` | Scales to unit length. A zero vector stays zero. |
| `dot(a, b)` | Dot product. |
| `cross(out, a, b)` | Cross product, by the right-hand rule. `Vec3` only. |
| `lerp(out, a, b, t)` | Linear interpolation. `t` isn't clamped. |
| `reflect(out, a, normal)` | Reflects `a` off a surface. `normal` must be unit length. |
| `angle(a, b)` | Angle between two vectors in radians, `0` to `π`, accurate near `0` and `π`. |
| `isEqualXY`, `isEqualXYZ`, `isEqualXYZW` | Compares against loose components, rounded to float32 first. |
| `ZERO`, `ONE` | Constant vectors. |
| `UP`, `DOWN`, `LEFT`, `RIGHT` | Direction constants. `Vec2` and `Vec3` only. |
| `FORWARD`, `BACK` | Negative and positive z. `Vec3` only. |

Transforms write the product `m * v`:

| Function | Description |
| --- | --- |
| `Vec2.transformMat2` | By a 2x2 matrix. |
| `Vec2.transformMat3x2` | As a point, so the translation applies. |
| `Vec2.transformDirectionMat3x2` | As a direction, ignoring the translation. |
| `Vec3.transformMat3` | By a 3x3 matrix. |
| `Vec3.transformMat4` | As a point, then divides by the resulting `w`, so it also handles projections. |
| `Vec3.transformDirectionMat4` | As a direction, using only the upper-left 3x3. |
| `Vec3.transformQuat` | Rotates by a unit quaternion. |
| `Vec4.transformMat4` | With the given `w` and no divide, so a projected point stays in clip space. |

None of them is correct for surface normals under a non-uniform scale. Transform those by `Mat3.normalFromMat4`.

### Matrices: `Mat2`, `Mat3`, `Mat3x2`, `Mat4`

`Mat3x2` is a 2D affine transform: three columns of two rows, the layout of WGSL's `mat3x2<f32>`. Its bottom row is always `0 0 1` and isn't stored, so it can translate, rotate, scale and shear, but not project.

| Function | Description |
| --- | --- |
| `identity(out)` | Resets `out` to the identity. |
| `IDENTITY` | The identity matrix. |
| `multiply(out, a, b)` | The product `a * b`, applying `b` first. |
| `transpose(out, a)` | Swaps rows and columns. Not on `Mat3x2`. |
| `determinant(a)` | Area or volume scale; negative when the matrix mirrors. |
| `invert(out, a)` | The inverse, or `null` when the determinant is exactly zero or `NaN`. |

Builders overwrite every element of `out` with a new transform. Combine transforms with `multiply`.

| Function | Description |
| --- | --- |
| `Mat2.fromRotation`, `Mat2.fromScale` | 2D rotation or scale. |
| `Mat3x2.fromTranslation`, `fromRotation`, `fromScale` | 2D translation, rotation or scale. |
| `Mat3x2.fromTRS(out, t, angle, s)` | Scale, then rotate, then translate, in one pass. |
| `Mat3.fromQuat(out, q)` | Rotation matrix from a unit quaternion. |
| `Mat3.fromMat4(out, m)` | The upper-left 3x3 of a `Mat4`, dropping its translation. |
| `Mat3.normalFromMat4(out, m)` | The normal matrix, the inverse-transpose of the upper-left 3x3. Returns `null` when that is singular. |
| `Mat4.fromTranslation`, `fromScale` | 3D translation or scale. |
| `Mat4.fromQuat(out, q)` | Rotation from a unit quaternion. |
| `Mat4.fromAxisAngle(out, axis, angle)` | Rotation about a unit axis. |
| `Mat4.fromTRS(out, t, r, s)` | Scale, then rotate, then translate, in one pass. |
| `Mat4.decompose(outT, outR, outS, m)` | Splits an affine transform back into translation, rotation and scale. Returns `false` when the 3x3 is singular. |

Camera matrices are right-handed, with the camera looking down negative z. The projections come in two depth ranges, named by suffix: `NO` runs from `-1` to `1`, for WebGL, and `ZO` from `0` to `1`, for WebGPU, Vulkan, Metal and Direct3D.

| Function | Description |
| --- | --- |
| `Mat4.lookAt(out, eye, center, up)` | View matrix, or `null` when `eye` equals `center` or `up` is parallel to the view direction. |
| `Mat4.perspectiveNO`, `perspectiveZO` | Perspective projection from a vertical field of view. `far` may be `Infinity`. |
| `Mat4.orthographicNO`, `orthographicZO` | Orthographic projection of a view-space box. `far` must be finite. |

### Quaternions: `Quat`

Stored as `[x, y, z, w]`. Rotations must be unit length; nothing enforces it, so renormalise after long chains of `multiply`.

| Function | Description |
| --- | --- |
| `identity(out)`, `IDENTITY` | The rotation that changes nothing. |
| `multiply(out, a, b)` | Composes rotations, applying `b` first. |
| `rotateX`, `rotateY`, `rotateZ` | Turns a rotation about its own axis. |
| `conjugate(out, a)` | The inverse of a unit quaternion. |
| `invert(out, a)` | The inverse of any non-zero quaternion. |
| `normalize(out, a)` | Scales to unit length. The zero quaternion becomes the identity. |
| `magnitude`, `magnitudeSq`, `dot` | Length, squared length and 4D dot product. |
| `angle(a, b)` | Angle between two rotations in radians, `0` to `π`, treating `q` and `-q` as the same. |
| `slerp(out, a, b, t)` | Constant-speed interpolation along the shorter arc. |
| `nlerp(out, a, b, t)` | Cheaper interpolation along the same arc, slower near the ends. |
| `fromAxisAngle(out, axis, angle)` | Rotation about a unit axis. |
| `toAxisAngle(outAxis, q)` | Writes the unit axis and returns the angle, `0` to `π`. |
| `fromEuler(out, x, y, z)` | Pitch, yaw and roll in radians, in Y-X-Z order. |
| `fromUnitVectors(out, from, to)` | The shortest rotation that turns one unit direction into another. |
| `fromMat3(out, m)` | The rotation held in a rotation matrix. |
| `isEqualXYZW(a, x, y, z, w)` | Compares against loose components. |
| `isEqualRotation(a, b, tolerance?)` | Compares rotations rather than components, so `q` and `-q` are equal. |

`q` and `-q` are the same rotation, but `isEqual` and `isEqualEpsilon` compare components and treat them as different. `slerp`, `nlerp` and `fromMat3` can return either sign, so compare their results with `isEqualRotation`.

### Colours: `Color`

Four linear float32 channels, `[r, g, b, a]`, nominally `0` to `1`. Nothing clamps, so values above `1` are valid HDR channels.

| Function | Description |
| --- | --- |
| `lerp(out, a, b, t)` | Linear interpolation. `t` isn't clamped. |
| `isEqualRGB`, `isEqualRGBA` | Compares against loose channels. `isEqualRGB` ignores alpha. |
| `fromColor32(out, color32)` | Decodes a `Color32` with the sRGB transfer function. |
| `WHITE`, `BLACK`, `RED`, `GREEN`, `BLUE`, `YELLOW`, `CYAN`, `MAGENTA`, `TRANSPARENT` | Named colours. |

### Color32

An sRGB colour packed into one unsigned number as `0xRRGGBBAA`. It is immutable and compares with `===`, so its functions return a new value rather than writing to `out`, and none of them allocate.

| Function | Description |
| --- | --- |
| `create(r, g, b, alpha?)` | Packs channels from `0` to `255`. Alpha defaults to `255`. |
| `red`, `green`, `blue`, `alpha` | Reads one channel. |
| `lerp(from, to, t)` | Blends the encoded channels and clamps them to `0` to `255`. |
| `fromColor(color)` | Encodes a linear `Color`, clipping channels to `0` to `1` first. |
| `WHITE`, `BLACK`, ... | The same named colours as `Color`. |

```ts
import { Color, Color32 } from '@cult-frog/math';

const orange = Color32.create(255, 136, 0); // 0xff8800ff
const tint = Color.fromColor32(Color.create(), orange); // linear, ready for a shader
```

### Scalars and interpolation

| Function | Description |
| --- | --- |
| `clamp(value, min, max)` | Limits `value` to `[min, max]`. |
| `saturate(value)` | Clamps to `[0, 1]`. |
| `round(value, decimals?)` | Rounds to a number of decimal places. |
| `wrap(value, min, max)` | Wraps into `[min, max)`, such as an angle or an array index. |
| `snapToZero(value)` | Returns `0` for values within `EPSILON` of zero. |
| `isEqualEpsilon(a, b, eps?)` | Approximate equality, with a tolerance that widens with magnitude. |
| `lerp(a, b, t)` | Linear interpolation. `t` isn't clamped. |
| `invLerp(min, max, v)` | Where `v` sits between `min` and `max`, clamped to `[0, 1]`. |
| `smoothstep(min, max, v)`, `smootherstep(min, max, v)` | A smooth `0` to `1` ramp between `min` and `max`. |

Note the argument order: the interpolation helpers take the range first and the value last, unlike `clamp`.

The constants are `EPSILON` (`1e-6`), `EPSILON_SQUARED`, `PI` and `TWO_PI`.

### Easing: `Easing`

Easing curves map a `t` from `0` to `1` onto a shaped `0` to `1`. None of them clamp `t`.

| Curve | Functions |
| --- | --- |
| `Easing.Quad`, `Easing.Cubic`, `Easing.Quart`, `Easing.Quint` | `easeIn`, `easeOut`, `easeInOut` |
| `Easing.Smooth` | `smoothstep`, `smootherstep` |

```ts
import { Easing, lerp } from '@cult-frog/math';

const height = lerp(start, end, Easing.Cubic.easeOut(t));
```

## License

[MIT](./LICENSE)
