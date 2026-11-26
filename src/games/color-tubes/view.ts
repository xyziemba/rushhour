import { el, pulseClass, sleep } from '../../shell/dom';
import { COLOR_NAME, SYMBOL } from '../../shell/palette';
import type { GameView, ViewContext } from '../../shell/types';
import type { Event, Level, Move, State } from './rules';

export class TubesView implements GameView<State, Move, Event> {
  private row: HTMLElement;
  private selected: number | null = null;
  private state: State;

  constructor(host: HTMLElement, private ctx: ViewContext<Move>, private level: Level, state: State) {
    const wrap = el('div', 'ct-wrap');
    this.row = el('div', 'ct-row');
    this.row.style.setProperty('--cap', String(level.cap));
    wrap.append(this.row);
    host.replaceChildren(wrap);
    this.state = state;
    this.render(state);
  }

  destroy(): void {}

  render(state: State, fresh?: { to: number; amount: number }): void {
    this.state = state;
    this.row.style.setProperty('--n', String(state.tubes.length));
    this.row.replaceChildren(
      ...state.tubes.map((tube, i) => {
        const b = el('button', `ct-tube${this.selected === i ? ' selected' : ''}`);
        b.setAttribute(
          'aria-label',
          `Tube ${i + 1}: ${tube.length ? tube.map((c) => COLOR_NAME[c]).join(', ') + ' (bottom to top)' : 'empty'}${this.selected === i ? ', selected' : ''}`,
        );
        for (let k = 0; k < this.level.cap; k++) {
          const c = tube[k];
          const isFresh = fresh && fresh.to === i && k >= tube.length - fresh.amount;
          b.append(el('span', c ? `ct-seg c-${c}${isFresh ? ' fresh' : ''}` : 'ct-seg empty', c ? `<span class="sym">${SYMBOL[c]}</span>` : ''));
        }
        b.addEventListener('click', () => this.onTube(i));
        return b;
      }),
    );
  }

  private onTube(i: number): void {
    if (this.ctx.isBusy()) return;
    if (this.selected === null) {
      if (!this.state.tubes[i]!.length) return;
      this.selected = i;
      this.render(this.state);
      return;
    }
    if (this.selected === i) {
      this.selected = null;
      this.render(this.state);
      return;
    }
    const from = this.selected;
    this.selected = null;
    this.ctx.play([from, i]);
  }

  reject(state: State, [from, to]: Move): void {
    this.render(state);
    const t = this.row.children[to];
    if (t) pulseClass(t, 'shake', 400);
    if (state.tubes[to]!.length >= state.cap) this.ctx.toast('That tube is full.');
    else if (state.tubes[to]!.length) this.ctx.toast('You can only pour onto the same color.');
    void from;
  }

  async animate(_prev: State, next: State, [, to]: Move, events: Event[]): Promise<void> {
    this.render(next, { to, amount: events[0]!.amount });
    await sleep(this.ctx.reducedMotion() ? 0 : 220);
  }
}
