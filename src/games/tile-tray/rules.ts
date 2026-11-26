import { mulberry32, randInt, shuffle, type Rng } from '../../lib/rng';
import type { LevelBase, Status } from '../../shell/types';

export const TRAY_SIZE = 7;
export const ICON_COUNT = 12;

/** Tiles live on a half-tile grid: a tile spans [x, x+2) × [y, y+2) on layer z. */
export interface Tile {
  id: string;
  x: number;
  y: number;
  z: number;
  icon: number;
}

export interface Level extends LevelBase {
  width: number; // in half-tile units
  height: number;
  tiles: Tile[];
  solution: string[];
}

export interface State {
  tiles: Tile[];
  tray: number[];
}

export interface Event {
  icon: number;
  cleared: boolean;
}

export const covers = (a: Tile, b: Tile): boolean => a.z > b.z && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

export function isFree(tiles: Tile[], t: Tile): boolean {
  return !tiles.some((o) => o !== t && covers(o, t));
}

/** Insert next to matching icons; three of a kind clear. */
export function addToTray(tray: number[], icon: number): { tray: number[]; before: number[]; cleared: boolean } {
  const before = [...tray];
  const last = before.lastIndexOf(icon);
  if (last === -1) before.push(icon);
  else before.splice(last + 1, 0, icon);
  const count = before.filter((i) => i === icon).length;
  if (count >= 3) return { tray: before.filter((i) => i !== icon), before, cleared: true };
  return { tray: before, before, cleared: false };
}

export const init = (lv: Level): State => ({ tiles: lv.tiles, tray: [] });

export function pickTile(s: State, id: string): { state: State; event: Event } | null {
  const t = s.tiles.find((x) => x.id === id);
  if (!t || !isFree(s.tiles, t) || status(s) !== 'playing') return null;
  const r = addToTray(s.tray, t.icon);
  return { state: { tiles: s.tiles.filter((x) => x !== t), tray: r.tray }, event: { icon: t.icon, cleared: r.cleared } };
}

export function status(s: State): Status {
  if (s.tray.length >= TRAY_SIZE) return 'lost';
  return s.tiles.length === 0 && s.tray.length === 0 ? 'won' : 'playing';
}

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  cols: number; // tiles per row on the bottom layer
  rows: number;
  layers: number;
  icons: number;
  /** 0..1: how often a new icon group starts before the current ones finish. */
  spread: number;
}

function layout(p: Params, rnd: Rng): Omit<Tile, 'icon'>[] {
  const out: Omit<Tile, 'icon'>[] = [];
  for (let z = 0; z < p.layers; z++) {
    const off = z % 2; // odd layers sit half a tile over
    const inset = Math.floor(z / 2);
    const fill = z === 0 ? 0.85 : 0.75;
    for (let j = inset; j < p.rows - inset - off; j++) {
      for (let i = inset; i < p.cols - inset - off; i++) {
        if (rnd() < fill) out.push({ id: `t${out.length}`, x: 2 * i + off, y: 2 * j + off, z });
      }
    }
  }
  // Need a multiple of 3: drop tiles from the top layer.
  out.sort((a, b) => a.z - b.z);
  while (out.length % 3) out.pop();
  return out;
}

/** A random order in which tiles can be picked (always take an uncovered one). */
function removalOrder(tiles: Tile[], rnd: Rng): Tile[] {
  let left = [...tiles];
  const order: Tile[] = [];
  while (left.length) {
    const free = left.filter((t) => isFree(left, t));
    const t = free[randInt(rnd, free.length)]!;
    order.push(t);
    left = left.filter((x) => x !== t);
  }
  return order;
}

/**
 * Assign icons along the removal order in groups of three. At most 3 groups
 * are open at a time, so following the order never puts more than 6 tiles in
 * the 7-slot tray.
 */
function assignIcons(order: Tile[], p: Params, rnd: Rng): void {
  const palette = shuffle(rnd, Array.from({ length: ICON_COUNT }, (_, i) => i)).slice(0, p.icons);
  let nextIcon = 0;
  const open: { icon: number; size: number }[] = [];
  order.forEach((t, idx) => {
    const remaining = order.length - idx;
    const needs = open.reduce((n, g) => n + 3 - g.size, 0);
    const canOpen = open.length < 3 && remaining - 1 >= needs + 2;
    let g: { icon: number; size: number };
    if (!open.length || (canOpen && rnd() < p.spread)) {
      // Avoid two open groups with the same icon (they would clear early).
      let icon = palette[nextIcon++ % palette.length]!;
      for (let k = 0; k < palette.length && open.some((o) => o.icon === icon); k++) icon = palette[nextIcon++ % palette.length]!;
      g = { icon, size: 0 };
      open.push(g);
    } else {
      g = open[rnd() < 0.6 ? 0 : randInt(rnd, open.length)]!;
    }
    t.icon = g.icon;
    if (++g.size === 3) open.splice(open.indexOf(g), 1);
  });
}

export function replay(lv: Level, order: string[]): Status {
  let s = init(lv);
  for (const id of order) {
    const r = pickTile(s, id);
    if (!r) return 'lost';
    s = r.state;
  }
  return status(s);
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  for (let attempt = 0; ; attempt++) {
    const tiles = layout(p, rnd).map((t) => ({ ...t, icon: 0 }));
    const order = removalOrder(tiles, rnd);
    assignIcons(order, p, rnd);
    const width = Math.max(...tiles.map((t) => t.x)) + 2;
    const height = Math.max(...tiles.map((t) => t.y)) + 2;
    const lv: Level = { id: p.id, name: p.name, width, height, tiles, solution: order.map((t) => t.id) };
    if (replay(lv, lv.solution) === 'won' || attempt > 50) return lv;
  }
}
