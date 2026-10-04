import type { Page } from '@fieldia/core';
import type { Drop } from './layout-ops';
import { across, nodeOf } from './layout-tree';

/**
 * Where a part dropped on the Advanced canvas would go, read off the canvas the
 * way the approved mockup reads it (as Grafloria's split board does), zones
 * walked outermost first:
 *
 *  1. within a few pixels of a whole group's outer edge — that group: a new
 *     column beside it, or a new row under or above it;
 *  2. at a boundary between a grid's rows — the gap, or a few pixels into a
 *     row — a new full-width row there;
 *  3. otherwise the part under the pointer, by its nearest edge (measured
 *     against its own size, so a wide, short field still has a top and a
 *     bottom): beside it, or under or above it.
 *
 * In a group's padding or a gap, the nearest part inside answers; an empty
 * group takes the part. Nothing moves until the drop: the line and the words
 * are the promise.
 *
 * The canvas marks each part `data-node`, and the element holding a group's or
 * a tab's parts `data-container`; `root` holds the page's own.
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A drop, the line that shows where, and — for a whole group — the group tinted. */
export interface DropMark {
  drop: Drop;
  line: Rect;
  zone: Rect | null;
}

export interface DropFinder {
  /** What holds the page's own parts. */
  root: HTMLElement;
  page: Page;
  /** Right to left: a part's left edge is the side after it. */
  rtl: boolean;
  rectOf(element: Element): DOMRect;
}

/** How near a group's outer edge counts as the whole group. */
const BAND = 10;
/** How far into a row its boundary with the next still counts. */
const ROW_BAND = 8;
/** How far a drop line sits off the edge it marks, and how thick it is. */
const OUT = 5;
const THICK = 4;

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** The drop line by one side of a box: just off it, as thick as a drop line is. The outline's drag draws the same line on the canvas. */
export function edgeLine(r: Rect, at: Side): Rect {
  return at === 'left' || at === 'right'
    ? { left: (at === 'right' ? r.left + r.width + OUT : r.left - OUT) - THICK / 2, top: r.top, width: THICK, height: r.height }
    : { left: r.left, top: (at === 'bottom' ? r.top + r.height + OUT : r.top - OUT) - THICK / 2, width: r.width, height: THICK };
}

/** The line where a part goes into an empty group: across the top of what holds its parts. */
export const intoLine = (r: Rect): Rect => ({ left: r.left + 8, top: r.top + 8, width: r.width - 16, height: THICK });

/** The edge of a box nearest a point, each measured against the box's own size. */
function nearestSide(r: DOMRect, x: number, y: number): Side {
  const d: Record<Side, number> = { left: (x - r.left) / r.width, right: (r.right - x) / r.width, top: (y - r.top) / r.height, bottom: (r.bottom - y) / r.height };
  return (Object.keys(d) as Side[]).reduce((a, b) => (d[b] < d[a] ? b : a));
}

