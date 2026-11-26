import { el, fitCells, sleep } from '../../shell/dom';
import type { GameView, ViewContext } from '../../shell/types';
import { ICONS, iconSvg } from './icons';
import { TRAY_SIZE, addToTray, isFree, type Event, type Level, type State } from './rules';

export class TileTrayView implements GameView<State, string, Event> {
  private wrap: HTMLElement;
  private board: HTMLElement;
  private trayEl: HTMLElement;
  private stopFit: () => void;

  constructor(host: HTMLElement, private ctx: ViewContext<string>, level: Level, state: State) {
    this.wrap = el('div', 'tt-wrap');
    this.board = el('div', 'tt-board');
    this.board.style.setProperty('--cols', String(level.width));
    this.board.style.setProperty('--rows', String(level.height));
    this.wrap.append(this.board);
    this.trayEl = el('div', 'tt-tray');
    this.trayEl.setAttribute('aria-label', 'Tray');
    host.replaceChildren(this.wrap, this.trayEl);
    this.stopFit = fitCells(this.wrap, this.board, level.width, level.height, { min: 14, max: 36, pad: 8 });
    this.render(state);
  }

  destroy(): void {
    this.stopFit();
  }

  render(state: State): void {
    this.renderBoard(state);
    this.renderTray(state.tray);
  }

  private renderBoard(state: State): void {
    const tiles = [...state.tiles].sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
    this.board.replaceChildren(
      ...tiles.map((t) => {
        const free = isFree(state.tiles, t);
        const b = el('button', `tt-tile${free ? '' : ' covered'}`, iconSvg(t.icon));
        b.style.setProperty('--x', String(t.x));
        b.style.setProperty('--y', String(t.y));
        b.style.zIndex = String(t.z * 100 + t.y);
        b.dataset.id = t.id;
        b.setAttribute('aria-label', `${ICONS[t.icon]!.name}${free ? '' : ' (covered)'}`);
        if (!free) b.tabIndex = -1;
        b.addEventListener('click', () => {
          if (free && !this.ctx.isBusy()) this.ctx.play(t.id);
        });
        return b;
      }),
    );
  }

  private renderTray(tray: number[], flash: number | null = null, fresh = -1): void {
    const slots: HTMLElement[] = [];
    for (let i = 0; i < TRAY_SIZE; i++) {
      const icon = tray[i];
      const slot = el('div', `tt-slot${i >= TRAY_SIZE - 1 && tray.length >= TRAY_SIZE - 1 ? ' warn' : ''}`);
      if (icon !== undefined) {
        const t = el('div', `tt-tile in-tray${icon === flash ? ' clearing' : ''}${i === fresh ? ' fresh' : ''}`, iconSvg(icon));
        t.setAttribute('aria-label', ICONS[icon]!.name);
        slot.append(t);
      }
      slots.push(slot);
    }
    this.trayEl.replaceChildren(...slots);
  }

  async animate(prev: State, next: State, id: string, events: Event[]): Promise<void> {
    const fast = this.ctx.reducedMotion();
    const ev = events[0]!;
    const tileEl = this.board.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (tileEl && !fast) {
      tileEl.classList.add('taken');
      await sleep(140);
    }
    this.renderBoard(next);
    const { before } = addToTray(prev.tray, ev.icon);
    const fresh = before.lastIndexOf(ev.icon);
    if (ev.cleared) {
      this.renderTray(before, ev.icon, fresh);
      await sleep(fast ? 0 : 380);
    }
    this.renderTray(next.tray, null, ev.cleared ? -1 : fresh);
  }
}
