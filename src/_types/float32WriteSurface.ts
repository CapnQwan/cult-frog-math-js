/**
 * Members that mutate the backing memory, or return a writable alias of it.
 * `subarray` is included because it gives the caller a mutable Float32Array
 * over the same bytes in one call.
 *
 * `buffer` stays visible on purpose: without it a value no longer counts as an
 * `ArrayBufferView`, so readonly values can't be passed to GPU uploads. Writing
 * through it takes a deliberate `new Float32Array(v.buffer, ...)`, which is no
 * easier to do by accident than a cast.
 */
export type Float32WriteSurface = 'set' | 'fill' | 'copyWithin' | 'reverse' | 'sort' | 'subarray';
