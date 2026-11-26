import { describe, expect, it } from 'vitest';
import * as SO from '../../src/games/slide-out/rules';
import * as CP from '../../src/games/crate-push/rules';
import * as CL from '../../src/games/color-links/rules';
import slideLevels from '../../src/games/slide-out/levels.json';
import crateLevels from '../../src/games/crate-push/levels.json';

describe('slide out', () => {
  const blocks: SO.Block[] = [
    { id: 't', x: 0, y: 2, len: 2, horiz: true },
    { id: 'v', x: 3, y: 1, len: 2, horiz: false },
  ];
  it('slides only within free space along the block axis', () => {
    expect(SO.range(blocks, 't')).toEqual([0, 1]);
    expect(SO.range(blocks, 'v')).toEqual([-1, 3]);
    expect(SO.slide({ blocks }, ['t', 2])).toBeNull();
  });
  it('finds the shortest solution', () => {
    expect(SO.solve(blocks).path).toEqual([['v', -1], ['t', 4]]);
  });
  it('stored campaign pars are optimal and increase', () => {
    const pars = (slideLevels as SO.Level[]).map((l) => l.par);
    for (const l of slideLevels as SO.Level[]) expect(SO.solve(l.blocks, 200_000).path?.length).toBe(l.par);
    expect(pars[9]).toBeGreaterThan(pars[0]!);
  });
});

describe('crate push', () => {
  // ######
  // #P C.#
  // ######
  const lv: CP.Level = {
    id: 't', name: 't', cols: 6, rows: 3, solution: [], par: 0, player: 7, crates: [9], targets: [10],
    walls: [0, 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16, 17],
  };
  it('walks, pushes and refuses to push into walls', () => {
    let s = CP.init(lv);
    s = CP.step(s, 'right')!.state;
    const r = CP.step(s, 'right')!;
    expect(r.event.pushed).toBe(true);
    expect(CP.isSolved(r.state)).toBe(true);
    expect(CP.step(CP.init(lv), 'up')).toBeNull();
  });
  it('spots crates stuck in corners', () => {
    const s = { ...CP.init(lv), crates: [7], player: 8 };
    expect(CP.stuckCrate(s)).toBe(7);
  });
  it('stored campaign solutions are shortest', () => {
    for (const l of (crateLevels as CP.Level[]).slice(0, 6)) expect(CP.solve(CP.init(l)).path?.length).toBe(l.par);
  });
});

describe('color links', () => {
  const lv: CL.Level = {
    id: 't', name: 't', n: 3, solution: [],
    pairs: [
      { color: 'red', a: 0, b: 2 },
      { color: 'blue', a: 3, b: 8 },
    ],
  };
  it('accepts connected paths and fills the board to win', () => {
    let s = CL.init(lv);
    s = CL.draw(s, { pair: 0, path: [0, 1, 2] })!;
    expect(CL.isConnected(s, 0)).toBe(true);
    s = CL.draw(s, { pair: 1, path: [3, 4, 5, 8] })!;
    expect(CL.isSolved(s)).toBe(false); // 6 and 7 still empty
    s = CL.draw(s, { pair: 1, path: [3, 6, 7, 4, 5, 8] })!;
    expect(CL.isSolved(s)).toBe(true);
  });
  it('rejects broken paths and cuts crossed lines', () => {
    const s = CL.init(lv);
    expect(CL.draw(s, { pair: 0, path: [0, 2] })).toBeNull(); // not adjacent
    expect(CL.draw(s, { pair: 0, path: [0, 3] })).toBeNull(); // through another color's dot
    let t = CL.draw(s, { pair: 1, path: [3, 4, 1] })!;
    t = CL.draw(t, { pair: 0, path: [0, 1, 2] })!;
    expect(t.paths[1]).toEqual([3, 4]);
  });
  it('generated boards are fully covered by the solution', () => {
    const g = CL.generate({ id: 'x', name: 'x', seed: 5, n: 7, pairs: 6 });
    expect(g.solution.flatMap((m) => m.path).sort((a, b) => a - b)).toEqual([...Array(49).keys()]);
  });
});
