export function inCubic(t: number): number {
  return t * t * t;
}

export function outCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function inOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
