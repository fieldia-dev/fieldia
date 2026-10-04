import type { SectionNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { foldOf } from './group-fold';
import { designerIcon } from './icons';

/**
 * The small mark before a group's title on the canvas when the group folds
 * by it, where the form draws its arrow: pointing down while it starts open,
 * along the line while it starts folded. The canvas draws the group open, so
 * it can be edited.
 */
export interface FoldMark {
  element: HTMLElement;
  update(section: SectionNode): void;
}

export function foldMark(el: ElementFactory, doc: Document): FoldMark {
  const element = el('span', { class: 'fd-canvas-fold', role: 'img', hidden: '' }, designerIcon(doc, 'chevron'));
  return {
    element,
    update(section) {
      const fold = foldOf(section);
      element.hidden = fold === 'no' || !section.title;
      element.dataset['fold'] = fold;
      const words = fold === 'folded' ? 'Folds, starting folded' : 'Folds, starting open';
      element.setAttribute('aria-label', words);
      element.title = words;
    },
  };
}
