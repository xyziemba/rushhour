import { bfs, dfs, type SearchProblem } from '../../lib/search';
import { mulberry32, shuffle } from '../../lib/rng';
import { COLORS, type Color } from '../../shell/palette';
import type { LevelBase, Status } from '../../shell/types';

export type Move = [from: number, to: number];

export interface Level extends LevelBase {
  cap: number;
  tubes: Color[][]; // bottom → top
  solution: Move[];
  par: number;
}

export interface State {
  cap: number;
  tubes: Color[][];
}

export interface Event {
  amount: number;
}

const top = (t: Color[]) => t[t.length - 1];

export function topRun(t: Color[]): number {
  let n = 0;
  for (let i = t.length - 1; i >= 0 && t[i] === top(t); i--) n++;
  return n;
}

const uniformFull = (t: Color[], cap: number) => t.length === cap && topRun(t) === cap;

export function pour(s: State, [from, to]: Move): { state: State; amount: number } | null {
  const a = s.tubes[from];
  const b = s.tubes[to];
  if (!a || !b || from === to || !a.length || b.length >= s.cap) return null;
  if (b.length && top(b) !== top(a)) return null;
  const amount = Math.min(topRun(a), s.cap - b.length);
  const tubes = s.tubes.map((t) => [...t]);
  for (let i = 0; i < amount; i++) tubes[to]!.push(tubes[from]!.pop()!);
  return { state: { ...s, tubes }, amount };
}

export function isSolved(s: State): boolean {
  return s.tubes.every((t) => t.length === 0 || uniformFull(t, s.cap));
}

export function legalMoves(s: State, pruned = false): Move[] {
  const out: Move[] = [];
  s.tubes.forEach((a, i) => {
    if (!a.length) return;
    if (pruned && uniformFull(a, s.cap)) return;
    s.tubes.forEach((b, j) => {
      if (i === j || b.length >= s.cap || (b.length && top(b) !== top(a))) return;
      // Pointless: moving a whole single-color tube into an empty one.
      if (pruned && !b.length && topRun(a) === a.length) return;
      out.push([i, j]);
    });
  });
  if (pruned) {
    // Try pours onto matching colors first.
    out.sort((m, n) => Number(s.tubes[n[1]]!.length > 0) - Number(s.tubes[m[1]]!.length > 0));
  }
  return out;
}

export const init = (lv: Level): State => ({ cap: lv.cap, tubes: lv.tubes });

export function status(s: State): Status {
  if (isSolved(s)) return 'won';
  return legalMoves(s).length ? 'playing' : 'lost';
}

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  colors: number;
  cap: number;
  empty: number;
}

function problem(s: State): SearchProblem<State, Move> {
  return {
    start: s,
    key: (x) => x.tubes.map((t) => t.join(',')).sort().join('|'),
    moves: (x) => legalMoves(x, true),
    apply: (x, m) => pour(x, m)?.state ?? null,
    isGoal: isSolved,
  };
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  const palette = shuffle(rnd, [...COLORS]).slice(0, p.colors);
  for (let attempt = 0; ; attempt++) {
    const layers = shuffle(rnd, palette.flatMap((c) => Array<Color>(p.cap).fill(c)));
    const tubes: Color[][] = [];
    for (let i = 0; i < p.colors; i++) tubes.push(layers.slice(i * p.cap, (i + 1) * p.cap));
    for (let i = 0; i < p.empty; i++) tubes.push([]);
    const s: State = { cap: p.cap, tubes };
    if (tubes.some((t) => t.length && topRun(t) >= p.cap - 1)) continue; // too easy a start
    // Shortest solution when it's cheap to find; otherwise any solution.
    const short = bfs(problem(s), 60_000);
    const sol = short.path ?? dfs(problem(s), 150_000).path;
    if (!sol) {
      if (attempt > 200) throw new Error(`no solvable tubes for seed ${p.seed}`);
      continue;
    }
    return { id: p.id, name: p.name, cap: p.cap, tubes, solution: sol, par: sol.length };
  }
}
