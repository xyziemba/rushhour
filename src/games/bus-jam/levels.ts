import { generateLevel, type GenParams } from './generate';
import type { Level } from './types';

/**
 * The campaign. Each level is built deterministically from fixed generator
 * parameters (including the seed), so every player gets the same puzzles.
 * tests/levels.test.ts checks that each one is valid and solvable.
 */
export const LEVEL_PARAMS: GenParams[] = [
  { id: 'l1', name: 'First Stop', seed: 101, cols: 5, rows: 5, colors: 2, vehicles: 4, bays: 4, bury: 0 },
  { id: 'l2', name: 'Rush Hour', seed: 202, cols: 5, rows: 6, colors: 3, vehicles: 6, bays: 4, bury: 0.2 },
  { id: 'l3', name: 'Side Streets', seed: 303, cols: 6, rows: 6, colors: 3, vehicles: 8, bays: 4, bury: 0.3 },
  { id: 'l4', name: 'Crosstown', seed: 404, cols: 6, rows: 7, colors: 4, vehicles: 10, bays: 5, bury: 0.4 },
  { id: 'l5', name: 'Market Day', seed: 505, cols: 6, rows: 7, colors: 4, vehicles: 12, bays: 5, bury: 0.5 },
  { id: 'l6', name: 'Gridlock Alley', seed: 606, cols: 7, rows: 7, colors: 5, vehicles: 14, bays: 5, bury: 0.55 },
  { id: 'l7', name: 'Downtown', seed: 707, cols: 7, rows: 8, colors: 5, vehicles: 16, bays: 5, bury: 0.6 },
  { id: 'l8', name: 'Stadium Exit', seed: 808, cols: 7, rows: 8, colors: 6, vehicles: 18, bays: 5, bury: 0.7 },
  { id: 'l9', name: 'Airport Loop', seed: 909, cols: 8, rows: 8, colors: 7, vehicles: 21, bays: 5, bury: 0.75 },
  { id: 'l10', name: 'Final Rush', seed: 1010, cols: 8, rows: 9, colors: 8, vehicles: 24, bays: 5, bury: 0.8 },
];

const cache = new Map<number, Level>();

export function getLevel(index: number): Level {
  let level = cache.get(index);
  if (!level) {
    level = generateLevel(LEVEL_PARAMS[index]!);
    cache.set(index, level);
  }
  return level;
}

export const LEVEL_COUNT = LEVEL_PARAMS.length;
