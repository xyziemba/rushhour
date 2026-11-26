import { hexDisk, hexNeighbors, type Hex } from '../../lib/hex';
import { mulberry32, pick, randInt, shuffle, type Rng } from '../../lib/rng';
import { COLORS, type Color } from '../../shell/palette';
import type { LevelBase, Status } from '../../shell/types';

export const CLEAR_AT = 10;

export type Move = [slot: number, cell: number];

export interface Level extends LevelBase {
  radius: number;
  seq: Color[][];
  target: number;
  solution: Move[];
}

export interface State {
  cells: Hex[];
  nbrs: number[][];
  stacks: Color[][];
  offers: (Color[] | null)[];
  seq: Color[][];
  pos: number;
  score: number;
  target: number;
}

export interface Event {
  /** Cells whose stacks changed (for highlighting). */
  touched: number[];
  gained: number;
}

const top = (s: Color[]) => s[s.length - 1];

export function topRun(s: Color[]): number {
  let n = 0;
  for (let i = s.length - 1; i >= 0 && s[i] === top(s); i--) n++;
  return n;
}

/**
 * After a placement: neighbors whose top color matches slide their top run
 * onto the stack being processed (starting with the placed one). Any stack
 * with CLEAR_AT or more of one color on top clears. Repeats until stable.
 */
export function resolve(stacks: Color[][], nbrs: number[][], start: number): { stacks: Color[][]; gained: number; touched: number[] } {
  const st = stacks.map((s) => [...s]);
  const touched = new Set<number>([start]);
  let gained = 0;
  let queue = [start];
  for (let guard = 0; guard < 500 && queue.length; guard++) {
    while (queue.length) {
      const c = queue.shift()!;
      const t = top(st[c]!);
      if (t === undefined) continue;
      for (const n of nbrs[c]!) {
        if (top(st[n]!) !== t) continue;
        const run = st[n]!.splice(st[n]!.length - topRun(st[n]!));
        st[c]!.push(...run);
        touched.add(n).add(c);
        queue.push(n);
      }
    }
    for (let c = 0; c < st.length; c++) {
      const run = topRun(st[c]!);
      if (run >= CLEAR_AT) {
        st[c]!.splice(st[c]!.length - run);
        gained += run;
        touched.add(c);
        queue.push(c);
      }
    }
  }
  return { stacks: st, gained, touched: [...touched] };
}

export function init(lv: Level): State {
  const cells = hexDisk(lv.radius);
  return {
    cells,
    nbrs: hexNeighbors(cells),
    stacks: cells.map(() => []),
    offers: lv.seq.slice(0, 3),
    seq: lv.seq,
    pos: 3,
    score: 0,
    target: lv.target,
  };
}

export function place(s: State, [slot, cell]: Move): { state: State; event: Event } | null {
  const offer = s.offers[slot];
  if (!offer || !s.stacks[cell] || s.stacks[cell]!.length || status(s) !== 'playing') return null;
  const stacks = s.stacks.map((x) => x);
  stacks[cell] = [...offer];
  const r = resolve(stacks, s.nbrs, cell);
  let offers = [...s.offers];
  offers[slot] = null;
  let pos = s.pos;
  if (offers.every((o) => o === null)) {
    offers = s.seq.slice(pos, pos + 3);
    pos += 3;
  }
  return {
    state: { ...s, stacks: r.stacks, offers, pos, score: s.score + r.gained },
    event: { touched: r.touched, gained: r.gained },
  };
}

export function status(s: State): Status {
  if (s.score >= s.target) return 'won';
  return s.stacks.some((x) => !x.length) && s.offers.some((o) => o) ? 'playing' : 'lost';
}

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  radius: number;
  colors: number;
  /** Placements the calibration bot gets. */
  pieces: number;
  factor: number;
}

function randomStack(palette: Color[], rnd: Rng): Color[] {
  const len = 2 + randInt(rnd, 4);
  const runs = 1 + randInt(rnd, Math.min(3, len));
  const out: Color[] = [];
  let prev: Color | undefined;
  for (let k = 0; k < runs; k++) {
    let c = pick(rnd, palette);
    if (c === prev) c = pick(rnd, palette);
    prev = c;
    const n = k === runs - 1 ? len - out.length : 1 + randInt(rnd, Math.max(1, len - out.length - (runs - k - 1)));
    for (let i = 0; i < n && out.length < len; i++) out.push(c);
  }
  return out;
}

/** Greedy bot used to set reachable targets. */
export function botMove(s: State): Move | null {
  let best: Move | null = null;
  let bestVal = -Infinity;
  s.offers.forEach((o, slot) => {
    if (!o) return;
    s.stacks.forEach((st, cell) => {
      if (st.length) return;
      const r = place(s, [slot, cell]);
      if (!r) return;
      let match = 0;
      for (const n of s.nbrs[cell]!) if (s.stacks[n]!.length && top(s.stacks[n]!) === top(o)) match++;
      const empties = r.state.stacks.filter((x) => !x.length).length;
      const val = r.event.gained * 100 + match * 5 + empties;
      if (val > bestVal) {
        bestVal = val;
        best = [slot, cell];
      }
    });
  });
  return best;
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  for (let attempt = 0; ; attempt++) {
    const palette = shuffle(rnd, [...COLORS]).slice(0, p.colors);
    const seq = Array.from({ length: 400 }, () => randomStack(palette, rnd));
    const base: Level = { id: p.id, name: p.name, radius: p.radius, seq, target: Infinity, solution: [] };
    let s = init(base);
    const moves: Move[] = [];
    const scores: number[] = [];
    for (let i = 0; i < p.pieces; i++) {
      const m = botMove(s);
      if (!m) break;
      s = place(s, m)!.state;
      moves.push(m);
      scores.push(s.score);
    }
    const target = Math.floor((s.score * p.factor) / 5) * 5;
    if (target >= 10 || attempt > 20) {
      const t = Math.max(10, target);
      const reach = scores.findIndex((x) => x >= t);
      if (reach !== -1) return { ...base, target: t, solution: moves.slice(0, reach + 1) };
    }
  }
}
