import { mulberry32, randInt, shuffle, type Rng } from '../../lib/rng';
import { COLORS, type Color } from '../../shell/palette';
import type { LevelBase, Status } from '../../shell/types';

export const MAX_MISSES = 3;

export interface BeltNode {
  x: number;
  y: number;
  kind: 'spawn' | 'junction' | 'bin';
  /** Junction: [left, right] child node indices. Spawn: [first node]. */
  next: number[];
  color?: Color;
}

export interface Level extends LevelBase {
  nodes: BeltNode[];
  /** Parcels in arrival order: seconds after start, and color. */
  schedule: { t: number; color: Color }[];
  /** Belt speed in layout units per second. */
  speed: number;
}

export interface Parcel {
  id: number;
  color: Color;
  from: number;
  to: number;
  d: number;
}

export interface State {
  level: Level;
  speed: number;
  time: number;
  spawned: number;
  parcels: Parcel[];
  gates: number[]; // per node index (junctions only matter)
  sorted: number;
  misses: number;
  /** Per-bin delivery counts, for the view. */
  delivered: number[];
  lastMiss: number;
}

export const edgeLen = (nodes: BeltNode[], a: number, b: number): number =>
  Math.hypot(nodes[b]!.x - nodes[a]!.x, nodes[b]!.y - nodes[a]!.y);

export function init(lv: Level, speedFactor = 1): State {
  return {
    level: lv,
    speed: lv.speed * speedFactor,
    time: 0,
    spawned: 0,
    parcels: [],
    gates: lv.nodes.map(() => 0),
    sorted: 0,
    misses: 0,
    delivered: lv.nodes.map(() => 0),
    lastMiss: -1,
  };
}

export function toggle(s: State, node: number): State | null {
  if (s.level.nodes[node]?.kind !== 'junction' || status(s) !== 'playing') return null;
  const gates = [...s.gates];
  gates[node] = 1 - gates[node]!;
  return { ...s, gates };
}

export function tick(s: State, dtMs: number): State {
  if (status(s) !== 'playing') return s;
  const { nodes, schedule } = s.level;
  const time = s.time + dtMs / 1000;
  const parcels = s.parcels.map((p) => ({ ...p }));
  let { spawned, sorted, misses, lastMiss } = s;
  const delivered = [...s.delivered];
  const spawn = nodes.findIndex((n) => n.kind === 'spawn');
  while (spawned < schedule.length && schedule[spawned]!.t <= time) {
    const late = time - schedule[spawned]!.t;
    parcels.push({ id: spawned, color: schedule[spawned]!.color, from: spawn, to: nodes[spawn]!.next[0]!, d: late * s.speed });
    spawned++;
  }
  const keep: Parcel[] = [];
  for (const p of parcels) {
    p.d += (dtMs / 1000) * s.speed;
    let gone = false;
    for (let len = edgeLen(nodes, p.from, p.to); p.d >= len; len = edgeLen(nodes, p.from, p.to)) {
      p.d -= len;
      const at = nodes[p.to]!;
      if (at.kind === 'bin') {
        delivered[p.to]!++;
        if (at.color === p.color) sorted++;
        else {
          misses++;
          lastMiss = p.to;
        }
        gone = true;
        break;
      }
      p.from = p.to;
      p.to = at.next[s.gates[p.from]!]!;
    }
    if (!gone) keep.push(p);
  }
  return { ...s, time, parcels: keep, spawned, sorted, misses, delivered, lastMiss };
}

export function status(s: State): Status {
  if (s.misses >= MAX_MISSES) return 'lost';
  if (s.spawned === s.level.schedule.length && !s.parcels.length) return 'won';
  return 'playing';
}

/** Bin colors reachable below each node. */
export function colorsBelow(nodes: BeltNode[]): Set<Color>[] {
  const memo: Set<Color>[] = [];
  const visit = (i: number): Set<Color> => {
    if (memo[i]) return memo[i]!;
    const n = nodes[i]!;
    const out = n.kind === 'bin' ? new Set([n.color!]) : new Set(n.next.flatMap((c) => [...visit(c)]));
    memo[i] = out;
    return out;
  };
  nodes.forEach((_, i) => visit(i));
  return memo;
}

/** A perfect player: sets each junction for the next parcel heading into it. */
export function autoplay(lv: Level): Status {
  const below = colorsBelow(lv.nodes);
  let s = init(lv);
  for (let step = 0; step < 200_000 && status(s) === 'playing'; step++) {
    const gates = [...s.gates];
    lv.nodes.forEach((n, j) => {
      if (n.kind !== 'junction') return;
      const coming = s.parcels.filter((p) => p.to === j).sort((a, b) => b.d - a.d)[0];
      if (coming) gates[j] = below[n.next[0]!]!.has(coming.color) ? 0 : 1;
    });
    s = tick({ ...s, gates }, 20);
  }
  return status(s);
}

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  bins: number;
  parcels: number;
  speed: number;
  /** Seconds between parcels at the start and at the end. */
  gapStart: number;
  gapEnd: number;
}

interface TreeNode {
  leaves: number;
  kids?: [TreeNode, TreeNode];
}

function tree(n: number, rnd: Rng): TreeNode {
  if (n === 1) return { leaves: 1 };
  const k = Math.max(1, Math.min(n - 1, Math.floor(n / 2) + (rnd() < 0.5 ? 0 : randInt(rnd, 2) * (rnd() < 0.5 ? -1 : 1))));
  return { leaves: n, kids: [tree(k, rnd), tree(n - k, rnd)] };
}

function layout(root: TreeNode, colors: Color[]): BeltNode[] {
  const depth = (t: TreeNode): number => (t.kids ? 1 + Math.max(depth(t.kids[0]), depth(t.kids[1])) : 0);
  const D = depth(root);
  const nodes: BeltNode[] = [];
  let leaf = 0;
  const place = (t: TreeNode, d: number): number => {
    if (!t.kids) {
      nodes.push({ x: leaf, y: D * 1.15 + 0.4, kind: 'bin', next: [], color: colors[leaf] });
      leaf++;
      return nodes.length - 1;
    }
    const idx = nodes.push({ x: 0, y: d * 1.15, kind: 'junction', next: [] }) - 1;
    const l = place(t.kids[0], d + 1);
    const r = place(t.kids[1], d + 1);
    nodes[idx]!.next = [l, r];
    nodes[idx]!.x = (nodes[l]!.x + nodes[r]!.x) / 2;
    return idx;
  };
  const top = place(root, 0);
  nodes.push({ x: nodes[top]!.x, y: -1.1, kind: 'spawn', next: [top] });
  return nodes;
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  const colors = shuffle(rnd, [...COLORS]).slice(0, p.bins);
  const nodes = layout(tree(p.bins, rnd), colors);
  for (let attempt = 0; ; attempt++) {
    const schedule: { t: number; color: Color }[] = [];
    let t = 1;
    for (let i = 0; i < p.parcels; i++) {
      schedule.push({ t: Math.round(t * 100) / 100, color: colors[randInt(rnd, colors.length)]! });
      const f = p.parcels > 1 ? i / (p.parcels - 1) : 0;
      t += Math.max(0.35, (p.gapStart + (p.gapEnd - p.gapStart) * f) * (0.85 + rnd() * 0.3));
    }
    const lv: Level = { id: p.id, name: p.name, nodes, schedule, speed: p.speed };
    // Never touching a switch must lose; otherwise the level plays itself.
    let idle = init(lv);
    while (status(idle) === 'playing') idle = tick(idle, 50);
    if (status(idle) === 'lost' || attempt > 50) return lv;
  }
}
