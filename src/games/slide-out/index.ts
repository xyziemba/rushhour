import './style.css';
import { starsByPar } from '../../shell/helpers';
import type { GameModule } from '../../shell/types';
import LEVELS from './levels.json';
import { SLIDE_PARAMS } from './params';
import { generate, init, slide, status, type Level, type Move, type State } from './rules';
import { SlideView } from './view';

const levels = LEVELS as Level[];

const game: GameModule<Level, State, Move, unknown> = {
  id: 'slide-out',
  kind: 'turn',
  howToPlay: [
    'Blocks slide only along their length. Drag a block to slide it.',
    'Get the red block out through the gap on the right.',
    'Keyboard: Tab to a block, then use the arrow keys.',
    'Stars compare your moves with the fewest possible.',
  ],
  hint: 'Drag blocks to clear a path for the red one.',
  campaign: { count: levels.length, name: (i) => SLIDE_PARAMS[i]!.name, level: (i) => levels[i]! },
  endless: (seed, streak) => {
    const t = Math.min(4, Math.floor(streak / 3));
    return generate({ id: `so-endless-${seed}`, name: `Endless #${seed}`, seed, blocks: 9 + t, min: 8 + t * 2, max: 12 + t * 3, attempts: 25 });
  },
  endlessTest: { seeds: 10, ms: 3000 },
  init,
  apply(s, m) {
    const next = slide(s, m);
    return next ? { ok: true, state: next, events: [] } : { ok: false, reason: 'blocked' };
  },
  status,
  lossMessage: () => ({ title: 'Stuck', body: '' }),
  stars: (_s, stats, level) => starsByPar(stats.moves, level.par),
  hudText: (_s, stats) => `${stats.moves} moves`,
  mountView: (host, ctx, _level, state) => new SlideView(host, ctx, state),
};

export default game;
