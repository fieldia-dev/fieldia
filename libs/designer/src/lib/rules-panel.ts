import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { answerRulesEditor } from './rules-answers';
import { setWhenSetting, workedOutSetting } from './rules-worked-out';

/**
 * A field's own rules on the panel's Rules tab, under when it shows and
 * whether it is required: its value worked out from others, values set when
 * something holds, and the rules its answer must keep. Each row says its
 * tab, so the panel sorts it there and the search finds it.
 */

export interface FieldRules {
  rows: HTMLElement[];
  update(page: Page): void;
  /** Bring the answer rules forward. */
  focus(): void;
}

export function fieldRules(el: ElementFactory, designer: Designer, id: string): FieldRules {
  const workedOut = workedOutSetting(el, designer, id);
  const setWhen = setWhenSetting(el, designer, id);
  const answers = answerRulesEditor(el, designer, id);
  return {
    rows: [workedOut.element, setWhen.element, answers.element],
    update(page) {
      workedOut.update(page);
      setWhen.update(page);
      answers.update(page);
    },
    focus: () => answers.focus(),
  };
}
