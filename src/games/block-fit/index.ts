import './style.css';
import { makeCampaign, starsByUndos, undoText } from '../../shell/helpers';
import type { GameModule } from '../../shell/types';
import { generate, init, place, status, type Event, type Level, type Move, type Params, type State } from './rules';
import { BlockFitView } from './view';

const P = (i: number, name: string, pieces: number, blocks: number, factor: number): Params => ({
  id: `bf${i}`, name, seed: 8800 + i * 29, pieces, blocks, factor,
});

const LEVELS: Params[] = [
  P(1, 'Starter', 12, 0, 0.7),
  P(2, 'Stacker', 18, 0, 0.75),
  P(3, 'Packer', 24, 2, 0.75),
  P(4, 'Tidy Up', 30, 3, 0.8),
  P(5, 'Rubble', 36, 5, 0.8),
  P(6, 'Puzzle Box', 44, 6, 0.85),
  P(7, 'Clutter', 52, 8, 0.85),
  P(8, 'Overflow', 60, 9, 0.9),
  P(9, 'Long Haul', 72, 10, 0.9),
  P(10, 'Marathon', 90, 12, 0.92),
];

const game: GameModule<Level, State, Move, Event> = {
  id: 'block-fit',
  kind: 'turn',
  howToPlay: [
    'Drag a piece from the tray onto the board. You can also tap a piece, then tap the board.',
    'Fill a whole row or column to clear it. Clearing several lines at once scores extra.',
    'When all three pieces are placed, three new ones arrive.',
    'Reach the target score to win. If none of your pieces fit anywhere, you lose.',
    'Stars: ★★★ with no undos, ★★ with up to two.',
  ],
  hint: 'Drag pieces onto the board. Full rows and columns clear.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `bf-endless-${seed}`, name: `Endless #${seed}`, seed, pieces: 40 + t * 10, blocks: 4 + t * 2, factor: 0.8 + t * 0.03 });
  },
  init,
  apply(s, m) {
    const r = place(s, m);
    return r ? { ok: true, state: r.state, events: [r.event] } : { ok: false, reason: 'blocked' };
  },
  status,
  lossMessage: (s) => ({ title: 'No room!', body: `None of your pieces fit. You scored ${s.score} of ${s.target}.` }),
  stars: (_s, stats) => starsByUndos(stats.undos),
  hudText: (s) => `${s.score} / ${s.target}`,
  resultText: (s, stats) => `Score ${s.score} / ${s.target} · ${undoText(stats.undos).toLowerCase()}`,
  mountView: (host, ctx, level, state) => new BlockFitView(host, ctx, level, state),
};

export default game;
