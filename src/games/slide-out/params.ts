import type { Params } from './rules';

const P = (i: number, name: string, blocks: number, min: number, max: number): Params => ({ id: `so${i}`, name, seed: 3300 + i * 41, blocks, min, max });

/** Campaign generator settings. Levels are pre-generated into levels.json by scripts/gen-levels.ts. */
export const SLIDE_PARAMS: Params[] = [
  P(1, 'Parking Spot', 5, 2, 4),
  P(2, 'Back Out', 6, 4, 6),
  P(3, 'Shuffle', 7, 6, 8),
  P(4, 'Side Step', 8, 8, 10),
  P(5, 'Gridlock', 9, 10, 12),
  P(6, 'Tight Squeeze', 10, 12, 15),
  P(7, 'Double Park', 11, 14, 18),
  P(8, 'Rush Out', 12, 16, 22),
  P(9, 'No Way Out', 12, 20, 28),
  P(10, 'Escape Artist', 13, 24, 40),
];
