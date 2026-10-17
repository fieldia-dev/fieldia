import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { setting } from './panel-controls';
import { findContainer, findNode, findTab } from './page-tree';

/** The kinds of part a page may leave off paper (`"print": false`). */
const PRINTABLE = new Set(['field', 'section', 'tab', 'related']);

/** The part a page may leave off paper, by its id: a field, a group, a tab or a related list. */
export function printablePart(page: Page, id: string): { type: string; print?: boolean } | null {
  const part = (findContainer(page, id) ?? findTab(page, id)?.tab ?? findNode(page, id)?.node) as { type: string; print?: boolean } | null | undefined;
  return part && PRINTABLE.has(part.type) ? part : null;
}

/**
 * "On paper": whether a part prints with its record (Ctrl+P, Print) — ticked, as every part prints unless its page says
 * otherwise; unticked, it is shown on screen and left out on paper (`"print": false`), as an invoice's journal items.
 */
export function printSetting(el: ElementFactory, designer: Designer, id: string): { element: HTMLElement; update(page: Page): void } {
  const w = designer.words.rulesUi;
  const box = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.onPaper }) as HTMLInputElement;
  box.addEventListener('change', () => {
    if (!designer.setPrinted(id, box.checked)) box.checked = printablePart(designer.getPage(), id)?.print !== false;
  });
  const element = setting(el, 'rules', 'On paper', box, { hint: w.onPaperHint, words: w.onPaper });
  return {
    element,
    update(page) {
      box.checked = printablePart(page, id)?.print !== false;
    },
  };
}
