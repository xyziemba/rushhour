/** Generic state-space search used by puzzle generators to prove levels solvable. */

export interface SearchProblem<S, M> {
  start: S;
  key(s: S): string;
  moves(s: S): M[];
  apply(s: S, m: M): S | null;
  isGoal(s: S): boolean;
}

export interface SearchResult<M> {
  path: M[] | null;
  nodes: number;
  /** True if the node cap stopped the search early. */
  capped: boolean;
}

/** Breadth-first search: finds a shortest move list. */
export function bfs<S, M>(p: SearchProblem<S, M>, maxNodes = 200_000): SearchResult<M> {
  if (p.isGoal(p.start)) return { path: [], nodes: 0, capped: false };
  const seen = new Map<string, { prev: string | null; move: M | null }>();
  const startKey = p.key(p.start);
  seen.set(startKey, { prev: null, move: null });
  let frontier: [S, string][] = [[p.start, startKey]];
  let nodes = 0;
  while (frontier.length) {
    const next: [S, string][] = [];
    for (const [s, k] of frontier) {
      for (const m of p.moves(s)) {
        const t = p.apply(s, m);
        if (!t) continue;
        const tk = p.key(t);
        if (seen.has(tk)) continue;
        seen.set(tk, { prev: k, move: m });
        if (p.isGoal(t)) {
          const path: M[] = [];
          for (let cur: string | null = tk; cur !== null; ) {
            const e: { prev: string | null; move: M | null } = seen.get(cur)!;
            if (e.move !== null) path.push(e.move);
            cur = e.prev;
          }
          return { path: path.reverse(), nodes, capped: false };
        }
        if (++nodes >= maxNodes) return { path: null, nodes, capped: true };
        next.push([t, tk]);
      }
    }
    frontier = next;
  }
  return { path: null, nodes, capped: false };
}

/** Depth-first search with memo: finds *a* solution fast (not shortest). Moves are tried in the given order. */
export function dfs<S, M>(p: SearchProblem<S, M>, maxNodes = 200_000): SearchResult<M> {
  const seen = new Set<string>();
  let nodes = 0;
  let capped = false;
  const path: M[] = [];
  const go = (s: S): boolean => {
    if (p.isGoal(s)) return true;
    if (++nodes > maxNodes) {
      capped = true;
      return false;
    }
    const k = p.key(s);
    if (seen.has(k)) return false;
    seen.add(k);
    for (const m of p.moves(s)) {
      const t = p.apply(s, m);
      if (!t) continue;
      path.push(m);
      if (go(t)) return true;
      path.pop();
      if (capped) return false;
    }
    return false;
  };
  return go(p.start) ? { path, nodes, capped: false } : { path: null, nodes, capped };
}
