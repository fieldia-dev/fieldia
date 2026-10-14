import type { Page } from '../format/page';
import type { ListNode } from '../format/layout';
import { matchesFilter } from './filter';
import { suggestions } from './search';

/**
 * A list's search reads what is typed as every box does (FIELDIA INPUT RULES,
 * 8): digits in any script, a number in the page's language — its grouping
 * and decimal marks, never hex or an exponent — and a phone by its digits,
 * however they are spaced.
 */

const page: Page = {
  fieldia: '0.1',
  id: 'customers',
  data: { kind: 'record', model: 'partner' },
  fields: {
    name: { type: 'char', label: 'Name' },
    phone: { type: 'char', label: 'Phone' },
    number: { type: 'integer', label: 'ID' },
    credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'phone', 'number', 'credit_limit'], cells: { phone: { widget: 'phone' } } },
};
const list = page.layout as ListNode;
const delta = { name: 'Delta Foods ٢', phone: '+20 40 333 4400', number: 4172, credit_limit: 420000.5 };
const nile = { name: 'Nile Traders', phone: '+20 2 2735 1100', number: 104, credit_limit: 80000 };
const offered = (typed: string, locale = 'en') => suggestions(typed, page, list, undefined, locale);
const numberIn = (typed: string, field: string, locale = 'en') => offered(typed, locale).find((s) => s.field === field)?.value;
/** The records a suggestion finds, through the memory source's own matching. */
const found = (typed: string, field: string, locale = 'en') => {
  const suggestion = offered(typed, locale).find((s) => s.field === field);
  return suggestion ? [delta, nile].filter((record) => matchesFilter(record, [{ field, op: suggestion.op, value: suggestion.value }])).map((r) => r.name) : [];
};

describe('a number typed in a list’s search', () => {
  it('reads Arabic-Indic and Persian digits', () => {
    expect(numberIn('٤١٧٢', 'number')).toBe(4172);
    expect(numberIn('۴۱۷۲', 'number')).toBe(4172);
    expect(found('٤١٧٢', 'number')).toEqual(['Delta Foods ٢']);
  });

  it('reads the page’s own marks: a German grouping point, a French decimal comma', () => {
    expect(numberIn('4.172', 'number', 'de')).toBe(4172);
    expect(numberIn('4,172', 'number', 'en')).toBe(4172);
    expect(numberIn('420 000,5', 'credit_limit', 'fr')).toBe(420000.5);
    expect(numberIn('٤٢٠٬٠٠٠٫٥', 'credit_limit', 'ar')).toBe(420000.5);
  });

  it('never reads hex, an exponent or words as a number', () => {
    expect(numberIn('0x104C', 'number')).toBeUndefined();
    expect(numberIn('4e3', 'number')).toBeUndefined();
    expect(numberIn('Infinity', 'credit_limit')).toBeUndefined();
  });
});

describe('words typed in a list’s search', () => {
  it('fold their digits, and find a name written with Arabic ones', () => {
    expect(offered('٢').find((s) => s.field === 'name')?.value).toBe('2');
    expect(found('foods 2', 'name')).toEqual(['Delta Foods ٢']);
  });
});

describe('a phone column searched', () => {
  it('matches the typed digits in order, whatever the spacing, in any script', () => {
    for (const typed of ['4400', '3334400', '333 4400', '+20 40 333 4400', '٤٤٠٠', '۴۴۰۰', '+٢٠ ٤٠ ٣٣٣ ٤٤٠٠', '(40) 333-4400']) {
      expect([typed, found(typed, 'phone')]).toEqual([typed, ['Delta Foods ٢']]);
    }
  });

  it('asks a server for those digits with anything between them', () => {
    expect(offered('333 44').find((s) => s.field === 'phone')).toEqual(expect.objectContaining({ op: 'ilike', value: '3%3%3%4%4', valueLabel: '333 44' }));
  });

  it('looks for words as words', () => {
    expect(offered('ext').find((s) => s.field === 'phone')?.value).toBe('ext');
  });
});
