import { DELTA, type Dir4 } from '../../lib/grid';
import { mulberry32, pick, randInt, type Rng } from '../../lib/rng';
import type { LevelBase, Status } from '../../shell/types';

export interface Piece {
  id: string;
  x: number;
  y: number;
  length: 1 | 2 | 3;
  dir: Dir4;
}

export interface Level extends LevelBase {
  cols: number;
  rows: number;
  lives: number;
  pieces: Piece[];
  solution: string[];
}

export interface State {
  cols: number;
  rows: number;
  pieces: Piece[];
  lives: number;
  crashes: number;
}

export type Event = { type: 'exit' } | { type: 'crash'; blocker: string };

const vertical = (d: Dir4) => d === 'up' || d === 'down';

export function cells(p: Pick<Piece, 'x' | 'y' | 'length' | 'dir'>): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < p.length; i++) out.push(vertical(p.dir) ? [p.x, p.y + i] : [p.x + i, p.y]);
  return out;
}

/** Cells from the piece's head to the edge of the board, nearest first. */
export function lane(p: Pick<Piece, 'x' | 'y' | 'length' | 'dir'>, cols: number, rows: number): [number, number][] {
  const [dx, dy] = DELTA[p.dir];
  const head = cells(p)[dx + dy > 0 ? p.length - 1 : 0]!;
  const out: [number, number][] = [];
  for (let x = head[0] + dx, y = head[1] + dy; x >= 0 && y >= 0 && x < cols && y < rows; x += dx, y += dy) out.push([x, y]);
  return out;
}

function occupancy(pieces: Piece[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of pieces) for (const [x, y] of cells(p)) m.set(`${x},${y}`, p.id);
  return m;
}

export function blocker(s: Pick<State, 'pieces' | 'cols' | 'rows'>, id: string): string | null {
  const p = s.pieces.find((q) => q.id === id);
  if (!p) return null;
  const occ = occupancy(s.pieces);
  for (const [x, y] of lane(p, s.cols, s.rows)) {
    const hit = occ.get(`${x},${y}`);
    if (hit) return hit;
  }
  return null;
}

export const init = (lv: Level): State => ({ cols: lv.cols, rows: lv.rows, pieces: lv.pieces, lives: lv.lives, crashes: 0 });

export function tap(s: State, id: string): { state: State; event: Event } | null {
  if (!s.pieces.some((p) => p.id === id) || status(s) !== 'playing') return null;
  const b = blocker(s, id);
  if (b) return { state: { ...s, lives: s.lives - 1, crashes: s.crashes + 1 }, event: { type: 'crash', blocker: b } };
  return { state: { ...s, pieces: s.pieces.filter((p) => p.id !== id) }, event: { type: 'exit' } };
}

export function status(s: State): Status {
  if (s.pieces.length === 0) return 'won';
  return s.lives <= 0 ? 'lost' : 'playing';
}

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  cols: number;
  rows: number;
  /** Fraction of cells to try to fill. */
  density: number;
  lives: number;
}

const DIRS: Dir4[] = ['up', 'down', 'left', 'right'];

/**
 * Each new piece must have a clear lane when placed, so removing pieces in
 * reverse placement order always works (and some piece can always leave).
 * Candidates that sit in other pieces' lanes are preferred to tangle the board.
 */
function place(p: Params, rnd: Rng): Piece[] {
  const placed: Piece[] = [];
  const target = Math.round(p.cols * p.rows * p.density);
  let filled = 0;
  let failures = 0;
  while (filled < target && failures < 60) {
    const occ = occupancy(placed);
    const lanes = new Map<string, number>();
    for (const q of placed) for (const [x, y] of lane(q, p.cols, p.rows)) lanes.set(`${x},${y}`, (lanes.get(`${x},${y}`) ?? 0) + 1);
    let best: Piece | null = null;
    let bestScore = -1;
    for (let t = 0; t < 50; t++) {
      const r = rnd();
      const cand: Piece = {
        id: `a${placed.length}`,
        x: randInt(rnd, p.cols),
        y: randInt(rnd, p.rows),
        length: r < 0.25 ? 1 : r < 0.75 ? 2 : 3,
        dir: pick(rnd, DIRS),
      };
      const cs = cells(cand);
      if (cs.some(([x, y]) => x >= p.cols || y >= p.rows || occ.has(`${x},${y}`))) continue;
      if (lane(cand, p.cols, p.rows).some(([x, y]) => occ.has(`${x},${y}`))) continue;
      const score = cs.reduce((n, [x, y]) => n + (lanes.get(`${x},${y}`) ?? 0), 0) + rnd();
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (!best) {
      failures++;
      continue;
    }
    placed.push(best);
    filled += best.length;
  }
  return placed;
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  const pieces = place(p, rnd);
  return { id: p.id, name: p.name, cols: p.cols, rows: p.rows, lives: p.lives, pieces, solution: pieces.map((q) => q.id).reverse() };
}
