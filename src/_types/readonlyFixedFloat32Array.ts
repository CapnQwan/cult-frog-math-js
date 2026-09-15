import type { FixedElements } from './fixedElements.js';
import type { Float32WriteSurface } from './float32WriteSurface.js';

export type ReadonlyFixedFloat32Array<N extends number> = Omit<
  Float32Array<ArrayBuffer>,
  Float32WriteSurface | number
> & { readonly length: N; readonly [index: number]: number } & {
  readonly [K in keyof FixedElements<N>]: number;
};
