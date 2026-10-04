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
  const choice = segmented<Fold>(
    el,
    'Folds',
    [
      { value: 'no', words: 'No' },
      { value: 'open', words: 'Starts open', title: 'People can fold it by its title' },
      { value: 'folded', words: 'Starts folded', title: 'It starts folded: people open it by its title' },
    ],
    (value) => value && designer.setFold(id, value)
  );
  const why = el('p', { class: 'fd-properties-hint fd-fold-why', hidden: '' }, 'A group folds by its title. Give it a title to let it fold.');
  const row = setting(el, 'content', 'Folds', [choice.element, why]);
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
