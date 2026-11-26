import './style.css';
import { makeCampaign } from '../../shell/helpers';
import { getSettings } from '../../shell/storage';
import type { GameModule, Stars } from '../../shell/types';
import { MAX_MISSES, autoplay, generate, init, status, tick, toggle, type Level, type Params, type State } from './rules';
import { ConveyorView } from './view';

const P = (i: number, name: string, bins: number, parcels: number, speed: number, gapStart: number, gapEnd: number): Params => ({
  id: `cv${i}`, name, seed: 5900 + i * 37, bins, parcels, speed, gapStart, gapEnd,
});

const LEVELS: Params[] = [
  P(1, 'Mail Room', 2, 8, 1.3, 2.6, 2.2),
  P(2, 'Post Office', 3, 10, 1.4, 2.4, 2.0),
  P(3, 'Sorting Hall', 3, 14, 1.5, 2.2, 1.7),
  P(4, 'Parcel Depot', 4, 16, 1.6, 2.1, 1.6),
  P(5, 'Distribution', 4, 20, 1.7, 2.0, 1.4),
  P(6, 'Hub', 5, 22, 1.8, 1.9, 1.3),
  P(7, 'Night Shift', 5, 26, 1.9, 1.8, 1.2),
  P(8, 'Holiday Rush', 6, 28, 2.0, 1.7, 1.1),
  P(9, 'Express Lane', 6, 32, 2.2, 1.6, 1.0),
  P(10, 'Peak Season', 6, 38, 2.4, 1.5, 0.9),
];

const game: GameModule<Level, State, number, unknown> = {
  id: 'conveyor',
  kind: 'realtime',
  howToPlay: [
    'Parcels ride the belt down from the top. Tap a switch (the circles) to flip which way it sends them.',
    'Route every parcel into the bin of its color.',
    `${MAX_MISSES} parcels in the wrong bin and the shift is over.`,
    'Press P or the pause button to pause. “Relaxed speed” on the home screen slows the belts down.',
    'Stars: ★★★ with no mistakes, ★★ with one.',
  ],
  hint: 'Tap switches to send parcels to their color.',
  campaign: makeCampaign(LEVELS, generate),
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `cv-endless-${seed}`, name: `Endless #${seed}`, seed, bins: 4 + Math.min(2, Math.floor(t / 2)), parcels: 20 + t * 4, speed: 1.7 + t * 0.15, gapStart: 2, gapEnd: 1.4 - t * 0.1 });
  },
  init: (lv) => init(lv, getSettings().relaxed ? 0.6 : 1),
  tick,
  autoplay,
  apply(s, node) {
    const next = toggle(s, node);
    return next ? { ok: true, state: next, events: [] } : { ok: false, reason: 'invalid' };
  },
  status,
  lossMessage: (s) => ({ title: 'Shift over!', body: `Three parcels went to the wrong bin. You sorted ${s.sorted} of ${s.level.schedule.length}.` }),
  stars: (s): Stars => (s.misses === 0 ? 3 : s.misses === 1 ? 2 : 1),
  hudText: (s) => `${s.sorted}/${s.level.schedule.length} · ${'✕'.repeat(s.misses)}${'·'.repeat(MAX_MISSES - s.misses)}`,
  mountView: (host, ctx, level, state) => new ConveyorView(host, ctx, level, state),
};

export default game;
