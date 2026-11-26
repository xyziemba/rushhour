import { describe, expect, it } from 'vitest';
import { GAMES } from '../src/games/registry';
import type { GameModule, LevelBase } from '../src/shell/types';

/** Replay a level's stored solution through the game's public `apply`. */
function replay(game: GameModule<any, any, any, any>, level: LevelBase): string {
  let state = game.init(level);
  for (const move of level.solution ?? []) {
    const r = game.apply(state, move);
    if (!r.ok) return `move ${JSON.stringify(move)} refused: ${r.reason}`;
    state = r.state;
  }
  return game.status(state);
}

describe.each(GAMES.map((g) => [g.id, g] as const))('%s', (_id, meta) => {
  it('registry metadata matches the module', async () => {
    const game = await meta.load();
    expect(game.id).toBe(meta.id);
    expect(game.campaign.count).toBe(meta.levels);
    expect(game.howToPlay.length).toBeGreaterThan(0);
  });

  it('campaign levels are deterministic, start in play and have a winning solution', async () => {
    const game = await meta.load();
    const ids = new Set<string>();
    for (let i = 0; i < game.campaign.count; i++) {
      const level = game.campaign.level(i);
      expect(ids.has(level.id), `duplicate level id ${level.id}`).toBe(false);
      ids.add(level.id);
      expect(game.status(game.init(level))).toBe('playing');
      expect(level.solution?.length, `level ${i + 1} has no stored solution`).toBeGreaterThan(0);
      expect(replay(game, level), `level ${i + 1}`).toBe('won');
    }
  });

  it('endless levels generate quickly and are winnable', async () => {
    const game = await meta.load();
    if (!game.endless) return;
    const budget = game.endlessTest ?? { seeds: 200, ms: 250 };
    for (let seed = 1; seed <= budget.seeds; seed++) {
      const t = performance.now();
      const level = game.endless(seed, seed % 15);
      expect(performance.now() - t, `seed ${seed} too slow`).toBeLessThan(budget.ms);
      expect(JSON.stringify(game.endless(seed, seed % 15))).toBe(JSON.stringify(level));
      expect(replay(game, level), `seed ${seed}`).toBe('won');
    }
  }, 120_000);
});
