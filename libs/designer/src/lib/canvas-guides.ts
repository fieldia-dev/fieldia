import type { Designer, DesignerState } from './designer';
import { across, locate, nodeOf } from './layout-tree';

/**
 * The guides of the Advanced canvas, as the mockup draws them: the columns of
 * the grid the picked part sits on — and of a picked group's own grid — as
 * tinted bands under the parts, each numbered, so a part dropped or widened is
 * seen to land on them. The bands are laid out by the grid's own column count
 * and gap at the width it has now, so they are its columns, not a copy. A
 * group in twelfths (and an arrangement on its columns) has more than four:
 * they are drawn fainter, and not numbered.
 */

export interface CanvasGuides {
  update(state: DesignerState, advanced: boolean): void;
}

/**
 * The width of a cell parts share, side by side, at or under which the form
 * puts them one under the other — its stylesheet's @container rule (a spec
 * holds the two together). Kept here, not in the form's script, which has no
 * use for it.
 */
export const SHARED_CELL_NARROW = 330;

export function canvasGuides(options: { root: HTMLElement; designer: Designer }): CanvasGuides {
  const { root, designer } = options;
  const doc = root.ownerDocument;

  /**
   * Cells that parts share are one column where the browser reports them
   * SHARED_CELL_NARROW wide or less, as the form's own rule has it: known from
   * a ResizeObserver, which reports after the page is laid out, so nothing is
   * measured while the canvas redraws. A cell crossing that width redraws the
   * guides.
   */
  const narrowCells = new WeakMap<Element, boolean>();
  const watched = new WeakSet<Element>();
  let last: { state: DesignerState; advanced: boolean } | null = null;
  const view = doc.defaultView;
  const sized = view?.ResizeObserver
    ? new view.ResizeObserver((entries) => {
        let crossed = false;
        for (const entry of entries) {
          const narrow = entry.contentRect.width <= SHARED_CELL_NARROW;
          if (narrowCells.get(entry.target) !== narrow) crossed = true;
          narrowCells.set(entry.target, narrow);
        }
        if (crossed && last) update(last.state, last.advanced);
      })
    : null;

  /**
   * How many columns a grid has now, worked out as the stylesheet does —
   * never by laying the page out to measure it: the columns the canvas gives
   * it; on its grid's tracks, as many as its span covers of that grid's; in a
   * shared cell, its own, or one where the cell is narrow; else as the page says.
   */
  function columns(grid: HTMLElement): number {
    const given = Number(grid.style.getPropertyValue('--fd-cols'));
    if (Number.isInteger(given) && given >= 1) return given;
    const part = grid.parentElement;
    const place = part?.dataset['place'];
    if (part && place === 'tracks') {
      const outer = part.parentElement?.closest<HTMLElement>('[data-container]');
      const span = Number(part.style.getPropertyValue('--fd-span')) || 1;
      return Math.min(span, outer && outer !== root ? columns(outer) : 1);
    }
    if (part && place === 'shared') {
      if (sized && !watched.has(part)) {
        watched.add(part);
        sized.observe(part);
      }
      return narrowCells.get(part) ? 1 : Number(grid.style.getPropertyValue('--fd-columns')) || 1;
    }
    const holder = nodeOf(designer.getPage(), grid.dataset['container'] as string);
    return holder ? across(designer.getPage(), holder) : 1;
  }

  function draw(grid: HTMLElement) {
    const count = columns(grid);
    if (count < 2) return;
    const bands = doc.createElement('div');
    bands.className = count > 4 ? 'fd-guides fd-guides-fine' : 'fd-guides';
    bands.setAttribute('aria-hidden', 'true');
    for (let n = 1; n <= count; n++) {
      const band = doc.createElement('i');
      if (count <= 4) band.setAttribute('data-n', String(n));
      bands.append(band);
    }
    grid.prepend(bands);
  }

  function update(state: DesignerState, advanced: boolean) {
    last = { state, advanced };
    for (const old of root.querySelectorAll('.fd-guides')) old.remove();
      const id = state.selected;
    if (!advanced || !id || !locate(state.page, id)) return;
    const part = root.querySelector<HTMLElement>(`[data-node="${id.replace(/["\\]/g, '\\$&')}"]:not([role="tab"])`);
    if (!part) return;
    const around = part.parentElement?.closest<HTMLElement>('[data-container]');
    const own = [...part.querySelectorAll<HTMLElement>('[data-container]')].find((g) => g.parentElement?.closest('[data-node]') === part);
    for (const grid of [around, own]) if (grid && grid !== root) draw(grid);
  }

  return { update };
}
