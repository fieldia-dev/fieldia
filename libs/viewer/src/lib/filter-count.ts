import { recordSentence, type Locale, type Page } from '@fieldia/core';
import { formatNumber } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

type CountWords = Pick<ViewerLabels, 'groupCount' | 'groupCountNoun' | 'groupCountOne' | 'groupCountNounOne'>;

/**
 * How many records a filter finds (`filterCounts`), beside its words: the number as the page writes numbers ("1,284"),
 * and to a screen reader in words after them, in the page's own word for its records — "Villa, 12 homes", "Late, 5
 * leads" — as a group's heading says its count.
 */
export function countMark(el: El, n: number, page: Page, labels: CountWords, fill: (template: string, values: Record<string, string | number>) => string, locale: Locale = 'en'): HTMLElement[] {
  const shown = formatNumber(n, 0, locale);
  const one = new Intl.PluralRules(locale).select(n) === 'one';
  const words = fill(one ? recordSentence(page.records, labels.groupCountNounOne, labels.groupCountOne, locale) : recordSentence(page.records, labels.groupCountNoun, labels.groupCount, locale), { n: shown });
  const comma = locale.split('-')[0] === 'ar' ? '، ' : ', ';
  return [el('span', { class: 'fd-filter-count', 'aria-hidden': 'true' }, shown), el('span', { class: 'fd-sr-only' }, `${comma}${words}`)];
}
