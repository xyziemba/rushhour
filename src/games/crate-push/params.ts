import type { Params } from './rules';

const P = (i: number, name: string, cols: number, rows: number, crates: number, clutter: number, minMoves: number): Params => ({
  id: `cp${i}`, name, seed: 2700 + i * 59, cols, rows, crates, clutter, minMoves,
});

/** Campaign settings. Levels are pre-generated into levels.json by scripts/gen-levels.ts. */
export const CRATE_PARAMS: Params[] = [
  P(1, 'Loading Dock', 6, 6, 1, 1, 6),
  P(2, 'Storeroom', 6, 6, 1, 3, 12),
  P(3, 'Pantry', 7, 6, 2, 2, 16),
  P(4, 'Cellar', 7, 7, 2, 4, 22),
  P(5, 'Warehouse', 8, 7, 2, 5, 28),
  P(6, 'Stockroom', 8, 7, 3, 4, 30),
  P(7, 'Depot', 8, 8, 3, 6, 36),
  P(8, 'Freight Yard', 9, 8, 3, 7, 42),
  P(9, 'Cargo Hold', 9, 8, 4, 6, 44),
  P(10, 'Grand Depot', 9, 9, 4, 8, 50),
];
