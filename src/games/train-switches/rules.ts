import { mulberry32, randInt, shuffle, type Rng } from '../../lib/rng';
import { COLORS, type Color } from '../../shell/palette';
import type { LevelBase, Status } from '../../shell/types';

/**
 * Tracks run left to right through columns 0..cols of nodes (node id = c*rows + r).
 * Every node has one or two outgoing tracks to the next column; nodes with two
 * are switches. Trains enter at column 0 at their departure time and move one
 * column per tick. Stations sit at the last column.
 */
export interface Train {
  color: Color;
  row: number;
  depart: number;
}

export interface Level extends LevelBase {
  cols: number;
  rows: number;
  /** outs[node] = target nodes (one, or two for a switch). */
  outs: number[][];
  switches: number[];
  trains: Train[];
  /** Station color per row of the last column (null = no station: trains must not go there). */
  stations: (Color | null)[];
  solution: Move[];
}

export type Move = { t: 'flip'; s: number } | { t: 'go' };

export interface Fail {
  kind: 'crash' | 'wrong';
  time: number;
  node: number;
  trains: number[];
}

export interface Run {
  paths: number[][];
  fail: Fail | null;
}

export interface State {
  /** The level's (immutable) track layout. */
  level: Level;
  setting: number[];
  runs: number;
  won: boolean;
  last: Run | null;
}

export type Event = { run: Run } | { flip: number };

export function simulate(
  lv: Pick<Level, 'cols' | 'rows' | 'outs' | 'switches' | 'trains' | 'stations'>,
  setting: number[],
  checkStations = true,
): Run {
  const swIndex = new Map(lv.switches.map((n, i) => [n, i]));
  const paths = lv.trains.map((t) => {
    const path = [t.row];
    for (let c = 0; c < lv.cols; c++) {
      const node = path[path.length - 1]!;
      const outs = lv.outs[node]!;
      const si = swIndex.get(node);
      path.push(outs.length > 1 && si !== undefined ? outs[setting[si]!]! : outs[0]!);
    }
    return path;
  });
  // Earliest problem wins: two trains on one node at the same tick, or a train at the wrong station.
  let fail: Fail | null = null;
  const seen = new Map<string, number>();
  paths.forEach((path, i) => {
    const t0 = lv.trains[i]!.depart;
    path.forEach((node, k) => {
      const key = `${t0 + k}:${node}`;
      const other = seen.get(key);
      // A crash is reported over a wrong-station arrival at the same moment.
      const earlier = !fail || t0 + k < fail.time || (t0 + k === fail.time && fail.kind === 'wrong');
      if (other !== undefined && earlier) fail = { kind: 'crash', time: t0 + k, node, trains: [other, i] };
      seen.set(key, i);
    });
    const end = path[path.length - 1]!;
    const want = lv.stations[end - lv.cols * lv.rows];
    const time = t0 + path.length - 1;
    if (checkStations && want !== lv.trains[i]!.color && (!fail || time < fail.time)) fail = { kind: 'wrong', time, node: end, trains: [i] };
  });
  if (fail) {
    const f: Fail = fail;
    // Cut paths at the moment of failure.
    paths.forEach((p, i) => {
      const keep = f.time - lv.trains[i]!.depart + 1;
      if (keep < p.length) p.length = Math.max(0, keep);
    });
  }
  return { paths, fail };
}

export const init = (lv: Level): State => ({ level: lv, setting: lv.switches.map(() => 0), runs: 0, won: false, last: null });

export function apply(s: State, m: Move): { state: State; event: Event } | null {
  const lv = s.level;
  if (s.won) return null;
  if (m.t === 'flip') {
    if (m.s < 0 || m.s >= s.setting.length) return null;
    const setting = [...s.setting];
    setting[m.s] = 1 - setting[m.s]!;
    return { state: { ...s, setting, last: null }, event: { flip: m.s } };
  }
  const run = simulate(lv, s.setting);
  return { state: { ...s, runs: s.runs + (run.fail ? 1 : 0), won: !run.fail, last: run }, event: { run } };
}

