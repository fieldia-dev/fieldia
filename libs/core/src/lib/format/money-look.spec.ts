import { validatePage } from '../../index';

/**
 * How an amount is written where it is read (`money` on a monetary field):
 * its currency by symbol or by code, before or after it, short, the home
 * currency left unsaid, and what it is for while a condition holds. The
 * page says it by words and conditions, so a word that is none, or a
 * condition reading a field the page lacks, is refused here.
 */

const page = (price: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
  fieldia: '0.1',
  id: 'homes',
  data: { kind: 'record', model: 'home' },
  fields: {
    name: { type: 'char', label: 'Name' },
    currency: { type: 'char', label: 'Currency' },
    offer: { type: 'selection', label: 'Offer', options: [{ value: 'sale', label: 'For sale' }, { value: 'rent', label: 'For rent' }] },
    price: { type: 'monetary', label: 'Price', currencyField: 'currency', ...price },
    ...more,
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'price'] },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('how an amount is written', () => {
  it('takes its currency by code or symbol, before or after, short, a home currency and what it is for', () => {
    expect(problems(page({ money: { currency: 'code', at: 'after' } }))).toEqual([]);
    expect(problems(page({ money: { currency: 'symbol', at: 'before', short: true, home: 'EGP' } }))).toEqual([]);
    expect(problems(page({ money: { per: [{ period: 'month', when: "offer == 'rent'" }, { period: 'year' }] } }))).toEqual([]);
    expect(problems(page({ money: {} }))).toEqual([]);
  });

  it('refuses words that are none, and a condition reading a field the page lacks', () => {
    expect(problems(page({ money: { currency: 'name' } }))).not.toEqual([]);
    expect(problems(page({ money: { at: 'middle' } }))).not.toEqual([]);
    expect(problems(page({ money: { home: 'egp' } }))).toEqual(['fields.price.money.home: a home currency is a code of three capitals, such as EGP']);
    expect(problems(page({ money: { per: [] } }))).not.toEqual([]);
    expect(problems(page({ money: { per: [{ period: 'fortnight' }] } }))).not.toEqual([]);
    expect(problems(page({ money: { per: [{ period: 'month', when: "deal == 'rent'" }] } }))).toEqual([`fields.price.money.per[0].when: "deal == 'rent'" reads "deal", which is not a field of this page`]);
    expect(problems(page({ money: { shape: 'round' } }))).not.toEqual([]);
  });

  it('is for a monetary field alone', () => {
    expect(problems(page({}, { size: { type: 'float', label: 'Size', money: { short: true } } }))).not.toEqual([]);
  });

  it('on a line, reads the line’s own fields', () => {
    const lines = {
      fieldia: '0.1',
      id: 'order',
      data: { kind: 'record', model: 'order' },
      fields: {
        line_ids: {
          type: 'one2many',
          label: 'Lines',
          relation: 'order.line',
          fields: {
            kind: { type: 'char', label: 'Kind' },
            amount: { type: 'monetary', label: 'Amount', currency: 'EGP', money: { per: [{ period: 'month', when: "kind == 'rent'" }] } },
          },
        },
      },
      layout: { type: 'sheet', id: 'sheet', children: [{ type: 'field', id: 'f-lines', field: 'line_ids' }] },
    };
    expect(problems(lines)).toEqual([]);
  });
});
