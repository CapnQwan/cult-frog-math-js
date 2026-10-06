import type { FixedElements } from './fixedElements.js';

export type FixedFloat32Array<
  N extends number,
  TBuffer extends ArrayBufferLike = ArrayBufferLike,
> = Float32Array<TBuffer> & { readonly length: N } & FixedElements<N>;
