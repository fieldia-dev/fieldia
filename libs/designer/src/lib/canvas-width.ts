import { wideColumns, type SectionNode } from '@fieldia/core';
import type { Designer, DesignerState } from './designer';
import { SPANNED } from './layout-ops';
import { isWrapper, locate, nameOf, rowsOf, spanOf, type Part } from './layout-tree';
import { inTwelfths, keepsFull, laidInTwelfths, percent, toTwelfths, TWELVE, twelfthsAhead } from './layout-twelfths';
import { setHidden } from './writes';

/**
 * Widths on the Advanced canvas, dragged where they are seen. A picked part's
 * end edge (its start edge right to left) carries a handle: dragged, it snaps
 * to the columns of the grid the part sits in, a chip saying "2 of 4 columns",
 * and lets go as one edit. Where another part follows in the same row, the
 * edge between them is a gutter instead: dragged, or moved with the arrow
 * keys, it trades columns between the two, together keeping what they had.
 *
 * In a group (see layout-twelfths.ts) widths are twelfths of the row, said as
 * percentages — "58% · 42%" — and a group of one to four columns is shown in
 * twelfths as the drag starts, and divided so in the edit it lets go as. A
 * group that keeps its rows full has no room at a row's end, so no handle:
 * the last part of a row has the gutter before it. One that allows gaps has
 * the handle, widening a part into the room its row has left.
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

/** A part's width in twelfths of its group's row, as it is or as dividing the group in twelfths makes it. */
function twelfthsOf(group: SectionNode, part: Part): number {
  const cols = wideColumns(group.columns);
  return (Math.min(spanOf(part), cols) * TWELVE) / cols;
}

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

  /**
   * What the marks are on now: the part (the first of two, at a gutter), its grid, the part after it in the row if any —
   * and, in a group, the group, whose widths the marks count in twelfths.
   */
  let on: { id: string; element: HTMLElement; grid: HTMLElement; cols: number; gap: number; next: HTMLElement | null; group: SectionNode | null; percents: boolean } | null = null;
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
  const nodeAt = (id: string) => locate(designer.getPage(), id)?.node;
  const spanned = (id: string) => SPANNED.has(nodeAt(id)?.type ?? '');
  /** The part's own width, as the model has it, no more than the grid has now — in a group, in twelfths. */
  const widthNow = (id: string) => {
    const node = nodeAt(id);
    if (!node || !on) return 1;
    return on.group ? twelfthsOf(on.group, node) : Math.min(spanOf(node), on.cols);
  };
  /** The part in the same row beside an element, after it or before it. */
  const besideIn = (element: HTMLElement, after: boolean) => {
    const step = (e: Element | null) => (after ? e?.nextElementSibling : e?.previousElementSibling) as HTMLElement | null;
    let other = step(element);
    while (other && !other.dataset['node']) other = step(other);
    return other && Math.abs(boxOf(other).top - boxOf(element).top) <= 4 && spanned(other.dataset['node'] as string) ? other : null;
  };
  /** Widths in words: percentages of the row in twelfths, else columns. */
  const words = (a: number, b?: number) => {
    const units = on?.group ? TWELVE : (on?.cols ?? 1);
    if (on?.percents) return b === undefined ? `${percent(a, units)}% of the row` : `${percent(a, units)}% · ${percent(b, units)}%`;
    return b === undefined ? `${a} of ${columnsWords(units)}` : `${a} and ${b} of ${columnsWords(units)}`;
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
    const page = designer.getPage();
    const parent = locate(page, id)?.parent;
    const group = twelfthsAhead(parent) ? parent : null;
    let first = element;
    let next = besideIn(element, true);
    // A row kept full has no room at its end: its last part has the gutter before it.
    if (!next && group && keepsFull(group)) {
      next = element;
      first = besideIn(element, false) as HTMLElement;
      if (!first) return null;
    }
    on = { id: first.dataset['node'] as string, element: first, grid, cols, gap, next, group, percents: !!group || laidInTwelfths(page, parent) };
    const r = boxOf(first);
    const rtl = options.rtl();
    if (!next) {
      place(handle, { left: (rtl ? r.left : r.right) - 4, top: r.top + r.height / 2 - 15 });
      return 'handle';
    }
    const n = boxOf(next);
    const edge = rtl ? (r.left + n.right) / 2 : (r.right + n.left) / 2;
    const top = Math.min(r.top, n.top);
    // Centred on the edge, half its 24px each side.
    place(gutter, { left: edge - 12, top, height: Math.max(r.bottom, n.bottom) - top });
    const nextId = next.dataset['node'] as string;
    const [a, b] = [widthNow(on.id), widthNow(nextId)];
    gutter.setAttribute('aria-label', `Width between “${nameOf(page, nodeAt(on.id) ?? null)}” and “${nameOf(page, nodeAt(nextId) ?? null)}”`);
    gutter.setAttribute('aria-valuenow', String(a));
    gutter.setAttribute('aria-valuemax', String(a + b - 1));
    if (on.percents) gutter.setAttribute('aria-valuetext', words(a, b));
    else gutter.removeAttribute('aria-valuetext');
    return 'gutter';
  }

  /**
   * A group of one to four columns shown in twelfths while its widths are dragged, as dividing it makes it — every part,
   * and the parts an arrangement lays on its columns, as wide as they are now — and put back as it was after.
   */
  function shownInTwelfths(grid: HTMLElement, group: SectionNode): () => void {
    const undo: (() => void)[] = [];
    const set = (element: HTMLElement, name: string, value: string) => {
      const was = element.style.getPropertyValue(name);
      element.style.setProperty(name, value);
      undo.push(() => (was ? element.style.setProperty(name, was) : element.style.removeProperty(name)));
    };
    const copy = JSON.parse(JSON.stringify(group)) as SectionNode;
    toTwelfths(copy);
    set(grid, '--fd-cols', String(TWELVE));
    // The guides under it, twelve fine tracks for now.
    const guides = grid.querySelector<HTMLElement>(':scope > .fd-guides');
    if (guides) {
      const [was, kind] = [[...guides.children], guides.className];
      guides.className = 'fd-guides fd-guides-fine';
      guides.replaceChildren(...Array.from({ length: TWELVE }, () => doc.createElement('i')));
      undo.push(() => {
        guides.className = kind;
        guides.replaceChildren(...was);
      });
    }
    const walk = (list: Part[]) => {
      for (const part of list) {
        const element = partEl(part.id);
        if (element && SPANNED.has(part.type)) set(element, '--fd-span', String(spanOf(part)));
        if (isWrapper(part)) walk(part.children);
      }
    };
    walk(copy.children);
    return () => undo.reverse().forEach((put) => put());
  }

  /** The room a part's row has left, in twelfths of its group. */
  function roomBeside(group: SectionNode, id: string): number {
    const page = designer.getPage();
    const row = rowsOf(page, group).find((r) => r.items.some((p) => p.id === id));
    return TWELVE - (row?.items ?? []).reduce((n, p) => n + (p.type === 'divider' ? TWELVE : twelfthsOf(group, p)), 0);
  }

  /** Set widths as one edit: in a group, in twelfths, dividing it so if it is not yet. */
  function commit(widths: { id: string; span: number }[]) {
    if (on?.group) designer.setWidths(widths, { twelfths: true });
    else if (widths.length === 1) designer.setColspan(widths[0].id, widths[0].span);
    else designer.setWidths(widths);
  }

  /** A drag of the handle or the gutter: the parts follow the pointer, a chip says the widths, and it is one edit when let go. */
  function drag(event: PointerEvent, kind: 'span' | 'trade') {
    if (!on || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const { id, element, grid, gap, next, group } = on;
    const rtl = options.rtl();
    const r = boxOf(element);
    // In a group, the twelve columns a row divides in, wherever its own columns fall.
    const units = group ? TWELVE : on.cols;
    const colW = (rectOf(grid).width - gap * (units - 1)) / units;
    const start = rtl ? r.right : r.left;
    const nextId = next?.dataset['node'] as string;
    const was = widthNow(id);
    const total = kind === 'trade' ? was + widthNow(nextId) : group ? was + roomBeside(group, id) : units;
    let span = was;
    const chip = doc.createElement('div');
    chip.className = 'fd-width-chip';
    canvas.append(chip);
    const putBack = group && !inTwelfths(group) ? shownInTwelfths(grid, group) : null;
    const before = [element.style.getPropertyValue('--fd-span'), next?.style.getPropertyValue('--fd-span') ?? ''];
    dragging = true;
    const move = (e: PointerEvent) => {
      span = kind === 'span' ? spanAt({ start, x: e.clientX, colW, gap, cols: total, rtl }) : tradeAt({ start, x: e.clientX, colW, gap, total, rtl });
      element.style.setProperty('--fd-span', String(span));
      if (kind === 'trade') next?.style.setProperty('--fd-span', String(total - span));
      chip.textContent = kind === 'span' ? words(span) : words(span, total - span);
      place(chip, { left: e.clientX + 14, top: e.clientY - 30 });
      // The handle or the gutter stays on the edge it moves.
      const now = boxOf(element);
      if (kind === 'span') place(handle, { left: (rtl ? now.left : now.right) - 4, top: now.top + now.height / 2 - 15 });
      else if (next) {
        const n = boxOf(next);
        const top = Math.min(now.top, n.top);
        place(gutter, { left: (rtl ? (now.left + n.right) / 2 : (now.right + n.left) / 2) - 12, top, height: Math.max(now.bottom, n.bottom) - top });
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
      putBack?.();
      if (span === was) return;
      commit(kind === 'span' ? [{ id, span }] : [{ id, span }, { id: nextId, span: total - span }]);
    };
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    move(event);
  }

  const onHandle = (event: PointerEvent) => drag(event, 'span');
  const onGutter = (event: PointerEvent) => drag(event, 'trade');
  /** The gutter by the keyboard: a column — in a group, a twelfth — at a time towards the arrow, mirrored right to left. */
  const onKey = (event: KeyboardEvent) => {
    if (!on?.next || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const forward = (event.key === 'ArrowRight') !== options.rtl();
    const nextId = on.next.dataset['node'] as string;
    const a = widthNow(on.id);
    const total = a + widthNow(nextId);
    const span = Math.max(1, Math.min(total - 1, a + (forward ? 1 : -1)));
    if (span !== a) commit([{ id: on.id, span }, { id: nextId, span: total - span }]);
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
