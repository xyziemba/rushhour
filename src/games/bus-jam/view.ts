import { el, fitCells, pulseClass, sleep } from '../../shell/dom';
import { COLOR_NAME, SYMBOL } from '../../shell/palette';
import type { GameView, ViewContext } from '../../shell/types';
import { boardOne, exitVehicle } from './rules';
import type { Bay, Dir, GameState, Level, Vehicle } from './types';

const QUEUE_COLS = 10;
const QUEUE_ROWS = 4;
const VEHICLE_KIND: Record<number, string> = { 1: 'car', 2: 'van', 3: 'bus' };

const ARROW_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 11h5v10h5V11h5z" fill="currentColor"/></svg>';

export type BusJamMove = string; // vehicle id

export class BusJamView implements GameView<GameState, BusJamMove, unknown> {
  private lotWrap: HTMLElement;
  private lotEl: HTMLElement;
  private baysEl: HTMLElement;
  private queueEl: HTMLElement;
  private queueMore: HTMLElement;
  private vehicleEls = new Map<string, HTMLButtonElement>();
  private stopFit: () => void;

  constructor(
    host: HTMLElement,
    private ctx: ViewContext<BusJamMove>,
    private level: Level,
    state: GameState,
  ) {
    const board = el('div', 'board');
    const station = el('section', 'station');
    const queueWrap = el('div', 'queue-wrap');
    this.queueEl = el('div', 'queue');
    this.queueEl.setAttribute('role', 'list');
    this.queueEl.setAttribute('aria-label', 'Passenger line');
    this.queueMore = el('div', 'queue-more');
    queueWrap.append(this.queueEl, this.queueMore);
    this.baysEl = el('div', 'bays');
    this.baysEl.setAttribute('aria-label', 'Loading bays');
    station.append(queueWrap, this.baysEl);

    this.lotWrap = el('section', 'lot-wrap');
    this.lotEl = el('div', 'lot');
    this.lotEl.setAttribute('aria-label', 'Parking lot');
    this.lotEl.style.setProperty('--cols', String(level.cols));
    this.lotEl.style.setProperty('--rows', String(level.rows));
    this.lotWrap.append(this.lotEl);
    board.append(station, this.lotWrap);
    host.replaceChildren(board);

    this.stopFit = fitCells(this.lotWrap, this.lotEl, level.cols, level.rows);
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
  }

  render(state: GameState): void {
    this.renderLot(state, true);
    this.renderBays(state);
    this.renderQueue(state);
  }

  reject(_state: GameState, move: BusJamMove, reason: string, detail?: unknown): void {
    const vEl = this.vehicleEls.get(move);
    if (vEl) pulseClass(vEl, 'shake', 400);
    if (reason === 'blocked') {
      const bEl = this.vehicleEls.get(detail as string);
      if (bEl) pulseClass(bEl, 'blocker', 600);
    } else if (reason === 'no-bay') {
      this.ctx.toast('Out of bays: wait for a vehicle to fill up.');
    }
  }

  async animate(prev: GameState, next: GameState, move: BusJamMove): Promise<void> {
    const fast = this.ctx.reducedMotion();
    const exit = exitVehicle(prev, move);
    if (exit.result !== 'moved') {
      this.render(next);
      return;
    }
    const vehicle = prev.lot.find((v) => v.id === move)!;
    const vEl = this.vehicleEls.get(move);
    if (vEl && !fast) await this.animateExit(vEl, vehicle);

    let s = exit.state;
    this.renderLot(s);
    this.renderBays(s, exit.bayIndex);
    await sleep(fast ? 0 : 160);

    // Replay boarding one passenger at a time until we reach `next`.
    for (let step = boardOne(s); step; step = boardOne(s)) {
      s = step.state;
      this.renderQueue(s);
      if (step.event.departed) {
        const bayEl = this.baysEl.children[step.event.bayIndex]?.querySelector('.bay-vehicle');
        if (bayEl) {
          bayEl.querySelector('.seats')!.textContent = '0';
          bayEl.classList.add('departing');
          await sleep(fast ? 0 : 320);
        }
      } else {
        await sleep(fast ? 0 : 45);
      }
      this.renderBays(s);
    }
    this.render(next);
  }

  // ---------- drawing ----------

