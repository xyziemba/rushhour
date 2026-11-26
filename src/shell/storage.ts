/** Saved progress for every game, in one failure-tolerant localStorage entry. */
import type { Stars } from './types';

const KEY = 'puzzlelot:v2';
const LEGACY_KEY = 'rushhour:v1';

export interface GameProgress {
  /** Highest campaign level index the player may open. */
  unlocked: number;
  /** Best star rating per level id. */
  stars: Record<string, Stars>;
  /** Fewest moves per level id. */
  best: Record<string, number>;
  endlessStreak: number;
}

export interface Settings {
  symbols: boolean;
  /** Slow down timed games. */
  relaxed?: boolean;
  lastGame?: string;
}

export interface SaveData {
  settings: Settings;
  games: Record<string, GameProgress>;
}

const emptyGame = (): GameProgress => ({ unlocked: 0, stars: {}, best: {}, endlessStreak: 0 });
const emptySave = (): SaveData => ({ settings: { symbols: false }, games: {} });

let memory: SaveData = emptySave();
let loaded = false;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Storage unavailable (private mode, blocked): progress just won't survive a reload.
  }
}

/** Convert the single-game save (before the hub) into the Bus Jam slot. */
export function migrateLegacy(legacy: unknown): SaveData | null {
  if (!legacy || typeof legacy !== 'object') return null;
  const old = legacy as { unlocked?: number; best?: Record<string, number>; endlessStreak?: number; symbols?: boolean };
  const best = old.best ?? {};
  // The old save didn't track undos, so a finished level gets 1 star; replaying can earn more.
  const stars: Record<string, Stars> = {};
  for (const id of Object.keys(best)) stars[id] = 1;
  return {
    settings: { symbols: !!old.symbols, lastGame: 'bus-jam' },
    games: {
      'bus-jam': {
        unlocked: old.unlocked ?? 0,
        stars,
        best,
        endlessStreak: old.endlessStreak ?? 0,
      },
    },
  };
}

export function load(): SaveData {
  if (loaded) return memory;
  loaded = true;
  const current = read(KEY) as Partial<SaveData> | null;
  if (current) {
    memory = { settings: { ...emptySave().settings, ...current.settings }, games: current.games ?? {} };
  } else {
    const migrated = migrateLegacy(read(LEGACY_KEY));
    if (migrated) {
      memory = migrated;
      write();
    }
  }
  return memory;
}

export function getSettings(): Settings {
  return load().settings;
}

export function saveSettings(update: Partial<Settings>): Settings {
  load();
  memory = { ...memory, settings: { ...memory.settings, ...update } };
  write();
  return memory.settings;
}

export function getProgress(gameId: string): GameProgress {
  return { ...emptyGame(), ...load().games[gameId] };
}

export function saveProgress(gameId: string, update: Partial<GameProgress>): GameProgress {
  const next = { ...getProgress(gameId), ...update };
  memory = { ...memory, games: { ...memory.games, [gameId]: next } };
  write();
  return next;
}

/** Record a finished campaign level, keeping the best stars and moves. */
/** Record a finished campaign level. `moves` is only kept for games where fewer moves is better. */
export function recordWin(gameId: string, levelIndex: number, levelId: string, stars: Stars, moves: number | null, levelCount: number): GameProgress {
  const p = getProgress(gameId);
  return saveProgress(gameId, {
    unlocked: Math.max(p.unlocked, Math.min(levelCount - 1, levelIndex + 1)),
    stars: { ...p.stars, [levelId]: Math.max(p.stars[levelId] ?? 0, stars) as Stars },
    best: moves === null ? p.best : { ...p.best, [levelId]: Math.min(p.best[levelId] ?? Infinity, moves) },
  });
}

export function resetAll(): void {
  memory = emptySave();
  write();
}

/** Total stars earned in a game. */
export const starCount = (p: GameProgress): number => Object.values(p.stars).reduce((a, b) => a + b, 0);
