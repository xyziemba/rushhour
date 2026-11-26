import { describe, expect, it } from 'vitest';
import { isLegacyHash, parseRoute, routeHash } from '../src/shell/router';
import { migrateLegacy } from '../src/shell/storage';
import { busJamStars } from '../src/games/bus-jam/index';

describe('router', () => {
  it('parses every route shape', () => {
    expect(parseRoute('')).toEqual({ kind: 'hub' });
    expect(parseRoute('#/')).toEqual({ kind: 'hub' });
    expect(parseRoute('#/bus-jam')).toEqual({ kind: 'levels', game: 'bus-jam' });
    expect(parseRoute('#/bus-jam/level/3')).toEqual({ kind: 'level', game: 'bus-jam', index: 2 });
    expect(parseRoute('#/bus-jam/endless/42')).toEqual({ kind: 'endless', game: 'bus-jam', seed: 42 });
    expect(parseRoute('#/bus-jam/level/zero')).toEqual({ kind: 'levels', game: 'bus-jam' });
  });

  it('sends old single-game links to Bus Jam', () => {
    expect(isLegacyHash('#/level/4')).toBe(true);
    expect(isLegacyHash('#/bus-jam/level/4')).toBe(false);
    expect(routeHash(parseRoute('#/level/4'))).toBe('#/bus-jam/level/4');
    expect(routeHash(parseRoute('#/endless/77'))).toBe('#/bus-jam/endless/77');
  });

  it('round-trips', () => {
    for (const h of ['#/', '#/bus-jam', '#/bus-jam/level/10', '#/bus-jam/endless/5']) {
      expect(routeHash(parseRoute(h))).toBe(h);
    }
  });
});

describe('storage migration', () => {
  it('moves the old save into the bus-jam slot', () => {
    const migrated = migrateLegacy({ unlocked: 3, best: { l1: 4, l2: 6 }, endlessStreak: 2, symbols: true });
    expect(migrated).toEqual({
      settings: { symbols: true, lastGame: 'bus-jam' },
      games: { 'bus-jam': { unlocked: 3, stars: { l1: 1, l2: 1 }, best: { l1: 4, l2: 6 }, endlessStreak: 2 } },
    });
  });

  it('ignores missing or junk data', () => {
    expect(migrateLegacy(null)).toBeNull();
    expect(migrateLegacy('nope')).toBeNull();
  });
});

describe('bus jam stars', () => {
  it('rewards solving without undo', () => {
    expect(busJamStars(0)).toBe(3);
    expect(busJamStars(2)).toBe(2);
    expect(busJamStars(3)).toBe(1);
  });
});
