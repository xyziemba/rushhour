import type { Dir4 } from '../../lib/grid';
import { el, fitCells, pulseClass, sleep } from '../../shell/dom';
import { onDrag } from '../../shell/input';
import type { GameView, ViewContext } from '../../shell/types';
import { stuckCrate, type Event, type Level, type State } from './rules';

const KEYS: Record<string, Dir4> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

export class CrateView implements GameView<State, Dir4, Event> {
  private wrap: HTMLElement;
  private board: HTMLElement;
  private crateEls: HTMLElement[] = [];
  private playerEl: HTMLElement;
  private stopFit: () => void;
  private stopDrag: () => void;
  private warned = -1;

  constructor(host: HTMLElement, private ctx: ViewContext<Dir4>, private level: Level, state: State) {
    this.wrap = el('div', 'cp-wrap');
    this.board = el('div', 'cp-board');
    this.board.style.setProperty('--cols', String(level.cols));
    this.board.style.setProperty('--rows', String(level.rows));
    this.board.setAttribute('aria-label', 'Warehouse floor. Use the arrow keys or swipe to move.');
    const targets = new Set(level.targets);
    const walls = new Set(level.walls);
    for (let i = 0; i < level.cols * level.rows; i++) {
      const c = el('div', `cp-cell${walls.has(i) ? ' wall' : ''}${targets.has(i) ? ' target' : ''}`);
      c.addEventListener('click', () => this.tapCell(i));
      this.board.append(c);
    }
    this.playerEl = el('div', 'cp-player', '<span></span>');
    this.board.append(this.playerEl);
    this.wrap.append(this.board);

    const pad = el('div', 'cp-pad');
    for (const [d, glyph] of [['up', '▲'], ['left', '◀'], ['down', '▼'], ['right', '▶']] as const) {
      const b = el('button', `cp-key k-${d}`, glyph);
      b.setAttribute('aria-label', `Move ${d}`);
      b.addEventListener('click', () => this.go(d));
      pad.append(b);
    }
    host.replaceChildren(this.wrap, pad);
    this.stopFit = fitCells(this.wrap, this.board, level.cols, level.rows, { max: 60, pad: 8 });

    // Swipe anywhere on the board.
    let sx = 0, sy = 0;
    this.stopDrag = onDrag(this.board, {
      start: (e) => {
        sx = e.clientX;
        sy = e.clientY;
      },
      end: (e, cancelled) => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (cancelled || Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
          // treat as a tap on the cell under the finger
          const cell = document.elementFromPoint(e.clientX, e.clientY);
          const i = [...this.board.children].indexOf(cell as Element);
          if (!cancelled && i >= 0) this.tapCell(i);
          return;
        }
        this.go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      },
    });
    document.addEventListener('keydown', this.onKey);
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
    this.stopDrag();
    document.removeEventListener('keydown', this.onKey);
  }

  private state!: State;

  private onKey = (e: KeyboardEvent) => {
    const d = KEYS[e.key];
    if (!d || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    this.go(d);
  };

  private go(d: Dir4): void {
    if (!this.ctx.isBusy()) this.ctx.play(d);
  }

  private tapCell(i: number): void {
    const p = this.state.player, cols = this.level.cols;
    const dx = (i % cols) - (p % cols), dy = Math.floor(i / cols) - Math.floor(p / cols);
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    this.go(dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up');
  }

  private pos(e: HTMLElement, cell: number): void {
    e.style.setProperty('--x', String(cell % this.level.cols));
    e.style.setProperty('--y', String(Math.floor(cell / this.level.cols)));
  }

  render(state: State): void {
    this.state = state;
    while (this.crateEls.length < state.crates.length) {
      const c = el('div', 'cp-crate');
      this.crateEls.push(c);
      this.board.append(c);
    }
    state.crates.forEach((c, i) => {
      this.pos(this.crateEls[i]!, c);
      this.crateEls[i]!.classList.toggle('home', state.targets.has(c));
    });
    this.pos(this.playerEl, state.player);
  }

  reject(): void {
    pulseClass(this.playerEl, 'bump', 250);
  }

  async animate(_prev: State, next: State): Promise<void> {
    this.render(next);
    const stuck = stuckCrate(next);
    if (stuck !== null && stuck !== this.warned) {
      this.warned = stuck;
      this.ctx.toast('That crate is stuck in a corner. Undo to free it.', 3000);
    }
    await sleep(this.ctx.reducedMotion() ? 0 : 90);
  }
}
