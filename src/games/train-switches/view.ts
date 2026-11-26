import { el, sleep } from '../../shell/dom';
import { COLOR_NAME } from '../../shell/palette';
import type { GameView, ViewContext } from '../../shell/types';
import type { Event, Level, Move, Run, State } from './rules';

const W = 74, H = 60, PAD = 46;
const TICK_MS = 520;

export class TrainView implements GameView<State, Move, Event> {
  private svg: SVGSVGElement;
  private goBtn: HTMLButtonElement;
  private info: HTMLElement;
  private state: State;

  constructor(host: HTMLElement, private ctx: ViewContext<Move>, private level: Level, state: State) {
    const wrap = el('div', 'ts-wrap');
    const vw = PAD * 2 + level.cols * W + 40;
    const vh = PAD * 2 + (level.rows - 1) * H;
    wrap.innerHTML = `<svg class="ts-map" viewBox="-30 0 ${vw} ${vh}" role="group" aria-label="Track map"></svg>`;
    this.svg = wrap.firstElementChild as SVGSVGElement;
    const bar = el('div', 'ts-bar');
    this.info = el('div', 'ts-info');
    this.goBtn = el('button', 'btn primary ts-go', 'Go ▶');
    this.goBtn.addEventListener('click', () => {
      if (!this.ctx.isBusy()) this.ctx.play({ t: 'go' });
    });
    bar.append(this.info, this.goBtn);
    host.replaceChildren(wrap, bar);
    this.svg.addEventListener('click', (e) => {
      const g = (e.target as Element).closest('[data-switch]');
      if (g && !this.ctx.isBusy()) this.ctx.play({ t: 'flip', s: Number(g.getAttribute('data-switch')) });
    });
    this.svg.addEventListener('keydown', (e) => {
      const g = (e.target as Element).closest('[data-switch]');
      if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (!this.ctx.isBusy()) this.ctx.play({ t: 'flip', s: Number(g.getAttribute('data-switch')) });
      }
    });
    this.state = state;
    this.render(state);
  }

  destroy(): void {}

  private xy(node: number): [number, number] {
    const c = Math.floor(node / this.level.rows), r = node % this.level.rows;
    return [PAD + c * W, PAD + r * H];
  }

  render(state: State, trains = ''): void {
    this.state = state;
    const lv = this.level;
    const swIndex = new Map(lv.switches.map((n, i) => [n, i]));
    const tracks: string[] = [];
    const used = new Set<number>(lv.trains.map((t) => t.row));
    // Only draw track reachable from an entry.
    for (let c = 0; c < lv.cols; c++) {
      for (let r = 0; r < lv.rows; r++) {
        const n = c * lv.rows + r;
        if (!used.has(n)) continue;
        lv.outs[n]!.forEach((m, k) => {
          used.add(m);
          const si = swIndex.get(n);
          const active = si === undefined || state.setting[si] === k;
          const [x1, y1] = this.xy(n), [x2, y2] = this.xy(m);
          tracks.push(`<line class="ts-rail${active ? '' : ' off'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
        });
      }
    }
    const nodes: string[] = [];
    used.forEach((n) => {
      const [x, y] = this.xy(n);
      const si = swIndex.get(n);
      if (si !== undefined) {
        const target = lv.outs[n]![state.setting[si]!]!;
        const [tx, ty] = this.xy(target);
        const ang = (Math.atan2(ty - y, tx - x) * 180) / Math.PI;
        const dir = ty < y ? 'up' : ty > y ? 'down' : 'straight';
        nodes.push(`<g class="ts-switch" data-switch="${si}" tabindex="0" role="button" aria-label="Switch, set ${dir}">
          <circle cx="${x}" cy="${y}" r="15"/><path d="M-6 -5 L5 0 L-6 5 Z" transform="translate(${x} ${y}) rotate(${ang})"/></g>`);
      } else if (Math.floor(n / lv.rows) < lv.cols) {
        nodes.push(`<circle class="ts-node" cx="${x}" cy="${y}" r="4"/>`);
      }
    });
    const stations = lv.stations.map((c, r) => {
      const [x, y] = this.xy(lv.cols * lv.rows + r);
      if (!used.has(lv.cols * lv.rows + r)) return '';
      return c
        ? `<rect class="ts-station c-${c}" x="${x + 6}" y="${y - 14}" width="26" height="28" rx="6"><title>${COLOR_NAME[c]} station</title></rect>`
        : `<rect class="ts-station none" x="${x + 6}" y="${y - 14}" width="26" height="28" rx="6"><title>No station</title></rect>`;
    });
    const waiting = lv.trains.map((t, i) => {
      const [x, y] = this.xy(t.row);
      const sameRow = lv.trains.filter((o, j) => o.row === t.row && j < i).length;
      return `<g class="ts-wait"><rect class="c-${t.color}" x="${x - 40 - sameRow * 6}" y="${y - 9 - sameRow * 4}" width="24" height="18" rx="5"/>
        <text x="${x - 28 - sameRow * 6}" y="${y + 4 - sameRow * 4}">${t.depart + 1}</text></g>`;
    });
    this.svg.innerHTML = `${tracks.join('')}${stations.join('')}${nodes.join('')}<g class="ts-waiting">${waiting.join('')}</g>${trains}`;
    this.info.textContent = state.runs ? `${state.runs} failed run${state.runs === 1 ? '' : 's'}` : 'Numbers show departure order';
    this.goBtn.disabled = state.won;
  }

  /** Train tokens at a fractional time. */
  private trainsAt(run: Run, time: number): string {
    return run.paths
      .map((path, i) => {
        const t = this.level.trains[i]!;
        const k = time - t.depart;
        if (k < 0 || !path.length) return '';
        const a = Math.min(path.length - 1, Math.floor(k));
        const b = Math.min(path.length - 1, a + 1);
        const f = Math.min(1, k - a);
        const [x1, y1] = this.xy(path[a]!), [x2, y2] = this.xy(path[b]!);
        const x = x1 + (x2 - x1) * f, y = y1 + (y2 - y1) * f;
        return `<rect class="ts-train c-${t.color}" x="${x - 13}" y="${y - 9}" width="26" height="18" rx="6"/>`;
      })
      .join('');
  }

  async animate(_prev: State, next: State, _m: Move, events: Event[]): Promise<void> {
    const ev = events[0]!;
    if (!('run' in ev)) {
      this.render(next);
      return;
    }
    const run = ev.run;
    const end = run.fail ? run.fail.time : Math.max(...this.level.trains.map((t, i) => t.depart + run.paths[i]!.length - 1));
    if (!this.ctx.reducedMotion()) {
      const t0 = performance.now();
      await new Promise<void>((done) => {
        const frame = (now: number) => {
          const time = Math.min(end, (now - t0) / TICK_MS);
          this.render(this.state, this.trainsAt(run, time));
          if (time < end) requestAnimationFrame(frame);
          else done();
        };
        requestAnimationFrame(frame);
      });
    }
    let boom = '';
    if (run.fail) {
      const [x, y] = this.xy(run.fail.node);
      boom = `<circle class="ts-boom" cx="${x}" cy="${y}" r="22"/>`;
      const who = run.fail.trains.map((i) => COLOR_NAME[this.level.trains[i]!.color]).join(' and ');
      this.ctx.toast(run.fail.kind === 'crash' ? `Crash! The ${who} trains met.` : `The ${who} train reached the wrong station.`, 2800);
    }
    this.render(next, this.trainsAt(run, end) + boom);
    await sleep(this.ctx.reducedMotion() ? 0 : run.fail ? 700 : 300);
  }
}
