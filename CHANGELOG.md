# Changelog

All notable changes to this package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Vector types `Vec2`, `Vec3` and `Vec4`, with `ReadonlyVec2`, `ReadonlyVec3` and `ReadonlyVec4`, and the `Vec2`, `Vec3` and `Vec4` namespaces with `create`, `clone`, `set`, `copy`, `isEqual` and `isEqualEpsilon`, plus `isEqualXY`, `isEqualXYZ` and `isEqualXYZW` respectively to compare against loose components.
- Vector arithmetic on `Vec2`, `Vec3` and `Vec4`: `add`, `sub`, `mul`, `div` and `scale`. `mul` and `div` work per component, and `div` follows normal float rules, so a zero divisor gives `Infinity` or `NaN` rather than a guarded value.
- Vector measurement on `Vec2`, `Vec3` and `Vec4`: `magnitudeSq`, `magnitude`, `distanceSq`, `distance` and `normalize`. `normalize` turns a zero vector into a zero vector rather than `NaN`.
- Vector products: `dot` on `Vec2`, `Vec3` and `Vec4`, and `cross` on `Vec3`. `cross` follows the right-hand rule.
- Vector helpers on `Vec2`, `Vec3` and `Vec4`: `scaleAndAdd`, `negate`, `lerp`, `reflect` and `angle`. `scaleAndAdd` writes `a + b * scalar`, `lerp` is unclamped, like the scalar `lerp`, `reflect` expects a normal with a length of `1`, and `angle` returns radians and gives `0` for a zero vector.
- Packed reads on `Vec2`, `Vec3` and `Vec4`: `fromPacked` copies one row of a tightly packed array into `out` without making a view. The index is a row, not an element offset, and bounds aren't checked, so a component read from outside the array is written as `NaN`. Each namespace also gets a `SIZE` constant.
- Direction constants: `ZERO`, `ONE`, `UP`, `DOWN`, `LEFT` and `RIGHT` on `Vec2` and `Vec3`, plus `FORWARD` and `BACK` on `Vec3`. The 3D axes are y-up and right-handed, so `FORWARD` is negative z and `BACK` is positive z.
- Matrix types `Mat2`, `Mat3` and `Mat4`, with their `Readonly*` variants, and the `Mat2`, `Mat3` and `Mat4` namespaces with `create`, `clone`, `set`, `copy`, `identity`, `isEqual` and `isEqualEpsilon`, plus `IDENTITY` and `SIZE` constants. Matrices are stored column major; `create` and `set` take their arguments in row-major order.
- Quaternion type `Quat` and `ReadonlyQuat`, and the `Quat` namespace with `create`, `clone`, `set`, `copy`, `identity`, `isEqual`, `isEqualEpsilon` and `isEqualXYZW`, and an `IDENTITY` constant. Quaternions are stored as `[x, y, z, w]`, and equality compares components, so `q` and `-q` are not equal even though they represent the same rotation.
- Scalar helpers: `clamp`, `saturate`, `round`, `wrap`, `snapToZero` and `isEqualEpsilon`.
- Interpolation helpers: `lerp`, `invLerp`, `smoothstep` and `smootherstep`. `lerp` is unclamped, while the others clamp their result to `[0, 1]`.
- The `Easing` namespace, with `easeIn`, `easeOut` and `easeInOut` on `Easing.Quad`, `Easing.Cubic`, `Easing.Quart` and `Easing.Quint`, plus `smoothstep` and `smootherstep` on `Easing.Smooth`. Every curve takes a single `t` and does not clamp it. Available from the `@cult-frog/math/easing` subpath and the package root.
- Constants: `EPSILON`, `EPSILON_SQUARED`, `PI` and `TWO_PI`.
- A subpath export per type (`@cult-frog/math/vec3`, `@cult-frog/math/mat4`, `@cult-frog/math/quat`, ...), each exporting its namespace and types. The package root exports all of them.
- All values are branded `Float32Array`s and can be views over either an `ArrayBuffer` or a `SharedArrayBuffer`.
