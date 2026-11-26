import { canExit, getStatus, newGame, tap } from './rules';
import type { GameState, Level } from './types';

function key(s: GameState): string {
  const lot = s.lot.map((v) => v.id).join(',');
  const bays = s.bays
    .filter((b) => b !== null)
    .sort((a, b) => a!.parkedAt - b!.parkedAt)
    .map((b) => `${b!.vehicle.id}:${b!.seatsLeft}`)
    .join(',');
  return `${lot}|${bays}`;
}

export interface SolveResult {
  solution: string[] | null;
  /** True if the search gave up before exploring everything. */
  exhausted: boolean;
  nodes: number;
}

/**
 * Depth-first search for a sequence of taps that wins the level.
 * Vehicles whose color is needed soonest in the line are tried first.
 */
export function solve(level: Level, maxNodes = 200_000): SolveResult {
  const seen = new Set<string>();
  let nodes = 0;
  let exhausted = false;

  const dfs = (s: GameState, path: string[]): string[] | null => {
    const status = getStatus(s);
    if (status === 'won') return path;
    if (status === 'lost') return null;
    if (++nodes > maxNodes) {
      exhausted = true;
      return null;
    }
    const k = key(s);
    if (seen.has(k)) return null;
    seen.add(k);

    const need = (c: string) => {
      const i = s.queue.indexOf(c as GameState['queue'][number]);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    const movable = s.lot
      .filter((v) => canExit(s, v.id))
      .sort((a, b) => need(a.color) - need(b.color));
    for (const v of movable) {
      const r = tap(s, v.id);
      if (r.result !== 'moved') continue;
      const found = dfs(r.state, [...path, v.id]);
      if (found) return found;
      if (exhausted) return null;
    }
    return null;
  };

  const solution = dfs(newGame(level), []);
  return { solution, exhausted, nodes };
}
