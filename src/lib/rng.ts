/** Seeded random helpers. Every generator takes its randomness from here so levels are reproducible. */

export type Rng = () => number;

/** Small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, n). */
export const randInt = (rnd: Rng, n: number): number => Math.floor(rnd() * n);

export function pick<T>(rnd: Rng, items: readonly T[]): T {
  return items[randInt(rnd, items.length)]!;
}

/** Fisher–Yates shuffle, in place. Returns the same array. */
export function shuffle<T>(rnd: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randInt(rnd, i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** A random seed for endless mode (not reproducible on purpose). */
export const randomSeed = (): number => 1 + Math.floor(Math.random() * 999_999);
