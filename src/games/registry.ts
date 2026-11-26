import type { GameMeta } from '../shell/types';

/**
 * Every game on the site, in hub order. `load` is a dynamic import, so each
 * game's code (and CSS) is only downloaded when the player opens it.
 * Card icons are inline SVG (viewBox 0 0 64 64).
 */
export const GAMES: GameMeta[] = [
  {
    id: 'bus-jam',
    title: 'Bus Jam',
    tagline: 'Clear the lot and get every passenger home.',
    levels: 10,
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#2b2d42"/><rect x="10" y="18" width="44" height="26" rx="7" fill="#f5c518"/><rect x="15" y="23" width="9" height="8" rx="2" fill="#fff8e1"/><rect x="27" y="23" width="9" height="8" rx="2" fill="#fff8e1"/><rect x="39" y="23" width="9" height="8" rx="2" fill="#fff8e1"/><circle cx="20" cy="46" r="5" fill="#1d1e2c"/><circle cx="44" cy="46" r="5" fill="#1d1e2c"/></svg>`,
    load: () => import('./bus-jam/index').then((m) => m.default),
  },
  {
    id: 'arrow-escape',
    title: 'Arrow Escape',
    tagline: 'Untangle the arrows without crashing.',
    levels: 10,
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#2b2d42"/><path d="M14 40h22" stroke="#46b04a" stroke-width="6" stroke-linecap="round"/><path d="M34 31l10 9-10 9z" fill="#46b04a"/><path d="M24 50V24" stroke="#3a6df0" stroke-width="6" stroke-linecap="round"/><path d="M15 26l9-11 9 11z" fill="#3a6df0"/><path d="M50 14v14" stroke="#f2812c" stroke-width="6" stroke-linecap="round"/><path d="M42 26l8 10 8-10z" fill="#f2812c"/></svg>`,
    load: () => import('./arrow-escape/index').then((m) => m.default),
  },
  {
    id: 'tile-tray',
    title: 'Tile Tray',
    tagline: 'Pick tiles off the pile, three of a kind clear.',
    levels: 10,
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#2b2d42"/><rect x="12" y="10" width="20" height="20" rx="5" fill="#f6efdc"/><rect x="26" y="18" width="20" height="20" rx="5" fill="#fffdf6"/><circle cx="36" cy="28" r="5" fill="#e5484d"/><rect x="8" y="44" width="48" height="12" rx="4" fill="#4a4e69"/><rect x="11" y="46" width="8" height="8" rx="2" fill="#fffdf6"/><rect x="21" y="46" width="8" height="8" rx="2" fill="#fffdf6"/></svg>`,
    load: () => import('./tile-tray/index').then((m) => m.default),
  },
  {
    id: 'color-tubes',
    title: 'Color Tubes',
    tagline: 'Pour until every tube holds one color.',
    levels: 10,
    icon: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#2b2d42"/><g stroke="#d6d9e6" stroke-width="2.5" fill="none"><path d="M12 12v34a6 6 0 0 0 12 0V12"/><path d="M26 12v34a6 6 0 0 0 12 0V12"/><path d="M40 12v34a6 6 0 0 0 12 0V12"/></g><path d="M14 36h8v10a4 4 0 0 1-8 0z" fill="#e5484d"/><path d="M14 26h8v10h-8z" fill="#3a6df0"/><path d="M28 36h8v10a4 4 0 0 1-8 0z" fill="#3a6df0"/><path d="M28 26h8v10h-8z" fill="#e5484d"/><path d="M42 36h8v10a4 4 0 0 1-8 0z" fill="#f5c518"/></svg>`,
    load: () => import('./color-tubes/index').then((m) => m.default),
  },
];

export const findGame = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
