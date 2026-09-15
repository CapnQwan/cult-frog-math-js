/** Builds [number, number, ...] of length N. Fine for N <= 16 (mat4). */
export type NumberTuple<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc
  : NumberTuple<N, [...Acc, number]>;
