import { el } from './dom';
import type { GameModule, GameView, LevelBase, PlayStats, Stars, ViewContext } from './types';

export interface ShellOptions {
  /** Small label above the level name, e.g. "Level 3" or "Endless · streak 2". */
  label: string;
  symbols: boolean;
  hint?: string;
  onMenu(): void;
  /** Called once per win; returns what the win card should offer. */
  onWin(result: { stars: Stars; moves: number }): { best?: number; bestStars?: Stars; next?: { label: string; go(): void } };
  onLose?(): void;
}

interface Snapshot<S> {
  state: S;
  moves: number;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const starsHtml = (n: number, of = 3): string =>
  `<span class="stars" aria-label="${n} of ${of} stars">${'<span class="star on">★</span>'.repeat(n)}${'<span class="star">★</span>'.repeat(of - n)}</span>`;

/**
 * Hosts one level of one game: owns the HUD, history/undo, status checks and
 * the win/lose overlays. The game's view only draws the board and reports moves.
 */
export class GameShell<L extends LevelBase, S, M, E> {
  readonly root: HTMLElement;
  private state: S;
  private history: Snapshot<S>[] = [];
  private stats: PlayStats = { moves: 0, undos: 0 };
  private busy = false;
  private ended = false;
  private view: GameView<S, M, E>;

  private counterEl: HTMLElement;
  private undoBtn: HTMLButtonElement;
  private overlay: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  // Real-time games only.
  private raf = 0;
  private lastFrame = 0;
  private paused = false;
  private pauseBtn: HTMLButtonElement | null = null;

