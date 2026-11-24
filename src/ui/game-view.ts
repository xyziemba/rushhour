import {
  boardOne,
  exitVehicle,
  getStatus,
  loseReason,
  newGame,
} from '../engine/game';
import type { Bay, Dir, GameState, Level, Vehicle } from '../engine/types';
import { COLOR_NAME, SYMBOL } from './palette';

export interface GameViewOptions {
  /** Label shown above the level name, e.g. "Level 3" or "Endless". */
  label: string;
  symbols: boolean;
  /** Called on a win; returns details for the win overlay. */
  onWin(moves: number): { best?: number; next?: { label: string; go(): void } };
  onLose?(): void;
  onMenu(): void;
  /** Optional first-time hint. */
  hint?: string;
}

const QUEUE_COLS = 10;
const QUEUE_ROWS = 4;
const VEHICLE_KIND: Record<number, string> = { 1: 'car', 2: 'van', 3: 'bus' };

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const ARROW_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 11h5v10h5V11h5z" fill="currentColor"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class GameView {
  readonly root: HTMLElement;
  private state: GameState;
  private history: GameState[] = [];
  private busy = false;
  private lostReported = false;

  private lotWrap: HTMLElement;
  private lotEl: HTMLElement;
  private baysEl: HTMLElement;
  private queueEl: HTMLElement;
  private queueMore: HTMLElement;
  private movesEl: HTMLElement;
  private undoBtn: HTMLButtonElement;
  private overlay: HTMLElement;
  private toastEl: HTMLElement;
  private vehicleEls = new Map<string, HTMLButtonElement>();
  private resizeObs: ResizeObserver;
  private toastTimer = 0;

  constructor(
    container: HTMLElement,
    private level: Level,
    private opts: GameViewOptions,
  ) {
    this.state = newGame(level);
    this.root = el('div', 'game');
    if (opts.symbols) this.root.classList.add('symbols');

    // HUD
    const hud = el('header', 'hud');
    const menuBtn = el('button', 'icon-btn', '<span aria-hidden="true">☰</span>');
    menuBtn.setAttribute('aria-label', 'Menu');
    menuBtn.addEventListener('click', () => this.opts.onMenu());
    const title = el('div', 'hud-title');
    title.append(el('span', 'hud-label', opts.label), el('span', 'hud-name', level.name));
    this.movesEl = el('div', 'hud-moves');
    this.undoBtn = el('button', 'icon-btn', '<span aria-hidden="true">↶</span>');
    this.undoBtn.setAttribute('aria-label', 'Undo (U)');
    this.undoBtn.title = 'Undo (U)';
    this.undoBtn.addEventListener('click', () => this.undo());
    const restartBtn = el('button', 'icon-btn', '<span aria-hidden="true">⟲</span>');
    restartBtn.setAttribute('aria-label', 'Restart (R)');
    restartBtn.title = 'Restart (R)';
    restartBtn.addEventListener('click', () => this.restart());
    hud.append(menuBtn, title, this.movesEl, this.undoBtn, restartBtn);

    // Board
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

    this.toastEl = el('div', 'toast');
    this.toastEl.setAttribute('role', 'status');
    this.overlay = el('div', 'overlay');
    this.overlay.hidden = true;

    this.root.append(hud, board, this.toastEl, this.overlay);
    container.replaceChildren(this.root);

    this.resizeObs = new ResizeObserver(() => this.fit());
    this.resizeObs.observe(this.lotWrap);
    document.addEventListener('keydown', this.onKey);

    this.renderAll();
    this.fit();
    if (opts.hint) this.toast(opts.hint, 4500);
  }

  destroy(): void {
    this.resizeObs.disconnect();
    document.removeEventListener('keydown', this.onKey);
    clearTimeout(this.toastTimer);
  }

  // ---------- input ----------

  private onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'u' || (k === 'z' && !e.shiftKey)) this.undo();
    else if (k === 'r') this.restart();
    else if (k === 'escape') this.opts.onMenu();
  };

  private async onVehicle(id: string): Promise<void> {
    if (this.busy || getStatus(this.state) !== 'playing') return;
    const vEl = this.vehicleEls.get(id);
    const r = exitVehicle(this.state, id);
    if (r.result === 'blocked') {
      this.shake(vEl);
      const bEl = this.vehicleEls.get(r.blockerId);
      if (bEl) this.flash(bEl);
      return;
    }
    if (r.result === 'no-bay') {
      this.shake(vEl);
      this.toast('Out of bays: wait for a vehicle to fill up.');
      return;
    }
    if (r.result !== 'moved') return;

    this.busy = true;
    this.history.push(this.state);
    const vehicle = this.state.lot.find((v) => v.id === id)!;
    if (vEl) await this.animateExit(vEl, vehicle);
    this.state = r.state;
    this.renderLot();
    this.renderBays(r.bayIndex);
    this.renderHud();
    await this.runBoarding();
    this.busy = false;
    this.checkEnd();
  }

  private async runBoarding(): Promise<void> {
    const fast = reducedMotion();
    await sleep(fast ? 0 : 160);
    for (let step = boardOne(this.state); step; step = boardOne(this.state)) {
      this.state = step.state;
      this.renderQueue();
      if (step.event.departed) {
        const bayEl = this.baysEl.children[step.event.bayIndex]?.querySelector('.bay-vehicle');
        if (bayEl) {
          bayEl.querySelector('.seats')!.textContent = '0';
          bayEl.classList.add('departing');
          await sleep(fast ? 0 : 320);
        }
        this.renderBays();
      } else {
        this.renderBays();
        await sleep(fast ? 0 : 45);
      }
    }
  }

  undo(): void {
    if (this.busy || !this.history.length) return;
    this.state = this.history.pop()!;
    this.overlay.hidden = true;
    this.renderAll();
  }

  restart(): void {
    if (this.busy) return;
    this.state = newGame(this.level);
    this.history = [];
    this.lostReported = false;
    this.overlay.hidden = true;
    this.renderAll();
  }

  // ---------- layout ----------

  private fit(): void {
    const { clientWidth: w, clientHeight: h } = this.lotWrap;
    if (!w || !h) return;
    const pad = 16;
    const cell = Math.max(24, Math.min(76, Math.floor(Math.min((w - pad) / this.level.cols, (h - pad) / this.level.rows))));
    this.lotEl.style.setProperty('--cell', `${cell}px`);
  }

  // ---------- rendering ----------

  private renderAll(): void {
    this.renderLot(true);
    this.renderBays();
    this.renderQueue();
    this.renderHud();
  }

  private renderHud(): void {
    this.movesEl.textContent = `${this.state.moves} ${this.state.moves === 1 ? 'move' : 'moves'}`;
    this.undoBtn.disabled = this.history.length === 0;
  }

  private renderLot(rebuild = false): void {
    if (rebuild) {
      this.vehicleEls.forEach((e) => e.remove());
      this.vehicleEls.clear();
    }
    const present = new Set(this.state.lot.map((v) => v.id));
    for (const [id, e] of this.vehicleEls) {
      if (!present.has(id)) {
        e.remove();
        this.vehicleEls.delete(id);
      }
    }
    for (const v of this.state.lot) {
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
    b.addEventListener('click', () => void this.onVehicle(v.id));
    return b;
  }

  private renderBays(justParked = -1): void {
    const slots = this.state.bays.map((bay: Bay | null, i) => {
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

  private renderQueue(): void {
    const max = QUEUE_COLS * QUEUE_ROWS;
    const shown = this.state.queue.slice(0, max);
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
    const rest = this.state.queue.length - shown.length;
    this.queueMore.textContent = rest > 0 ? `+${rest} more waiting` : `${this.state.queue.length} waiting`;
  }

  // ---------- effects ----------

  private async animateExit(vEl: HTMLElement, v: Vehicle): Promise<void> {
    const delta: Record<Dir, [number, number]> = {
      up: [0, -(v.y + v.length + 1)],
      down: [0, this.level.rows - v.y + 1],
      left: [-(v.x + v.length + 1), 0],
      right: [this.level.cols - v.x + 1, 0],
    };
    const [dx, dy] = delta[v.dir];
    if (reducedMotion()) return;
    const dist = Math.abs(dx) + Math.abs(dy);
    const ms = Math.min(420, 140 + dist * 30);
    vEl.classList.add('leaving');
    vEl.style.transition = `transform ${ms}ms cubic-bezier(.5,0,.9,.6), opacity ${ms}ms ease-in`;
    vEl.style.transform = `translate(calc(var(--cell) * ${dx}), calc(var(--cell) * ${dy}))`;
    vEl.style.opacity = '0.2';
    await sleep(ms);
  }

  private shake(e?: HTMLElement): void {
    if (!e) return;
    e.classList.remove('shake');
    void e.offsetWidth; // restart animation
    e.classList.add('shake');
    setTimeout(() => e.classList.remove('shake'), 400);
  }

  private flash(e: HTMLElement): void {
    e.classList.remove('blocker');
    void e.offsetWidth;
    e.classList.add('blocker');
    setTimeout(() => e.classList.remove('blocker'), 600);
  }

  private toast(msg: string, ms = 2200): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  // ---------- end of game ----------

  private checkEnd(): void {
    const status = getStatus(this.state);
    if (status === 'won') this.showWin();
    else if (status === 'lost') this.showLose();
  }

  private showWin(): void {
    const { best, next } = this.opts.onWin(this.state.moves);
    const card = el('div', 'card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Level complete');
    card.append(
      el('h2', '', 'All aboard!'),
      el('p', '', `Cleared in <b>${this.state.moves}</b> moves${best !== undefined ? ` · best ${best}` : ''}.`),
    );
    const actions = el('div', 'actions');
    if (next) {
      const n = el('button', 'btn primary', next.label);
      n.addEventListener('click', () => next.go());
      actions.append(n);
    }
    const replay = el('button', 'btn', 'Replay');
    replay.addEventListener('click', () => this.restart());
    const menu = el('button', 'btn', 'Menu');
    menu.addEventListener('click', () => this.opts.onMenu());
    actions.append(replay, menu);
    card.append(actions);
    this.overlay.replaceChildren(card);
    this.overlay.hidden = false;
    (actions.firstElementChild as HTMLElement | null)?.focus();
  }

  private showLose(): void {
    if (!this.lostReported) {
      this.lostReported = true;
      this.opts.onLose?.();
    }
    const reason = loseReason(this.state);
    const card = el('div', 'card');
    card.setAttribute('role', 'dialog');
    card.append(
      el('h2', '', reason === 'gridlock' ? 'Gridlock!' : 'Out of bays!'),
      el(
        'p',
        '',
        reason === 'gridlock'
          ? 'No vehicle can get out of the lot.'
          : 'Every bay is full and nobody at the front of the line can board.',
      ),
    );
    const actions = el('div', 'actions');
    const undo = el('button', 'btn primary', 'Undo');
    undo.addEventListener('click', () => this.undo());
    const restart = el('button', 'btn', 'Restart');
    restart.addEventListener('click', () => this.restart());
    actions.append(undo, restart);
    card.append(actions);
    this.overlay.replaceChildren(card);
    this.overlay.hidden = false;
    undo.focus();
  }
}
