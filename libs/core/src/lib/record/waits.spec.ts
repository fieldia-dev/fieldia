import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { Line, Values } from './values';

/**
 * A value worked out from others waits while one of them holds text that does not read — as the table's own total
 * waits for a line whose Quantity says "abc" (0.24) — whoever works it out: the page (`compute`), or the app as the
 * lines change (a read-only amount, from a source with an onchange). Never an amount counting the value the text
 * replaced. The sales order of the owner's walk: "abc" in the Office chair's Quantity, the Standing desk set to 7.
 */

const lines = (extra: Record<string, unknown> = {}) => ({
  type: 'one2many',
  label: 'Order lines',
  relation: 'sale.order.line',
  lineKinds: { field: 'display_type', text: 'name' },
  fields: {
    display_type: { type: 'selection', label: 'Line type', options: [{ value: 'section', label: 'Section' }] },
    name: { type: 'char', label: 'Description' },
    qty: { type: 'float', label: 'Quantity' },
    price: { type: 'monetary', label: 'Unit price', currency: 'EGP' },
    subtotal: { type: 'monetary', label: 'Subtotal', currency: 'EGP', readonly: true, ...extra },
  },
});

function page(fields: Record<string, unknown>): Page {
  return {
    fieldia: '0.5',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields,
    layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((field) => ({ type: 'field', id: `f-${field}`, field })) },
  } as Page;
}

const ORDER: Line[] = [
  { key: 's1', values: { display_type: 'section', name: 'Workstations' } },
  { key: 'l1', values: { name: 'Office chair', qty: 12, price: 1890, subtotal: 22680 } },
  { key: 'l2', values: { name: 'Standing desk', qty: 6, price: 6425, subtotal: 38550 } },
];
const ABC = { text: 'abc', message: 'Line 1: Quantity: “abc” is not a number' };

/** The app's onchange as the demo's server works a sales order out: each line's subtotal, the order's totals. */
function app(values: Values): Values {
  const worked = ((values['line_ids'] as Line[]) ?? []).map((line) => (line.values['display_type'] ? line : { ...line, values: { ...line.values, subtotal: Number(line.values['qty']) * Number(line.values['price']) } }));
  const untaxed = worked.reduce((sum, line) => sum + Number(line.values['subtotal'] ?? 0), 0);
  return { line_ids: worked, amount_untaxed: untaxed, amount_total: untaxed * 1.14 };
}

function appOrder() {
  const source = createMemoryDataSource({
    records: { 'sale.order': { 1: { line_ids: ORDER, amount_untaxed: 61230, amount_total: 69802.2, note: 'Deliver by noon', margin: 0.2 } } },
    onchange: { 'sale.order': { line_ids: app } },
  });
  return createForm({
    page: page({
      line_ids: lines(),
      amount_untaxed: { type: 'monetary', label: 'Untaxed amount', currency: 'EGP', readonly: true },
      amount_total: { type: 'monetary', label: 'Total', currency: 'EGP', readonly: true },
      // Read-only, but no amount: the app keeps it, nothing worked out.
      note: { type: 'char', label: 'Note', readonly: true },
      // An amount a person types: never waits.
      margin: { type: 'float', label: 'Margin' },
    }),
    dataSource: source,
    recordId: 1,
  });
}

