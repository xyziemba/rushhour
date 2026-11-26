import { el } from '../../shell/dom';
import { COLOR_NAME, SYMBOL } from '../../shell/palette';
import type { GameView, ViewContext } from '../../shell/types';
import { edgeLen, type Level, type State } from './rules';

const U = 60; // px per layout unit
const SVGNS = 'http://www.w3.org/2000/svg';

export class ConveyorView implements GameView<State, number, unknown> {
  private svg: SVGSVGElement;
  private parcelLayer: SVGGElement;
  private parcelEls = new Map<number, SVGGElement>();
  private gateEls = new Map<number, SVGLineElement>();
  private binEls = new Map<number, SVGGElement>();
  private shownGates: number[] = [];
  private shownDelivered: number[] = [];
  private shownMisses = 0;

  constructor(host: HTMLElement, private ctx: ViewContext<number>, private level: Level, state: State) {
    const xs = level.nodes.map((n) => n.x), ys = level.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 0.7, maxX = Math.max(...xs) + 0.7;
    const minY = Math.min(...ys) - 0.4, maxY = Math.max(...ys) + 0.7;
    const wrap = el('div', 'cv-wrap');
    this.svg = document.createElementNS(SVGNS, 'svg');
    this.svg.setAttribute('class', 'cv-map');
    this.svg.setAttribute('viewBox', `${minX * U} ${minY * U} ${(maxX - minX) * U} ${(maxY - minY) * U}`);
    wrap.append(this.svg);
    host.replaceChildren(wrap, el('div', 'cv-legend', 'Tap a switch to flip it. Send every parcel to its color.'));

    const parts: string[] = [];
    level.nodes.forEach((n, i) => {
      for (const c of n.next) {
        const m = level.nodes[c]!;
        parts.push(`<line class="cv-belt" x1="${n.x * U}" y1="${n.y * U}" x2="${m.x * U}" y2="${m.y * U}"/>`);
        parts.push(`<line class="cv-belt-run" x1="${n.x * U}" y1="${n.y * U}" x2="${m.x * U}" y2="${m.y * U}"/>`);
      }
      if (n.kind === 'spawn') parts.push(`<rect class="cv-chute" x="${n.x * U - 22}" y="${n.y * U - 16}" width="44" height="22" rx="6"/>`);
      void i;
    });
    this.svg.innerHTML = parts.join('');
    level.nodes.forEach((n, i) => {
      if (n.kind === 'bin') {
        const g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', `cv-bin c-${n.color}`);
        g.innerHTML = `<rect x="${n.x * U - 24}" y="${n.y * U - 6}" width="48" height="34" rx="7"/>
          <text class="sym" x="${n.x * U}" y="${n.y * U + 16}">${SYMBOL[n.color!]}</text><title>${COLOR_NAME[n.color!]} bin</title>`;
        this.svg.append(g);
        this.binEls.set(i, g);
      }
      if (n.kind === 'junction') {
        const g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', 'cv-gate');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', 'Switch');
        g.innerHTML = `<circle class="hit" cx="${n.x * U}" cy="${n.y * U}" r="30"/><circle class="knob" cx="${n.x * U}" cy="${n.y * U}" r="14"/>`;
        const arrow = document.createElementNS(SVGNS, 'line');
        arrow.setAttribute('class', 'cv-arrow');
        g.append(arrow);
        const fire = () => this.ctx.play(i);
        g.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          fire();
        });
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fire();
          }
        });
        this.svg.append(g);
        this.gateEls.set(i, arrow);
      }
    });
    this.parcelLayer = document.createElementNS(SVGNS, 'g');
    this.svg.append(this.parcelLayer);
    this.render(state);
  }

  destroy(): void {}

  render(state: State): void {
    this.parcelEls.forEach((e) => e.remove());
    this.parcelEls.clear();
    this.shownGates = [];
    this.shownDelivered = [...state.delivered];
    this.shownMisses = state.misses;
    this.frame(state);
  }

  frame(state: State): void {
    const nodes = this.level.nodes;
    // Gates
    this.gateEls.forEach((arrow, i) => {
      if (this.shownGates[i] === state.gates[i]) return;
      this.shownGates[i] = state.gates[i]!;
      const n = nodes[i]!, to = nodes[n.next[state.gates[i]!]!]!;
      const len = Math.hypot(to.x - n.x, to.y - n.y);
      arrow.setAttribute('x1', String(n.x * U));
      arrow.setAttribute('y1', String(n.y * U));
      arrow.setAttribute('x2', String((n.x + ((to.x - n.x) / len) * 0.42) * U));
      arrow.setAttribute('y2', String((n.y + ((to.y - n.y) / len) * 0.42) * U));
      arrow.parentElement!.setAttribute('aria-label', `Switch, sending parcels ${state.gates[i] ? 'right' : 'left'}`);
    });
    // Parcels
    const alive = new Set<number>();
    for (const p of state.parcels) {
      alive.add(p.id);
      let g = this.parcelEls.get(p.id);
      if (!g) {
        g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', `cv-parcel c-${p.color}`);
        g.innerHTML = `<rect x="-11" y="-11" width="22" height="22" rx="5"/><text class="sym" y="4">${SYMBOL[p.color]}</text>`;
        this.parcelLayer.append(g);
        this.parcelEls.set(p.id, g);
      }
      const a = nodes[p.from]!, b = nodes[p.to]!;
      const f = Math.min(1, p.d / edgeLen(nodes, p.from, p.to));
      g.setAttribute('transform', `translate(${(a.x + (b.x - a.x) * f) * U} ${(a.y + (b.y - a.y) * f) * U})`);
    }
    for (const [id, g] of this.parcelEls) {
      if (!alive.has(id)) {
        g.remove();
        this.parcelEls.delete(id);
      }
    }
    // Deliveries
    state.delivered.forEach((n, i) => {
      if (n > (this.shownDelivered[i] ?? 0)) {
        const bin = this.binEls.get(i);
        const bad = state.misses > this.shownMisses && state.lastMiss === i;
        bin?.classList.remove('ok', 'bad');
        void bin?.getBoundingClientRect();
        bin?.classList.add(bad ? 'bad' : 'ok');
        if (bad && state.misses < 3) this.ctx.toast(`Wrong bin! ${3 - state.misses} ${3 - state.misses === 1 ? 'mistake' : 'mistakes'} left.`, 1400);
      }
    });
    this.shownDelivered = [...state.delivered];
    this.shownMisses = state.misses;
  }

  async animate(_p: State, next: State): Promise<void> {
    this.frame(next);
  }
}
