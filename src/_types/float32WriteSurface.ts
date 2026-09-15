/**
 * Members that mutate the backing memory, or return a writable alias of it.
 * `subarray` and `buffer` are included because either one gives the caller
 * a mutable Float32Array over the same bytes.
 */
export type Float32WriteSurface =
  | 'set'
  | 'fill'
  | 'copyWithin'
  | 'reverse'
  | 'sort'
  | 'subarray'
  | 'buffer';
