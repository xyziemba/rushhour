import { hexPoints, hexToPixel } from '../../lib/hex';
import { el, sleep } from '../../shell/dom';
import { COLOR_NAME, SYMBOL, type Color } from '../../shell/palette';
import type { GameView, ViewContext } from '../../shell/types';
import { topRun, type Event, type Level, type Move, type State } from './rules';

const SIZE = 30; // hex radius in SVG units
const LAYER = 4.2; // vertical offset per tile
const MAX_DRAWN = 14;

function stackSvg(stack: Color[], cx: number, cy: number, size: number, layer: number): string {
  const shown = stack.slice(-MAX_DRAWN);
  const parts = shown.map((c, i) => {
    const y = cy - i * layer;
    return `<polygon class="hs-tile c-${c}" points="${hexPoints(cx, y, size * 0.9)}"/>`;
  });
  if (stack.length) {
    const c = stack[stack.length - 1]!;
    const y = cy - (shown.length - 1) * layer;
    parts.push(`<text class="hs-count" x="${cx}" y="${y + size * 0.16}">${topRun(stack)}</text>`);
    parts.push(`<text class="hs-sym sym" x="${cx}" y="${y - size * 0.32}">${SYMBOL[c]}</text>`);
  }
  return parts.join('');
}

export class HexView implements GameView<State, Move, Event> {
  private svg: SVGSVGElement;
  private offersEl: HTMLElement;
  private state: State;
  private selected: number | null = null;

  constructor(host: HTMLElement, private ctx: ViewContext<Move>, level: Level, state: State) {
    void level;
    const wrap = el('div', 'hs-wrap');
    const span = SIZE * Math.sqrt(3) * (2 * level.radius + 1);
    const tall = SIZE * (3 * level.radius + 2) + MAX_DRAWN * LAYER;
    wrap.innerHTML = `<svg class="hs-board" viewBox="${-span / 2 - 4} ${-SIZE * (1.5 * level.radius + 1) - MAX_DRAWN * LAYER} ${span + 8} ${tall + 8}"></svg>`;
    this.svg = wrap.firstElementChild as SVGSVGElement;
    this.offersEl = el('div', 'hs-offers');
    host.replaceChildren(el('div', 'hs-goal'), wrap, this.offersEl);
    this.svg.addEventListener('click', (e) => {
      const g = (e.target as Element).closest('[data-cell]');
      if (g) this.onCell(Number(g.getAttribute('data-cell')));
    });
    this.svg.addEventListener('keydown', (e) => {
      const g = (e.target as Element).closest('[data-cell]');
      if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.onCell(Number(g.getAttribute('data-cell')));
      }
    });
    this.state = state;
    this.render(state);
  }

  destroy(): void {}

  render(state: State, touched: number[] = []): void {
    this.state = state;
    if (this.selected !== null && !state.offers[this.selected]) this.selected = null;
    // Draw back-to-front so taller stacks overlap the row behind them.
    const order = state.cells.map((_, i) => i).sort((a, b) => state.cells[a]!.r - state.cells[b]!.r || state.cells[a]!.q - state.cells[b]!.q);
    this.svg.innerHTML = order
      .map((i) => {
        const [x, y] = hexToPixel(state.cells[i]!, SIZE);
        const stack = state.stacks[i]!;
        const empty = !stack.length;
        const label = empty ? 'Empty space' : `Stack of ${stack.length}, top ${topRun(stack)} ${COLOR_NAME[stack[stack.length - 1]!]}`;
        return `<g data-cell="${i}" class="hs-cell${empty ? ' empty' : ''}${empty && this.selected !== null ? ' open' : ''}${touched.includes(i) ? ' pulse' : ''}" tabindex="${empty ? 0 : -1}" role="button" aria-label="${label}">
          <polygon class="hs-base" points="${hexPoints(x, y, SIZE * 0.96)}"/>${stackSvg(stack, x, y, SIZE, LAYER)}</g>`;
      })
      .join('');
    (this.svg.parentElement!.previousElementSibling as HTMLElement).textContent = `Reach ${state.target} points · tiles clear at 10`;
    this.renderOffers();
  }

  private renderOffers(): void {
    this.offersEl.replaceChildren(
      ...this.state.offers.map((o, slot) => {
        const b = el('button', `hs-offer${this.selected === slot ? ' selected' : ''}`);
        if (!o) {
          b.disabled = true;
          b.setAttribute('aria-label', 'Used');
          return b;
        }
        b.innerHTML = `<svg viewBox="-36 ${-36 - o.length * 7} 72 ${72 + o.length * 7}">${stackSvg(o, 0, 0, 28, 7)}</svg>`;
        b.setAttribute('aria-label', `Stack ${slot + 1}: ${o.map((c) => COLOR_NAME[c]).join(', ')} (bottom to top)`);
        b.addEventListener('click', () => {
          if (this.ctx.isBusy()) return;
          this.selected = this.selected === slot ? null : slot;
          this.render(this.state);
        });
        return b;
      }),
    );
  }

  private onCell(i: number): void {
    if (this.ctx.isBusy()) return;
    if (this.selected === null) {
      // Placing with nothing selected: use the first available stack.
      const first = this.state.offers.findIndex((o) => o);
      if (first === -1) return;
      this.selected = first;
    }
    if (this.state.stacks[i]!.length) {
      this.ctx.toast('Pick an empty space.');
      return;
    }
    const slot = this.selected;
    this.selected = null;
    this.ctx.play([slot, i]);
  }

  reject(): void {
    this.render(this.state);
  }

  async animate(_prev: State, next: State, _m: Move, events: Event[]): Promise<void> {
    const ev = events[0]!;
    this.render(next, ev.touched);
    if (ev.gained) this.ctx.toast(`+${ev.gained}!`, 900);
    await sleep(this.ctx.reducedMotion() ? 0 : 260);
  }
}
