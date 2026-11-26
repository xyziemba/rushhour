/** Square-grid helpers shared by grid-based games. */

export type Cell = readonly [x: number, y: number];
export type Dir4 = 'up' | 'down' | 'left' | 'right';

export const DIRS4: readonly Dir4[] = ['up', 'down', 'left', 'right'];

export const DELTA: Record<Dir4, Cell> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export const OPPOSITE: Record<Dir4, Dir4> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const cellKey = (x: number, y: number): string => `${x},${y}`;

export const inGrid = (x: number, y: number, cols: number, rows: number): boolean =>
  x >= 0 && y >= 0 && x < cols && y < rows;

export function neighbors4(x: number, y: number, cols: number, rows: number): Cell[] {
  const out: Cell[] = [];
  for (const d of DIRS4) {
    const nx = x + DELTA[d][0];
    const ny = y + DELTA[d][1];
    if (inGrid(nx, ny, cols, rows)) out.push([nx, ny]);
  }
  return out;
}
