import './style.css';
import type { Dir4 } from '../../lib/grid';
import { plural } from '../../shell/helpers';
import type { GameModule, Stars } from '../../shell/types';
import LEVELS from './levels.json';
import { CRATE_PARAMS } from './params';
import { generate, init, status, step, type Event, type Level, type State } from './rules';
import { CrateView } from './view';

const levels = LEVELS as Level[];

const game: GameModule<Level, State, Dir4, Event> = {
  id: 'crate-push',
  kind: 'turn',
  howToPlay: [
    'Move with the arrow keys, WASD, by swiping, or with the on-screen pad.',
    'Walk into a crate to push it. You can’t pull crates, and you can only push one at a time.',
    'Get every crate onto a green target.',
    'Careful with corners: a crate pushed into one is stuck. Undo is your friend.',
    'Stars compare your steps with the fewest possible.',
  ],
  hint: 'Push every crate onto a green target.',
  campaign: { count: levels.length, name: (i) => CRATE_PARAMS[i]!.name, level: (i) => levels[i]! },
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `cp-endless-${seed}`, name: `Endless #${seed}`, seed, cols: 7 + (t > 1 ? 1 : 0), rows: 7, crates: t >= 2 ? 3 : 2, clutter: 3 + t, minMoves: 18 + t * 5, attempts: 30 });
  },
  endlessTest: { seeds: 60, ms: 2500 },
  init,
  apply(s, d) {
    const r = step(s, d);
    return r ? { ok: true, state: r.state, events: [r.event] } : { ok: false, reason: 'blocked' };
  },
  status,
  lossMessage: () => ({ title: 'Stuck', body: '' }),
  stars: (_s, stats, level): Stars => (stats.moves <= Math.ceil(level.par * 1.2) ? 3 : stats.moves <= Math.ceil(level.par * 1.8) ? 2 : 1),
  tracksBest: true,
  hudText: (_s, stats, level) => `${plural(stats.moves, 'step')} · target ${level.par}`,
  resultText: (s, stats, level) => `${plural(stats.moves, 'step')} (target ${level.par}), ${plural(s.pushes, 'push', 'pushes')}`,
  mountView: (host, ctx, level, state) => new CrateView(host, ctx, level, state),
};

export default game;
