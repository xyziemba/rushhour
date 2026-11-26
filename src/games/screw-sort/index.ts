import './style.css';
import { makeCampaign, starsByUndos } from '../../shell/helpers';
import type { GameModule } from '../../shell/types';
import { generate, init, status, unscrew, type Event, type Level, type Params, type State } from './rules';
import { ScrewView } from './view';

const P = (i: number, name: string, cols: number, rows: number, plates: number, colors: number, holes: number, spread: number): Params => ({
  id: `ss${i}`, name, seed: 6100 + i * 47, cols, rows, plates, colors, holes, spread,
});

const LEVELS: Params[] = [
  P(1, 'Loose Bolts', 4, 5, 3, 2, 5, 0),
  P(2, 'Toolbox', 5, 5, 4, 3, 5, 0.15),
  P(3, 'Workbench', 5, 6, 5, 3, 5, 0.25),
  P(4, 'Shelf Kit', 5, 6, 6, 4, 5, 0.3),
  P(5, 'Flat Pack', 6, 6, 7, 4, 5, 0.4),
  P(6, 'Engine Bay', 6, 7, 8, 5, 5, 0.45),
  P(7, 'Clockwork', 6, 7, 9, 5, 4, 0.45),
  P(8, 'Scaffold', 6, 8, 10, 6, 4, 0.5),
  P(9, 'Assembly Line', 7, 8, 11, 6, 4, 0.55),
  P(10, 'Skyscraper', 7, 9, 12, 7, 4, 0.6),
];

const game: GameModule<Level, State, string, Event> = {
  id: 'screw-sort',
  kind: 'turn',
  howToPlay: [
    'Tap a screw to take it out. Screws under another plate can’t be reached yet.',
    'A screw goes into the open box of its color. If no box matches, it waits in a spare hole.',
    'Full boxes leave and the next box arrives. Waiting screws jump into matching boxes on their own.',
    'A plate with no screws left falls away and uncovers what’s underneath.',
    'You lose if every spare hole is full and no reachable screw fits a box.',
    'Stars: ★★★ with no undos, ★★ with up to two.',
  ],
  hint: 'Tap screws that match the open boxes.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `ss-endless-${seed}`, name: `Endless #${seed}`, seed, cols: 6, rows: 7 + Math.floor(t / 2), plates: 7 + t, colors: 4 + Math.floor(t / 2), holes: t >= 3 ? 4 : 5, spread: 0.4 + t * 0.05 });
  },
  init,
  apply(s, id) {
    const r = unscrew(s, id);
    return 'error' in r ? { ok: false, reason: r.error } : { ok: true, state: r.state, events: [r.event] };
  },
  status,
  lossMessage: () => ({ title: 'Out of holes!', body: 'Every spare hole is full and no reachable screw fits an open box.' }),
  stars: (_s, stats) => starsByUndos(stats.undos),
  hudText: (s) => `${s.screws.length} screws left`,
  mountView: (host, ctx, level, state) => new ScrewView(host, ctx, level, state),
};

export default game;
