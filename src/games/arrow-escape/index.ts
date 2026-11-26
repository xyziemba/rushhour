import './style.css';
import { makeCampaign } from '../../shell/helpers';
import type { GameModule, Stars } from '../../shell/types';
import { generate, init, status, tap, type Event, type Level, type Params, type State } from './rules';
import { ArrowView } from './view';

const P = (i: number, name: string, cols: number, rows: number, density: number): Params => ({
  id: `ae${i}`,
  name,
  seed: 4100 + i * 37,
  cols,
  rows,
  density,
  lives: 3,
});

const LEVELS: Params[] = [
  P(1, 'Warm Up', 4, 4, 0.55),
  P(2, 'Cross Traffic', 5, 5, 0.6),
  P(3, 'Knots', 5, 6, 0.65),
  P(4, 'Weave', 6, 6, 0.7),
  P(5, 'Tangle', 6, 7, 0.72),
  P(6, 'Bramble', 7, 7, 0.75),
  P(7, 'Thicket', 7, 8, 0.78),
  P(8, 'Labyrinth', 8, 8, 0.8),
  P(9, 'Hairball', 8, 9, 0.82),
  P(10, 'Gordian', 9, 9, 0.85),
];

const game: GameModule<Level, State, string, Event> = {
  id: 'arrow-escape',
  kind: 'turn',
  howToPlay: [
    'Tap an arrow to send it flying off the board the way it points.',
    'If another arrow is in the way, it crashes and you lose a heart. Three crashes and the level is over.',
    'Clear every arrow to win.',
    'Stars: ★★★ with no crashes, ★★ with one.',
  ],
  hint: 'Tap an arrow whose path to the edge is clear.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `ae-endless-${seed}`, name: `Endless #${seed}`, seed, cols: 6 + Math.floor(t / 2), rows: 7 + Math.floor((t + 1) / 2), density: 0.72 + t * 0.03, lives: 3 });
  },
  init,
  apply(s, id) {
    const r = tap(s, id);
    return r ? { ok: true, state: r.state, events: [r.event] } : { ok: false, reason: 'invalid' };
  },
  status,
  lossMessage: () => ({ title: 'Out of hearts!', body: 'Three crashes. Look for arrows with a clear path to the edge.' }),
  stars: (s): Stars => (s.crashes === 0 ? 3 : s.crashes === 1 ? 2 : 1),
  hudText: (s) => `${'♥'.repeat(Math.max(0, s.lives))}${'♡'.repeat(Math.max(0, 3 - s.lives))} · ${s.pieces.length} left`,
  mountView: (host, ctx, level, state) => new ArrowView(host, ctx, level, state),
};

export default game;
