import { fill, type FilterRange } from '@fieldia/core';
import type { FilterKit, RangeBoxesContext, RangeEnds, RangeWords } from './filter-range';
import type { ViewerLabels } from './labels';

/** Neither end of a range: nothing filtered. */
const OPEN: RangeEnds = { from: null, to: null };
const sameEnds = (a: RangeEnds, b: RangeEnds) => a.from === b.from && a.to === b.to;

export interface RangeControl {
  element: HTMLElement;
  /** Where the focus goes as it opens: the press that is on, else the first box. */
  focus(): void;
  /** The ends drawn as they are now: its presses, and its boxes as the page writes them. */
  show(ends: RangeEnds): void;
  /**
   * What the boxes hold taken, as leaving them takes it: false where one holds text that is no number (no day) or From
   * is past To — said under it, kept as typed, the focus on it when `focus`.
   */
  commit(focus?: boolean): boolean;
  destroy(): void;
}

/**
 * A filter bar's range: a press for each least value the page names — "Any", "1+", "2+" — then From and To. A press
 * takes its range at once; a box, when it is left or Enter is pressed (`onChange`).
 */
export function rangeControl(context: RangeBoxesContext & { kit: FilterKit; labels: RangeWords & Pick<ViewerLabels, 'rangeAny'>; range?: FilterRange; onChange: (ends: RangeEnds) => void; ends: RangeEnds }): RangeControl {
  const { def, el, labels } = context;
  const { rangeBoxes, endWords, numberRange } = context.kit;
  const locale = context.locale ?? 'en';
  let ends = context.ends;
  const boxes = rangeBoxes({ ...context, onRead: (next) => take(next) });
  const least = numberRange(def) ? (context.range?.atLeast ?? []) : [];
  const presses = least.length
    ? [{ ends: OPEN, words: labels.rangeAny }, ...least.map((n) => ({ ends: { from: n, to: null }, words: fill(labels.rangeOrMore, { from: endWords(def, n, locale) }) }))].map((press) => {
        const button = el('button', { type: 'button', class: 'fd-filter-range-press', 'aria-pressed': 'false' }, press.words);
        button.addEventListener('click', () => {
          boxes.show(press.ends);
          take(press.ends);
        });
        return { ...press, button };
      })
    : [];
  const pressRow = presses.length ? [el('div', { class: 'fd-filter-range-presses', role: 'group', 'aria-label': def.label }, ...presses.map((p) => p.button))] : [];
  const element = el('div', { class: 'fd-filter-range' }, ...pressRow, boxes.element);
  const drawPresses = () => {
    for (const press of presses) press.button.setAttribute('aria-pressed', String(sameEnds(press.ends, ends)));
  };
  function take(next: RangeEnds) {
    const changed = !sameEnds(next, ends);
    ends = next;
    drawPresses();
    if (changed) context.onChange(next);
  }
  boxes.show(ends);
  drawPresses();
  return {
    element,
    focus() {
      (presses.find((p) => sameEnds(p.ends, ends))?.button ?? boxes.from).focus();
    },
    show(next) {
      ends = next;
      boxes.show(next);
      drawPresses();
    },
    commit(focus = false) {
      const next = boxes.read(focus);
      if (next) take(next);
      return next !== false;
    },
    destroy: boxes.destroy,
  };
}

