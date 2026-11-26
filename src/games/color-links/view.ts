import { el, fitCells } from '../../shell/dom';
import { onDrag } from '../../shell/input';
import { COLOR_NAME, SYMBOL } from '../../shell/palette';
import type { GameView, ViewContext } from '../../shell/types';
import { adjacent, isConnected, type Level, type Move, type State } from './rules';

const SVGNS = 'http://www.w3.org/2000/svg';

export class LinksView implements GameView<State, Move, unknown> {
  private wrap: HTMLElement;
  private board: HTMLElement;
  private svg: SVGSVGElement;
  private dots: HTMLElement[] = [];
  private state: State;
  private stopFit: () => void;
  private stopDrag: () => void;
  /** Path being drawn right now (not yet committed). */
  private live: { pair: number; path: number[] } | null = null;
  private n: number;

  constructor(host: HTMLElement, private ctx: ViewContext<Move>, level: Level, state: State) {
    this.n = level.n;
    this.wrap = el('div', 'cl-wrap');
    this.board = el('div', 'cl-board');
    this.board.style.setProperty('--n', String(level.n));
    for (let i = 0; i < level.n * level.n; i++) this.board.append(el('div', 'cl-cell'));
    this.svg = document.createElementNS(SVGNS, 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${level.n} ${level.n}`);
    this.svg.classList.add('cl-svg');
    this.board.append(this.svg);
    level.pairs.forEach((p) => {
      for (const c of [p.a, p.b]) {
        const d = el('div', `cl-dot c-${p.color}`, `<span class="sym">${SYMBOL[p.color]}</span>`);
        d.style.setProperty('--x', String(c % level.n));
        d.style.setProperty('--y', String(Math.floor(c / level.n)));
        d.setAttribute('aria-label', `${COLOR_NAME[p.color]} dot`);
        this.dots.push(d);
        this.board.append(d);
      }
    });
    this.wrap.append(this.board);
    const status = el('div', 'cl-status');
    host.replaceChildren(this.wrap, status);
    this.stopFit = fitCells(this.wrap, this.board, level.n, level.n, { max: 64, pad: 12 });
    this.stopDrag = onDrag(this.board, {
      start: (e) => this.begin(e),
      move: (e) => this.extend(e),
      end: (_e, cancelled) => this.finish(cancelled),
    });
    this.state = state;
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
    this.stopDrag();
  }

  private cellAt(e: PointerEvent): number | null {
    const r = this.board.getBoundingClientRect();
    const pad = 6;
    const size = (r.width - pad * 2) / this.n;
    const x = Math.floor((e.clientX - r.left - pad) / size), y = Math.floor((e.clientY - r.top - pad) / size);
    if (x < 0 || y < 0 || x >= this.n || y >= this.n) return null;
    return y * this.n + x;
  }

  private pairAtDot(c: number): number {
    return this.state.pairs.findIndex((p) => p.a === c || p.b === c);
  }

  private begin(e: PointerEvent): boolean {
    if (this.ctx.isBusy()) return false;
    const c = this.cellAt(e);
    if (c === null) return false;
    const dotPair = this.pairAtDot(c);
    if (dotPair !== -1) {
      this.live = { pair: dotPair, path: [c] };
    } else {
      // Grab an existing path at this cell and keep drawing from there.
      const pi = this.state.paths.findIndex((p) => p.includes(c));
      if (pi === -1) return false;
      const p = this.state.paths[pi]!;
      this.live = { pair: pi, path: p.slice(0, p.indexOf(c) + 1) };
    }
    this.draw();
    return true;
  }

  private extend(e: PointerEvent): void {
    if (!this.live) return;
    const c = this.cellAt(e);
    const path = this.live.path;
    const last = path[path.length - 1]!;
    if (c === null || c === last) return;
    const back = path.indexOf(c);
    if (back !== -1) {
      path.length = back + 1; // drag back over your own line to shorten it
      this.draw();
      return;
    }
    if (!adjacent(this.n, last, c)) return;
    const pr = this.state.pairs[this.live.pair]!;
    const otherEnd = path[0] === pr.a ? pr.b : pr.a;
    if (last === otherEnd) return; // already connected
    const dot = this.pairAtDot(c);
    if (dot !== -1 && dot !== this.live.pair) return;
    path.push(c);
    this.draw();
  }

  private finish(cancelled: boolean): void {
    const live = this.live;
    this.live = null;
    if (!live || cancelled || live.path.length < 2) {
      this.draw();
      return;
    }
    const cur = this.state.paths[live.pair]!;
    if (cur.length === live.path.length && cur.every((c, i) => c === live.path[i])) {
      this.draw();
      return;
    }
    this.ctx.play({ pair: live.pair, path: live.path });
  }

  private draw(): void {
    const paths = this.state.paths.map((p, i) => (this.live?.pair === i ? this.live.path : p));
    // While drawing, show other colors cut where the live line crosses them.
    if (this.live) {
      const claimed = new Set(this.live.path);
      paths.forEach((p, i) => {
        if (i === this.live!.pair) return;
        const cut = p.findIndex((c) => claimed.has(c));
        if (cut !== -1) paths[i] = p.slice(0, cut);
      });
    }
    const filled = new Set<number>();
    const parts: string[] = [];
    paths.forEach((p, i) => {
      p.forEach((c) => filled.add(c));
      if (p.length < 2) return;
      const pts = p.map((c) => `${(c % this.n) + 0.5},${Math.floor(c / this.n) + 0.5}`).join(' ');
      parts.push(`<polyline points="${pts}" class="c-${this.state.pairs[i]!.color}" />`);
    });
    this.svg.innerHTML = parts.join('');
    [...this.board.querySelectorAll('.cl-cell')].forEach((cell, i) => {
      const owner = paths.findIndex((p) => p.includes(i));
      cell.className = `cl-cell${owner !== -1 ? ` tint c-${this.state.pairs[owner]!.color}` : ''}`;
    });
    const done = this.state.pairs.filter((_, i) => isConnected(this.state, i)).length;
    const status = this.wrap.nextElementSibling as HTMLElement;
    status.textContent = `${done}/${this.state.pairs.length} connected · ${Math.round((filled.size / (this.n * this.n)) * 100)}% filled`;
  }

  render(state: State): void {
    this.state = state;
    this.draw();
  }

  reject(): void {
    this.draw();
  }

  async animate(_prev: State, next: State): Promise<void> {
    this.render(next);
  }
}
