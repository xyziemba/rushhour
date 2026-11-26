import { mulberry32, randInt, shuffle, type Rng } from '../../lib/rng';
import { COLORS, type Color } from '../../shell/palette';
import type { LevelBase, Status } from '../../shell/types';

export const BOX_SIZE = 3;
export const ACTIVE_BOXES = 2;

export interface Plate {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export interface Screw {
  id: string;
  plate: string;
  x: number;
  y: number;
  color: Color;
}

export interface Level extends LevelBase {
  cols: number;
  rows: number;
  holes: number;
  plates: Plate[];
  screws: Screw[];
  /** Box colors in the order they arrive. */
  boxes: Color[];
  solution: string[];
}

export interface Box {
  color: Color;
  filled: number;
}

export interface State {
  plates: Plate[];
  screws: Screw[];
  active: Box[];
  queue: Color[];
  holes: Color[];
  holeCount: number;
}

export type Event = { to: 'box' | 'hole' };

const inside = (p: Plate, x: number, y: number) => x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h;

/** A screw is reachable when no plate above its own covers it. */
export function isFree(s: Pick<State, 'plates'>, sc: Screw): boolean {
  const own = s.plates.find((p) => p.id === sc.plate)!;
  return !s.plates.some((p) => p.z > own.z && inside(p, sc.x, sc.y));
}

function fill(active: Box[], color: Color): boolean {
  const box = active.find((b) => b.color === color && b.filled < BOX_SIZE);
  if (!box) return false;
  box.filled++;
  return true;
}

/** Send full boxes away, open new ones, and move waiting screws from holes into boxes. */
function settle(s: State): State {
  let active = s.active.map((b) => ({ ...b }));
  let queue = [...s.queue];
  let holes = [...s.holes];
  for (let changed = true; changed; ) {
    changed = false;
    if (active.some((b) => b.filled >= BOX_SIZE)) {
      active = active.filter((b) => b.filled < BOX_SIZE);
      changed = true;
    }
    while (active.length < ACTIVE_BOXES && queue.length) {
      active.push({ color: queue.shift()!, filled: 0 });
      changed = true;
    }
    const keep: Color[] = [];
    for (const c of holes) {
      if (fill(active, c)) changed = true;
      else keep.push(c);
    }
    holes = keep;
  }
  return { ...s, active, queue, holes };
}

export function init(lv: Level): State {
  return settle({ plates: lv.plates, screws: lv.screws, active: [], queue: [...lv.boxes], holes: [], holeCount: lv.holes });
}

export function legal(s: State, sc: Screw): 'box' | 'hole' | null {
  if (!isFree(s, sc)) return null;
  if (s.active.some((b) => b.color === sc.color && b.filled < BOX_SIZE)) return 'box';
  return s.holes.length < s.holeCount ? 'hole' : null;
}

export function unscrew(s: State, id: string): { state: State; event: Event } | { error: string } {
  const sc = s.screws.find((x) => x.id === id);
  if (!sc) return { error: 'gone' };
  if (!isFree(s, sc)) return { error: 'covered' };
  const to = legal(s, sc);
  if (!to) return { error: 'no-hole' };
  const active = s.active.map((b) => ({ ...b }));
  const holes = [...s.holes];
  if (to === 'box') fill(active, sc.color);
  else holes.push(sc.color);
  const screws = s.screws.filter((x) => x !== sc);
  // A plate with no screws left falls away.
  const plates = s.plates.filter((p) => screws.some((x) => x.plate === p.id));
  return { state: settle({ ...s, screws, plates, active, holes }), event: { to } };
}

export function status(s: State): Status {
  if (!s.screws.length && !s.holes.length) return 'won';
  return s.screws.some((sc) => legal(s, sc)) ? 'playing' : 'lost';
}

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  cols: number;
  rows: number;
  plates: number;
  colors: number;
  holes: number;
  /** 0..1: how often screws for a new box show up before the current boxes are done. */
  spread: number;
}

