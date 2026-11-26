import { mulberry32, randInt, type Rng } from '../../lib/rng';
import type { Color } from '../../shell/palette';
import type { LevelBase, Status } from '../../shell/types';

export const SIZE = 8;

export interface Shape {
  cells: [number, number][];
  w: number;
  h: number;
  color: Color;
  /** Relative weight for random draws; big pieces are rarer. */
  weight: number;
}

function shape(color: Color, weight: number, ...rows: string[]): Shape {
  const cells: [number, number][] = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && cells.push([x, y])));
  return { cells, w: Math.max(...rows.map((r) => r.length)), h: rows.length, color, weight };
}

export const SHAPES: Shape[] = [
  shape('yellow', 2, '#'),
  shape('orange', 3, '##'),
  shape('orange', 3, '#', '#'),
  shape('red', 3, '###'),
  shape('red', 3, '#', '#', '#'),
  shape('pink', 2, '####'),
  shape('pink', 2, '#', '#', '#', '#'),
  shape('purple', 1, '#####'),
  shape('purple', 1, '#', '#', '#', '#', '#'),
  shape('green', 3, '##', '##'),
  shape('teal', 1, '###', '###', '###'),
  shape('blue', 2, '##', '#.'),
  shape('blue', 2, '##', '.#'),
  shape('blue', 2, '#.', '##'),
  shape('blue', 2, '.#', '##'),
  shape('green', 1, '###', '#..', '#..'),
  shape('green', 1, '###', '..#', '..#'),
  shape('teal', 2, '#.', '#.', '##'),
  shape('teal', 2, '###', '#..'),
  shape('yellow', 2, '###', '.#.'),
  shape('yellow', 2, '.#.', '###'),
  shape('orange', 2, '##.', '.##'),
  shape('orange', 2, '.##', '##.'),
];

export type Move = [slot: number, x: number, y: number];

export interface Level extends LevelBase {
  seq: number[];
  blocks: number[];
  target: number;
  solution: Move[];
}

export type Cell = Color | 'stone' | null;

export interface State {
  board: Cell[];
  tray: (number | null)[];
  seq: number[];
  pos: number;
  score: number;
  target: number;
}

export interface Event {
  placed: number[];
  cleared: number[];
}

export function fits(board: Cell[], sh: Shape, x: number, y: number): boolean {
  return sh.cells.every(([cx, cy]) => {
    const px = x + cx, py = y + cy;
    return px >= 0 && py >= 0 && px < SIZE && py < SIZE && board[py * SIZE + px] === null;
  });
}

export function anyFit(board: Cell[], sh: Shape): boolean {
  for (let y = 0; y <= SIZE - sh.h; y++) for (let x = 0; x <= SIZE - sh.w; x++) if (fits(board, sh, x, y)) return true;
  return false;
}

/** Indices of cells in rows/columns that are full. */
export function fullLines(board: Cell[]): { cells: number[]; lines: number } {
  const cells = new Set<number>();
  let lines = 0;
  for (let i = 0; i < SIZE; i++) {
    const row = Array.from({ length: SIZE }, (_, k) => i * SIZE + k);
    const col = Array.from({ length: SIZE }, (_, k) => k * SIZE + i);
    for (const line of [row, col]) {
      if (line.every((c) => board[c] !== null)) {
        lines++;
        line.forEach((c) => cells.add(c));
      }
    }
  }
  return { cells: [...cells], lines };
}

export function init(lv: Level): State {
  const board: Cell[] = Array(SIZE * SIZE).fill(null);
  for (const b of lv.blocks) board[b] = 'stone';
  return { board, tray: lv.seq.slice(0, 3), seq: lv.seq, pos: 3, score: 0, target: lv.target };
}

export function place(s: State, [slot, x, y]: Move): { state: State; event: Event } | null {
  const id = s.tray[slot];
  if (id === null || id === undefined || status(s) !== 'playing') return null;
  const sh = SHAPES[id]!;
  if (!fits(s.board, sh, x, y)) return null;
  const board = [...s.board];
  const placed = sh.cells.map(([cx, cy]) => (y + cy) * SIZE + x + cx);
  for (const c of placed) board[c] = sh.color;
  const { cells: cleared, lines } = fullLines(board);
  for (const c of cleared) board[c] = null;
  let tray = [...s.tray];
  tray[slot] = null;
  let pos = s.pos;
  if (tray.every((t) => t === null)) {
    tray = s.seq.slice(pos, pos + 3);
    pos += 3;
  }
  const score = s.score + placed.length + 10 * lines * lines;
  return { state: { ...s, board, tray, pos, score }, event: { placed, cleared } };
}

export function status(s: State): Status {
  if (s.score >= s.target) return 'won';
  return s.tray.some((t) => t !== null && anyFit(s.board, SHAPES[t]!)) ? 'playing' : 'lost';
}

// ---------- generator ----------

export interface Params {
  id: string;
  name: string;
  seed: number;
  /** Pieces the calibration bot gets to place; more pieces = higher target. */
  pieces: number;
  /** Pre-filled cells. */
  blocks: number;
  /** Fraction of the bot's score required. */
  factor: number;
}

function draw(rnd: Rng): number {
  const total = SHAPES.reduce((n, s) => n + s.weight, 0);
  let r = rnd() * total;
  for (let i = 0; i < SHAPES.length; i++) {
    r -= SHAPES[i]!.weight;
    if (r < 0) return i;
  }
  return 0;
}

/** Greedy bot: clears lines when it can, otherwise packs pieces against filled cells and walls. */
export function botMove(s: State): Move | null {
  let best: Move | null = null;
  let bestVal = -Infinity;
  s.tray.forEach((id, slot) => {
    if (id === null) return;
    const sh = SHAPES[id]!;
    for (let y = 0; y <= SIZE - sh.h; y++) {
      for (let x = 0; x <= SIZE - sh.w; x++) {
        if (!fits(s.board, sh, x, y)) continue;
        const board = [...s.board];
        for (const [cx, cy] of sh.cells) board[(y + cy) * SIZE + x + cx] = sh.color;
        const { lines } = fullLines(board);
        let contacts = 0;
        for (const [cx, cy] of sh.cells) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = x + cx + dx, ny = y + cy + dy;
            if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || board[ny * SIZE + nx] !== null) contacts++;
          }
        }
        const val = lines * 40 + contacts - sh.cells.length * 0.5;
        if (val > bestVal) {
          bestVal = val;
          best = [slot, x, y];
        }
      }
    }
  });
  return best;
}

export function generate(p: Params): Level {
  const rnd = mulberry32(p.seed);
  const seq = Array.from({ length: 600 }, () => draw(rnd));
  const blocks: number[] = [];
  while (blocks.length < p.blocks) {
    const c = randInt(rnd, SIZE * SIZE);
    if (!blocks.includes(c)) blocks.push(c);
  }
  // Calibrate: let the bot play, then ask for a share of its score.
  const base: Level = { id: p.id, name: p.name, seq, blocks, target: Infinity, solution: [] };
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
  const target = Math.max(10, Math.floor((s.score * p.factor) / 5) * 5);
  const reach = scores.findIndex((sc) => sc >= target);
  return { ...base, target, solution: moves.slice(0, reach + 1) };
}
