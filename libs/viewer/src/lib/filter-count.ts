import { recordSentence, listComma, type Locale, type Page, intlFormat } from '@fieldia/core';
import { formatNumber } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

type CountWords = Pick<ViewerLabels, 'groupCount' | 'groupCountNoun' | 'groupCountOne' | 'groupCountNounOne'>;

/**
 * How many records a filter finds (`filterCounts`), beside its words: the number as the page writes numbers ("1,284"),
 * hidden from a screen reader, and `named` — what its owner is called with it, in the page's own word for its records,
 * "Villa, 12 homes", "Late, 5 leads" — as a group's heading says its count. The owner takes `named` as its name
 * (`aria-label`): words put after its own inside it would be read with a space before their comma.
 */
export function countMark(el: El, n: number, page: Page, labels: CountWords, fill: (template: string, values: Record<string, string | number>) => string, locale: Locale = 'en'): { mark: HTMLElement; named: (words: string) => string } {
  const shown = formatNumber(n, 0, locale);
  const one = intlFormat('PluralRules', locale).select(n) === 'one';
  const said = fill(one ? recordSentence(page.records, labels.groupCountNounOne, labels.groupCountOne, locale) : recordSentence(page.records, labels.groupCountNoun, labels.groupCount, locale), { n: shown });
  const comma = listComma(locale);
  return { mark: el('span', { class: 'fd-filter-count', 'aria-hidden': 'true' }, shown), named: (words) => `${words}${comma}${said}` };
}
