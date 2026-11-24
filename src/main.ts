import './styles.css';
import { endlessParams, generateLevel } from './engine/generator';
import { LEVEL_COUNT, LEVEL_PARAMS, getLevel } from './levels/levels';
import { loadProgress, saveProgress } from './storage';
import { GameView } from './ui/game-view';

const app = document.getElementById('app')!;
let current: GameView | null = null;

type Route = { kind: 'menu' } | { kind: 'level'; index: number } | { kind: 'endless'; seed: number };

function parseRoute(): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'level') {
    const n = Number(parts[1]);
    if (Number.isInteger(n) && n >= 1 && n <= LEVEL_COUNT) return { kind: 'level', index: n - 1 };
  }
  if (parts[0] === 'endless') {
    const seed = Number(parts[1]);
    if (Number.isInteger(seed) && seed > 0) return { kind: 'endless', seed };
  }
  return { kind: 'menu' };
}

const go = (hash: string) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};
const randomSeed = () => 1 + Math.floor(Math.random() * 999_999);

function route(): void {
  current?.destroy();
  current = null;
  const r = parseRoute();
  const progress = loadProgress();

  if (r.kind === 'level') {
    if (r.index > progress.unlocked) return go('#/');
    const level = getLevel(r.index);
    current = new GameView(app, level, {
      label: `Level ${r.index + 1}`,
      symbols: progress.symbols,
      hint: r.index === 0 && !progress.best[level.id] ? 'Tap a vehicle to drive it out the way its arrow points.' : undefined,
      onMenu: () => go('#/'),
      onWin: (moves) => {
        const prevBest = progress.best[level.id];
        const best = prevBest === undefined ? moves : Math.min(prevBest, moves);
        saveProgress({
          unlocked: Math.max(progress.unlocked, Math.min(LEVEL_COUNT - 1, r.index + 1)),
          best: { ...progress.best, [level.id]: best },
        });
        const isLast = r.index === LEVEL_COUNT - 1;
        return {
          best,
          next: isLast
            ? { label: 'Try Endless', go: () => go(`#/endless/${randomSeed()}`) }
            : { label: 'Next level', go: () => go(`#/level/${r.index + 2}`) },
        };
      },
    });
    return;
  }

  if (r.kind === 'endless') {
    const level = generateLevel(endlessParams(r.seed, progress.endlessStreak));
    current = new GameView(app, level, {
      label: `Endless · streak ${progress.endlessStreak}`,
      symbols: progress.symbols,
      onMenu: () => go('#/'),
      onLose: () => saveProgress({ endlessStreak: 0 }),
      onWin: () => {
        saveProgress({ endlessStreak: loadProgress().endlessStreak + 1 });
        return { next: { label: 'Next puzzle', go: () => go(`#/endless/${randomSeed()}`) } };
      },
    });
    return;
  }

  renderMenu();
}

function renderMenu(): void {
  const progress = loadProgress();
  const root = document.createElement('main');
  root.className = 'menu';
  root.innerHTML = `
    <header class="menu-head">
      <img src="./icon.svg" alt="" width="56" height="56" />
      <div>
        <h1>Rush Hour</h1>
        <p class="tagline">Clear the lot. Get everyone home.</p>
      </div>
    </header>
    <section>
      <h2>Levels</h2>
      <div class="level-grid"></div>
    </section>
    <section class="endless">
      <button class="btn primary wide" data-endless>Endless mode</button>
      <p class="muted">Random puzzles. Current streak: <b>${progress.endlessStreak}</b></p>
    </section>
    <section>
      <label class="toggle"><input type="checkbox" data-symbols ${progress.symbols ? 'checked' : ''}/> Show color symbols</label>
    </section>
    <details class="howto">
      <summary>How to play</summary>
      <ul>
        <li>Tap a vehicle to drive it out of the lot in the direction of its arrow. It needs a clear path to the edge.</li>
        <li>Vehicles that leave park in a loading bay.</li>
        <li>Passengers at the front of the line board parked vehicles of their color. Full vehicles depart and free their bay.</li>
        <li>You lose if every bay is full and nobody at the front can board. Plan ahead and dig out the colors you need next.</li>
        <li>Keys: <kbd>U</kbd> undo, <kbd>R</kbd> restart, <kbd>Esc</kbd> menu.</li>
      </ul>
    </details>
  `;
  const grid = root.querySelector('.level-grid')!;
  LEVEL_PARAMS.forEach((p, i) => {
    const locked = i > progress.unlocked;
    const best = progress.best[p.id!];
    const b = document.createElement('button');
    b.className = `level-btn${best !== undefined ? ' done' : ''}`;
    b.disabled = locked;
    b.innerHTML = `<span class="num">${locked ? '🔒' : i + 1}</span><span class="name">${p.name}</span>${
      best !== undefined ? `<span class="best">✓ ${best} moves</span>` : ''
    }`;
    b.setAttribute('aria-label', `Level ${i + 1}: ${p.name}${locked ? ' (locked)' : ''}`);
    b.addEventListener('click', () => go(`#/level/${i + 1}`));
    grid.append(b);
  });
  root.querySelector('[data-endless]')!.addEventListener('click', () => go(`#/endless/${randomSeed()}`));
  root.querySelector<HTMLInputElement>('[data-symbols]')!.addEventListener('change', (e) => {
    saveProgress({ symbols: (e.target as HTMLInputElement).checked });
  });
  app.replaceChildren(root);
}

window.addEventListener('hashchange', route);
route();
