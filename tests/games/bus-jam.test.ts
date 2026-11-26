import { describe, expect, it } from 'vitest';
import { boardAll, exitVehicle, firstBlocker, getStatus, loseReason, newGame, tap, validateLevel } from '../../src/games/bus-jam/rules';
import type { Level, Vehicle } from '../../src/games/bus-jam/types';

const car = (id: string, color: Vehicle['color'], x: number, y: number, dir: Vehicle['dir'], length: Vehicle['length'] = 1, capacity = 2): Vehicle => ({
  id, color, x, y, dir, length, capacity,
});

function level(partial: Partial<Level>): Level {
  return { id: 't', name: 't', cols: 4, rows: 4, bays: 2, vehicles: [], queue: [], ...partial };
}

describe('exit rules', () => {
  it('moves a vehicle with a clear path into the leftmost free bay', () => {
    const s = newGame(level({ vehicles: [car('a', 'red', 0, 0, 'up')], queue: ['red', 'red'] }));
    const r = exitVehicle(s, 'a');
    expect(r.result).toBe('moved');
    if (r.result !== 'moved') return;
    expect(r.bayIndex).toBe(0);
    expect(r.state.lot).toHaveLength(0);
    expect(r.state.moves).toBe(1);
  });

  it('reports the nearest blocker and does not count a move', () => {
    const s = newGame(level({
      vehicles: [car('a', 'red', 0, 3, 'up'), car('far', 'blue', 0, 0, 'left'), car('near', 'blue', 0, 2, 'left')],
      queue: ['red', 'red', 'blue', 'blue', 'blue', 'blue'],
    }));
    const r = exitVehicle(s, 'a');
    expect(r.result).toBe('blocked');
    if (r.result === 'blocked') expect(r.blockerId).toBe('near');
    expect(r.state.moves).toBe(0);
  });

  it('handles every direction and vehicle length', () => {
    const s = newGame(level({
      cols: 5, rows: 5,
      vehicles: [
        car('r', 'red', 1, 1, 'right', 2),   // (1,1),(2,1) → path (3,1),(4,1)
        car('d', 'red', 3, 2, 'down', 3),    // (3,2),(3,3),(3,4) → no path
        car('l', 'red', 4, 0, 'left'),       // path (3..0, 0)
        car('blk', 'red', 4, 1, 'up'),       // blocks 'r'
      ],
      queue: [],
    }));
    expect(firstBlocker(s, 'r')?.id).toBe('blk');
    expect(firstBlocker(s, 'd')).toBeNull();
    expect(firstBlocker(s, 'l')).toBeNull();
    expect(firstBlocker(s, 'blk')?.id).toBe('l');
  });

  it('refuses when all bays are full', () => {
    const lv = level({
      bays: 1,
      vehicles: [car('a', 'red', 0, 0, 'up'), car('b', 'blue', 1, 0, 'up')],
      queue: ['blue', 'blue', 'red', 'red'],
    });
    const s = tap(newGame(lv), 'a').state;
    expect(getStatus(s)).toBe('lost');
    expect(loseReason(s)).toBe('bays-full');
    expect(exitVehicle(s, 'b').result).toBe('invalid');
  });
});

describe('boarding', () => {
  it('boards matching passengers and departs a full vehicle', () => {
    const s = newGame(level({ vehicles: [car('a', 'red', 0, 0, 'up', 1, 2)], queue: ['red', 'red'] }));
    const moved = exitVehicle(s, 'a');
    const { state, events } = boardAll(moved.state);
    expect(events.map((e) => e.departed)).toEqual([false, true]);
    expect(state.bays[0]).toBeNull();
    expect(getStatus(state)).toBe('won');
  });

  it('stops when the front color has no parked vehicle', () => {
    const s = newGame(level({
      vehicles: [car('a', 'red', 0, 0, 'up', 1, 2), car('b', 'blue', 1, 0, 'up', 1, 2)],
      queue: ['red', 'blue', 'red', 'blue'],
    }));
    const s1 = tap(s, 'a').state;
    expect(s1.queue).toEqual(['blue', 'red', 'blue']);
    expect(s1.bays[0]?.seatsLeft).toBe(1);
    const s2 = tap(s1, 'b').state;
    expect(getStatus(s2)).toBe('won');
  });

  it('fills the vehicle that parked first when two share a color', () => {
    const s = newGame(level({
      vehicles: [car('a', 'red', 0, 0, 'up', 1, 2), car('b', 'red', 1, 0, 'up', 1, 2), car('c', 'blue', 2, 0, 'up', 1, 1)],
      queue: ['blue', 'red', 'red', 'red', 'red'],
      bays: 3,
    }));
    let st = tap(s, 'b').state;
    st = tap(st, 'a').state;
    st = tap(st, 'c').state;
    expect(getStatus(st)).toBe('won');
  });

  it('detects gridlock', () => {
    const s = newGame(level({
      cols: 2, rows: 1,
      vehicles: [car('a', 'red', 0, 0, 'right', 1, 1), car('b', 'blue', 1, 0, 'left', 1, 1)],
      queue: ['red', 'blue'],
    }));
    expect(loseReason(s)).toBe('gridlock');
  });
});

describe('validateLevel', () => {
  it('flags capacity mismatches and overlaps', () => {
    const errs = validateLevel(level({
      vehicles: [car('a', 'red', 0, 0, 'right', 2), car('b', 'red', 1, 0, 'up')],
      queue: ['red'],
    }));
    expect(errs.some((e) => e.includes('overlaps'))).toBe(true);
    expect(errs.some((e) => e.startsWith('red'))).toBe(true);
  });
});
