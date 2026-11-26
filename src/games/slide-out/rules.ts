import { bfs } from '../../lib/search';
import { mulberry32, randInt, type Rng } from '../../lib/rng';
import type { LevelBase, Status } from '../../shell/types';

export const N = 6;
export const EXIT_ROW = 2;
export const TARGET = 't';

export interface Block {
  id: string;
  x: number;
  y: number;
  len: 2 | 3;
  horiz: boolean;
}

export type Move = [id: string, delta: number];

export interface Level extends LevelBase {
  blocks: Block[];
  solution: Move[];
  par: number;
}

export interface State {
  blocks: Block[];
}

const cellsOf = (b: Block): number[] =>
  Array.from({ length: b.len }, (_, i) => (b.horiz ? b.y * N + b.x + i : (b.y + i) * N + b.x));

function occupied(blocks: Block[], except?: string): Set<number> {
  const s = new Set<number>();
  for (const b of blocks) if (b.id !== except) cellsOf(b).forEach((c) => s.add(c));
  return s;
}

/** How far a block can slide: [most negative, most positive] delta. */
export function range(blocks: Block[], id: string): [number, number] {
  const b = blocks.find((x) => x.id === id)!;
  const occ = occupied(blocks, id);
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && !occ.has(y * N + x);
  let lo = 0, hi = 0;
  if (b.horiz) {
    while (free(b.x + lo - 1, b.y)) lo--;
    while (free(b.x + b.len + hi, b.y)) hi++;
  } else {
    while (free(b.x, b.y + lo - 1)) lo--;
    while (free(b.x, b.y + b.len + hi)) hi++;
  }
  return [lo, hi];
}

export function slide(s: State, [id, d]: Move): State | null {
  const b = s.blocks.find((x) => x.id === id);
  if (!b || d === 0 || isSolved(s)) return null;
  const [lo, hi] = range(s.blocks, id);
  if (d < lo || d > hi) return null;
  return { blocks: s.blocks.map((x) => (x.id === id ? { ...x, x: x.horiz ? x.x + d : x.x, y: x.horiz ? x.y : x.y + d } : x)) };
}

export const isSolved = (s: State): boolean => s.blocks.find((b) => b.id === TARGET)!.x === N - 2;
export const init = (lv: Level): State => ({ blocks: lv.blocks });
export const status = (s: State): Status => (isSolved(s) ? 'won' : 'playing');

export function solve(blocks: Block[], maxNodes = 40_000) {
  return bfs<State, Move>(
    {
      start: { blocks },
      key: (s) => s.blocks.map((b) => (b.horiz ? b.x : b.y)).join(''),
      moves: (s) =>
        s.blocks.flatMap((b) => {
          const [lo, hi] = range(s.blocks, b.id);
          const out: Move[] = [];
          for (let d = lo; d <= hi; d++) if (d) out.push([b.id, d]);
          return out;
        }),
      apply: slide,
      isGoal: isSolved,
    },
    maxNodes,
  );
}

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  blocks: number;
  /** Wanted optimal solution length range. */
  min: number;
  max: number;
  attempts?: number;
}

function randomLayout(p: Params, rnd: Rng): Block[] {
  const blocks: Block[] = [{ id: TARGET, x: randInt(rnd, 3), y: EXIT_ROW, len: 2, horiz: true }];
  let tries = 0;
  while (blocks.length < p.blocks + 1 && tries++ < 400) {
    const horiz = rnd() < 0.5;
    const len: 2 | 3 = rnd() < 0.7 ? 2 : 3;
    const b: Block = {
      id: `b${blocks.length}`,
      horiz,
      len,
      x: randInt(rnd, horiz ? N - len + 1 : N),
      y: randInt(rnd, horiz ? N : N - len + 1),
    };
    if (horiz && b.y === EXIT_ROW) continue; // would wall in the target forever
    const occ = occupied(blocks);
    if (cellsOf(b).some((c) => occ.has(c))) continue;
    blocks.push(b);
  }
  return blocks;
}

/**
 * Explore every position reachable from a layout (fast, typed arrays), then
 * run a second breadth-first pass backwards from all solved positions. Each
 * position's distance is its optimal solution length, so we can pick a start
 * of exactly the difficulty we want.
 */
