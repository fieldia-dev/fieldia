import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import type { DataSource, SearchRequest } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { Line } from './values';

/** An order whose lines read the order they are on: its discount, its company, its status. */
const order = {
  fieldia: '0.1',
  id: 'order',
  title: 'Order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    discount: { type: 'float', label: 'Discount %' },
    company_id: { type: 'many2one', label: 'Company', relation: 'res.company' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'sale', label: 'Order' }] },
    user_id: { type: 'many2one', label: 'Salesperson', relation: 'res.users', filter: [{ field: 'id', op: '=', valueFrom: 'user.id' }] },
    order_line: {
      type: 'one2many',
      label: 'Lines',
      relation: 'sale.order.line',
      fields: {
        name: { type: 'char', label: 'Description' },
        price: { type: 'float', label: 'Price' },
        qty: { type: 'float', label: 'Quantity' },
        subtotal: { type: 'float', label: 'Subtotal', compute: 'price * qty * (100 - parent.discount) / 100' },
        locked: { type: 'boolean', label: 'Locked', setWhen: [{ when: "parent.state == 'sale'", value: 'True' }] },
        tax_id: { type: 'many2one', label: 'Tax', relation: 'account.tax', filter: [{ field: 'company_id', op: '=', valueFrom: 'parent.company_id' }] },
      },
    },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    children: [
      { type: 'field', id: 'f-discount', field: 'discount' },
      { type: 'field', id: 'f-company', field: 'company_id' },
      { type: 'field', id: 'f-state', field: 'state' },
      { type: 'field', id: 'f-user', field: 'user_id' },
      { type: 'field', id: 'f-lines', field: 'order_line' },
    ],
  },
} as unknown as Page;

const messages = (result: ReturnType<typeof validatePage>) => ('issues' in result ? result.issues.map((issue) => issue.message).join(' | ') : '');
const lines = (form: ReturnType<typeof createForm>) => (form.getState().values['order_line'] as Line[]).map((line) => line.values);

/** A data source that keeps every search it is asked. */
function asked(): { source: DataSource; searches: SearchRequest[] } {
  const searches: SearchRequest[] = [];
  const memory = createMemoryDataSource({ records: { 'account.tax': { 1: { name: 'VAT 14%', company_id: { id: 3, label: 'Sherkety' } } }, 'res.users': { 4: { name: 'Nour' } } } });
  return { searches, source: { ...memory, search: (request) => (searches.push(request), memory.search!(request)) } };
}

describe('a line reads the record it is on, as parent', () => {
  it('works out a line from its record’s values, again when they change', () => {
    expect(validatePage(order)).toMatchObject({ ok: true });
    const form = createForm({ page: order, values: { discount: 10, order_line: [{ key: 'a', values: { name: 'Desk', price: 200, qty: 2 } }] } as never });
    expect(lines(form)[0]['subtotal']).toBe(360);
    form.setValue('discount', 25);
    expect(lines(form)[0]['subtotal']).toBe(300);
  });

  it('sets a line’s value when a condition on its record starts to hold', () => {
    const form = createForm({ page: order, values: { state: 'draft', order_line: [{ key: 'a', values: { name: 'Desk', price: 200, qty: 1 } }] } as never });
    expect(lines(form)[0]['locked']).toBeFalsy();
    form.setValue('state', 'sale');
    expect(lines(form)[0]['locked']).toBe(true);
  });

  it('filters a line’s link by its record’s value', async () => {
    const { source, searches } = asked();
    const form = createForm({ page: order, dataSource: source, values: { company_id: { id: 3, label: 'Sherkety' }, order_line: [{ key: 'a', values: { name: 'Desk' } }] } as never });
    await form.searchLine('order_line', 'a', 'tax_id', '');
    expect(searches.at(-1)?.filter).toEqual([{ field: 'company_id', op: '=', value: 3 }]);
  });

  it('filters a link by the person using the form', async () => {
    const { source, searches } = asked();
    const form = createForm({ page: order, dataSource: source, user: { id: 4, roles: [] } });
    await form.search('user_id', '');
    expect(searches.at(-1)?.filter).toEqual([{ field: 'id', op: '=', value: 4 }]);
  });
});

describe('the page check knows parent', () => {
  it('refuses parent where there is no record above, and fields its record lacks', () => {
    const fields = order.fields as Record<string, never>;
    const lineFields = (order.fields['order_line'] as { fields: Record<string, unknown> }).fields;
    const withLine = (extra: Record<string, unknown>): Page => ({ ...order, fields: { ...fields, order_line: { ...(order.fields['order_line'] as object), fields: { ...lineFields, ...extra } } } as unknown as Page['fields'] });
    const unknown = validatePage(withLine({ bad: { type: 'float', label: 'Bad', compute: 'parent.nope * 2' } }));
    expect(messages(unknown)).toMatch(/parent\.nope.*not a field of this page/);
    const badFilter = validatePage(withLine({ tax2: { type: 'many2one', label: 'Tax', relation: 'account.tax', filter: [{ field: 'company_id', op: '=', valueFrom: 'parent.nope' }] } }));
    expect(badFilter.ok).toBe(false);
    const onRecord = validatePage({ ...order, fields: { ...fields, total: { type: 'float', label: 'Total', compute: 'parent.discount' } } as unknown as Page['fields'] });
    expect(messages(onRecord)).toMatch(/reads "parent", which is not a field of this page/);
  });
});