describe('a value worked out from lines waits while a line holds text that does not read', () => {
  it('the app’s totals: from the moment "abc" is typed, through its answer to another line, till it reads', async () => {
    const form = appOrder();
    await form.load();
    expect(form.waitsFor('amount_untaxed')).toBeNull();
    form.setUnread('line_ids.l1.qty', ABC);
    // Line 1 as people count them: the section is no line.
    expect(form.waitsFor('amount_untaxed')).toEqual({ field: 'line_ids', line: 1, column: 'qty' });
    expect(form.waitsFor('amount_total')).toEqual({ field: 'line_ids', line: 1, column: 'qty' });
    expect(form.waitsFor('note')).toBeNull();
    expect(form.waitsFor('margin')).toBeNull();
    // The desk set to 7: the app answers, counting the chair at its old 12 — laid, and still waiting.
    form.updateLine('line_ids', 'l2', 'qty', 7);
    await form.settled();
    expect(form.getState().values['amount_untaxed']).toBe(12 * 1890 + 7 * 6425);
    expect(form.waitsFor('amount_untaxed')).toEqual({ field: 'line_ids', line: 1, column: 'qty' });
    // Put right: the line reads, the app answers for it, and nothing waits.
    form.updateLine('line_ids', 'l1', 'qty', 10);
    await form.settled();
    expect(form.getState().unread).toEqual({});
    expect(form.waitsFor('amount_untaxed')).toBeNull();
    expect(form.getState().values['amount_untaxed']).toBe(10 * 1890 + 7 * 6425);
  });

  it('a source that works nothing out: its read-only amounts are its own, and do not wait', async () => {
    const source = createMemoryDataSource({ records: { 'sale.order': { 1: { line_ids: ORDER, amount_untaxed: 61230 } } } });
    // A source that has no onchange: the amounts are as it keeps them, worked out by nothing here.
    delete (source as { onchange?: unknown }).onchange;
    const form = createForm({ page: page({ line_ids: lines(), amount_untaxed: { type: 'monetary', label: 'Untaxed amount', currency: 'EGP', readonly: true } }), dataSource: source, recordId: 1 });
    await form.load();
    form.setUnread('line_ids.l1.qty', ABC);
    expect(form.waitsFor('amount_untaxed')).toBeNull();
  });

  it('the page’s own: a sum over the lines, and what is worked out from it in turn; not what reads no line', () => {
    const form = createForm({
      page: page({
        line_ids: lines({ compute: 'qty * price', readonly: undefined }),
        untaxed: { type: 'monetary', label: 'Untaxed', currency: 'EGP', compute: "sum(line_ids, 'subtotal')" },
        total: { type: 'monetary', label: 'Total', currency: 'EGP', compute: 'untaxed * 1.14' },
        rate: { type: 'float', label: 'Rate' },
        fee: { type: 'monetary', label: 'Fee', currency: 'EGP', compute: 'rate * 10' },
      }),
    });
    form.setValue('line_ids', ORDER);
    expect(form.getState().values['untaxed']).toBe(12 * 1890 + 6 * 6425);
    form.setUnread('line_ids.l2.qty', { text: '6x', message: 'Line 2: Quantity: “6x” is not a number' });
    expect(form.waitsFor('untaxed')).toEqual({ field: 'line_ids', line: 2, column: 'qty' });
    expect(form.waitsFor('total')).toEqual({ field: 'line_ids', line: 2, column: 'qty' });
    expect(form.waitsFor('fee')).toBeNull();
    // A field of the record's own the page works a value out from, holding text that does not read: that one waits for it.
    form.setUnread('rate', { text: '1,2,3', message: 'Rate: “1,2,3” is not a number' });
    expect(form.waitsFor('fee')).toEqual({ field: 'rate' });
    form.setUnread('line_ids.l2.qty', null);
    expect(form.waitsFor('total')).toBeNull();
  });

  it('a line opened in its dialog: its Subtotal waits for its Quantity, as its cell in the table does', () => {
    const line = createForm({
      page: page({
        qty: { type: 'float', label: 'Quantity' },
        price: { type: 'monetary', label: 'Unit price', currency: 'EGP' },
        subtotal: { type: 'monetary', label: 'Subtotal', currency: 'EGP', readonly: true },
        name: { type: 'char', label: 'Description' },
      }),
      parent: { values: {}, fields: {} },
    });
    line.setValue('qty', 12);
    expect(line.waitsFor('subtotal')).toBeNull();
    line.setUnread('qty', { text: 'abc', message: 'Quantity: “abc” is not a number' });
    expect(line.waitsFor('subtotal')).toEqual({ field: 'qty' });
    // Nothing a person types in waits.
    expect(line.waitsFor('price')).toBeNull();
    expect(line.waitsFor('name')).toBeNull();
  });

  it('a section’s or a note’s text is never waited for, and the first line holding text is named', () => {
    const form = appOrder();
    form.setValue('line_ids', ORDER);
    form.setUnread('line_ids.l2.qty', ABC);
    form.setUnread('line_ids.l1.price', { text: '1.8.9', message: 'Line 1: Unit price: “1.8.9” is not a number' });
    expect(form.waitsFor('amount_total')).toEqual({ field: 'line_ids', line: 1, column: 'price' });
  });
});
