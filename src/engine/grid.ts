import type { Dir, Vehicle } from './types';

export type Cell = [number, number];

export const isVertical = (dir: Dir): boolean => dir === 'up' || dir === 'down';

/** Cells occupied by a vehicle. */
export function vehicleCells(v: Pick<Vehicle, 'x' | 'y' | 'length' | 'dir'>): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < v.length; i++) {
    out.push(isVertical(v.dir) ? [v.x, v.y + i] : [v.x + i, v.y]);
  }
  return out;
}

/** Cells between the vehicle's front and the edge of the grid, nearest first. */
export function exitPath(
  v: Pick<Vehicle, 'x' | 'y' | 'length' | 'dir'>,
  cols: number,
  rows: number,
): Cell[] {
  const out: Cell[] = [];
  switch (v.dir) {
    case 'up':
      for (let y = v.y - 1; y >= 0; y--) out.push([v.x, y]);
      break;
    case 'down':
      for (let y = v.y + v.length; y < rows; y++) out.push([v.x, y]);
      break;
    case 'left':
      for (let x = v.x - 1; x >= 0; x--) out.push([x, v.y]);
      break;
    case 'right':
      for (let x = v.x + v.length; x < cols; x++) out.push([x, v.y]);
      break;
  }
  return out;
}

/** Map from "x,y" to the id of the vehicle occupying that cell. */
export function occupancy(vehicles: Vehicle[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const v of vehicles) {
    for (const [x, y] of vehicleCells(v)) map.set(`${x},${y}`, v.id);
  }
  return map;
}

export function inBounds(v: Pick<Vehicle, 'x' | 'y' | 'length' | 'dir'>, cols: number, rows: number): boolean {
  return vehicleCells(v).every(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows);
}
