import { el, fitCells, pulseClass, sleep } from '../../shell/dom';
import type { GameView, ViewContext } from '../../shell/types';
import { DELTA } from '../../lib/grid';
import type { Event, Level, Piece, State } from './rules';

const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 11h5v11h6V11h5z" fill="currentColor"/></svg>';

export class ArrowView implements GameView<State, string, Event> {
  private wrap: HTMLElement;
  private board: HTMLElement;
  private els = new Map<string, HTMLButtonElement>();
  private stopFit: () => void;

  constructor(host: HTMLElement, private ctx: ViewContext<string>, private level: Level, state: State) {
    this.wrap = el('div', 'ae-wrap');
    this.board = el('div', 'ae-board');
    this.board.style.setProperty('--cols', String(level.cols));
    this.board.style.setProperty('--rows', String(level.rows));
    this.wrap.append(this.board);
    host.replaceChildren(this.wrap);
    this.stopFit = fitCells(this.wrap, this.board, level.cols, level.rows, { max: 72 });
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
  }

  render(state: State): void {
    this.els.forEach((e) => e.remove());
    this.els.clear();
    for (const p of state.pieces) {
      const b = this.make(p);
      this.els.set(p.id, b);
      this.board.append(b);
    }
  }

  private make(p: Piece): HTMLButtonElement {
    const horiz = p.dir === 'left' || p.dir === 'right';
    const b = el('button', `ae-piece d-${p.dir}`);
    b.style.setProperty('--x', String(p.x));
    b.style.setProperty('--y', String(p.y));
    b.style.setProperty('--w', String(horiz ? p.length : 1));
    b.style.setProperty('--h', String(horiz ? 1 : p.length));
    b.setAttribute('aria-label', `Arrow pointing ${p.dir}`);
    b.innerHTML = `<span class="ae-shaft"></span><span class="ae-head">${ARROW}</span>`;
    b.addEventListener('click', () => {
      if (!this.ctx.isBusy()) this.ctx.play(p.id);
    });
    return b;
  }

  async animate(prev: State, next: State, id: string, events: Event[]): Promise<void> {
    const e = events[0]!;
    const pEl = this.els.get(id);
    if (e.type === 'crash') {
      if (pEl) pulseClass(pEl, 'crash', 450);
      const b = this.els.get(e.blocker);
      if (b) pulseClass(b, 'blocker', 600);
      this.ctx.toast(next.lives > 0 ? `Crash! ${next.lives} ${next.lives === 1 ? 'heart' : 'hearts'} left.` : 'Crash!');
      await sleep(this.ctx.reducedMotion() ? 0 : 300);
      return;
    }
    const p = prev.pieces.find((q) => q.id === id)!;
    if (pEl && !this.ctx.reducedMotion()) {
      const [dx, dy] = DELTA[p.dir];
      const far = Math.max(this.level.cols, this.level.rows) + 3;
      pEl.classList.add('leaving');
      pEl.style.transform = `translate(calc(var(--cell) * ${dx * far}), calc(var(--cell) * ${dy * far}))`;
      await sleep(260);
    }
    pEl?.remove();
    this.els.delete(id);
  }
}
