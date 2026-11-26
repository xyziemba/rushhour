/** Pointer helpers that behave the same for mouse, touch and pen. */

export interface DragHandlers {
  /** Return false to ignore this press. */
  start(e: PointerEvent): boolean | void;
  move?(e: PointerEvent): void;
  end?(e: PointerEvent, cancelled: boolean): void;
}

/** Track one pointer from press to release on `el` (with pointer capture). Returns cleanup. */
export function onDrag(el: HTMLElement | SVGElement, h: DragHandlers): () => void {
  let active: number | null = null;
  const down = (e: PointerEvent) => {
    if (active !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (h.start(e) === false) return;
    active = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* element may be detached */
    }
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId === active) h.move?.(e);
  };
  const finish = (cancelled: boolean) => (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    h.end?.(e, cancelled);
  };
  const up = finish(false);
  const cancel = finish(true);
  el.addEventListener('pointerdown', down as EventListener);
  el.addEventListener('pointermove', move as EventListener);
  el.addEventListener('pointerup', up as EventListener);
  el.addEventListener('pointercancel', cancel as EventListener);
  return () => {
    el.removeEventListener('pointerdown', down as EventListener);
    el.removeEventListener('pointermove', move as EventListener);
    el.removeEventListener('pointerup', up as EventListener);
    el.removeEventListener('pointercancel', cancel as EventListener);
  };
}

/** Element-relative cell under a pointer for a grid whose cells are `cell` px. */
export function cellAt(e: { clientX: number; clientY: number }, gridEl: Element, cell: number, pad = 0): [number, number] {
  const r = gridEl.getBoundingClientRect();
  return [Math.floor((e.clientX - r.left - pad) / cell), Math.floor((e.clientY - r.top - pad) / cell)];
}
