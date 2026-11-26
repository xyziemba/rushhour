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
];

export const findGame = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