  private renderLot(state: GameState, rebuild = false): void {
    if (rebuild) {
      this.vehicleEls.forEach((e) => e.remove());
      this.vehicleEls.clear();
    }
    const present = new Set(state.lot.map((v) => v.id));
    for (const [id, e] of this.vehicleEls) {
      if (!present.has(id)) {
        e.remove();
        this.vehicleEls.delete(id);
      }
    }
    for (const v of state.lot) {
      if (!this.vehicleEls.has(v.id)) {
        const b = this.makeVehicle(v);
        this.vehicleEls.set(v.id, b);
        this.lotEl.append(b);
      }
    }
  }

  private makeVehicle(v: Vehicle): HTMLButtonElement {
    const horizontal = v.dir === 'left' || v.dir === 'right';
    const b = el('button', `vehicle c-${v.color} dir-${v.dir} ${horizontal ? 'horiz' : 'vert'} len-${v.length}`);
    b.style.setProperty('--x', String(v.x));
    b.style.setProperty('--y', String(v.y));
    b.style.setProperty('--w', String(horizontal ? v.length : 1));
    b.style.setProperty('--h', String(horizontal ? 1 : v.length));
    b.setAttribute('aria-label', `${COLOR_NAME[v.color]} ${VEHICLE_KIND[v.length]}, ${v.capacity} seats, facing ${v.dir}`);
    b.innerHTML =
      `<span class="body"><span class="glass"></span>` +
      `<span class="arrow">${ARROW_SVG}</span>` +
      `<span class="sym" aria-hidden="true">${SYMBOL[v.color]}</span></span>`;
    b.addEventListener('click', () => {
      if (!this.ctx.isBusy()) this.ctx.play(v.id);
    });
    return b;
  }

  private renderBays(state: GameState, justParked = -1): void {
    const slots = state.bays.map((bay: Bay | null, i) => {
      const slot = el('div', 'bay');
      if (bay) {
        const v = bay.vehicle;
        const bv = el('div', `bay-vehicle c-${v.color} len-${v.length}${i === justParked ? ' parked' : ''}`);
        bv.innerHTML =
          `<span class="glass"></span><span class="sym" aria-hidden="true">${SYMBOL[v.color]}</span>` +
          `<span class="seats">${bay.seatsLeft}</span>`;
        bv.setAttribute('aria-label', `${COLOR_NAME[v.color]}, ${bay.seatsLeft} seats left`);
        slot.append(bv);
      } else {
        slot.setAttribute('aria-label', 'Empty bay');
      }
      return slot;
    });
    this.baysEl.replaceChildren(...slots);
  }

  private renderQueue(state: GameState): void {
    const max = QUEUE_COLS * QUEUE_ROWS;
    const shown = state.queue.slice(0, max);
    const dots = shown.map((c, i) => {
      // Serpentine: front of line is bottom-left, snaking upward.
      const row = Math.floor(i / QUEUE_COLS);
      const inRow = i % QUEUE_COLS;
      const col = row % 2 === 0 ? inRow : QUEUE_COLS - 1 - inRow;
      const d = el('span', `person c-${c}${i === 0 ? ' front' : ''}`);
      d.style.gridRow = String(QUEUE_ROWS - row);
      d.style.gridColumn = String(col + 1);
      d.setAttribute('role', 'listitem');
      d.setAttribute('aria-label', COLOR_NAME[c]);
      d.innerHTML = `<span class="sym" aria-hidden="true">${SYMBOL[c]}</span>`;
      return d;
    });
    this.queueEl.replaceChildren(...dots);
    const rest = state.queue.length - shown.length;
    this.queueMore.textContent = rest > 0 ? `+${rest} more waiting` : `${state.queue.length} waiting`;
  }

  private async animateExit(vEl: HTMLElement, v: Vehicle): Promise<void> {
    const delta: Record<Dir, [number, number]> = {
      up: [0, -(v.y + v.length + 1)],
      down: [0, this.level.rows - v.y + 1],
      left: [-(v.x + v.length + 1), 0],
      right: [this.level.cols - v.x + 1, 0],
    };
    const [dx, dy] = delta[v.dir];
    const ms = Math.min(420, 140 + (Math.abs(dx) + Math.abs(dy)) * 30);
    vEl.classList.add('leaving');
    vEl.style.transition = `transform ${ms}ms cubic-bezier(.5,0,.9,.6), opacity ${ms}ms ease-in`;
    vEl.style.transform = `translate(calc(var(--cell) * ${dx}), calc(var(--cell) * ${dy}))`;
    vEl.style.opacity = '0.2';
    await sleep(ms);
  }
}
