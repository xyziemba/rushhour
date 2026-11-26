import './style.css';
import { makeCampaign, starsByPar } from '../../shell/helpers';
import type { GameModule } from '../../shell/types';
import { generate, init, pour, status, type Event, type Level, type Move, type Params, type State } from './rules';
import { TubesView } from './view';

const P = (i: number, name: string, colors: number, cap: number, empty: number): Params => ({
  id: `ct${i}`, name, seed: 9100 + i * 71, colors, cap, empty,
});

const LEVELS: Params[] = [
  P(1, 'First Pour', 3, 4, 2),
  P(2, 'Mixer', 4, 4, 2),
  P(3, 'Layers', 5, 4, 2),
  P(4, 'Rainbow', 6, 4, 2),
  P(5, 'Tight Fit', 5, 4, 1),
  P(6, 'Lab Bench', 7, 4, 2),
  P(7, 'Squeeze', 6, 4, 1),
  P(8, 'Full Rack', 8, 4, 2),
  P(9, 'Tall Glass', 6, 5, 2),
  P(10, 'Alchemist', 8, 4, 1),
];

const game: GameModule<Level, State, Move, Event> = {
  id: 'color-tubes',
  kind: 'turn',
  howToPlay: [
    'Tap a tube to pick it up, then tap another tube to pour.',
    'Only the top color pours, and only onto an empty tube or the same color. As much pours as fits.',
    'Win when every tube holds a single color.',
    'Stars compare your pours with the best known solution.',
  ],
  hint: 'Tap a tube, then tap where to pour.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `ct-endless-${seed}`, name: `Endless #${seed}`, seed, colors: 5 + Math.min(2, t), cap: 4, empty: t >= 3 ? 1 : 2 });
  },
  init,
  apply(s, m) {
    const r = pour(s, m);
    return r ? { ok: true, state: r.state, events: [{ amount: r.amount }] } : { ok: false, reason: 'illegal' };
  },
  status,
  lossMessage: () => ({ title: 'Stuck!', body: 'No pours are possible. Undo a few steps and try another order.' }),
  stars: (_s, stats, level) => starsByPar(stats.moves, level.par),
  hudText: (_s, stats) => `${stats.moves} pours`,
  mountView: (host, ctx, level, state) => new TubesView(host, ctx, level, state),
};

export default game;