  constructor(
    container: HTMLElement,
    private game: GameModule<L, S, M, E>,
    private level: L,
    private opts: ShellOptions,
  ) {
    this.state = game.init(level);
    this.root = el('div', `game g-${game.id}${opts.symbols ? ' symbols' : ''}`);

    const hud = el('header', 'hud');
    const menuBtn = iconButton('☰', 'Back to levels (Esc)', () => this.opts.onMenu());
    const title = el('div', 'hud-title');
    title.append(el('span', 'hud-label', opts.label), el('span', 'hud-name', level.name));
    this.counterEl = el('div', 'hud-moves');
    this.counterEl.setAttribute('aria-live', 'polite');
    this.undoBtn = iconButton('↶', 'Undo (U)', () => this.undo());
    const restartBtn = iconButton('⟲', 'Restart (R)', () => this.restart());
    hud.append(menuBtn, title, this.counterEl);
    if (game.kind === 'turn') hud.append(this.undoBtn);
    else {
      this.pauseBtn = iconButton('⏸', 'Pause (P)', () => this.setPaused(!this.paused));
      hud.append(this.pauseBtn);
    }
    hud.append(restartBtn);

    const host = el('div', 'board-host');
    this.toastEl = el('div', 'toast');
    this.toastEl.setAttribute('role', 'status');
    this.overlay = el('div', 'overlay');
    this.overlay.hidden = true;
    this.root.append(hud, host, this.toastEl, this.overlay);
    container.replaceChildren(this.root);

    const ctx: ViewContext<M> = {
      play: (move) => void this.play(move),
      isBusy: () => this.busy || this.ended,
      toast: (m, ms) => this.toast(m, ms),
      symbols: opts.symbols,
      reducedMotion,
    };
    this.view = game.mountView(host, ctx, level, this.state);
    // Hook for browser smoke tests: replay a level's stored solution through the real UI.
    (window as unknown as { __puzzlelot?: unknown }).__puzzlelot = {
      level,
      play: (m: M) => this.play(m),
      state: () => this.state,
      busy: () => this.busy,
    };
    document.addEventListener('keydown', this.onKey);
    this.refreshHud();
    if (opts.hint) this.toast(opts.hint, 4500);
    if (game.kind === 'realtime') {
      document.addEventListener('visibilitychange', this.onVisibility);
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  destroy(): void {
    this.view.destroy();
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onVisibility);
    cancelAnimationFrame(this.raf);
    this.raf = -1;
    clearTimeout(this.toastTimer);
  }

  // ---------- real-time loop ----------

  private frame = (now: number) => {
    if (this.raf === -1) return;
    const dt = this.lastFrame ? Math.min(50, now - this.lastFrame) : 0;
    this.lastFrame = now;
    if (!this.paused && !this.ended && this.game.tick) {
      this.state = this.game.tick(this.state, dt);
      if (this.view.frame) this.view.frame(this.state);
      else this.view.render(this.state);
      this.refreshHud();
      this.checkEnd();
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private onVisibility = () => {
    if (document.hidden && !this.ended) this.setPaused(true);
  };

  private setPaused(paused: boolean): void {
    if (this.ended || this.game.kind !== 'realtime') return;
    this.paused = paused;
    this.lastFrame = 0;
    if (this.pauseBtn) this.pauseBtn.innerHTML = `<span aria-hidden="true">${paused ? '▶' : '⏸'}</span>`;
    if (!paused) {
      this.overlay.hidden = true;
      return;
    }
    const card = el('div', 'card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Paused');
    card.append(el('h2', '', 'Paused'));
    const actions = el('div', 'actions');
    actions.append(
      button('Resume', () => this.setPaused(false), true),
      button('Restart', () => this.restart()),
      button('Levels', () => this.opts.onMenu()),
    );
    card.append(actions);
    this.openOverlay(card);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'u' && this.game.kind === 'turn') this.undo();
    else if (k === 'p' && this.game.kind === 'realtime') {
      this.setPaused(!this.paused);
    } else if (k === 'r') this.restart();
    else if (k === 'escape') this.opts.onMenu();
  };

  async play(move: M): Promise<void> {
    if (this.busy || this.ended || this.paused) return;
    const result = this.game.apply(this.state, move);
    if (!result.ok) {
      this.view.reject?.(this.state, move, result.reason, result.detail);
      return;
    }
    if (this.game.kind === 'realtime') {
      // No history or animation wait: the frame loop keeps drawing.
      this.state = result.state;
      this.stats.moves++;
      if (this.view.frame) this.view.frame(this.state);
      else this.view.render(this.state);
      this.refreshHud();
      return;
    }
    this.busy = true;
    const prev = this.state;
    this.history.push({ state: prev, moves: this.stats.moves });
    this.state = result.state;
    this.stats.moves++;
    this.refreshHud();
    try {
      await this.view.animate(prev, result.state, move, result.events);
    } finally {
      this.busy = false;
    }
    this.checkEnd();
  }

  undo(): void {
    if (this.busy || !this.history.length) return;
    const snap = this.history.pop()!;
    this.state = snap.state;
    this.stats.moves = snap.moves;
    this.stats.undos++;
    this.ended = false;
    this.overlay.hidden = true;
    this.view.render(this.state);
    this.refreshHud();
  }

  restart(): void {
    if (this.busy) return;
    this.state = this.game.init(this.level);
    this.history = [];
    this.stats = { moves: 0, undos: 0 };
    this.ended = false;
    this.paused = false;
    this.lastFrame = 0;
    if (this.pauseBtn) this.pauseBtn.innerHTML = '<span aria-hidden="true">⏸</span>';
    this.overlay.hidden = true;
    this.view.render(this.state);
    this.refreshHud();
  }

  private refreshHud(): void {
    this.counterEl.textContent =
      this.game.hudText?.(this.state, this.stats) ?? `${this.stats.moves} ${this.stats.moves === 1 ? 'move' : 'moves'}`;
    this.undoBtn.disabled = this.history.length === 0;
  }

  toast(message: string, ms = 2200): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  private checkEnd(): void {
    const status = this.game.status(this.state);
    if (status === 'won') this.showWin();
    else if (status === 'lost') this.showLose();
  }

  private showWin(): void {
    this.ended = true;
    const stars = this.game.stars(this.state, this.stats, this.level);
    const { best, bestStars, next } = this.opts.onWin({ stars, moves: this.stats.moves });
    const card = el('div', 'card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Level complete');
    const bestText =
      bestStars !== undefined && bestStars > stars
        ? ` · best ${'★'.repeat(bestStars)}`
        : best !== undefined && best < this.stats.moves
          ? ` · best ${best}`
          : '';
    card.append(
      el('h2', '', 'Solved!'),
      el('div', 'card-stars', starsHtml(stars)),
      el('p', '', `${this.stats.moves} moves${this.stats.undos ? `, ${this.stats.undos} undo${this.stats.undos === 1 ? '' : 's'}` : ''}${bestText}`),
    );
    const actions = el('div', 'actions');
    if (next) actions.append(button(next.label, () => next.go(), true));
    actions.append(
      button('Replay', () => this.restart()),
      button('Levels', () => this.opts.onMenu()),
    );
    card.append(actions);
    this.openOverlay(card);
  }

  private showLose(): void {
    if (!this.ended) this.opts.onLose?.();
    this.ended = true;
    const { title, body } = this.game.lossMessage(this.state);
    const card = el('div', 'card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', title);
    card.append(el('h2', '', title), el('p', '', body));
    const actions = el('div', 'actions');
    if (this.game.kind === 'turn') actions.append(button('Undo', () => this.undo(), true));
    actions.append(button('Restart', () => this.restart(), this.game.kind !== 'turn'));
    card.append(actions);
    this.openOverlay(card);
  }

  private openOverlay(card: HTMLElement): void {
    this.overlay.replaceChildren(card);
    this.overlay.hidden = false;
    card.querySelector<HTMLElement>('.btn')?.focus();
  }
}

function iconButton(glyph: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', 'icon-btn', `<span aria-hidden="true">${glyph}</span>`);
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', onClick);
  return b;
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = el('button', `btn${primary ? ' primary' : ''}`, label);
  b.addEventListener('click', onClick);
  return b;
}
