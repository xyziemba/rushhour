import { exitPath, occupancy } from './grid';
import type { Color, GameState, Level, Status, Vehicle } from './types';

export function newGame(level: Level): GameState {
  return {
    cols: level.cols,
    rows: level.rows,
    lot: level.vehicles.map((v) => ({ ...v })),
    bays: Array.from({ length: level.bays }, () => null),
    queue: [...level.queue],
    moves: 0,
    parkCounter: 0,
  };
}

/** The first vehicle standing in this vehicle's way, or null if its path is clear. */
export function firstBlocker(state: GameState, id: string): Vehicle | null {
  const v = state.lot.find((c) => c.id === id);
  if (!v) return null;
  const occ = occupancy(state.lot);
  for (const [x, y] of exitPath(v, state.cols, state.rows)) {
    const hit = occ.get(`${x},${y}`);
    if (hit && hit !== id) return state.lot.find((c) => c.id === hit) ?? null;
  }
  return null;
}

export function canExit(state: GameState, id: string): boolean {
  return state.lot.some((v) => v.id === id) && firstBlocker(state, id) === null;
}

export type ExitResult =
  | { result: 'moved'; state: GameState; bayIndex: number }
  | { result: 'blocked'; state: GameState; blockerId: string }
  | { result: 'no-bay'; state: GameState }
  | { result: 'invalid'; state: GameState };

/**
 * Drive a vehicle out of the lot into the leftmost free bay. Does not board
 * passengers; call boardOne/boardAll afterwards. Blocked or refused taps
 * return the original state unchanged (and do not count as a move).
 */
export function exitVehicle(state: GameState, id: string): ExitResult {
  const v = state.lot.find((c) => c.id === id);
  if (!v || getStatus(state) !== 'playing') return { result: 'invalid', state };
  const blocker = firstBlocker(state, id);
  if (blocker) return { result: 'blocked', state, blockerId: blocker.id };
  const bayIndex = state.bays.findIndex((b) => b === null);
  if (bayIndex === -1) return { result: 'no-bay', state };

  const bays = [...state.bays];
  bays[bayIndex] = { vehicle: v, seatsLeft: v.capacity, parkedAt: state.parkCounter };
  return {
    result: 'moved',
    bayIndex,
    state: {
      ...state,
      lot: state.lot.filter((c) => c.id !== id),
      bays,
      moves: state.moves + 1,
      parkCounter: state.parkCounter + 1,
    },
  };
}

/** Index of the bay the front passenger would board, or -1. */
export function boardingBay(state: GameState): number {
  const front = state.queue[0];
  if (front === undefined) return -1;
  let best = -1;
  state.bays.forEach((b, i) => {
    if (b && b.vehicle.color === front && b.seatsLeft > 0) {
      if (best === -1 || b.parkedAt < state.bays[best]!.parkedAt) best = i;
    }
  });
  return best;
}

export interface BoardEvent {
  bayIndex: number;
  color: Color;
  vehicleId: string;
  departed: boolean;
}

/** Board one passenger, if possible. A vehicle that becomes full departs. */
export function boardOne(state: GameState): { state: GameState; event: BoardEvent } | null {
  const bayIndex = boardingBay(state);
  if (bayIndex === -1) return null;
  const bay = state.bays[bayIndex]!;
  const seatsLeft = bay.seatsLeft - 1;
  const departed = seatsLeft === 0;
  const bays = [...state.bays];
  bays[bayIndex] = departed ? null : { ...bay, seatsLeft };
  return {
    state: { ...state, bays, queue: state.queue.slice(1) },
    event: { bayIndex, color: bay.vehicle.color, vehicleId: bay.vehicle.id, departed },
  };
}

export function boardAll(state: GameState): { state: GameState; events: BoardEvent[] } {
  const events: BoardEvent[] = [];
  let s = state;
  for (let step = boardOne(s); step; step = boardOne(s)) {
    s = step.state;
    events.push(step.event);
  }
  return { state: s, events };
}

/** Exit + board in one step. */
export function tap(state: GameState, id: string): ExitResult {
  const r = exitVehicle(state, id);
  if (r.result !== 'moved') return r;
  return { ...r, state: boardAll(r.state).state };
}

export type LoseReason = 'bays-full' | 'gridlock';

export function loseReason(state: GameState): LoseReason | null {
  if (state.queue.length === 0) return null;
  if (boardingBay(state) !== -1) return null;
  const baysFull = state.bays.every((b) => b !== null);
  if (baysFull) return 'bays-full';
  if (!state.lot.some((v) => canExit(state, v.id))) return 'gridlock';
  return null;
}

/** Assumes boarding has been resolved (boardAll called after each move). */
export function getStatus(state: GameState): Status {
  if (state.queue.length === 0) return 'won';
  return loseReason(state) ? 'lost' : 'playing';
}

/** Check that per-color capacity equals per-color passengers. */
export function validateLevel(level: Level): string[] {
  const errors: string[] = [];
  const seats = new Map<Color, number>();
  const people = new Map<Color, number>();
  for (const v of level.vehicles) seats.set(v.color, (seats.get(v.color) ?? 0) + v.capacity);
  for (const c of level.queue) people.set(c, (people.get(c) ?? 0) + 1);
  for (const c of new Set([...seats.keys(), ...people.keys()])) {
    if ((seats.get(c) ?? 0) !== (people.get(c) ?? 0)) {
      errors.push(`${c}: ${seats.get(c) ?? 0} seats vs ${people.get(c) ?? 0} passengers`);
    }
  }
  const occ = new Set<string>();
  for (const v of level.vehicles) {
    for (let i = 0; i < v.length; i++) {
      const x = v.dir === 'left' || v.dir === 'right' ? v.x + i : v.x;
      const y = v.dir === 'up' || v.dir === 'down' ? v.y + i : v.y;
      if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) errors.push(`${v.id} out of bounds`);
      if (occ.has(`${x},${y}`)) errors.push(`${v.id} overlaps at ${x},${y}`);
      occ.add(`${x},${y}`);
    }
  }
  return errors;
}
