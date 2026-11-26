import './style.css';
import { makeCampaign } from '../../shell/helpers';
import type { GameModule, Stars } from '../../shell/types';
import { draw, generate, init, status, type Level, type Move, type Params, type State } from './rules';
import { LinksView } from './view';

const P = (i: number, name: string, n: number, pairs: number): Params => ({ id: `cl${i}`, name, seed: 1900 + i * 43, n, pairs });

const LEVELS: Params[] = [
  P(1, 'First Thread', 4, 3),
  P(2, 'Stitches', 5, 4),
  P(3, 'Weaving', 5, 5),
  P(4, 'Patchwork', 6, 5),
  P(5, 'Quilt', 6, 6),
  P(6, 'Tapestry', 7, 6),
  P(7, 'Embroidery', 7, 7),
  P(8, 'Lacework', 8, 7),
  P(9, 'Loom', 8, 8),
  P(10, 'Grand Weave', 9, 8),
];

const game: GameModule<Level, State, Move, unknown> = {
  id: 'color-links',
  kind: 'turn',
  howToPlay: [
    'Drag from a dot to draw a line to the other dot of the same color.',
    'Lines can’t cross. Drawing over another line cuts it.',
    'Connect every pair and fill every square to win.',
    'Drag back over a line to shorten it, or start again from either dot.',
    'Stars: ★★★ if you draw each line once, ★★ with up to three redraws.',
  ],
  hint: 'Connect matching dots and fill the whole board.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `cl-endless-${seed}`, name: `Endless #${seed}`, seed, n: 6 + Math.floor(t / 2), pairs: 5 + Math.min(3, t) });
  },
  init,
  apply(s, m) {
    const next = draw(s, m);
    return next ? { ok: true, state: next, events: [] } : { ok: false, reason: 'invalid' };
  },
  status,
  lossMessage: () => ({ title: 'Stuck', body: '' }),
  stars: (s, stats): Stars => (stats.moves <= s.pairs.length ? 3 : stats.moves <= s.pairs.length + 3 ? 2 : 1),
  hudText: (_s, stats) => `${stats.moves} lines`,
  mountView: (host, ctx, level, state) => new LinksView(host, ctx, level, state),
};

export default game;