function layout(p: Params, rnd: Rng): { plates: Plate[]; screws: Omit<Screw, 'color'>[] } {
  const plates: Plate[] = [];
  const screws: Omit<Screw, 'color'>[] = [];
  const used = new Set<string>();
  for (let k = 0; k < p.plates; k++) {
    const w = 2 + randInt(rnd, Math.min(3, p.cols - 1));
    const h = 2 + randInt(rnd, Math.min(3, p.rows - 1));
    const plate: Plate = { id: `p${k}`, x: randInt(rnd, p.cols - w + 1), y: randInt(rnd, p.rows - h + 1), w, h, z: k };
    const spots: [number, number][] = [];
    for (let y = plate.y; y < plate.y + h; y++) for (let x = plate.x; x < plate.x + w; x++) if (!used.has(`${x},${y}`)) spots.push([x, y]);
    if (!spots.length) continue;
    shuffle(rnd, spots);
    const n = Math.min(spots.length, 2 + randInt(rnd, 3));
    plates.push(plate);
    for (const [x, y] of spots.slice(0, n)) {
      used.add(`${x},${y}`);
      screws.push({ id: `s${screws.length}`, plate: plate.id, x, y });
    }
  }
  // Need a multiple of 3 screws; drop extras from plates that keep at least one.
  while (screws.length % BOX_SIZE) {
    const i = screws.findIndex((s) => screws.filter((o) => o.plate === s.plate).length > 1);
    screws.splice(i === -1 ? screws.length - 1 : i, 1);
  }
  return { plates: plates.filter((pl) => screws.some((s) => s.plate === pl.id)), screws };
}

function removalOrder(plates: Plate[], screws: Omit<Screw, 'color'>[], rnd: Rng): Omit<Screw, 'color'>[] {
  let ps = [...plates];
  let left = [...screws];
  const order: Omit<Screw, 'color'>[] = [];
  while (left.length) {
    const free = left.filter((sc) => isFree({ plates: ps }, sc as Screw));
    const pick = free[randInt(rnd, free.length)]!;
    order.push(pick);
    left = left.filter((x) => x !== pick);
    ps = ps.filter((pl) => left.some((x) => x.plate === pl.id));
  }
  return order;
}

/** Color screws in groups of 3 along the removal order; group order is the box order. */
function colorize(order: Omit<Screw, 'color'>[], p: Params, rnd: Rng): { screws: Screw[]; boxes: Color[] } {
  const palette = shuffle(rnd, [...COLORS]).slice(0, p.colors);
  const open: { color: Color; size: number }[] = [];
  const boxes: Color[] = [];
  let next = 0;
  const screws = order.map((sc, idx) => {
    const remaining = order.length - idx;
    const needs = open.reduce((n, g) => n + BOX_SIZE - g.size, 0);
    const canOpen = open.length < 3 && remaining - 1 >= needs + BOX_SIZE - 1;
    let g: { color: Color; size: number };
    if (!open.length || (canOpen && rnd() < p.spread)) {
      let color = palette[next++ % palette.length]!;
      for (let k = 0; k < palette.length && open.some((o) => o.color === color); k++) color = palette[next++ % palette.length]!;
      g = { color, size: 0 };
      open.push(g);
      boxes.push(color);
    } else {
      g = open[rnd() < 0.6 ? 0 : randInt(rnd, open.length)]!;
    }
    if (++g.size === BOX_SIZE) open.splice(open.indexOf(g), 1);
    return { ...sc, color: g.color };
  });
  return { screws, boxes };
}

export function replay(lv: Level, order: string[]): Status {
  let s = init(lv);
  for (const id of order) {
    const r = unscrew(s, id);
    if ('error' in r) return 'lost';
    s = r.state;
  }
  return status(s);
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  for (let attempt = 0; ; attempt++) {
    const spread = attempt > 30 ? 0 : p.spread;
    const { plates, screws } = layout(p, rnd);
    const order = removalOrder(plates, screws, rnd);
    const { screws: colored, boxes } = colorize(order, { ...p, spread }, rnd);
    const lv: Level = {
      id: p.id, name: p.name, cols: p.cols, rows: p.rows, holes: p.holes,
      plates, screws: colored, boxes, solution: order.map((s) => s.id),
    };
    if (screws.length >= BOX_SIZE * 2 && replay(lv, lv.solution) === 'won') return lv;
    if (attempt > 200) throw new Error(`screw sort: no level for seed ${p.seed}`);
  }
}