export const status = (s: State): Status => (s.won ? 'won' : 'playing');

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  cols: number;
  rows: number;
  trains: number;
  /** Chance a node gets two outgoing tracks. */
  switchiness: number;
  /** Departure times are 0..spread. */
  spread: number;
}

function buildTracks(p: Params, rnd: Rng): number[][] {
  const R = p.rows;
  const outs: number[][] = Array.from({ length: (p.cols + 1) * R }, () => []);
  for (let c = 0; c < p.cols; c++) {
    for (let r = 0; r < R; r++) {
      const opts = [r - 1, r, r + 1].filter((x) => x >= 0 && x < R).map((x) => (c + 1) * R + x);
      const straight = (c + 1) * R + r;
      if (rnd() < p.switchiness && opts.length > 1) {
        const pair = shuffle(rnd, [...opts]).slice(0, 2).sort((a, b) => a - b);
        outs[c * R + r] = pair;
      } else {
        outs[c * R + r] = [rnd() < 0.6 ? straight : opts[randInt(rnd, opts.length)]!];
      }
    }
    // Remove X-crossings between neighbouring rows (they'd look like collisions that aren't).
    for (let r = 0; r < R - 1; r++) {
      const a = c * R + r, b = a + 1;
      const down = (c + 1) * R + r + 1, up = (c + 1) * R + r;
      if (outs[a]!.includes(down) && outs[b]!.includes(up)) {
        outs[b] = outs[b]!.length > 1 ? outs[b]!.filter((x) => x !== up) : [(c + 1) * R + r + 1];
        if (!outs[b]!.length) outs[b] = [(c + 1) * R + r + 1];
      }
    }
  }
  return outs;
}

function reachableSwitches(outs: number[][], starts: number[]): number[] {
  const seen = new Set(starts);
  const stack = [...starts];
  while (stack.length) {
    const n = stack.pop()!;
    for (const m of outs[n] ?? []) if (!seen.has(m)) (seen.add(m), stack.push(m));
  }
  return [...seen].filter((n) => (outs[n]?.length ?? 0) > 1).sort((a, b) => a - b);
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const outs = buildTracks(p, rnd);
    const rows = shuffle(rnd, Array.from({ length: p.rows }, (_, r) => r));
    const trains: Train[] = Array.from({ length: p.trains }, (_, i) => ({ color: 'red', row: rows[i % p.rows]!, depart: randInt(rnd, p.spread + 1) }));
    // Two trains leaving the same entry at the same time would crash immediately.
    if (new Set(trains.map((t) => `${t.row}:${t.depart}`)).size < trains.length) continue;
    const switches = reachableSwitches(outs, trains.map((t) => t.row));
    if (switches.length < 1 || switches.length > 10) continue;
    const goal = switches.map(() => randInt(rnd, 2));
    const stations: (Color | null)[] = Array(p.rows).fill(null);
    const base = { cols: p.cols, rows: p.rows, outs, switches, trains, stations };
    const dry = simulate(base, goal, false);
    if (dry.fail) continue;
    // Color stations by the trains the goal setting brings there.
    const palette = shuffle(rnd, [...COLORS]);
    let next = 0;
    dry.paths.forEach((path, i) => {
      const st = path[path.length - 1]! - p.cols * p.rows;
      stations[st] ??= palette[next++]!;
      trains[i]!.color = stations[st]!;
    });
    if (new Set(stations.filter(Boolean)).size < Math.min(2, p.trains)) continue;
    const lv = { ...base, stations, trains };
    // The puzzle should need thought: the start must fail, and few settings may work.
    let valid = 0;
    const total = 1 << switches.length;
    for (let mask = 0; mask < total; mask++) {
      const setting = switches.map((_, i) => (mask >> i) & 1);
      if (!simulate(lv, setting).fail) valid++;
    }
    if (!simulate(lv, switches.map(() => 0)).fail || valid / total > 0.34) continue;
    const solution: Move[] = [...goal.flatMap((b, i) => (b ? [{ t: 'flip', s: i } as Move] : [])), { t: 'go' }];
    return { id: p.id, name: p.name, ...lv, solution };
  }
  throw new Error(`train-switches: no level for seed ${p.seed}`);
}