function hardestFrom(layout: Block[], max: number, cap = 12_000): { blocks: Block[]; path: Move[]; truncated: boolean } | null {
  const n = layout.length;
  const horiz = layout.map((b) => b.horiz);
  const len = layout.map((b) => b.len);
  const fixed = layout.map((b) => (b.horiz ? b.y : b.x));
  const t = layout.findIndex((b) => b.id === TARGET);

  const occ = new Uint8Array(N * N);
  const fill = (pos: Uint8Array) => {
    occ.fill(0);
    for (let i = 0; i < n; i++) for (let k = 0; k < len[i]!; k++) occ[horiz[i] ? fixed[i]! * N + pos[i]! + k : (pos[i]! + k) * N + fixed[i]!] = 1;
  };
  const at = (i: number, p: number) => (horiz[i] ? fixed[i]! * N + p : p * N + fixed[i]!);
  const neighbors = (pos: Uint8Array, out: (next: Uint8Array, i: number, d: number) => void) => {
    fill(pos);
    for (let i = 0; i < n; i++) {
      for (let p = pos[i]! - 1, d = -1; p >= 0 && !occ[at(i, p)]; p--, d--) {
        const q = pos.slice();
        q[i] = p;
        out(q, i, d);
      }
      for (let p = pos[i]! + len[i]!, d = 1; p < N && !occ[at(i, p)]; p++, d++) {
        const q = pos.slice();
        q[i] = pos[i]! + d;
        out(q, i, d);
      }
    }
  };
  const key = (pos: Uint8Array) => String.fromCharCode(...pos);

  // Pass 1: every reachable position.
  const start = Uint8Array.from(layout.map((b) => (b.horiz ? b.x : b.y)));
  const index = new Map<string, number>([[key(start), 0]]);
  const states: Uint8Array[] = [start];
  for (let k = 0; k < states.length && states.length < cap; k++) {
    neighbors(states[k]!, (q) => {
      const kk = key(q);
      if (!index.has(kk)) {
        index.set(kk, states.length);
        states.push(q);
      }
    });
  }
  // Pass 2: distance to the nearest solved position.
  const dist = new Int32Array(states.length).fill(-1);
  const next = new Int32Array(states.length).fill(-1);
  const via: [number, number][] = Array(states.length);
  let queue: number[] = [];
  states.forEach((s, i) => {
    if (s[t] === N - 2) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  if (!queue.length) return null;
  let far = queue[0]!;
  while (queue.length) {
    const nq: number[] = [];
    for (const i of queue) {
      neighbors(states[i]!, (q, bi, d) => {
        const j = index.get(key(q));
        if (j === undefined || dist[j] !== -1) return;
        dist[j] = dist[i]! + 1;
        next[j] = i;
        via[j] = [bi, -d]; // the move from j back toward i
        if (dist[j]! <= max && dist[j]! > dist[far]!) far = j;
        nq.push(j);
      });
    }
    queue = nq;
  }
  if (dist[far]! <= 0) return null;
  const path: Move[] = [];
  for (let j = far; next[j] !== -1; j = next[j]!) path.push([layout[via[j]![0]]!.id, via[j]![1]]);
  const pos = states[far]!;
  return { blocks: layout.map((b, i) => (b.horiz ? { ...b, x: pos[i]! } : { ...b, y: pos[i]! })), path, truncated: states.length >= cap };
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  let best: { blocks: Block[]; path: Move[] } | null = null;
  for (let i = 0; i < (p.attempts ?? 120); i++) {
    const far = hardestFrom(randomLayout(p, rnd), p.max);
    if (!far) continue;
    // If exploration hit its cap, shortcuts may be missing: confirm the true shortest solution.
    const exact = far.truncated ? solve(far.blocks, 150_000).path : far.path;
    if (!exact?.length || exact.length > p.max) continue;
    const r = { blocks: far.blocks, path: exact };
    if (!best || r.path.length > best.path.length) best = r;
    if (best.path.length >= p.min) break;
  }
  if (!best) throw new Error(`slide-out: no level for seed ${p.seed}`);
  return { id: p.id, name: p.name, blocks: best.blocks, solution: best.path, par: best.path.length };
}
