/** Small helpers most games share. */
import type { LevelBase, Stars } from './types';

/** For games where every win takes the same number of moves: reward undo-free play. */
export const starsByUndos = (undos: number): Stars => (undos === 0 ? 3 : undos <= 2 ? 2 : 1);

/** Compare moves with a par (a known good solution length). */
export function starsByPar(moves: number, par: number, slack = 0.5): Stars {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * (1 + slack))) return 2;
  return 1;
}

/** Build a cached, lazily generated campaign from a list of generator params. */
export function makeCampaign<P extends { id: string; name: string }, L extends LevelBase>(
  params: P[],
  generate: (p: P) => L,
): { count: number; name(i: number): string; level(i: number): L } {
  const cache = new Map<number, L>();
  return {
    count: params.length,
    name: (i) => params[i]!.name,
    level: (i) => {
      let lv = cache.get(i);
      if (!lv) {
        lv = generate(params[i]!);
        cache.set(i, lv);
      }
      return lv;
    },
  };
}
