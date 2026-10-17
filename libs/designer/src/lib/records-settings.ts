import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { setting } from './panel-controls';

/**
 * What a screen's records are called in Fieldia's own sentences (`records`): the words for one and for more, then —
 * once both are given — one with its article; and, named or not, field labels written small inside any sentence. On the screen's
 * panel (panel-page.ts) and a list's (list-properties.ts), a record page's or a list's alone. Both words or neither:
 * with one alone nothing is kept yet, the boxes keep what is typed and say what is missing.
 */
export function recordsSettings(el: ElementFactory, designer: Designer): { rows: HTMLElement[]; update(page: Page): void } {
  const w = designer.words.panel;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const one = el('input', { class: 'fd-input', 'aria-label': w.recordsOne, placeholder: w.recordsOneExample }) as HTMLInputElement;
  const other = el('input', { class: 'fd-input', 'aria-label': w.recordsOther, placeholder: w.recordsOtherExample }) as HTMLInputElement;
  const a = el('input', { class: 'fd-input', 'aria-label': w.recordsA, placeholder: w.recordsAExample }) as HTMLInputElement;
  const lower = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.recordsLowerLabels }) as HTMLInputElement;
  const half = el('p', { class: 'fd-properties-hint fd-records-half', role: 'status', hidden: '' }, w.recordsBoth);
  const name = () => {
    const [words, more] = [one.value.trim(), other.value.trim()];
    half.hidden = !words === !more;
    if (!words !== !more) return;
    designer.setRecords({ one: words, other: more, a: a.value, lowerLabels: lower.checked });
  };
  for (const box of [one, other, a]) box.addEventListener('input', name);
  lower.addEventListener('change', name);
  const called = setting(el, 'content', 'Records are called', [one, other, half], { hint: w.recordsHint, words: w.recordsCalled });
  const article = setting(el, 'content', 'One with its article', a, { hint: w.recordsAHint, words: w.recordsA });
  const small = setting(el, 'content', 'Field names small inside them', lower, { hint: w.recordsLowerLabelsHint, words: w.recordsLowerLabels });
  return {
    rows: [called, article, small],
    update(page) {
      called.hidden = page.data.kind !== 'record';
      // While one word of the two is typed alone, the boxes keep it.
      if (page.records || half.hidden) {
        if (!focused(one)) one.value = page.records?.one ?? '';
        if (!focused(other)) other.value = page.records?.other ?? '';
      }
      if (!focused(a)) a.value = page.records?.a ?? '';
      lower.checked = !!page.records?.lowerLabels;
      // One with its article once both words are given; labels small whether or not the records are named.
      article.hidden = called.hidden || !page.records?.one;
      small.hidden = called.hidden;
    },
  };
}
