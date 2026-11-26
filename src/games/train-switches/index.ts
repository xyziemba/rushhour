import './style.css';
import { makeCampaign } from '../../shell/helpers';
import type { GameModule, Stars } from '../../shell/types';
import { apply, generate, init, status, type Event, type Level, type Move, type Params, type State } from './rules';
import { TrainView } from './view';

const P = (i: number, name: string, cols: number, rows: number, trains: number, switchiness: number, spread: number): Params => ({
  id: `ts${i}`, name, seed: 6600 + i * 83, cols, rows, trains, switchiness, spread,
});

const LEVELS: Params[] = [
  P(1, 'Branch Line', 3, 3, 2, 0.4, 1),
  P(2, 'Junction', 4, 3, 2, 0.45, 1),
  P(3, 'Crossover', 4, 4, 3, 0.45, 2),
  P(4, 'Sidings', 5, 4, 3, 0.5, 2),
  P(5, 'Rail Yard', 5, 4, 4, 0.5, 2),
  P(6, 'Interchange', 6, 4, 4, 0.5, 3),
  P(7, 'Terminus', 6, 5, 4, 0.5, 3),
  P(8, 'Grand Central', 6, 5, 5, 0.5, 3),
  P(9, 'Spaghetti', 7, 5, 5, 0.55, 4),
  P(10, 'Timetable', 7, 5, 5, 0.6, 4),
];

const game: GameModule<Level, State, Move, Event> = {
  id: 'train-switches',
  kind: 'turn',
  howToPlay: [
    'Tap a switch (the circles) to change which way it sends trains.',
    'Press Go: trains leave in the order shown by their numbers, one step at a time.',
    'Every train must reach the station of its color, and no two trains may meet at the same point.',
    'If a run fails you’ll see where. Adjust the switches and try again.',
    'Stars: ★★★ on the first run, ★★ on the second.',
  ],
  hint: 'Set the switches, then press Go.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `ts-endless-${seed}`, name: `Endless #${seed}`, seed, cols: 5 + Math.floor(t / 2), rows: 4 + (t > 2 ? 1 : 0), trains: 3 + Math.min(2, t), switchiness: 0.5, spread: 2 + Math.floor(t / 2) });
  },
  init,
  apply(s, m) {
    const r = apply(s, m);
    return r ? { ok: true, state: r.state, events: [r.event] } : { ok: false, reason: 'invalid' };
  },
  status,
  lossMessage: () => ({ title: 'Stuck', body: '' }),
  stars: (s): Stars => (s.runs === 0 ? 3 : s.runs === 1 ? 2 : 1),
  hudText: (s) => (s.runs ? `${s.runs} failed ${s.runs === 1 ? 'run' : 'runs'}` : 'First run'),
  resultText: (s) => (s.runs === 0 ? 'Solved on the first run' : `Solved on run ${s.runs + 1}`),
  mountView: (host, ctx, level, state) => new TrainView(host, ctx, level, state),
};

export default game;
