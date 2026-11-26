import './shell/shell.css';
import { findGame } from './games/registry';
import { randomSeed } from './lib/rng';
import { el } from './shell/dom';
import { GameShell } from './shell/game-shell';
import { renderHub, renderLevelSelect } from './shell/pages';
import { isLegacyHash, parseRoute, routeHash, type Route } from './shell/router';
import { getProgress, getSettings, recordWin, saveProgress, saveSettings } from './shell/storage';
import type { GameMeta, GameModule } from './shell/types';
import { registerSW } from 'virtual:pwa-register';

const app = document.getElementById('app')!;
let current: { destroy(): void } | null = null;
/** Increments on every navigation so a slow game load can't render over a newer page. */
let navToken = 0;

const go = (hash: string) => {
  if (location.hash === hash) void route();
  else location.hash = hash;
};

async function route(): Promise<void> {
  if (isLegacyHash(location.hash)) {
    history.replaceState(null, '', routeHash(parseRoute(location.hash)));
  }
  const token = ++navToken;
  current?.destroy();
  current = null;
  const r = parseRoute(location.hash);
  if (r.kind === 'hub') {
    // A new version finished downloading: switch to it now, while nothing is in progress.
    if (updateReady) return void applyUpdate(true);
    document.title = 'Puzzle Lot';
    renderHub(app, go);
    return;
  }

  const meta = findGame(r.game);
  if (!meta) return go('#/');
  let game: GameModule<any, any, any, any>;
  try {
    game = await meta.load();
  } catch {
    app.replaceChildren(el('main', 'menu', '<h1>Couldn’t load the game</h1><p class="muted">Check your connection and reload.</p>'));
    return;
  }
  if (token !== navToken) return;
  document.title = `${meta.title} · Puzzle Lot`;
  saveSettings({ lastGame: meta.id });

  if (r.kind === 'levels') renderLevelSelect(app, meta, game, go);
  else startLevel(meta, game, r);
}

function startLevel(meta: GameMeta, game: GameModule<any, any, any, any>, r: Extract<Route, { kind: 'level' | 'endless' }>): void {
  const progress = getProgress(meta.id);
  const symbols = getSettings().symbols;
  const back = () => go(`#/${meta.id}`);

  if (r.kind === 'level') {
    if (r.index >= game.campaign.count || r.index > progress.unlocked) return back();
    const level = game.campaign.level(r.index);
    const isLast = r.index === game.campaign.count - 1;
    current = new GameShell(app, game, level, {
      label: `Level ${r.index + 1}`,
      symbols,
      hint: r.index === 0 && !progress.stars[level.id] ? game.hint : undefined,
      onMenu: back,
      onWin: ({ stars, moves }) => {
        const before = getProgress(meta.id);
        const after = recordWin(meta.id, r.index, level.id, stars, game.tracksBest ? moves : null, game.campaign.count);
        return {
          best: before.best[level.id],
          bestStars: after.stars[level.id],
          next:
            isLast && game.endless
              ? { label: 'Try Endless', go: () => go(`#/${meta.id}/endless/${randomSeed()}`) }
              : isLast
                ? undefined
                : { label: 'Next level', go: () => go(`#/${meta.id}/level/${r.index + 2}`) },
        };
      },
    });
    return;
  }

  if (!game.endless) return back();
  const level = game.endless(r.seed, progress.endlessStreak);
  current = new GameShell(app, game, level, {
    label: `Endless · streak ${progress.endlessStreak}`,
    symbols,
    onMenu: back,
    onLose: () => saveProgress(meta.id, { endlessStreak: 0 }),
    onWin: () => {
      saveProgress(meta.id, { endlessStreak: getProgress(meta.id).endlessStreak + 1 });
      return { next: { label: 'Next puzzle', go: () => go(`#/${meta.id}/endless/${randomSeed()}`) } };
    },
  });
}

// Offline support: the service worker caches the whole app on the first online visit.
// When a newer version has been downloaded it waits, and is applied the next time the
// player returns to the home screen (or on the next launch).
let updateReady = false;
const applyUpdate = registerSW({
  onNeedRefresh() {
    updateReady = true;
    if (parseRoute(location.hash).kind === 'hub') void applyUpdate(true);
  },
  onRegisteredSW(_url, registration) {
    // An installed home-screen app can stay open for days; look for updates when it comes back.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update();
    });
  },
});

window.addEventListener('hashchange', () => void route());
void route();
