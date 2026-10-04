import type { Page } from '@fieldia/core';
import { edgeLine, intoLine, type Rect, type Side } from './canvas-drop';
import type { Designer } from './designer';
import type { Drop } from './layout-ops';
import { across, listOf, locate, nodeOf, type Holder } from './layout-tree';
import type { DropSpot } from './outline-drop';

/**
 * One drop line, drawn in the outline and on the canvas at once, as
 * Designable draws it. While a row is dragged in the outline, the canvas
 * shows where the part will land — the line and the chip a canvas drag
 * draws, at the same place; while a part is dragged on the canvas, the
 * outline shows the line at the matching row, or washes the row it goes
 * into. Each drag says where it would drop with an event; this only draws
 * it on the other side. Where a part is let go stays each drag's own to
 * decide.
 */

/** The event a drag says where it would drop with, bubbling from the outline's tree or the canvas. */
export const ECHO_EVENT = 'fd-drop-echo';

/** Where a drag would drop, or null when it would drop nowhere, or has ended. */
export type EchoDetail =
  | { source: 'outline'; spot: DropSpot | null; name?: string; words?: string }
  | { source: 'canvas'; drop: Drop | null; moving?: string };

/** Say where a drag would drop, for the other side to draw. */
export function echo(from: Element, detail: EchoDetail): void {
  from.dispatchEvent(new CustomEvent(ECHO_EVENT, { bubbles: true, detail }));
}

// ---- outline to canvas --------------------------------------------------------------------------

/** Where an outline drop lands on the canvas: by the side of a part, or into a group, after its last part. */
export type CanvasPlace = { kind: 'edge'; target: string; after: boolean } | { kind: 'into'; container: string; last: string | null };

/** The part now at the drop's place in its list, or after the last one; into the group when it goes into one, or into an empty one. */
export function canvasPlace(page: Page, spot: Pick<DropSpot, 'parent' | 'index' | 'into'>): CanvasPlace | null {
  const list = listOf(nodeOf(page, spot.parent) ?? undefined);
  if (!list) return null;
  const last = list[list.length - 1]?.id ?? null;
  if (spot.into || !list.length) return { kind: 'into', container: spot.parent, last };
  const at = list[spot.index];
  return at ? { kind: 'edge', target: at.id, after: false } : { kind: 'edge', target: last as string, after: true };
}

// ---- canvas to outline --------------------------------------------------------------------------

/** A row of the outline on show, as the echo reads it. */
export interface ShownRow {
  id: string;
  level: number;
}

/** Where a canvas drop lands in the outline: a line in the gap before the row on show at `gap`, `level` in; or a row washed. */
export type OutlineMark = { gap: number; level: number } | { into: string };

/** The gap after a row and every row under it. */
function after(rows: readonly ShownRow[], at: number): number {
  let gap = at + 1;
  while (gap < rows.length && rows[gap].level > rows[at].level) gap++;
  return gap;
}

/** The row on show for a part: its own, or the nearest one round it, washed, when it is folded away. */
function rowFor(rows: readonly ShownRow[], page: Page, id: string): { at: number } | { into: string } | null {
  const at = rows.findIndex((row) => row.id === id);
  if (at !== -1) return { at };
  for (let up = locate(page, id)?.parent; up && up.id !== page.layout.id; up = locate(page, up.id)?.parent) {
    if (rows.some((row) => row.id === up?.id)) return { into: up.id };
  }
  return null;
}

/** A line before the row of the part now at `index` of a group's parts (the one carried left out), or after the group's last row. */
function inList(rows: readonly ShownRow[], page: Page, container: string, index: number, moving?: string): OutlineMark | null {
  const list = (listOf(nodeOf(page, container) ?? undefined) ?? []).filter((part) => part.id !== moving);
  const at = list[index];
  if (at) {
    const found = rowFor(rows, page, at.id);
    return !found ? null : 'into' in found ? found : { gap: found.at, level: rows[found.at].level };
  }
  if (container === page.layout.id) return { gap: rows.length, level: 0 };
  const holder = rowFor(rows, page, container);
  if (!holder) return null;
  return 'into' in holder ? holder : { gap: after(rows, holder.at), level: rows[holder.at].level + 1 };
}

/** Where a canvas drop lands among the outline's rows on show. */
export function outlineMark(rows: readonly ShownRow[], page: Page, drop: Drop, moving?: string): OutlineMark | null {
  if (drop.how === 'row' || drop.how === 'at') return inList(rows, page, drop.container, drop.index, moving);
  if (drop.how === 'into' && drop.container === page.layout.id) return { gap: rows.length, level: 0 };
  const found = rowFor(rows, page, drop.how === 'into' ? drop.container : drop.target);
  if (drop.how === 'into') return !found ? null : 'into' in found ? found : { into: drop.container };
  if (!found || 'into' in found) return found;
  return { gap: drop.after ? after(rows, found.at) : found.at, level: rows[found.at].level };
}

// ---- drawing ---------------------------------------------------------------------------------------

export interface DropEchoOptions {
  /** The editor: drags say where they would drop inside it. */
  editor: HTMLElement;
  /** The canvas, which the marks are drawn in, and what holds the page's own parts on it. */
  canvas: HTMLElement;
  parts: HTMLElement;
  /** The outline's tree. */
  tree: HTMLElement;
  designer: Designer;
  rtl(): boolean;
  rectOf?(element: Element): DOMRect;
}

export interface DropEcho {
  destroy(): void;
}

