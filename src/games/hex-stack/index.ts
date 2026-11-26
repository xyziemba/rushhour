import './style.css';
import { makeCampaign, starsByUndos, undoText } from '../../shell/helpers';
import type { GameModule } from '../../shell/types';
import { generate, init, place, status, type Event, type Level, type Move, type Params, type State } from './rules';
import { HexView } from './view';

const P = (i: number, name: string, radius: number, colors: number, pieces: number, factor: number): Params => ({
  id: `hs${i}`, name, seed: 4400 + i * 67, radius, colors, pieces, factor,
});

const LEVELS: Params[] = [
  P(1, 'Honeycomb', 2, 3, 14, 0.7),
  P(2, 'Beehive', 2, 3, 22, 0.75),
  P(3, 'Mosaic', 2, 4, 28, 0.75),
  P(4, 'Tessellate', 3, 4, 32, 0.8),
  P(5, 'Stacks', 3, 4, 42, 0.8),
  P(6, 'Towers', 3, 5, 48, 0.85),
  P(7, 'Pillars', 3, 5, 58, 0.85),
  P(8, 'Spires', 3, 6, 64, 0.85),
  P(9, 'Skyline', 3, 6, 76, 0.9),
  P(10, 'Metropolis', 3, 7, 90, 0.9),
];

const game: GameModule<Level, State, Move, Event> = {
  id: 'hex-stack',
  kind: 'turn',
  howToPlay: [
    'Tap a stack below, then tap an empty space to place it. Tapping a space directly places the first stack.',
    'Neighboring stacks with the same top color slide together onto the stack you placed, and this can chain.',
    'When 10 or more of one color sit on top of a stack, they clear and score.',
    'Reach the target score before the board fills up.',
    'Stars: ★★★ with no undos, ★★ with up to two.',
  ],
  hint: 'Place stacks next to matching colors. Ten on top clear.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `hs-endless-${seed}`, name: `Endless #${seed}`, seed, radius: 3, colors: 4 + Math.min(3, t), pieces: 40 + t * 10, factor: 0.8 + t * 0.02 });
  },
  init,
  apply(s, m) {
    const r = place(s, m);
    return r ? { ok: true, state: r.state, events: [r.event] } : { ok: false, reason: 'occupied' };
  },
  status,
  lossMessage: (s) => ({ title: 'Board full!', body: `No empty spaces left. You scored ${s.score} of ${s.target}.` }),
  stars: (_s, stats) => starsByUndos(stats.undos),
  hudText: (s) => `${s.score} / ${s.target}`,
  resultText: (s, stats) => `Score ${s.score} / ${s.target} · ${undoText(stats.undos).toLowerCase()}`,
  mountView: (host, ctx, level, state) => new HexView(host, ctx, level, state),
};

export default game;
