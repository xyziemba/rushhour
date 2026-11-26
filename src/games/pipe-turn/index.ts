import './style.css';
import { makeCampaign, starsByPar } from '../../shell/helpers';
import type { GameModule } from '../../shell/types';
import { generate, init, status, turn, type Level, type Params, type State } from './rules';
import { PipeView } from './view';

const P = (i: number, name: string, cols: number, rows: number): Params => ({ id: `pt${i}`, name, seed: 5200 + i * 61, cols, rows });

const LEVELS: Params[] = [
  P(1, 'Faucet', 3, 3),
  P(2, 'Garden Hose', 4, 4),
  P(3, 'Basement', 4, 5),
  P(4, 'Plumbing', 5, 5),
  P(5, 'Water Main', 5, 6),
  P(6, 'Boiler Room', 6, 6),
  P(7, 'Aqueduct', 6, 7),
  P(8, 'Reservoir', 7, 7),
  P(9, 'Waterworks', 7, 8),
  P(10, 'City Grid', 8, 9),
];

const game: GameModule<Level, State, number, unknown> = {
  id: 'pipe-turn',
  kind: 'turn',
  howToPlay: [
    'Tap a pipe to turn it a quarter turn clockwise.',
    'Connect every pipe to the water source in the middle, with no open ends.',
    'Pipes light up blue when water reaches them.',
    'Stars compare your turns with the fewest possible.',
  ],
  hint: 'Tap pipes to rotate them. Get water to every tile.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `pt-endless-${seed}`, name: `Endless #${seed}`, seed, cols: 5 + Math.floor(t / 2), rows: 6 + Math.ceil(t / 2) });
  },
  init,
  apply(s, i) {
    const next = turn(s, i);
    return next ? { ok: true, state: next, events: [] } : { ok: false, reason: 'invalid' };
  },
  status,
  lossMessage: () => ({ title: 'Stuck', body: '' }),
  stars: (_s, stats, level) => starsByPar(stats.moves, level.par),
  hudText: (_s, stats) => `${stats.moves} turns`,
  mountView: (host, ctx, level, state) => new PipeView(host, ctx, level, state),
};

export default game;
