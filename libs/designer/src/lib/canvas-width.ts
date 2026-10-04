import type { Designer, DesignerState } from './designer';
import { SPANNED } from './layout-ops';
import { locate, nameOf, spanOf } from './layout-tree';
import { setHidden } from './writes';

/**
 * Widths on the Advanced canvas, dragged where they are seen. A picked part's
 * end edge (its start edge right to left) carries a handle: dragged, it snaps
 * to the columns of the grid the part sits in, a chip saying "2 of 4 columns",
 * and lets go as one edit. Where another part follows in the same row, the
 * edge between them is a gutter instead: dragged, or moved with the arrow
 * keys, it trades columns between the two, together keeping what they had.
 */

/** The columns a part starting at `start` covers when its edge is dragged to `x`: the nearest, one at least, the grid's at most. */
export function spanAt(at: { start: number; x: number; colW: number; gap: number; cols: number; rtl: boolean }): number {
  const width = at.rtl ? at.start - at.x : at.x - at.start;
  return Math.max(1, Math.min(at.cols, Math.round((width + at.gap) / (at.colW + at.gap))));
}

/** The columns the first of two parts keeps when the gutter between them is dragged to `x`: one each at least. */
export function tradeAt(at: { start: number; x: number; colW: number; gap: number; total: number; rtl: boolean }): number {
  const along = at.rtl ? at.start - at.x : at.x - at.start;
  return Math.max(1, Math.min(at.total - 1, Math.round((along + at.gap / 2) / (at.colW + at.gap))));
}

export interface WidthMarksOptions {
  canvas: HTMLElement;
  /** What holds the page's own parts. */
  root: HTMLElement;
  designer: Designer;
  rtl(): boolean;
  rectOf?(element: Element): DOMRect;
  /** How many columns a grid has at the width it has now, and the gap between them; read off the grid by default. */
  columnsOf?(grid: HTMLElement): { cols: number; gap: number };
}

export interface WidthMarks {
  /** Put the handle or the gutter on the part picked; none in Simple. */
  update(state: DesignerState, advanced: boolean): void;
  destroy(): void;
}

const columnsWords = (n: number) => `${n} column${n === 1 ? '' : 's'}`;

