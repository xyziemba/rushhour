import { describe, expect, it } from 'vitest';
import { endlessParams, generateLevel, replays } from '../src/engine/generator';
import { getStatus, newGame, validateLevel } from '../src/engine/game';
import { solve } from '../src/engine/solver';
import type { Level } from '../src/engine/types';
import { LEVEL_COUNT, LEVEL_PARAMS, getLevel } from '../src/levels/levels';

const replaysStored = (lv: Level) => replays(lv, lv.solution ?? []);

describe('campaign levels', () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    it(`level ${i + 1} is valid and its stored solution wins`, () => {
      const lv = getLevel(i);
      expect(validateLevel(lv)).toEqual([]);
      expect(getStatus(newGame(lv))).toBe('playing');
      expect(replaysStored(lv)).toBe(true);
    });
  }

  it('the independent solver also solves the early levels', () => {
    for (let i = 0; i < 4; i++) expect(solve(getLevel(i)).solution).not.toBeNull();
  });

  it('is deterministic', () => {
    expect(JSON.stringify(generateLevel({ ...getLevelParamsCopy(4) }))).toBe(JSON.stringify(getLevel(4)));
  });
});

function getLevelParamsCopy(i: number) {
  return { ...LEVEL_PARAMS[i]! };
}

describe('endless generator', () => {
  it('produces valid, winnable levels across 1000 seeds', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const lv = generateLevel(endlessParams(seed, seed % 15));
      expect(validateLevel(lv)).toEqual([]);
      expect(replaysStored(lv)).toBe(true);
    }
  }, 30_000);
});
