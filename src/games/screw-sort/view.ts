import { el, fitCells, pulseClass, sleep } from '../../shell/dom';
import { COLOR_NAME, SYMBOL, type Color } from '../../shell/palette';
import type { GameView, ViewContext } from '../../shell/types';
import { BOX_SIZE, isFree, type Event, type Level, type State } from './rules';

const PLATE_TINTS = ['#c9b79c', '#a9c4d6', '#c7b3d6', '#b6d1b0', '#d8c08f', '#d4a9a9', '#a9d1cc', '#bdbdd9'];

const screwHtml = (c: Color) => `<span class="ss-screw c-${c}"><span class="ss-slot"></span><span class="sym">${SYMBOL[c]}</span></span>`;

export class ScrewView implements GameView<State, string, Event> {
  private boxesEl: HTMLElement;
  private holesEl: HTMLElement;
  private wrap: HTMLElement;
  private board: HTMLElement;
  private stopFit: () => void;
  /** Boxes already shown, so only newly arrived boxes animate in. */
  private seenBoxes = new Set<number>();
  private totalBoxes: number;

  constructor(host: HTMLElement, private ctx: ViewContext<string>, level: Level, state: State) {
    this.totalBoxes = level.boxes.length;
    const top = el('section', 'ss-top');
    this.boxesEl = el('div', 'ss-boxes');
    this.boxesEl.setAttribute('aria-label', 'Boxes');
    this.holesEl = el('div', 'ss-holes');
    this.holesEl.setAttribute('aria-label', 'Spare holes');
    top.append(this.boxesEl, this.holesEl);
    this.wrap = el('div', 'ss-wrap');
    this.board = el('div', 'ss-board');
    this.board.style.setProperty('--cols', String(level.cols));
    this.board.style.setProperty('--rows', String(level.rows));
    this.wrap.append(this.board);
    host.replaceChildren(top, this.wrap);
    this.stopFit = fitCells(this.wrap, this.board, level.cols, level.rows, { max: 64, pad: 16 });
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
  }

  render(state: State): void {
    this.renderTop(state);
    this.renderBoard(state);
  }

  private renderTop(state: State): void {
    // Box number in arrival order: everything before the active ones has already left.
    const firstActive = this.totalBoxes - state.queue.length - state.active.length;
    const boxes = state.active.map((b, i) => {
      const n = firstActive + i;
      const box = el('div', `ss-box c-${b.color}${this.seenBoxes.has(n) ? '' : ' arriving'}`);
      this.seenBoxes.add(n);
      box.setAttribute('aria-label', `${COLOR_NAME[b.color]} box, ${b.filled} of ${BOX_SIZE}`);
      for (let i = 0; i < BOX_SIZE; i++) box.append(el('span', 'ss-socket', i < b.filled ? screwHtml(b.color) : ''));
      return box;
    });
    const next = el('div', 'ss-next');
    next.innerHTML = state.queue.length
      ? `<span>Next</span>${state.queue.slice(0, 4).map((c) => `<i class="c-${c}" aria-label="${COLOR_NAME[c]}"></i>`).join('')}${state.queue.length > 4 ? `<span>+${state.queue.length - 4}</span>` : ''}`
      : '<span>Last boxes</span>';
    this.boxesEl.replaceChildren(...boxes, next);
    const holes: HTMLElement[] = [];
    for (let i = 0; i < state.holeCount; i++) {
      const c = state.holes[i];
      const h = el('span', `ss-hole${state.holes.length >= state.holeCount ? ' full' : ''}`, c ? screwHtml(c) : '');
      h.setAttribute('aria-label', c ? `Spare hole: ${COLOR_NAME[c]}` : 'Empty spare hole');
      holes.push(h);
    }
    this.holesEl.replaceChildren(...holes);
  }

  private renderBoard(state: State): void {
    const nodes: HTMLElement[] = [];
    state.plates.forEach((p) => {
      const plate = el('div', 'ss-plate');
      plate.style.cssText = `--x:${p.x};--y:${p.y};--w:${p.w};--h:${p.h};--tint:${PLATE_TINTS[p.z % PLATE_TINTS.length]};z-index:${p.z * 2 + 1}`;
      plate.dataset.id = p.id;
      nodes.push(plate);
    });
    for (const sc of state.screws) {
      const plate = state.plates.find((p) => p.id === sc.plate)!;
      const free = isFree(state, sc);
      const b = el('button', `ss-pin${free ? '' : ' covered'}`, screwHtml(sc.color));
      b.style.cssText = `--x:${sc.x};--y:${sc.y};z-index:${plate.z * 2 + 2}`;
      b.dataset.id = sc.id;
      b.setAttribute('aria-label', `${COLOR_NAME[sc.color]} screw${free ? '' : ' (covered)'}`);
      if (!free) b.tabIndex = -1;
      b.addEventListener('click', () => {
        if (!this.ctx.isBusy()) this.ctx.play(sc.id);
      });
      nodes.push(b);
    }
    this.board.replaceChildren(...nodes);
  }

  reject(state: State, id: string, reason: string): void {
    const b = this.board.querySelector(`[data-id="${id}"]`);
    if (b) pulseClass(b, 'shake', 400);
    if (reason === 'covered') this.ctx.toast('That screw is under another plate.');
    else if (reason === 'no-hole') {
      pulseClass(this.holesEl, 'shake', 400);
      this.ctx.toast('No spare holes left. Pick a screw that fits a box.');
    }
    void state;
  }

  async animate(prev: State, next: State, id: string): Promise<void> {
    const fast = this.ctx.reducedMotion();
    const b = this.board.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (b && !fast) {
      b.classList.add('out');
      await sleep(180);
    }
    const fell = prev.plates.filter((p) => !next.plates.some((q) => q.id === p.id));
    if (fell.length && !fast) {
      for (const p of fell) this.board.querySelector(`.ss-plate[data-id="${p.id}"]`)?.classList.add('falling');
      await sleep(260);
    }
    this.render(next);
  }
}
