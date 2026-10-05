import type { SectionNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { foldOf } from './group-fold';
import { designerIcon } from './icons';
import { setAttr, setData, setHidden } from './writes';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

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

export function foldMark(el: ElementFactory, doc: Document, words: DesignerWords = en): FoldMark {
  const element = el('span', { class: 'fd-canvas-fold', role: 'img', hidden: '' }, designerIcon(doc, 'chevron'));
  return {
    element,
    // Written only where it changed: a big page's every redraw would otherwise touch each group's mark.
    update(section) {
      const fold = foldOf(section);
      setHidden(element, fold === 'no' || !section.title);
      setData(element, 'fold', fold);
      const said = fold === 'folded' ? words.canvas.foldsFolded : words.canvas.foldsOpen;
      setAttr(element, 'aria-label', said);
      setAttr(element, 'title', said);
    },
  };
}
