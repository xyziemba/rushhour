/** The contract between the shell and each game. */

export type Status = 'playing' | 'won' | 'lost';
export type Stars = 1 | 2 | 3;

/** Every level a game hands the shell carries an id and a display name. */
export interface LevelBase {
  id: string;
  name: string;
  /** A known winning move list, replayed by the shared tests. */
  solution?: readonly unknown[];
}

export type ApplyResult<S, E> =
  | { ok: true; state: S; events: E[] }
  | { ok: false; reason: string; detail?: unknown };

/** Bookkeeping the shell tracks for the current attempt. Restart resets it. */
export interface PlayStats {
  moves: number;
  undos: number;
}

export interface ViewContext<M> {
  /** Ask the shell to play a move (ignored while an animation is running). */
  play(move: M): void;
  isBusy(): boolean;
  toast(message: string, ms?: number): void;
  readonly symbols: boolean;
  reducedMotion(): boolean;
}

export interface GameView<S, M, E> {
  /** Draw the state from scratch (start, undo, restart). */
  render(state: S): void;
  /** Animate a successful move. When the promise resolves the view must show `next`. */
  animate(prev: S, next: S, move: M, events: E[]): Promise<void>;
  /** Feedback for a refused move (shake, flash, toast...). */
  reject?(state: S, move: M, reason: string, detail?: unknown): void;
  destroy(): void;
}

export interface GameModule<L extends LevelBase = LevelBase, S = unknown, M = unknown, E = unknown> {
  id: string;
  howToPlay: string[];
  kind: 'turn' | 'realtime';
  campaign: {
    count: number;
    name(index: number): string;
    level(index: number): L;
  };
  endless?(seed: number, streak: number): L;
  /** Shared-test budget for slow endless generators (default 200 seeds, 250 ms each). */
  endlessTest?: { seeds: number; ms: number };
  /** Optional first-time hint for the first campaign level. */
  hint?: string;

  init(level: L): S;
  apply(state: S, move: M): ApplyResult<S, E>;
  status(state: S): Status;
  lossMessage(state: S): { title: string; body: string };
  stars(state: S, stats: PlayStats, level: L): Stars;
  /** HUD counter text; defaults to "N moves". */
  hudText?(state: S, stats: PlayStats): string;

  mountView(host: HTMLElement, ctx: ViewContext<M>, level: L, state: S): GameView<S, M, E>;
}

/** Light-weight metadata for the hub, available without loading the game's code. */
export interface GameMeta {
  id: string;
  title: string;
  tagline: string;
  /** Inline SVG markup for the card icon (viewBox 0 0 64 64). */
  icon: string;
  levels: number;
  load(): Promise<GameModule<any, any, any, any>>;
}
