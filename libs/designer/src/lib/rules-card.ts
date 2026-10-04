import type { FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { MenuItem } from './menu';
import { answerRulesEditor } from './rules-answers';
import { kindsFitting } from './rules-words';

/**
 * A survey question's rules, in its open card, the Google Forms way: from ⋮,
 * "Answer rules" opens them under the question — the same list of sentences
 * and settings as the screen editor's panel — and a question that has rules
 * shows them whenever its card is open.
 */

export interface CardRules {
  element: HTMLElement;
  /** What ⋮ offers for this question's rules. */
  menuItems(): MenuItem[];
  /** Do what was picked in ⋮; false when it was not this one's. */
  pick(item: string): boolean;
  update(page: Page, node: FieldNode): void;
}

export function cardRules(el: ElementFactory, designer: Designer, id: string): CardRules {
  const answers = answerRulesEditor(el, designer, id);
  const element = el('div', { class: 'fd-q-rules', hidden: '' }, answers.element);
  /** Asked for from ⋮, while it has no rules yet: shown until the card closes. */
  let wanted = false;
  let has = false;
  let fits = false;

  function draw() {
    element.hidden = !(has || (wanted && fits));
  }

  return {
    element,
    menuItems: () => (fits || has ? [{ id: 'answer-rules', label: 'Answer rules', checked: !element.hidden }] : []),
    pick(item) {
      if (item !== 'answer-rules') return false;
      // Off again only while there is nothing in it: rules are removed one by one, with Undo.
      if (!has) wanted = !wanted;
      draw();
      if (!element.hidden) answers.focus();
      return true;
    },
    update(page, node) {
      answers.update(page);
      has = !!node.validate?.length;
      fits = kindsFitting(page.fields[node.field]).length > 0;
      draw();
    },
  };
}
