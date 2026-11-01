# Changelog

All notable changes to this package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Vector types `Vec2`, `Vec3` and `Vec4`, with `ReadonlyVec2`, `ReadonlyVec3` and `ReadonlyVec4`, and the `Vec2`, `Vec3` and `Vec4` namespaces with `create`, `clone`, `set` and `copy`.
- Direction constants: `ZERO`, `ONE`, `UP`, `DOWN`, `LEFT` and `RIGHT` on `Vec2` and `Vec3`, plus `FORWARD` and `BACK` on `Vec3`.
- Matrix types `Mat2`, `Mat3` and `Mat4`, with their `Readonly*` variants, and the `Mat2`, `Mat3` and `Mat4` namespaces with `create`, `clone`, `set`, `copy`, `identity` and an `IDENTITY` constant. Matrices are stored column major; `create` and `set` take their arguments in row-major order.
- Quaternion type `Quat` and `ReadonlyQuat`, and the `Quat` namespace with `create`, `clone`, `set`, `copy`, `identity` and an `IDENTITY` constant. Quaternions are stored as `[x, y, z, w]`.
- Scalar helpers: `clamp`, `saturate`, `round`, `wrap`, `snapToZero` and `equalsEpsilon`.
- Interpolation helpers: `lerp` and `invLerp`. `lerp` is unclamped, while `invLerp` clamps its result to `[0, 1]`.
- Constants: `EPSILON`, `EPSILON_SQUARED`, `PI` and `TWO_PI`.
- A subpath export per type (`@cult-frog/math/vec3`, `@cult-frog/math/mat4`, `@cult-frog/math/quat`, ...), each exporting its namespace and types. The package root exports all of them.
- All values are branded `Float32Array`s and can be views over either an `ArrayBuffer` or a `SharedArrayBuffer`.
