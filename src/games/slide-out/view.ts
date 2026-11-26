import { el, fitCells, pulseClass, sleep } from '../../shell/dom';
import { onDrag } from '../../shell/input';
import type { GameView, ViewContext } from '../../shell/types';
import { EXIT_ROW, N, TARGET, range, type Block, type Move, type State } from './rules';

const TINTS = ['c-blue', 'c-green', 'c-orange', 'c-teal', 'c-purple', 'c-yellow', 'c-pink'];

export class SlideView implements GameView<State, Move, unknown> {
  private wrap: HTMLElement;
  private board: HTMLElement;
  private els = new Map<string, HTMLButtonElement>();
  private state: State;
  private stopFit: () => void;
  private cleanups: (() => void)[] = [];

  constructor(host: HTMLElement, private ctx: ViewContext<Move>, state: State) {
    this.wrap = el('div', 'so-wrap');
    this.board = el('div', 'so-board');
    this.board.style.setProperty('--exit', String(EXIT_ROW));
    this.board.append(el('div', 'so-exit'));
    this.wrap.append(this.board);
    host.replaceChildren(this.wrap);
    this.stopFit = fitCells(this.wrap, this.board, N + 0.6, N, { max: 72, pad: 20 });
    this.state = state;
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
    this.cleanups.forEach((f) => f());
  }

  render(state: State): void {
    this.state = state;
    this.cleanups.forEach((f) => f());
    this.cleanups = [];
    this.els.forEach((e) => e.remove());
    this.els.clear();
    state.blocks.forEach((b, i) => {
      const e = el('button', `so-block ${b.id === TARGET ? 'target c-red' : TINTS[i % TINTS.length]} ${b.horiz ? 'h' : 'v'}`);
      this.place(e, b);
      e.setAttribute('aria-label', `${b.id === TARGET ? 'Red block' : 'Block'}, ${b.horiz ? 'slides left and right' : 'slides up and down'}`);
      this.cleanups.push(this.drag(e, b.id));
      e.addEventListener('keydown', (ev) => this.onKey(ev, b));
      this.els.set(b.id, e);
      this.board.append(e);
    });
  }

  private place(e: HTMLElement, b: Block): void {
    e.style.setProperty('--x', String(b.x));
    e.style.setProperty('--y', String(b.y));
    e.style.setProperty('--w', String(b.horiz ? b.len : 1));
    e.style.setProperty('--h', String(b.horiz ? 1 : b.len));
    e.style.transform = '';
  }

  private onKey(ev: KeyboardEvent, b: Block): void {
    const d =
      b.horiz ? (ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0) : ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0;
    if (!d) return;
    ev.preventDefault();
    if (!this.ctx.isBusy()) this.ctx.play([b.id, d]);
  }

  private drag(e: HTMLElement, id: string): () => void {
    let sx = 0, sy = 0, lo = 0, hi = 0, d = 0;
    const cell = () => parseFloat(getComputedStyle(this.board).getPropertyValue('--cell')) || 48;
    const block = () => this.state.blocks.find((b) => b.id === id)!;
    return onDrag(e, {
      start: (ev) => {
        if (this.ctx.isBusy()) return false;
        sx = ev.clientX;
        sy = ev.clientY;
        [lo, hi] = range(this.state.blocks, id);
        d = 0;
        e.classList.add('dragging');
      },
      move: (ev) => {
        const b = block();
        const px = b.horiz ? ev.clientX - sx : ev.clientY - sy;
        const c = cell();
        const clamped = Math.max(lo * c, Math.min(hi * c, px));
        d = Math.round(clamped / c);
        e.style.transform = b.horiz ? `translateX(${clamped}px)` : `translateY(${clamped}px)`;
      },
      end: () => {
        e.classList.remove('dragging');
        if (d) this.ctx.play([id, d]);
        else e.style.transform = '';
      },
    });
  }

  reject(): void {
    this.render(this.state);
  }

  async animate(_prev: State, next: State, [id]: Move): Promise<void> {
    const b = next.blocks.find((x) => x.id === id)!;
    const e = this.els.get(id);
    this.state = next;
    if (e) this.place(e, b);
    if (id === TARGET && b.x === N - 2 && e && !this.ctx.reducedMotion()) {
      await sleep(120);
      e.classList.add('escape');
      await sleep(350);
    } else if (e) {
      pulseClass(e, 'settle', 200);
    }
  }
}
