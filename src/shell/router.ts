/** Hash routes: #/  ·  #/<game>  ·  #/<game>/level/N  ·  #/<game>/endless/SEED */

export type Route =
  | { kind: 'hub' }
  | { kind: 'levels'; game: string }
  | { kind: 'level'; game: string; index: number }
  | { kind: 'endless'; game: string; seed: number };

/** Links from before the hub existed (#/level/N, #/endless/SEED) belong to Bus Jam. */
const LEGACY_GAME = 'bus-jam';

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'level' || parts[0] === 'endless') parts.unshift(LEGACY_GAME);
  const [game, kind, arg] = parts;
  if (!game) return { kind: 'hub' };
  if (kind === 'level') {
    const n = Number(arg);
    if (Number.isInteger(n) && n >= 1) return { kind: 'level', game, index: n - 1 };
  }
  if (kind === 'endless') {
    const seed = Number(arg);
    if (Number.isInteger(seed) && seed > 0) return { kind: 'endless', game, seed };
  }
  return { kind: 'levels', game };
}

export function routeHash(r: Route): string {
  switch (r.kind) {
    case 'hub':
      return '#/';
    case 'levels':
      return `#/${r.game}`;
    case 'level':
      return `#/${r.game}/level/${r.index + 1}`;
    case 'endless':
      return `#/${r.game}/endless/${r.seed}`;
  }
}

/** True when the URL used an old single-game link and should be rewritten. */
export const isLegacyHash = (hash: string): boolean => /^#\/?(level|endless)\//.test(hash);
