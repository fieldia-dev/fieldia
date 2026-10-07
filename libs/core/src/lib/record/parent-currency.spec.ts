import type { Page } from '../format/page';
import { validatePage } from '../format/validate';

/** A line's money in the currency of the record it is on: `currencyField: "parent.currency_id"`. */
const order = (lineCurrency: string, own: Record<string, unknown> = {}) =>
  ({
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: {
      currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
      note: { type: 'text', label: 'Note' },
      ...own,
      line_ids: {
        type: 'one2many',
        label: 'Lines',
        relation: 'sale.order.line',
        fields: { price: { type: 'monetary', label: 'Price', currencyField: lineCurrency } },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'line_ids' }] },
  }) as unknown as Page;

const said = (page: Page) => {
  const result = validatePage(page);
  return result.ok ? '' : result.issues.map((issue) => issue.message).join('\n');
};

describe('a line’s money in its record’s currency', () => {
  it('takes the record’s currency field, as parent.currency_id', () => {
    expect(validatePage(order('parent.currency_id'))).toMatchObject({ ok: true });
  });

  it('refuses a record field it does not have, or one that holds no currency', () => {
    expect(said(order('parent.nothing'))).toContain('"nothing" is not a field of this page');
    expect(said(order('parent.note'))).toContain('a currency field must be a many2one, selection or char');
  });

  it('is for a line: the record’s own money has no parent', () => {
    const page = order('parent.currency_id', { total: { type: 'monetary', label: 'Total', currencyField: 'parent.currency_id' } });
    expect(said(page)).toContain('only a line’s money reads parent');
  });
});
