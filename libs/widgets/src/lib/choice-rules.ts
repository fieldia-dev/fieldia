import type { FieldNode, Option } from '@fieldia/core';
import { fillIn, setText, type Make } from './kind-parts';
import type { WidgetLabels } from './labels';

/**
 * What the choice kinds share beyond their looks: an option that goes alone
 * ("None of these"), a limit on how many are ticked, and the options laid
 * out in columns or in a row.
 */

/** The values once `value` is added: alone when it goes alone, else without those that do. */
export function withAlone(options: readonly Option[], now: readonly unknown[], value: unknown): unknown[] {
  const alone = (v: unknown) => options.some((o) => o.exclusive && o.value === v);
  return alone(value) ? [value] : [...now.filter((v) => !alone(v)), value];
}

/**
 * The most a question takes, from an answer rule that always holds and stops
 * the form: once that many are ticked the rest are turned off, and a polite
 * "Up to 3" says why — as Form.io does, rather than complaining after.
 */
export function limiter(make: Make, words: WidgetLabels, node: FieldNode) {
  const most = node.validate?.find((r) => r.atMost !== undefined && (r.when ?? true) === true && r.level !== 'warning')?.atMost;
  const element = most ? make('span', { class: 'fd-choice-limit', role: 'status' }) : null;
  return {
    element,
    /** Whether `count` fills it, saying so when it does. */
    full(count: number) {
      const full = !!most && count >= most;
      if (element) setText(element, full ? fillIn(words.upTo, { n: most as number }) : '');
      return full;
    },
  };
}

/** Columns (`options.columns`, 1 to 4) or all in a row (`"row"`); a phone stacks them again. */
export function layOut(group: HTMLElement, node: FieldNode) {
  const columns = node.options?.['columns'];
  if (columns === 'row') group.classList.add('fd-choices-row');
  else if (typeof columns === 'number' && columns >= 1) {
    group.classList.add('fd-choices-columns');
    group.style.setProperty('--fd-choice-columns', String(Math.min(4, Math.round(columns))));
  }
}