export function dropEcho(options: DropEchoOptions): DropEcho {
  const { editor, canvas, parts, tree, designer } = options;
  const doc = canvas.ownerDocument;
  const rectOf = options.rectOf ?? ((element: Element) => element.getBoundingClientRect());
  let marks: { bar: HTMLElement; zone: HTMLElement; chip: HTMLElement; name: HTMLElement; where: HTMLElement } | null = null;
  let line: HTMLElement | null = null;

  const partOf = (id: string): HTMLElement | null => (parts.dataset['container'] === id ? parts : ([...parts.querySelectorAll<HTMLElement>('[data-node]')].find((e) => e.dataset['node'] === id && e.getAttribute('role') !== 'tab') ?? null));
  const seen = (r: DOMRect) => r.width > 0 || r.height > 0;

  /** Where a box in the window is, in the canvas: the marks are drawn in it. */
  function inCanvas(box: Rect, element: HTMLElement) {
    const c = rectOf(canvas);
    Object.assign(element.style, { left: `${box.left - c.left}px`, top: `${box.top - c.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  }

  function clearCanvas() {
    for (const mark of Object.values(marks ?? {})) mark.remove();
    marks = null;
  }

  /** The line by the side of a part a drop goes before or after: down its side in a group of columns, else across its top or bottom. */
  function sideLine(id: string, afterIt: boolean): Rect | null {
    const element = partOf(id);
    const at = locate(designer.getPage(), id);
    if (!element || !at) return null;
    const r = rectOf(element);
    if (!seen(r)) return null;
    const sideways = across(designer.getPage(), at.parent as Holder) > 1;
    const side: Side = sideways ? (afterIt !== options.rtl() ? 'right' : 'left') : afterIt ? 'bottom' : 'top';
    return edgeLine(r, side);
  }

  function showOnCanvas(detail: Extract<EchoDetail, { source: 'outline' }>) {
    const place = detail.spot ? canvasPlace(designer.getPage(), detail.spot) : null;
    let bar: Rect | null = null;
    let zone: Rect | null = null;
    if (place?.kind === 'edge') bar = sideLine(place.target, place.after);
    else if (place) {
      const group = partOf(place.container);
      const content = place.container === parts.dataset['container'] ? parts : (group?.querySelector<HTMLElement>(`[data-container="${place.container}"]`) ?? null);
      const box = group ? rectOf(group) : null;
      zone = box && seen(box) && group !== parts ? box : null;
      bar = place.last ? sideLine(place.last, true) : content && seen(rectOf(content)) ? intoLine(rectOf(content)) : null;
    }
    if (!bar) return clearCanvas();
    if (!marks) {
      const make = (className: string) => {
        const element = doc.createElement('div');
        element.className = `${className} fd-drop-echo`;
        element.setAttribute('aria-hidden', 'true');
        return element;
      };
      const [name, where] = [doc.createElement('span'), doc.createElement('span')];
      name.className = 'fd-drop-name';
      where.className = 'fd-drop-where';
      marks = { zone: make('fd-drop-zone'), bar: make('fd-drop-bar'), chip: make('fd-drop-chip'), name, where };
      marks.chip.append(name, where);
      canvas.append(marks.zone, marks.bar, marks.chip);
    }
    inCanvas(bar, marks.bar);
    marks.zone.hidden = !zone;
    if (zone) inCanvas(zone, marks.zone);
    marks.name.textContent = detail.name ?? 'Part';
    marks.where.textContent = detail.words ?? '';
    // The chip under the line's start, kept inside the canvas.
    const c = rectOf(canvas);
    const width = rectOf(marks.chip).width;
    marks.chip.style.left = `${Math.max(0, Math.min(bar.left - c.left, c.width - width))}px`;
    marks.chip.style.top = `${bar.top - c.top + bar.height + 8}px`;
  }

  function clearOutline() {
    line?.remove();
    line = null;
    for (const row of tree.querySelectorAll('.fd-echo-into')) row.classList.remove('fd-outline-into', 'fd-echo-into');
  }

  function showInOutline(detail: Extract<EchoDetail, { source: 'canvas' }>) {
    clearOutline();
    if (!detail.drop || tree.closest('[hidden]')) return;
    const views = [...tree.querySelectorAll<HTMLElement>('[role="treeitem"]')];
    const rows = views.map((view) => ({ id: view.dataset['pick'] as string, level: Number(view.dataset['level'] ?? 0) }));
    const mark = outlineMark(rows, designer.getPage(), detail.drop, detail.moving);
    if (!mark || !views.length) return;
    if ('into' in mark) {
      views[rows.findIndex((row) => row.id === mark.into)]?.classList.add('fd-outline-into', 'fd-echo-into');
      return;
    }
    line = doc.createElement('div');
    line.className = 'fd-outline-line fd-drop-echo';
    line.setAttribute('aria-hidden', 'true');
    const box = rectOf(tree);
    const edge = views[mark.gap] ? rectOf(views[mark.gap]).top : rectOf(views[views.length - 1]).bottom;
    line.style.top = `${Math.round(edge - box.top)}px`;
    line.style.setProperty('--fd-drop-level', String(mark.level));
    tree.append(line);
  }

  const onEcho = (event: Event) => {
    const detail = (event as CustomEvent<EchoDetail>).detail;
    if (detail?.source === 'outline') showOnCanvas(detail);
    else if (detail?.source === 'canvas') showInOutline(detail);
  };
  editor.addEventListener(ECHO_EVENT, onEcho);
  return {
    destroy() {
      editor.removeEventListener(ECHO_EVENT, onEcho);
      clearCanvas();
      clearOutline();
    },
  };
}
