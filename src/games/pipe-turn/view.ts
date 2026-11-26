import { el, fitCells, sleep } from '../../shell/dom';
import type { GameView, ViewContext } from '../../shell/types';
import { D, L, R, U, maskAt, wet, type Level, type State } from './rules';

function pipeSvg(mask: number, isSource: boolean): string {
  const arms: string[] = [];
  if (mask & U) arms.push('<rect x="38" y="-2" width="24" height="52" rx="4"/>');
  if (mask & R) arms.push('<rect x="50" y="38" width="52" height="24" rx="4"/>');
  if (mask & D) arms.push('<rect x="38" y="50" width="24" height="52" rx="4"/>');
  if (mask & L) arms.push('<rect x="-2" y="38" width="52" height="24" rx="4"/>');
  const hub = isSource ? '<circle cx="50" cy="50" r="24" class="src"/><path d="M50 36c6 8 9 12 9 16a9 9 0 0 1-18 0c0-4 3-8 9-16z" fill="#fff"/>' : '<circle cx="50" cy="50" r="14"/>';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="pipe">${arms.join('')}${hub}</g></svg>`;
}

export class PipeView implements GameView<State, number, unknown> {
  private wrap: HTMLElement;
  private board: HTMLElement;
  private cells: HTMLButtonElement[] = [];
  /** Visual rotation count per cell, so tapping always spins clockwise. */
  private spins: number[] = [];
  private stopFit: () => void;

  constructor(host: HTMLElement, private ctx: ViewContext<number>, private level: Level, state: State) {
    this.wrap = el('div', 'pt-wrap');
    this.board = el('div', 'pt-board');
    this.board.style.setProperty('--cols', String(level.cols));
    this.board.style.setProperty('--rows', String(level.rows));
    this.wrap.append(this.board);
    host.replaceChildren(this.wrap);
    this.stopFit = fitCells(this.wrap, this.board, level.cols, level.rows, { max: 72, pad: 14 });
    level.pipes.forEach((mask, i) => {
      const b = el('button', 'pt-cell', pipeSvg(mask, i === level.source));
      b.addEventListener('click', () => {
        if (!this.ctx.isBusy()) this.ctx.play(i);
      });
      this.cells.push(b);
    });
    this.board.replaceChildren(...this.cells);
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
  }

  render(state: State): void {
    this.spins = [...state.turns];
    this.paint(state, false);
  }

  private paint(state: State, animated: boolean): void {
    const water = wet(state);
    const dirs = ['up', 'right', 'down', 'left'];
    this.cells.forEach((b, i) => {
      b.classList.toggle('wet', water.has(i));
      b.classList.toggle('no-anim', !animated);
      b.style.setProperty('--turn', `${this.spins[i]! * 90}deg`);
      const m = maskAt(state, i);
      const open = dirs.filter((_, k) => m & (1 << k)).join(', ');
      b.setAttribute('aria-label', `${i === this.level.source ? 'Water source' : 'Pipe'} open ${open}${water.has(i) ? ', has water' : ''}`);
    });
  }

  async animate(_prev: State, next: State, i: number): Promise<void> {
    this.spins[i]!++;
    this.paint(next, !this.ctx.reducedMotion());
    await sleep(this.ctx.reducedMotion() ? 0 : 120);
  }
}
