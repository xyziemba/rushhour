import { describe, expect, it } from 'vitest';
import * as HS from '../../src/games/hex-stack/rules';
import * as TS from '../../src/games/train-switches/rules';
import * as CV from '../../src/games/conveyor/rules';
import type { Color } from '../../src/shell/palette';

describe('hex stack', () => {
  // A line of 3 cells: 0 - 1 - 2
  const nbrs = [[1], [0, 2], [1]];
  it('pulls matching top runs onto the placed stack, chaining', () => {
    const stacks: Color[][] = [['blue', 'red'], ['green', 'green'], ['red', 'green']];
    // Place on 1 (already holds green/green for the test): neighbors 2 tops green.
    const r = HS.resolve(stacks, nbrs, 1);
    expect(r.stacks[1]).toEqual(['green', 'green', 'green']);
    expect(r.stacks[2]).toEqual(['red']);
  });
  it('clears ten of a color on top and scores them', () => {
    const tall = Array<Color>(7).fill('red');
    const r = HS.resolve([tall, ['blue', 'red', 'red', 'red'], []], nbrs, 1);
    expect(r.gained).toBe(10);
    expect(r.stacks[1]).toEqual(['blue']);
    expect(r.stacks[0]).toEqual([]);
  });
});

describe('train switches', () => {
  // 2 rows, 1 column of track: node0 (row0) is a switch to node2 or node3; stations at column 1.
  const lv: TS.Level = {
    id: 't', name: 't', cols: 1, rows: 2, outs: [[2, 3], [3], [], []], switches: [0],
    trains: [{ color: 'red', row: 0, depart: 0 }, { color: 'blue', row: 1, depart: 0 }],
    stations: ['red', 'blue'], solution: [],
  };
  it('routes by switch setting and detects collisions', () => {
    expect(TS.simulate(lv, [0]).fail).toBeNull();
    const bad = TS.simulate(lv, [1]).fail!;
    expect(bad.kind).toBe('crash');
    expect(bad.node).toBe(3);
  });
  it('a failed Go counts a run; a good one wins', () => {
    let s = TS.init(lv);
    s = TS.apply(s, { t: 'flip', s: 0 })!.state;
    s = TS.apply(s, { t: 'go' })!.state;
    expect(s.runs).toBe(1);
    s = TS.apply(s, { t: 'flip', s: 0 })!.state;
    s = TS.apply(s, { t: 'go' })!.state;
    expect(TS.status(s)).toBe('won');
  });
});

describe('conveyor', () => {
  const lv = CV.generate({ id: 'x', name: 'x', seed: 9, bins: 3, parcels: 12, speed: 2, gapStart: 1.5, gapEnd: 1 });
  it('a perfect player wins', () => {
    expect(CV.autoplay(lv)).toBe('won');
  });
  it('leaving every switch alone loses', () => {
    let s = CV.init(lv);
    for (let i = 0; i < 5000 && CV.status(s) === 'playing'; i++) s = CV.tick(s, 20);
    expect(CV.status(s)).toBe('lost');
  });
  it('relaxed mode slows the belt', () => {
    expect(CV.init(lv, 0.6).speed).toBeCloseTo(lv.speed * 0.6);
  });
});
