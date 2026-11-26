import './style.css';
import { makeCampaign, starsByUndos, undoText } from '../../shell/helpers';
import type { GameModule } from '../../shell/types';
import { generate, init, pickTile, status, type Event, type Level, type Params, type State } from './rules';
import { TileTrayView } from './view';

const P = (i: number, name: string, cols: number, rows: number, layers: number, icons: number, spread: number): Params => ({
  id: `tt${i}`, name, seed: 7300 + i * 53, cols, rows, layers, icons, spread,
});

const LEVELS: Params[] = [
  P(1, 'Picnic', 4, 4, 2, 4, 0),
  P(2, 'Garden', 5, 4, 2, 5, 0.15),
  P(3, 'Orchard', 5, 5, 3, 6, 0.25),
  P(4, 'Market', 6, 5, 3, 7, 0.35),
  P(5, 'Bazaar', 6, 6, 3, 8, 0.45),
  P(6, 'Pyramid', 6, 6, 4, 9, 0.5),
  P(7, 'Terraces', 7, 6, 4, 10, 0.55),
  P(8, 'Ziggurat', 7, 7, 4, 10, 0.6),
  P(9, 'Tower', 7, 7, 5, 11, 0.65),
  P(10, 'Summit', 7, 8, 5, 12, 0.7),
];

const game: GameModule<Level, State, string, Event> = {
  id: 'tile-tray',
  kind: 'turn',
  howToPlay: [
    'Tap an uncovered tile to move it into the tray at the bottom. Darkened tiles are covered by tiles above them.',
    'Three matching tiles in the tray disappear.',
    'Clear the board to win. If all 7 tray slots fill up, you lose.',
    'Stars: ★★★ with no undos, ★★ with up to two.',
  ],
  hint: 'Tap tiles to collect them. Three of a kind clear.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `tt-endless-${seed}`, name: `Endless #${seed}`, seed, cols: 6 + (t > 2 ? 1 : 0), rows: 6, layers: 3 + Math.min(2, Math.floor(t / 2)), icons: 8 + t, spread: 0.45 + t * 0.06 });
  },
  init,
  apply(s, id) {
    const r = pickTile(s, id);
    return r ? { ok: true, state: r.state, events: [r.event] } : { ok: false, reason: 'covered' };
  },
  status,
  lossMessage: () => ({ title: 'Tray full!', body: 'All 7 slots filled up without a match. Collect tiles in threes.' }),
  stars: (_s, stats) => starsByUndos(stats.undos),
  hudText: (s) => `${s.tiles.length} tiles left`,
  resultText: (_s, stats) => undoText(stats.undos),
  mountView: (host, ctx, level, state) => new TileTrayView(host, ctx, level, state),
};

export default game;
