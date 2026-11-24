export type Color =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'pink';

export const COLORS: Color[] = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

export type Dir = 'up' | 'down' | 'left' | 'right';

export type Length = 1 | 2 | 3;

/** Seats per vehicle length. */
export const CAPACITY: Record<Length, number> = { 1: 4, 2: 6, 3: 10 };

export interface Vehicle {
  id: string;
  color: Color;
  /** Top-left cell of the vehicle's footprint. */
  x: number;
  y: number;
  /** Number of cells along its facing axis. */
  length: Length;
  dir: Dir;
  capacity: number;
}

export interface Level {
  id: string;
  name: string;
  cols: number;
  rows: number;
  bays: number;
  vehicles: Vehicle[];
  /** Passenger colors; index 0 is the front of the line. */
  queue: Color[];
  /** A known winning tap order (vehicle ids), if available. */
  solution?: string[];
}

export interface Bay {
  vehicle: Vehicle;
  seatsLeft: number;
  /** Monotonic counter: lower = parked earlier. */
  parkedAt: number;
}

export type Status = 'playing' | 'won' | 'lost';

export interface GameState {
  cols: number;
  rows: number;
  lot: Vehicle[];
  bays: (Bay | null)[];
  queue: Color[];
  moves: number;
  parkCounter: number;
}
