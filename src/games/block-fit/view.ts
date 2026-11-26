import { el, fitCells, sleep } from '../../shell/dom';
import { onDrag } from '../../shell/input';
import type { GameView, ViewContext } from '../../shell/types';
import { SHAPES, SIZE, fits, type Event, type Level, type Move, type State } from './rules';

function pieceEl(id: number, cls: string): HTMLElement {
  const sh = SHAPES[id]!;
  const p = el('div', `bf-piece ${cls} c-${sh.color}`);
  p.style.setProperty('--pw', String(sh.w));
  p.style.setProperty('--ph', String(sh.h));
  for (const [x, y] of sh.cells) {
    const c = el('span', 'bf-block');
    c.style.gridColumn = String(x + 1);
    c.style.gridRow = String(y + 1);
    p.append(c);
  }
  return p;
}

export class BlockFitView implements GameView<State, Move, Event> {
  private wrap: HTMLElement;
  private board: HTMLElement;
  private cells: HTMLButtonElement[] = [];
  private trayEl: HTMLElement;
  private state: State;
  private selected: number | null = null;
  private cleanups: (() => void)[] = [];
  private stopFit: () => void;

  constructor(host: HTMLElement, private ctx: ViewContext<Move>, level: Level, state: State) {
    const goal = el('div', 'bf-goal');
    this.wrap = el('div', 'bf-wrap');
    this.board = el('div', 'bf-board');
    for (let i = 0; i < SIZE * SIZE; i++) {
      const c = el('button', 'bf-cell');
      c.setAttribute('aria-label', `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}`);
      c.addEventListener('click', () => this.onCell(i));
      this.cells.push(c);
    }
    this.board.append(...this.cells);
    this.wrap.append(this.board);
    this.trayEl = el('div', 'bf-tray');
    host.replaceChildren(goal, this.wrap, this.trayEl);
    this.stopFit = fitCells(this.wrap, this.board, SIZE, SIZE, { max: 54, pad: 12 });
    this.state = state;
    goal.textContent = `Reach ${level.target} points`;
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
    this.cleanups.forEach((f) => f());
  }

  render(state: State, flash: Event | null = null): void {
    this.state = state;
    this.cells.forEach((c, i) => {
      const color = state.board[i];
      c.className = `bf-cell${color ? ` filled c-${color}` : ''}${flash?.placed.includes(i) ? ' pop' : ''}`;
    });
    this.renderTray();
  }

  private renderTray(): void {
    this.cleanups.forEach((f) => f());
    this.cleanups = [];
    const slots = this.state.tray.map((id, slot) => {
      const b = el('button', `bf-slot${this.selected === slot ? ' selected' : ''}`);
      if (id === null || id === undefined) {
        b.disabled = true;
        b.setAttribute('aria-label', 'Empty');
        return b;
      }
      const sh = SHAPES[id]!;
      const playable = (() => {
        for (let y = 0; y <= SIZE - sh.h; y++) for (let x = 0; x <= SIZE - sh.w; x++) if (fits(this.state.board, sh, x, y)) return true;
        return false;
      })();
      b.classList.toggle('dead', !playable);
      b.append(pieceEl(id, 'mini'));
      b.setAttribute('aria-label', `Piece ${slot + 1}, ${sh.cells.length} blocks${this.selected === slot ? ', selected' : ''}`);
      this.cleanups.push(this.dragFrom(b, slot, id));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.select(slot);
        }
      });
      return b;
    });
    this.trayEl.replaceChildren(...slots);
  }

  private select(slot: number | null): void {
    this.selected = this.selected === slot ? null : slot;
    this.renderTray();
    if (this.selected !== null) this.ctx.toast('Now tap the board where it should go.', 1600);
  }

  private onCell(i: number): void {
    if (this.selected === null || this.ctx.isBusy()) return;
    const id = this.state.tray[this.selected];
    if (id === null || id === undefined) return;
    const sh = SHAPES[id]!;
    const x = Math.min(SIZE - sh.w, Math.max(0, (i % SIZE) - Math.floor((sh.w - 1) / 2)));
    const y = Math.min(SIZE - sh.h, Math.max(0, Math.floor(i / SIZE) - Math.floor((sh.h - 1) / 2)));
    const slot = this.selected;
    this.selected = null;
    this.ctx.play([slot, x, y]);
  }

  private preview(cells: number[], ok: boolean): void {
    this.cells.forEach((c, i) => {
      c.classList.toggle('ghost-ok', ok && cells.includes(i));
      c.classList.toggle('ghost-bad', !ok && cells.includes(i));
    });
  }

  /** Drag a piece from the tray; a short press without movement selects it instead. */
  private dragFrom(slotEl: HTMLElement, slot: number, id: number): () => void {
    const sh = SHAPES[id]!;
    let ghost: HTMLElement | null = null;
    let startX = 0, startY = 0, dragging = false, lift = 0;
    let target: [number, number] | null = null;
    const cellPx = () => parseFloat(getComputedStyle(this.board).getPropertyValue('--cell')) || 40;
    const toCell = (e: PointerEvent): [number, number] => {
      const cell = cellPx();
      const r = this.board.getBoundingClientRect();
      const left = e.clientX - (sh.w * cell) / 2;
      const top = e.clientY - sh.h * cell - lift;
      return [Math.round((left - r.left - 6) / cell), Math.round((top - r.top - 6) / cell)];
    };
    return onDrag(slotEl, {
      start: (e) => {
        if (this.ctx.isBusy()) return false;
        startX = e.clientX;
        startY = e.clientY;
        dragging = false;
        lift = e.pointerType === 'mouse' ? -(sh.h * cellPx()) / 2 : cellPx() * 0.8;
      },
      move: (e) => {
        if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
        if (!dragging) {
          dragging = true;
          ghost = pieceEl(id, 'drag');
          ghost.style.setProperty('--cell', `${cellPx()}px`);
          document.body.append(ghost);
          slotEl.classList.add('lifted');
        }
        const cell = cellPx();
        ghost!.style.left = `${e.clientX - (sh.w * cell) / 2}px`;
        ghost!.style.top = `${e.clientY - sh.h * cell - lift}px`;
        const [x, y] = toCell(e);
        const ok = fits(this.state.board, sh, x, y);
        target = ok ? [x, y] : null;
        const covered = sh.cells
          .map(([cx, cy]) => [x + cx, y + cy])
          .filter(([px, py]) => px! >= 0 && py! >= 0 && px! < SIZE && py! < SIZE)
          .map(([px, py]) => py! * SIZE + px!);
        this.preview(covered, ok);
      },
      end: (_e, cancelled) => {
        ghost?.remove();
        ghost = null;
        slotEl.classList.remove('lifted');
        this.preview([], true);
        if (!dragging) {
          if (!cancelled) this.select(slot);
          return;
        }
        if (target && !cancelled) {
          this.selected = null;
          this.ctx.play([slot, target[0], target[1]]);
        }
        target = null;
      },
    });
  }

  async animate(_prev: State, next: State, _m: Move, events: Event[]): Promise<void> {
    const ev = events[0]!;
    const fast = this.ctx.reducedMotion();
    if (ev.cleared.length) {
      // Show the placed piece and the lines lighting up before they clear.
      ev.placed.forEach((i) => this.cells[i]!.classList.add('filled', 'pop'));
      ev.cleared.forEach((i) => this.cells[i]!.classList.add('clearing'));
      await sleep(fast ? 0 : 320);
    }
    this.render(next, ev);
  }
}
