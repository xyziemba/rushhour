import './style.css';
import type { GameModule, Stars } from '../../shell/types';
import { endlessParams, generateLevel } from './generate';
import { LEVEL_COUNT, LEVEL_PARAMS, getLevel } from './levels';
import { boardAll, exitVehicle, getStatus, loseReason, newGame } from './rules';
import type { GameState, Level } from './types';
import { BusJamView, type BusJamMove } from './view';

/**
 * Every vehicle is tapped exactly once on the way to a win (blocked taps don't
 * count), so move counts can't separate good play from bad. Stars reward
 * solving without undo instead.
 */
export function busJamStars(undos: number): Stars {
  return undos === 0 ? 3 : undos <= 2 ? 2 : 1;
}

const game: GameModule<Level, GameState, BusJamMove, unknown> = {
  id: 'bus-jam',
  kind: 'turn',
  howToPlay: [
    'Tap a vehicle to drive it out of the lot the way its arrow points. It needs a clear path to the edge.',
    'Vehicles that leave park in a loading bay.',
    'Passengers at the front of the line board parked vehicles of their color. Full vehicles depart and free their bay.',
    'You lose if every bay is full and nobody at the front can board. Dig out the colors you need next.',
    'Stars: ★★★ with no undos, ★★ with up to two.',
  ],
  hint: 'Tap a vehicle to drive it out the way its arrow points.',
  campaign: {
    count: LEVEL_COUNT,
    name: (i) => LEVEL_PARAMS[i]!.name!,
    level: getLevel,
  },
  endless: (seed, streak) => generateLevel(endlessParams(seed, streak)),

  init: newGame,
  apply(state, move) {
    const r = exitVehicle(state, move);
    if (r.result === 'blocked') return { ok: false, reason: 'blocked', detail: r.blockerId };
    if (r.result !== 'moved') return { ok: false, reason: r.result };
    return { ok: true, state: boardAll(r.state).state, events: [] };
  },
  status: getStatus,
  lossMessage: (state) =>
    loseReason(state) === 'gridlock'
      ? { title: 'Gridlock!', body: 'No vehicle can get out of the lot.' }
      : { title: 'Out of bays!', body: 'Every bay is full and nobody at the front of the line can board.' },
  stars: (_state, stats) => busJamStars(stats.undos),
  hudText: (state) => `${state.lot.length} left · ${state.queue.length} waiting`,
  mountView: (host, ctx, level, state) => new BusJamView(host, ctx, level, state),
};

export default game;