export function widthMarks(options: WidthMarksOptions): WidthMarks {
  const { canvas, root, designer } = options;
  const doc = canvas.ownerDocument;
  const rectOf = options.rectOf ?? ((element: Element) => element.getBoundingClientRect());
  const columnsOf =
    options.columnsOf ??
    ((grid: HTMLElement) => {
      const style = doc.defaultView?.getComputedStyle(grid);
      // The columns the canvas gives the grid, which lays it out with as many; else as the browser laid it out.
      const given = Number(grid.style.getPropertyValue('--fd-cols'));
      const cols = Number.isInteger(given) && given >= 1 ? given : (style?.gridTemplateColumns ?? '').split(' ').filter(Boolean).length || 1;
      return { cols, gap: parseFloat(style?.columnGap ?? '') || 0 };
    });

  const handle = doc.createElement('div');
  handle.className = 'fd-width-handle';
  handle.hidden = true;
  handle.title = 'Drag to widen or narrow';
  const gutter = doc.createElement('div');
  gutter.className = 'fd-gutter';
  gutter.hidden = true;
  gutter.tabIndex = 0;
  gutter.setAttribute('role', 'separator');
  gutter.setAttribute('aria-orientation', 'vertical');
  gutter.setAttribute('aria-valuemin', '1');
  canvas.append(handle, gutter);

  /** What the marks are on now: the part, the grid, and the part after it in its row, if any. */
  let on: { id: string; element: HTMLElement; grid: HTMLElement; cols: number; gap: number; next: HTMLElement | null } | null = null;
  let last: { state: DesignerState; advanced: boolean } | null = null;
  /** A drag going on places its own mark: the parts it moves in passing must not swap the handle for a gutter. */
  let dragging = false;

  const place = (element: HTMLElement, box: { left: number; top: number; width?: number; height?: number }) => {
    const c = rectOf(canvas);
    element.style.left = `${box.left - c.left}px`;
    element.style.top = `${box.top - c.top}px`;
    if (box.width !== undefined) element.style.width = `${box.width}px`;
    if (box.height !== undefined) element.style.height = `${box.height}px`;
  };
  /** A part's own box: a field on the canvas reaches into the gap round it for its ring, which is not its width. */
  const boxOf = (element: HTMLElement) => {
    const r = rectOf(element);
    if (!element.classList.contains('fd-canvas-field')) return r;
    const style = doc.defaultView?.getComputedStyle(element);
    const [x, y] = [parseFloat(style?.paddingLeft ?? '') || 0, parseFloat(style?.paddingTop ?? '') || 0];
    return { left: r.left + x, right: r.right - x, top: r.top + y, bottom: r.bottom - y, width: r.width - 2 * x, height: r.height - 2 * y };
  };
  const partEl = (id: string) => root.querySelector<HTMLElement>(`[data-node="${id.replace(/["\\]/g, '\\$&')}"]:not([role="tab"])`);
  const spanned = (id: string) => {
    const node = locate(designer.getPage(), id)?.node;
    return !!node && SPANNED.has(node.type);
  };
  /** The part's own width, as the model has it, no more than the grid has now. */
  const spanNow = (id: string, cols: number) => {
    const node = locate(designer.getPage(), id)?.node;
    return node ? Math.min(spanOf(node), cols) : 1;
  };

  function update(state: DesignerState, advanced: boolean) {
    last = { state, advanced };
    // Worked out first, shown once: hiding the gutter while it has the keys would lose them.
    const shown = placeMarks(state, advanced);
    setHidden(handle, shown !== 'handle');
    setHidden(gutter, shown !== 'gutter');
  }

  /** Put the handle or the gutter where it goes, and say which one shows. */
  function placeMarks(state: DesignerState, advanced: boolean): 'handle' | 'gutter' | null {
    on = null;
    const id = state.selected;
    if (!advanced || !id || state.picked.length > 1 || !spanned(id)) return null;
    const element = partEl(id);
    const grid = element?.parentElement?.closest<HTMLElement>('[data-container]');
    if (!element || !grid) return null;
    const { cols, gap } = columnsOf(grid);
    if (cols < 2) return null;
    const r = boxOf(element);
    // The part after it in its row: the next part on the same line.
    let next = element.nextElementSibling as HTMLElement | null;
    while (next && !next.dataset['node']) next = next.nextElementSibling as HTMLElement | null;
    if (next && (Math.abs(boxOf(next).top - r.top) > 4 || !spanned(next.dataset['node'] as string))) next = null;
    on = { id, element, grid, cols, gap, next };
    const rtl = options.rtl();
    if (!next) {
      place(handle, { left: (rtl ? r.left : r.right) - 4, top: r.top + r.height / 2 - 15 });
      return 'handle';
    }
    const n = boxOf(next);
    const edge = rtl ? (r.left + n.right) / 2 : (r.right + n.left) / 2;
    const top = Math.min(r.top, n.top);
    place(gutter, { left: edge - 6, top, height: Math.max(r.bottom, n.bottom) - top });
    const page = designer.getPage();
    const [a, b] = [spanNow(id, cols), spanNow(next.dataset['node'] as string, cols)];
    gutter.setAttribute('aria-label', `Width between “${nameOf(page, locate(page, id)?.node ?? null)}” and “${nameOf(page, locate(page, next.dataset['node'] as string)?.node ?? null)}”`);
    gutter.setAttribute('aria-valuenow', String(a));
    gutter.setAttribute('aria-valuemax', String(a + b - 1));
    return 'gutter';
  }

  /** A drag of the handle or the gutter: the parts follow the pointer, a chip says the columns, and it is one edit when let go. */
  function drag(event: PointerEvent, kind: 'span' | 'trade') {
    if (!on || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const { id, element, grid, cols, gap, next } = on;
    const rtl = options.rtl();
    const r = boxOf(element);
    const colW = (rectOf(grid).width - gap * (cols - 1)) / cols;
    const start = rtl ? r.right : r.left;
    const nextId = next?.dataset['node'] as string;
    const was = spanNow(id, cols);
    const total = kind === 'trade' ? was + spanNow(nextId, cols) : cols;
    let span = was;
    const chip = doc.createElement('div');
    chip.className = 'fd-width-chip';
    canvas.append(chip);
    const before = [element.style.getPropertyValue('--fd-span'), next?.style.getPropertyValue('--fd-span') ?? ''];
    dragging = true;
    const move = (e: PointerEvent) => {
      span = kind === 'span' ? spanAt({ start, x: e.clientX, colW, gap, cols, rtl }) : tradeAt({ start, x: e.clientX, colW, gap, total, rtl });
      element.style.setProperty('--fd-span', String(span));
      if (kind === 'trade') next?.style.setProperty('--fd-span', String(total - span));
      chip.textContent = kind === 'span' ? `${span} of ${columnsWords(cols)}` : `${span} and ${total - span} of ${columnsWords(cols)}`;
      place(chip, { left: e.clientX + 14, top: e.clientY - 30 });
      // The handle or the gutter stays on the edge it moves.
      const now = boxOf(element);
      if (kind === 'span') place(handle, { left: (rtl ? now.left : now.right) - 4, top: now.top + now.height / 2 - 15 });
      else if (next) {
        const n = boxOf(next);
        const top = Math.min(now.top, n.top);
        place(gutter, { left: (rtl ? (now.left + n.right) / 2 : (now.right + n.left) / 2) - 6, top, height: Math.max(now.bottom, n.bottom) - top });
      }
    };
    const up = () => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      dragging = false;
      chip.remove();
      // Back as it was until the page says otherwise: an edit that is refused, or none, leaves it so.
      element.style.setProperty('--fd-span', before[0]);
      next?.style.setProperty('--fd-span', before[1]);
      if (!before[0]) element.style.removeProperty('--fd-span');
      if (next && !before[1]) next.style.removeProperty('--fd-span');
      if (span === was) return;
      if (kind === 'span') designer.setColspan(id, span);
      else designer.setWidths([{ id, span }, { id: nextId, span: total - span }]);
    };
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    move(event);
  }

  const onHandle = (event: PointerEvent) => drag(event, 'span');
  const onGutter = (event: PointerEvent) => drag(event, 'trade');
  /** The gutter by the keyboard: a column at a time towards the arrow, mirrored right to left. */
  const onKey = (event: KeyboardEvent) => {
    if (!on?.next || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const forward = (event.key === 'ArrowRight') !== options.rtl();
    const nextId = on.next.dataset['node'] as string;
    const a = spanNow(on.id, on.cols);
    const total = a + spanNow(nextId, on.cols);
    const span = Math.max(1, Math.min(total - 1, a + (forward ? 1 : -1)));
    if (span !== a) designer.setWidths([{ id: on.id, span }, { id: nextId, span: total - span }]);
  };
  handle.addEventListener('pointerdown', onHandle);
  gutter.addEventListener('pointerdown', onGutter);
  gutter.addEventListener('keydown', onKey);
  // The canvas resized: the marks follow the parts.
  const view = doc.defaultView as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
  const watcher = view?.ResizeObserver ? new view.ResizeObserver(() => !dragging && last && update(last.state, last.advanced)) : null;
  watcher?.observe(root);

  return {
    update,
    destroy() {
      watcher?.disconnect();
      handle.remove();
      gutter.remove();
    },
  };
}
