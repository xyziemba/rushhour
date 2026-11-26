import { mulberry32 } from '../../lib/rng';
import { firstBlocker, getStatus, newGame, tap, validateLevel } from './rules';
import { exitPath, inBounds, occupancy, vehicleCells } from './grid';
import { CAPACITY, COLORS, type Color, type Dir, type GameState, type Length, type Level, type Vehicle } from './types';

export interface GenParams {
  seed: number;
  cols: number;
  rows: number;
  colors: number;
  vehicles: number;
  bays: number;
  /** 0..1: how often the line asks for a buried vehicle rather than a random one. */
  bury: number;
  id?: string;
  name?: string;
}

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function pickLength(rnd: () => number): Length {
  const r = rnd();
  return r < 0.3 ? 1 : r < 0.75 ? 2 : 3;
}

/**
 * Place vehicles so each new one has a clear exit at the moment it's placed,
 * which guarantees the lot can always be fully emptied (reverse placement
 * order). Among sampled candidates, prefer ones that sit in other vehicles'
 * exit lanes so the lot is tangled.
 */
function placeVehicles(p: GenParams, rnd: () => number): Vehicle[] {
  const placed: Vehicle[] = [];
  let failures = 0;
  while (placed.length < p.vehicles && failures < 50) {
    const occ = occupancy(placed);
    const lanes = new Map<string, number>();
    for (const v of placed) {
      for (const [x, y] of exitPath(v, p.cols, p.rows)) {
        const k = `${x},${y}`;
        lanes.set(k, (lanes.get(k) ?? 0) + 1);
      }
    }
    let best: Omit<Vehicle, 'id' | 'color' | 'capacity'> | null = null;
    let bestScore = -1;
    for (let t = 0; t < 40; t++) {
      const length = pickLength(rnd);
      const dir = DIRS[Math.floor(rnd() * 4)]!;
      const cand = { x: Math.floor(rnd() * p.cols), y: Math.floor(rnd() * p.rows), length, dir };
      if (!inBounds(cand, p.cols, p.rows)) continue;
      const cells = vehicleCells(cand);
      if (cells.some(([x, y]) => occ.has(`${x},${y}`))) continue;
      if (exitPath(cand, p.cols, p.rows).some(([x, y]) => occ.has(`${x},${y}`))) continue;
      const score = cells.reduce((n, [x, y]) => n + (lanes.get(`${x},${y}`) ?? 0), 0) + rnd() * 0.9;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (!best) {
      failures++;
      continue;
    }
    placed.push({ id: `v${placed.length}`, color: 'red', ...best, capacity: CAPACITY[best.length] });
  }
  return placed;
}

function assignColors(vehicles: Vehicle[], count: number, rnd: () => number): void {
  const palette = [...COLORS];
  for (let i = palette.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [palette[i], palette[j]] = [palette[j]!, palette[i]!];
  }
  const used = palette.slice(0, Math.min(count, vehicles.length));
  const order = vehicles.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  order.forEach((vi, k) => {
    vehicles[vi]!.color = k < used.length ? used[k]! : used[Math.floor(rnd() * used.length)]!;
  });
}

/** Vehicles to remove (in order) so that `target` can drive out, ending with `target`. */
function clearingChain(state: GameState, target: string): string[] | null {
  const chain: string[] = [];
  let s = state;
  for (let guard = 0; guard < 200; guard++) {
    // Follow the blocking chain to a vehicle that can move now.
    let id = target;
    for (let b = firstBlocker(s, id); b; b = firstBlocker(s, id)) id = b.id;
    chain.push(id);
    s = { ...s, lot: s.lot.filter((v) => v.id !== id) };
    if (id === target) return chain;
  }
  return null;
}

/**
 * Plan a play-through and derive the passenger line from it. Each step picks a
 * "target" vehicle whose passengers come next. If it's buried, its blockers
 * are parked first and their passengers come later — that's the puzzle.
 */
function planQueue(level: Level, p: GenParams, rnd: () => number): { queue: Color[]; solution: string[] } | null {
  let state = newGame({ ...level, queue: [] });
  const parked: Vehicle[] = [];
  const queue: Color[] = [];
  const solution: string[] = [];

  while (state.lot.length || parked.length) {
    type Option = { cost: number; chain: string[]; parkedTarget?: Vehicle };
    const options: Option[] = parked.map((v) => ({ cost: 0, chain: [], parkedTarget: v }));
    for (const v of state.lot) {
      const chain = clearingChain(state, v.id);
      if (chain && parked.length + chain.length <= p.bays) options.push({ cost: chain.length - 1, chain });
    }
    if (!options.length) return null;

    let pick: Option;
    if (rnd() < p.bury) {
      const max = Math.max(...options.map((o) => o.cost));
      const deepest = options.filter((o) => o.cost === max);
      pick = deepest[Math.floor(rnd() * deepest.length)]!;
    } else {
      pick = options[Math.floor(rnd() * options.length)]!;
    }

    let target: Vehicle;
    if (pick.parkedTarget) {
      target = pick.parkedTarget;
      parked.splice(parked.indexOf(target), 1);
    } else {
      const targetId = pick.chain[pick.chain.length - 1]!;
      for (const id of pick.chain) {
        const v = state.lot.find((c) => c.id === id)!;
        solution.push(id);
        state = { ...state, lot: state.lot.filter((c) => c.id !== id) };
        if (id !== targetId) parked.push(v);
      }
      target = level.vehicles.find((v) => v.id === targetId)!;
    }
    for (let i = 0; i < target.capacity; i++) queue.push(target.color);
  }
  return { queue, solution };
}

/** Replay a tap order from the start and check it wins. */
export function replays(level: Level, order: string[]): boolean {
  let s = newGame(level);
  for (const id of order) {
    const r = tap(s, id);
    if (r.result !== 'moved') return false;
    s = r.state;
  }
  return getStatus(s) === 'won';
}

export function generateLevel(p: GenParams): Level {
  const rnd = mulberry32(p.seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const vehicles = placeVehicles(p, rnd);
    if (vehicles.length < Math.max(2, Math.floor(p.vehicles * 0.8))) continue;
    assignColors(vehicles, p.colors, rnd);
    const base: Level = {
      id: p.id ?? `seed-${p.seed}`,
      name: p.name ?? `Seed ${p.seed}`,
      cols: p.cols,
      rows: p.rows,
      bays: p.bays,
      vehicles,
      queue: [],
    };
    const plan = planQueue(base, p, rnd);
    if (!plan) continue;
    const level: Level = { ...base, queue: plan.queue, solution: plan.solution };
    if (validateLevel(level).length) continue;
    if (getStatus(newGame(level)) !== 'playing') continue;
    if (replays(level, plan.solution)) return level;
  }
  throw new Error(`Could not generate a level for seed ${p.seed}`);
}

/** Parameters for endless mode: difficulty grows slowly with the win streak. */
export function endlessParams(seed: number, streak: number): GenParams {
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const tier = Math.min(4, Math.floor(streak / 3));
  const cols = 6 + Math.min(2, Math.floor(tier / 2) + Math.floor(rnd() * 2));
  const rows = cols + Math.floor(rnd() * 2);
  return {
    seed,
    cols,
    rows,
    colors: 4 + tier,
    vehicles: 12 + tier * 3 + Math.floor(rnd() * 3),
    bays: 5,
    bury: 0.4 + tier * 0.1,
    id: `endless-${seed}`,
    name: `Endless #${seed}`,
  };
}
