/** Small, failure-tolerant wrapper around localStorage. */

const KEY = 'rushhour:v1';

export interface Progress {
  /** Highest campaign level index the player may open. */
  unlocked: number;
  /** Fewest moves per level id. */
  best: Record<string, number>;
  endlessStreak: number;
  symbols: boolean;
}

const DEFAULTS: Progress = { unlocked: 0, best: {}, endlessStreak: 0, symbols: false };

let memory: Progress = { ...DEFAULTS, best: {} };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Storage unavailable (private mode, blocked): keep the in-memory copy.
  }
  return memory;
}

export function saveProgress(update: Partial<Progress>): Progress {
  memory = { ...memory, ...update };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Ignore: progress just won't survive a reload.
  }
  return memory;
}
