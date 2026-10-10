# Changelog

All notable changes to this package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Vector types `Vec2`, `Vec3` and `Vec4`, with `ReadonlyVec2`, `ReadonlyVec3` and `ReadonlyVec4`, and the `vec2`, `vec3` and `vec4` namespaces with `create`, `clone`, `set` and `copy`.
- Direction constants: `ZERO`, `ONE`, `UP`, `DOWN`, `LEFT` and `RIGHT` on `vec2` and `vec3`, plus `FORWARD` and `BACK` on `vec3`.
- Matrix types `Mat2`, `Mat3` and `Mat4`, with their `Readonly*` variants, and the `mat2`, `mat3` and `mat4` namespaces with `create`, `clone`, `set`, `copy`, `identity` and an `IDENTITY` constant. Matrices are stored column major; `create` and `set` take their arguments in row-major order.
- Quaternion type `Quat` and `ReadonlyQuat`, and the `quat` namespace with `create`, `clone`, `set`, `copy`, `identity` and an `IDENTITY` constant. Quaternions are stored as `[x, y, z, w]`.
- Scalar helpers: `clamp`, `saturate`, `lerp`, `smoothstep`, `round`, `wrap`, `snapToZero` and `equalsEpsilon`.
- Constants: `EPSILON`, `EPSILON_SQUARED`, `PI` and `TWO_PI`.
- A subpath export per type (`@cult-frog/math/vec3`, `@cult-frog/math/mat4`, `@cult-frog/math/quat`, ...), each exporting its namespace and types. The package root exports all of them.
- All values are branded `Float32Array`s and can be views over either an `ArrayBuffer` or a `SharedArrayBuffer`.
