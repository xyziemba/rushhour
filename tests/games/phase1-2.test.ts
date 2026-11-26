import { describe, expect, it } from 'vitest';
import * as AE from '../../src/games/arrow-escape/rules';
import * as TT from '../../src/games/tile-tray/rules';
import * as CT from '../../src/games/color-tubes/rules';
import * as PT from '../../src/games/pipe-turn/rules';
import * as SS from '../../src/games/screw-sort/rules';
import * as BF from '../../src/games/block-fit/rules';

describe('arrow escape', () => {
  const lv: AE.Level = {
    id: 't', name: 't', cols: 3, rows: 1, lives: 2, solution: [],
    pieces: [
      { id: 'a', x: 0, y: 0, length: 1, dir: 'right' },
      { id: 'b', x: 2, y: 0, length: 1, dir: 'up' },
    ],
  };
  it('a blocked arrow costs a life and stays put', () => {
    const r = AE.tap(AE.init(lv), 'a')!;
    expect(r.event).toEqual({ type: 'crash', blocker: 'b' });
    expect(r.state.lives).toBe(1);
    expect(r.state.pieces).toHaveLength(2);
  });
  it('clear arrows leave; losing all lives loses', () => {
    let s = AE.tap(AE.init(lv), 'b')!.state;
    s = AE.tap(s, 'a')!.state;
    expect(AE.status(s)).toBe('won');
    let t = AE.tap(AE.init(lv), 'a')!.state;
    t = AE.tap(t, 'a')!.state;
    expect(AE.status(t)).toBe('lost');
  });
});

describe('tile tray', () => {
  it('groups matches and clears triples', () => {
    expect(TT.addToTray([1, 2], 1).tray).toEqual([1, 1, 2]);
    expect(TT.addToTray([1, 1, 2], 1)).toMatchObject({ tray: [2], cleared: true });
  });
  it('covered tiles cannot be taken; a full tray loses', () => {
    const top = { id: 'top', x: 1, y: 1, z: 1, icon: 0 };
    const under = { id: 'under', x: 0, y: 0, z: 0, icon: 1 };
    const s: TT.State = { tiles: [top, under], tray: [] };
    expect(TT.pickTile(s, 'under')).toBeNull();
    expect(TT.pickTile(s, 'top')).not.toBeNull();
    expect(TT.status({ tiles: [under], tray: [1, 2, 3, 4, 5, 6, 7] })).toBe('lost');
  });
});

describe('color tubes', () => {
  it('pours as much of the top color as fits, onto matching colors only', () => {
    const s: CT.State = { cap: 4, tubes: [['red', 'blue', 'blue'], ['blue', 'blue', 'blue'], ['red'], []] };
    expect(CT.pour(s, [0, 1])!.amount).toBe(1);
    expect(CT.pour(s, [0, 2])).toBeNull();
    expect(CT.pour(s, [0, 3])!.state.tubes[3]).toEqual(['blue', 'blue']);
  });
  it('is solved when each tube is empty or one full color', () => {
    expect(CT.isSolved({ cap: 2, tubes: [['red', 'red'], [], ['blue', 'blue']] })).toBe(true);
    expect(CT.isSolved({ cap: 2, tubes: [['red'], ['red'], ['blue', 'blue']] })).toBe(false);
  });
});

describe('pipe turn', () => {
  it('rotates masks clockwise', () => {
    expect(PT.rotate(PT.U, 1)).toBe(PT.R);
    expect(PT.rotate(PT.U | PT.L, 1)).toBe(PT.U | PT.R);
    expect(PT.rotate(PT.U | PT.D, 1)).toBe(PT.R | PT.L);
  });
  it('counts symmetric pieces correctly', () => {
    expect(PT.tapsToSolve(PT.U | PT.D, 1)).toBe(1); // straight: one more turn restores it
    expect(PT.tapsToSolve(15, 3)).toBe(0); // cross looks the same every way
  });
  it('generated starts are scrambled and the solution solves them', () => {
    const lv = PT.generate({ id: 'x', name: 'x', seed: 3, cols: 4, rows: 4 });
    let s = PT.init(lv);
    expect(PT.isSolved(s)).toBe(false);
    for (const i of lv.solution) s = PT.turn(s, i)!;
    expect(PT.isSolved(s)).toBe(true);
  });
});

describe('screw sort', () => {
  const lv: SS.Level = {
    id: 't', name: 't', cols: 3, rows: 2, holes: 1, solution: [],
    plates: [
      { id: 'low', x: 0, y: 0, w: 3, h: 2, z: 0 },
      { id: 'high', x: 0, y: 0, w: 1, h: 1, z: 1 },
    ],
    screws: [
      { id: 'a', plate: 'low', x: 0, y: 0, color: 'red' }, // under 'high'
      { id: 'b', plate: 'low', x: 1, y: 0, color: 'red' },
      { id: 'c', plate: 'low', x: 2, y: 0, color: 'red' },
      { id: 'd', plate: 'high', x: 0, y: 0, color: 'blue' },
      { id: 'e', plate: 'low', x: 1, y: 1, color: 'blue' },
      { id: 'f', plate: 'low', x: 2, y: 1, color: 'blue' },
    ],
    boxes: ['red', 'blue'],
  };
  it('covered screws are refused; removing the last screw drops the plate', () => {
    const s = SS.init(lv);
    expect(SS.unscrew(s, 'a')).toEqual({ error: 'covered' });
    const r = SS.unscrew(s, 'd');
    expect('state' in r && r.state.plates.map((p) => p.id)).toEqual(['low']);
  });
  it('full boxes leave and waiting screws move in', () => {
    let s = SS.init(lv);
    s = (SS.unscrew(s, 'b') as { state: SS.State }).state;
    s = (SS.unscrew(s, 'c') as { state: SS.State }).state;
    s = (SS.unscrew(s, 'd') as { state: SS.State }).state; // blue box is open too
    s = (SS.unscrew(s, 'a') as { state: SS.State }).state; // red box full → leaves
    expect(s.active.map((b) => b.color)).toEqual(['blue']);
  });
});

describe('block fit', () => {
  it('clears full rows and columns', () => {
    const board = Array<BF.State['board'][number]>(64).fill(null);
    for (let x = 0; x < 8; x++) board[x] = 'red';
    expect(BF.fullLines(board)).toEqual({ cells: [0, 1, 2, 3, 4, 5, 6, 7], lines: 1 });
  });
  it('targets are reachable and sensible', () => {
    for (let i = 1; i <= 10; i++) {
      const lv = BF.generate({ id: 'x', name: 'x', seed: i * 7, pieces: 10 + i * 8, blocks: i, factor: 0.8 });
      expect(lv.target).toBeGreaterThan(9);
      expect(lv.solution.length).toBeGreaterThan(2);
    }
  });
});