export function findDrop(finder: DropFinder, target: Element | null, x: number, y: number, moving?: string): DropMark | null {
  const { root, page, rectOf } = finder;
  if (!target || !root.contains(target)) return null;
  const movingEl = moving ? ([...root.querySelectorAll<HTMLElement>('[data-node]')].find((e) => e.dataset['node'] === moving) ?? null) : null;
  const inMoving = (e: Element) => !!movingEl && movingEl.contains(e);
  const isPart = (e: Element) => !!(e as HTMLElement).dataset['node'] && !e.matches('[role="tab"]');

  function side(id: string, at: Side, whole: boolean, r: DOMRect): DropMark {
    const sideways = at === 'left' || at === 'right';
    const visualAfter = at === 'right' || at === 'bottom';
    const after = sideways && finder.rtl ? !visualAfter : visualAfter;
    const line = edgeLine(r, at);
    const zone = whole ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    return { drop: { how: sideways ? 'beside' : 'under', target: id, after, whole }, line, zone };
  }

  /** The parts a grid draws (all but the one moving), grouped into rows by their tops, with each row's first and last place. */
  function drawnRows(grid: Element) {
    const items = [...grid.children].filter((c) => isPart(c) && (c as HTMLElement).dataset['node'] !== moving);
    const rows: { top: number; bottom: number; first: number; last: number }[] = [];
    items.forEach((element, i) => {
      const r = rectOf(element);
      const row = rows.find((w) => Math.abs(w.top - r.top) < 4);
      if (row) {
        row.bottom = Math.max(row.bottom, r.bottom);
        row.last = i;
      } else rows.push({ top: r.top, bottom: r.bottom, first: i, last: i });
    });
    return rows;
  }

  /** A boundary between the grid's rows near y: in the gap between two, or a few pixels into one. */
  function rowBoundary(grid: HTMLElement): DropMark | null {
    const id = grid.dataset['container'] as string;
    const holder = nodeOf(page, id);
    if (!holder || across(page, holder) < 2) return null;
    const g = rectOf(grid);
    const mark = (index: number, at: number): DropMark => ({ drop: { how: 'row', container: id, index }, line: { left: g.left, top: at - THICK / 2, width: g.width, height: THICK }, zone: null });
    const rows = drawnRows(grid);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const next = rows[i + 1];
      if (next && y >= row.bottom - ROW_BAND && y <= next.top + ROW_BAND) return mark(next.first, (row.bottom + next.top) / 2);
      if (i === 0 && y <= row.top + ROW_BAND && y >= row.top - ROW_BAND * 2) return mark(0, row.top - OUT);
      if (!next && y >= row.bottom - ROW_BAND && y <= row.bottom + ROW_BAND * 2) return mark(row.last + 1, row.bottom + OUT);
    }
    return null;
  }

  /** The part in a content box nearest the pointer, and its edge facing it. */
  function nearestInside(content: Element): DropMark | null {
    let best: { element: HTMLElement; r: DOMRect; d: number; dy: number } | null = null;
    for (const element of [...content.children] as HTMLElement[]) {
      if (!isPart(element) || element.dataset['node'] === moving) continue;
      const r = rectOf(element);
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.d) best = { element, r, d, dy };
    }
    if (!best) return null;
    const { r } = best;
    const at: Side = best.d === 0 ? nearestSide(r, x, y) : best.dy === 0 ? (x < r.left ? 'left' : 'right') : y < r.top ? 'top' : 'bottom';
    return side(best.element.dataset['node'] as string, at, false, r);
  }

  /** The element holding a part's own parts: its grid, or its open tab. */
  const contentOf = (part: Element) => [...part.querySelectorAll<HTMLElement>('[data-container]')].find((c) => c.parentElement?.closest('[data-node]') === part) ?? null;

  // The parts under the pointer, outermost first, leaving out the one moving and what is in it.
  const chain: HTMLElement[] = [];
  for (let p = target.closest<HTMLElement>('[data-node]'); p && root.contains(p); p = p.parentElement?.closest<HTMLElement>('[data-node]') ?? null) {
    if (isPart(p) && !inMoving(p)) chain.unshift(p);
  }

  // 1. A whole group's edge, the outermost first.
  for (const element of chain) {
    const node = nodeOf(page, element.dataset['node'] as string);
    if (node?.type !== 'section' && node?.type !== 'tabs') continue;
    const r = rectOf(element);
    const d: Record<Side, number> = { left: x - r.left, right: r.right - x, top: y - r.top, bottom: r.bottom - y };
    const at = (Object.keys(d) as Side[]).reduce((a, b) => (d[b] < d[a] ? b : a));
    if (d[at] >= 0 && d[at] <= BAND) return side(node.id, at, true, r);
  }

  const leaf = chain[chain.length - 1];
  const leafNode = leaf ? nodeOf(page, leaf.dataset['node'] as string) : null;
  // In a group (its padding, its title, a gap between its parts) or on the page: what is inside answers.
  if (!leaf || leafNode?.type === 'section' || leafNode?.type === 'tabs') {
    const content = leaf ? contentOf(leaf) : root;
    if (!content) return null;
    const row = rowBoundary(content);
    if (row) return row;
    const near = nearestInside(content);
    if (near) return near;
    const r = rectOf(content);
    return { drop: { how: 'into', container: content.dataset['container'] as string }, line: intoLine(r), zone: leaf ? rectOf(leaf) : r };
  }
  // 2. A boundary between the rows of the grid the part sits in.
  const grid = leaf.parentElement?.closest<HTMLElement>('[data-container]');
  if (grid) {
    const row = rowBoundary(grid);
    if (row) return row;
  }
  // 3. The part itself, by its nearest edge.
  const r = rectOf(leaf);
  return side(leaf.dataset['node'] as string, nearestSide(r, x, y), false, r);
}
