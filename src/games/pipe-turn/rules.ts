import { mulberry32, randInt, type Rng } from '../../lib/rng';
import type { LevelBase, Status } from '../../shell/types';

/** Connection bits: up, right, down, left. */
export const U = 1, R = 2, D = 4, L = 8;
const SIDES: [bit: number, dx: number, dy: number, opposite: number][] = [
  [U, 0, -1, D],
  [R, 1, 0, L],
  [D, 0, 1, U],
  [L, -1, 0, R],
];

/** Rotate a connection mask clockwise `turns` times. */
export function rotate(mask: number, turns: number): number {
  let m = mask;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

export interface Level extends LevelBase {
  cols: number;
  rows: number;
  source: number; // cell index
  pipes: number[]; // solved masks
  start: number[]; // initial clockwise turns per cell
  solution: number[]; // cells to tap
  par: number;
}

export interface State {
  cols: number;
  rows: number;
  source: number;
  pipes: number[];
  turns: number[];
}

export const maskAt = (s: State, i: number): number => rotate(s.pipes[i]!, s.turns[i]!);

/** Cells reachable from the source through mutually connected pipes. */
export function wet(s: State): Set<number> {
  const seen = new Set([s.source]);
  const stack = [s.source];
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % s.cols, y = Math.floor(i / s.cols);
    const m = maskAt(s, i);
    for (const [bit, dx, dy, opp] of SIDES) {
      if (!(m & bit)) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows) continue;
      const j = ny * s.cols + nx;
      if (!seen.has(j) && maskAt(s, j) & opp) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen;
}

/** Solved: every pipe end meets another pipe end, and water reaches every cell. */
export function isSolved(s: State): boolean {
  for (let i = 0; i < s.pipes.length; i++) {
    const x = i % s.cols, y = Math.floor(i / s.cols);
    const m = maskAt(s, i);
    for (const [bit, dx, dy, opp] of SIDES) {
      if (!(m & bit)) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows) return false;
      if (!(maskAt(s, ny * s.cols + nx) & opp)) return false;
    }
  }
  return wet(s).size === s.pipes.length;
}

export const init = (lv: Level): State => ({ cols: lv.cols, rows: lv.rows, source: lv.source, pipes: lv.pipes, turns: lv.start });

export function turn(s: State, i: number): State | null {
  if (i < 0 || i >= s.pipes.length || isSolved(s)) return null;
  const turns = [...s.turns];
  turns[i] = (turns[i]! + 1) % 4;
  return { ...s, turns };
}

export const status = (s: State): Status => (isSolved(s) ? 'won' : 'playing');

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  cols: number;
  rows: number;
}

/** Random spanning tree from the source (randomized Prim), turned into pipe masks. */
function tree(cols: number, rows: number, source: number, rnd: Rng): number[] {
  const masks = Array<number>(cols * rows).fill(0);
  const inTree = new Set([source]);
  const frontier: [from: number, side: number][] = [];
  const addEdges = (i: number) => SIDES.forEach((_, k) => frontier.push([i, k]));
  addEdges(source);
  while (inTree.size < cols * rows) {
    const [from, k] = frontier.splice(randInt(rnd, frontier.length), 1)[0]!;
    const [bit, dx, dy, opp] = SIDES[k]!;
    const x = (from % cols) + dx, y = Math.floor(from / cols) + dy;
    if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const to = y * cols + x;
    if (inTree.has(to)) continue;
    masks[from]! |= bit;
    masks[to]! |= opp;
    inTree.add(to);
    addEdges(to);
  }
  return masks;
}

/** Fewest clockwise taps that bring a pipe back to its solved shape (respects symmetry). */
export function tapsToSolve(mask: number, turns: number): number {
  for (let k = 0; k < 4; k++) if (rotate(mask, turns + k) === mask) return k;
  return 0;
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  const source = Math.floor(p.rows / 2) * p.cols + Math.floor(p.cols / 2);
  const pipes = tree(p.cols, p.rows, source, rnd);
  let start: number[];
  do {
    start = pipes.map(() => randInt(rnd, 4));
  } while (isSolved({ cols: p.cols, rows: p.rows, source, pipes, turns: start }));
  const solution: number[] = [];
  start.forEach((t, i) => {
    for (let k = tapsToSolve(pipes[i]!, t); k > 0; k--) solution.push(i);
  });
  return { id: p.id, name: p.name, cols: p.cols, rows: p.rows, source, pipes, start, solution, par: solution.length };
}
