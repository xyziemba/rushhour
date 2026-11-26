/** Tiny DOM helpers shared by the shell and the games. */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Restart a CSS animation class on an element. */
export function pulseClass(e: Element, cls: string, ms: number): void {
  e.classList.remove(cls);
  void (e as HTMLElement).offsetWidth;
  e.classList.add(cls);
  setTimeout(() => e.classList.remove(cls), ms);
}

/**
 * Keep `--cell` on `board` sized so a cols×rows grid fits inside `wrap`.
 * `pad` is the board's own padding + border (both sides), in px.
 * Returns a cleanup function.
 */
export function fitCells(
  wrap: HTMLElement,
  board: HTMLElement,
  cols: number,
  rows: number,
  { min = 24, max = 76, pad = 16 } = {},
): () => void {
  const fit = () => {
    // Usable space = the wrapper's content box (minus its padding).
    const cs = getComputedStyle(wrap);
    const w = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (w <= 0 || h <= 0) return;
    const cell = Math.max(min, Math.min(max, Math.floor(Math.min((w - pad) / cols, (h - pad) / rows))));
    board.style.setProperty('--cell', `${cell}px`);
  };
  const obs = new ResizeObserver(fit);
  obs.observe(wrap);
  fit();
  return () => obs.disconnect();
}
