import { mulberry32, randInt, shuffle, type Rng } from '../../lib/rng';
import { COLORS, type Color } from '../../shell/palette';
import type { LevelBase, Status } from '../../shell/types';

export interface Pair {
  color: Color;
  a: number;
  b: number;
}

/** Set one color's path (starting at one of its dots). */
export interface Move {
  pair: number;
  path: number[];
}

export interface Level extends LevelBase {
  n: number;
  pairs: Pair[];
  solution: Move[];
}

export interface State {
  n: number;
  pairs: Pair[];
  paths: number[][];
}

export const adjacent = (n: number, a: number, b: number): boolean =>
  (Math.abs(a - b) === 1 && Math.floor(a / n) === Math.floor(b / n)) || Math.abs(a - b) === n;

export const init = (lv: Level): State => ({ n: lv.n, pairs: lv.pairs, paths: lv.pairs.map(() => []) });

export const isConnected = (s: State, i: number): boolean => {
  const p = s.paths[i]!, pr = s.pairs[i]!;
  return p.length > 1 && ((p[0] === pr.a && p[p.length - 1] === pr.b) || (p[0] === pr.b && p[p.length - 1] === pr.a));
};

/** Validate a path for pair `i`; returns null if it breaks the rules. */
export function validPath(s: State, i: number, path: number[]): boolean {
  const pr = s.pairs[i];
  if (!pr || !path.length || (path[0] !== pr.a && path[0] !== pr.b)) return false;
  const other = path[0] === pr.a ? pr.b : pr.a;
  const seen = new Set<number>();
  for (let k = 0; k < path.length; k++) {
    const c = path[k]!;
    if (c < 0 || c >= s.n * s.n || seen.has(c)) return false;
    seen.add(c);
    if (k && !adjacent(s.n, path[k - 1]!, c)) return false;
    // Can't run over another color's dot, and must stop at its own other dot.
    if (s.pairs.some((q, j) => j !== i && (q.a === c || q.b === c))) return false;
    if (c === other && k !== path.length - 1) return false;
  }
  return true;
}

/** Drawing over another color's path cuts that path where they meet. */
export function draw(s: State, { pair, path }: Move): State | null {
  if (isSolved(s) || !validPath(s, pair, path)) return null;
  const claimed = new Set(path);
  const paths = s.paths.map((p, j) => {
    if (j === pair) return path;
    const cut = p.findIndex((c) => claimed.has(c));
    return cut === -1 ? p : p.slice(0, cut);
  });
  return { ...s, paths };
}

export function isSolved(s: State): boolean {
  if (!s.pairs.every((_, i) => isConnected(s, i))) return false;
  return s.paths.reduce((n, p) => n + p.length, 0) === s.n * s.n;
}

export const status = (s: State): Status => (isSolved(s) ? 'won' : 'playing');

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  n: number;
  pairs: number;
}

/** A random path through every cell: start from a snake and apply many "backbite" moves. */
function hamiltonian(n: number, rnd: Rng): number[] {
  let path: number[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) path.push(y * n + (y % 2 ? n - 1 - x : x));
  const nb = (c: number) => {
    const x = c % n, y = Math.floor(c / n);
    const out: number[] = [];
    if (x > 0) out.push(c - 1);
    if (x < n - 1) out.push(c + 1);
    if (y > 0) out.push(c - n);
    if (y < n - 1) out.push(c + n);
    return out;
  };
  for (let it = 0; it < n * n * 30; it++) {
    if (rnd() < 0.5) path.reverse();
    const end = path[path.length - 1]!;
    const options = nb(end).filter((c) => c !== path[path.length - 2]);
    if (!options.length) continue;
    const pick = options[randInt(rnd, options.length)]!;
    const i = path.indexOf(pick);
    // Connect the end to `pick` and reverse the tail after it.
    path = [...path.slice(0, i + 1), ...path.slice(i + 1).reverse()];
  }
  return path;
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  const total = p.n * p.n;
  const path = hamiltonian(p.n, rnd);
  // Segment lengths: at least 3 each, the rest spread randomly.
  const lens = Array<number>(p.pairs).fill(3);
  for (let left = total - 3 * p.pairs; left > 0; left--) lens[randInt(rnd, p.pairs)]!++;
  const colors = shuffle(rnd, [...COLORS]).slice(0, p.pairs);
  const pairs: Pair[] = [];
  const solution: Move[] = [];
  let at = 0;
  lens.forEach((len, i) => {
    const seg = path.slice(at, at + len);
    at += len;
    pairs.push({ color: colors[i]!, a: seg[0]!, b: seg[seg.length - 1]! });
    solution.push({ pair: i, path: seg });
  });
  return { id: p.id, name: p.name, n: p.n, pairs, solution };
}
