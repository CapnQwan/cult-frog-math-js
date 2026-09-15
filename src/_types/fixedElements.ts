import type { NumberTuple } from './numberTuple.js';

/** Maps the tuple's own element keys ("0" | "1" | ...) to number, dropping array members. */
export type FixedElements<N extends number> = {
  [K in Exclude<keyof NumberTuple<N>, keyof unknown[]>]: number;
};
