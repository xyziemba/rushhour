import { DELTA, type Dir4 } from '../../lib/grid';
import { bfs } from '../../lib/search';
import { mulberry32, pick, randInt, type Rng } from '../../lib/rng';
import type { LevelBase, Status } from '../../shell/types';

export interface Level extends LevelBase {
  cols: number;
  rows: number;
  walls: number[];
  targets: number[];
  crates: number[];
  player: number;
  solution: Dir4[];
  par: number;
}

export interface State {
  cols: number;
  rows: number;
  walls: ReadonlySet<number>;
  targets: ReadonlySet<number>;
  crates: number[];
  player: number;
  pushes: number;
}

export interface Event {
  pushed: boolean;
}

export const DIRS: Dir4[] = ['up', 'right', 'down', 'left'];

export function step(s: State, dir: Dir4): { state: State; event: Event } | null {
  if (isSolved(s)) return null;
  const [dx, dy] = DELTA[dir];
  const x = (s.player % s.cols) + dx, y = Math.floor(s.player / s.cols) + dy;
  if (x < 0 || y < 0 || x >= s.cols || y >= s.rows) return null;
  const to = y * s.cols + x;
  if (s.walls.has(to)) return null;
  const ci = s.crates.indexOf(to);
  if (ci === -1) return { state: { ...s, player: to }, event: { pushed: false } };
  const bx = x + dx, by = y + dy;
  if (bx < 0 || by < 0 || bx >= s.cols || by >= s.rows) return null;
  const beyond = by * s.cols + bx;
  if (s.walls.has(beyond) || s.crates.includes(beyond)) return null;
  const crates = [...s.crates];
  crates[ci] = beyond;
  return { state: { ...s, player: to, crates, pushes: s.pushes + 1 }, event: { pushed: true } };
}

export const isSolved = (s: Pick<State, 'crates' | 'targets'>): boolean => s.crates.every((c) => s.targets.has(c));

/** A crate pushed into a corner that isn't a target can never move again. */
export function stuckCrate(s: State): number | null {
  const wall = (x: number, y: number) => x < 0 || y < 0 || x >= s.cols || y >= s.rows || s.walls.has(y * s.cols + x);
  for (const c of s.crates) {
    if (s.targets.has(c)) continue;
    const x = c % s.cols, y = Math.floor(c / s.cols);
    if ((wall(x - 1, y) || wall(x + 1, y)) && (wall(x, y - 1) || wall(x, y + 1))) return c;
  }
  return null;
}

export const init = (lv: Level): State => ({
  cols: lv.cols, rows: lv.rows, walls: new Set(lv.walls), targets: new Set(lv.targets), crates: lv.crates, player: lv.player, pushes: 0,
});

export const status = (s: State): Status => (isSolved(s) ? 'won' : 'playing');

export function solve(s: State, maxNodes = 250_000) {
  return bfs<State, Dir4>(
    {
      start: s,
      key: (x) => `${x.player}|${[...x.crates].sort((a, b) => a - b).join(',')}`,
      moves: (x) => (stuckCrate(x) === null ? DIRS : []),
      apply: (x, d) => step(x, d)?.state ?? null,
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
  cols: number;
  rows: number;
  crates: number;
  /** Interior wall blocks to scatter. */
  clutter: number;
  /** Minimum optimal moves to accept. */
  minMoves: number;
  attempts?: number;
}

function floodCount(cols: number, rows: number, walls: Set<number>, from: number): number {
  const seen = new Set([from]);
  const stack = [from];
  while (stack.length) {
    const c = stack.pop()!;
    for (const d of DIRS) {
      const x = (c % cols) + DELTA[d][0], y = Math.floor(c / cols) + DELTA[d][1];
      const n = y * cols + x;
      if (x >= 0 && y >= 0 && x < cols && y < rows && !walls.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size;
}

function room(p: Params, rnd: Rng): Set<number> {
  const walls = new Set<number>();
  for (let x = 0; x < p.cols; x++) {
    walls.add(x);
    walls.add((p.rows - 1) * p.cols + x);
  }
  for (let y = 0; y < p.rows; y++) {
    walls.add(y * p.cols);
    walls.add(y * p.cols + p.cols - 1);
  }
  const inner = p.cols * p.rows - walls.size;
  let placed = 0;
  for (let tries = 0; placed < p.clutter && tries < 200; tries++) {
    const c = (1 + randInt(rnd, p.rows - 2)) * p.cols + 1 + randInt(rnd, p.cols - 2);
    if (walls.has(c)) continue;
    walls.add(c);
    const free = [...Array(p.cols * p.rows).keys()].find((i) => !walls.has(i))!;
    if (floodCount(p.cols, p.rows, walls, free) !== inner - placed - 1) walls.delete(c);
    else placed++;
  }
  return walls;
}

/**
 * Start solved (crates on targets) and walk the mover around backwards,
 * sometimes pulling a crate. Every pull is a push in reverse, so the result
 * is always solvable; a BFS then finds the shortest solution.
 */
export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  let best: Level | null = null;
  for (let attempt = 0; attempt < (p.attempts ?? 60); attempt++) {
    const walls = room(p, rnd);
    const floor = [...Array(p.cols * p.rows).keys()].filter((i) => !walls.has(i));
    const targets: number[] = [];
    while (targets.length < p.crates) {
      const c = pick(rnd, floor);
      if (!targets.includes(c)) targets.push(c);
    }
    let crates = [...targets];
    let player = pick(rnd, floor.filter((c) => !crates.includes(c)));
    const free = (c: number) => !walls.has(c) && !crates.includes(c);
    for (let k = 0; k < 120 + p.crates * 60; k++) {
      const d = pick(rnd, DIRS);
      const [dx, dy] = DELTA[d];
      const x = player % p.cols, y = Math.floor(player / p.cols);
      const to = (y + dy) * p.cols + x + dx;
      if (!free(to)) continue;
      const behind = (y - dy) * p.cols + x - dx;
      const ci = crates.indexOf(behind);
      if (ci !== -1 && rnd() < 0.65) {
        crates = [...crates];
        crates[ci] = player;
      }
      player = to;
    }
    if (crates.filter((c) => !targets.includes(c)).length < Math.min(p.crates, Math.max(1, p.crates - 1))) continue;
    const s0: State = { cols: p.cols, rows: p.rows, walls, targets: new Set(targets), crates, player, pushes: 0 };
    const r = solve(s0);
    if (!r.path || !r.path.length) continue;
    const lv: Level = {
      id: p.id, name: p.name, cols: p.cols, rows: p.rows, walls: [...walls], targets, crates, player, solution: r.path, par: r.path.length,
    };
    if (!best || lv.par > best.par) best = lv;
    if (lv.par >= p.minMoves) break;
  }
  if (!best) throw new Error(`crate-push: no level for seed ${p.seed}`);
  return best;
}
