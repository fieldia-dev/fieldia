import type { FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { MenuItem } from './menu';
import { answerRulesEditor } from './rules-answers';
import type { SampleOptions } from './rules-sample';
import { workedOutSetting } from './rules-worked-out';
import { kindsFitting } from './rules-words';

/**
 * A survey question's rules, in its open card, the Google Forms way: from ⋮,
 * "Answer rules" opens them under the question — the same list of sentences
 * and settings as the screen editor's panel — and "Worked out from other
 * answers" a formula, for a number, an amount or text. A question that has
 * either shows it whenever its card is open.
 */

export interface CardRules {
  element: HTMLElement;
  /** What ⋮ offers for this question's rules. */
  menuItems(): MenuItem[];
  /** Do what was picked in ⋮; false when it was not this one's. */
  pick(item: string): boolean;
  update(page: Page, node: FieldNode): void;
  destroy(): void;
}

/** One part of the card's rules: shown while it has something, or was asked for from ⋮ until the card closes. */
interface Part {
  element: HTMLElement;
  wanted: boolean;
  has: boolean;
  offered: boolean;
}

export function cardRules(el: ElementFactory, designer: Designer, id: string, sampling: SampleOptions = {}): CardRules {
  const answers = answerRulesEditor(el, designer, id, sampling);
  const workedOut = workedOutSetting(el, designer, id);
  const parts: Record<'answer-rules' | 'worked-out', Part> = {
    'answer-rules': { element: el('div', { class: 'fd-q-rules-part' }, answers.element), wanted: false, has: false, offered: false },
    'worked-out': { element: el('div', { class: 'fd-q-rules-part' }, workedOut.element), wanted: false, has: false, offered: false },
  };
  const element = el('div', { class: 'fd-q-rules', hidden: '' }, parts['worked-out'].element, parts['answer-rules'].element);
  const LABELS = { 'answer-rules': designer.words.rulesUi.answerRules, 'worked-out': designer.words.rulesUi.workedOutFromOthers } as const;

  function draw() {
    for (const part of Object.values(parts)) part.element.hidden = !(part.has || (part.wanted && part.offered));
    element.hidden = Object.values(parts).every((part) => part.element.hidden);
  }

  return {
    element,
    menuItems: () =>
      (Object.keys(parts) as (keyof typeof parts)[]).filter((key) => parts[key].offered || parts[key].has).map((key) => ({ id: key, label: LABELS[key], checked: !parts[key].element.hidden })),
    pick(item) {
      const part = parts[item as keyof typeof parts];
      if (!part) return false;
      // Off again only while there is nothing in it: rules are taken away in place, with Undo.
      if (!part.has) part.wanted = !part.wanted;
      draw();
      if (part.element.hidden) return true;
      if (item === 'answer-rules') answers.focus();
      else (workedOut.element.querySelector('input') as HTMLInputElement | null)?.focus();
      return true;
    },
    update(page, node) {
      answers.update(page);
      workedOut.update(page);
      const def = page.fields[node.field];
      Object.assign(parts['answer-rules'], { has: !!node.validate?.length, offered: kindsFitting(def).length > 0 });
      Object.assign(parts['worked-out'], { has: def.compute !== undefined, offered: !workedOut.element.hidden });
      draw();
    },
    destroy: () => answers.destroy(),
  };
}
