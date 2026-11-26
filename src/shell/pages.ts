import { GAMES } from '../games/registry';
import { randomSeed } from '../lib/rng';
import { el } from './dom';
import { starsHtml } from './game-shell';
import { getProgress, getSettings, resetAll, saveSettings, starCount } from './storage';
import type { GameMeta, GameModule } from './types';

export type Navigate = (hash: string) => void;

export function renderHub(app: HTMLElement, go: Navigate): void {
  const settings = getSettings();
  const page = el('main', 'menu');
  page.innerHTML = `
    <header class="menu-head">
      <img src="./icon.svg" alt="" width="56" height="56" />
      <div>
        <h1>Puzzle Lot</h1>
        <p class="tagline">Small puzzles, one tap at a time.</p>
      </div>
    </header>
    <h2>Games</h2>
    <div class="game-grid"></div>
    <section class="settings">
      <label class="toggle"><input type="checkbox" data-symbols ${settings.symbols ? 'checked' : ''}/> Show color symbols</label>
      <label class="toggle"><input type="checkbox" data-relaxed ${settings.relaxed ? 'checked' : ''}/> Relaxed speed in timed games</label>
      <button class="btn subtle" data-reset>Reset progress</button>
    </section>
  `;
  const grid = page.querySelector('.game-grid')!;
  for (const g of GAMES) grid.append(gameCard(g, settings.lastGame === g.id, go));

  page.querySelector<HTMLInputElement>('[data-symbols]')!.addEventListener('change', (e) => {
    saveSettings({ symbols: (e.target as HTMLInputElement).checked });
  });
  page.querySelector<HTMLInputElement>('[data-relaxed]')!.addEventListener('change', (e) => {
    saveSettings({ relaxed: (e.target as HTMLInputElement).checked });
  });
  page.querySelector('[data-reset]')!.addEventListener('click', () => {
    if (confirm('Reset progress for every game? This cannot be undone.')) {
      resetAll();
      renderHub(app, go);
    }
  });
  app.replaceChildren(page);
}

function gameCard(g: GameMeta, last: boolean, go: Navigate): HTMLButtonElement {
  const p = getProgress(g.id);
  const solved = Object.keys(p.stars).length;
  const b = el('button', `game-card${last ? ' last' : ''}`);
  b.innerHTML = `${g.icon}<div>
      <div class="gc-title">${g.title}</div>
      <div class="gc-tag">${g.tagline}</div>
      <div class="gc-progress"><span>${solved}/${g.levels} solved</span><span><span class="star on">★</span> ${starCount(p)}/${g.levels * 3}</span></div>
    </div>`;
  b.setAttribute('aria-label', `${g.title}: ${solved} of ${g.levels} levels solved`);
  b.addEventListener('click', () => go(`#/${g.id}`));
  return b;
}

export function renderLevelSelect(app: HTMLElement, meta: GameMeta, game: GameModule<any, any, any, any>, go: Navigate): void {
  const p = getProgress(meta.id);
  const page = el('main', 'menu');
  page.innerHTML = `
    <header class="page-head">
      <button class="icon-btn" data-back aria-label="All games"><span aria-hidden="true">←</span></button>
      ${meta.icon}
      <div>
        <h1>${meta.title}</h1>
        <p class="tagline">${meta.tagline}</p>
      </div>
    </header>
    <h2>Levels</h2>
    <div class="level-grid"></div>
    ${
      game.endless
        ? `<section class="endless">
      <button class="btn primary wide" data-endless>Endless mode</button>
      <p class="muted">Random puzzles. Current streak: <b>${p.endlessStreak}</b></p>
    </section>`
        : ''
    }
    <details class="howto" ${Object.keys(p.stars).length ? '' : 'open'}>
      <summary>How to play</summary>
      <ul>${game.howToPlay.map((t) => `<li>${t}</li>`).join('')}
        <li>Keys: ${game.kind === 'turn' ? '<kbd>U</kbd> undo, ' : ''}<kbd>R</kbd> restart, <kbd>Esc</kbd> back.</li>
      </ul>
    </details>
  `;
  const grid = page.querySelector('.level-grid')!;
  for (let i = 0; i < game.campaign.count; i++) {
    const locked = i > p.unlocked;
    const levelId = game.campaign.level(i).id;
    const stars = p.stars[levelId];
    const b = el('button', `level-btn${stars ? ' done' : ''}`);
    b.disabled = locked;
    b.innerHTML = `<span class="num">${locked ? '🔒' : i + 1}</span><span class="name">${game.campaign.name(i)}</span>${
      stars ? starsHtml(stars) : ''
    }`;
    b.setAttribute('aria-label', `Level ${i + 1}: ${game.campaign.name(i)}${locked ? ' (locked)' : stars ? `, ${stars} stars` : ''}`);
    b.addEventListener('click', () => go(`#/${meta.id}/level/${i + 1}`));
    grid.append(b);
  }
  page.querySelector('[data-back]')!.addEventListener('click', () => go('#/'));
  page.querySelector('[data-endless]')?.addEventListener('click', () => go(`#/${meta.id}/endless/${randomSeed()}`));
  app.replaceChildren(page);
}
