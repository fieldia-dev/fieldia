import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { foldOf, type Fold } from './group-fold';
import { isSection, nodeOf } from './layout-tree';
import { segmented, setting } from './panel-controls';

/**
 * Whether a group folds by its title, on its Content tab, in Simple too: No,
 * Starts open or Starts folded. A group with no title has nothing to fold
 * by: in place of the choices, it says so.
 */
export function foldSetting(el: ElementFactory, designer: Designer, id: string): { rows: HTMLElement[]; update(page: Page): void } {
  const w = designer.words.panel;
  const choice = segmented<Fold>(
    el,
    w.folds,
    [
      { value: 'no', words: w.no },
      { value: 'open', words: w.startsOpen, title: w.startsOpenTitle },
      { value: 'folded', words: w.startsFolded, title: w.startsFoldedTitle },
    ],
    (value) => value && designer.setFold(id, value)
  );
  const why = el('p', { class: 'fd-properties-hint fd-fold-why', hidden: '' }, w.foldsWhy);
  const row = setting(el, 'content', 'Folds', [choice.element, why], { words: w.folds });
  return {
    rows: [row],
    update(page) {
      const section = nodeOf(page, id);
      if (!isSection(section)) return;
      const titled = !!section.title?.trim();
      choice.element.hidden = !titled;
      why.hidden = titled;
      choice.set(foldOf(section));
    },
  };
}
