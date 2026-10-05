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

export function canvasGuides(options: { root: HTMLElement; designer: Designer }): CanvasGuides {
  const { root, designer } = options;
  const doc = root.ownerDocument;

  /** How many columns a grid has now: as the browser lays it out, or as the page says where there is no layout. */
  function columns(grid: HTMLElement): number {
    // The columns the canvas gives the grid, which lays it out with as many: read without laying the page out.
    const given = Number(grid.style.getPropertyValue('--fd-cols'));
    if (Number.isInteger(given) && given >= 1) return given;
    // Laid out, the browser gives each column's width; anything else is no layout to count.
    const tracks = (doc.defaultView?.getComputedStyle(grid).gridTemplateColumns ?? '').split(' ').filter(Boolean);
    if (tracks.length && tracks.every((t) => /^[\d.]+px$/.test(t))) return tracks.length;
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

  return {
    update(state, advanced) {
      for (const old of root.querySelectorAll('.fd-guides')) old.remove();
      const id = state.selected;
      if (!advanced || !id || !locate(state.page, id)) return;
      const part = root.querySelector<HTMLElement>(`[data-node="${id.replace(/["\\]/g, '\\$&')}"]:not([role="tab"])`);
      if (!part) return;
      const around = part.parentElement?.closest<HTMLElement>('[data-container]');
      const own = [...part.querySelectorAll<HTMLElement>('[data-container]')].find((g) => g.parentElement?.closest('[data-node]') === part);
      for (const grid of [around, own]) if (grid && grid !== root) draw(grid);
    },
  };
}
