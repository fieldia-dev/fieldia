import type { Page } from '../format/page';
import { createForm, type DraftStore } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { Line } from './values';

/**
 * Values set when a condition starts to hold (`setWhen`): only as it goes from
 * not holding to holding, so people may still change the value afterwards.
 */

const page = (fields: Record<string, unknown>, extra: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.1',
    id: 'set-when',
    data: { kind: 'record', model: 'sale.order' },
    fields,
    layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((name) => ({ type: 'field', id: `n_${name}`, field: name })) },
    ...extra,
  }) as Page;

const discountFields = {
  total: { type: 'float', label: 'Total' },
  discount: { type: 'float', label: 'Discount', setWhen: [{ when: 'total > 1000', value: '10' }] },
};

const values = (form: { getState(): { values: Record<string, unknown> } }) => form.getState().values;

describe('setWhen — a value set as a condition starts to hold', () => {
  it('sets the field when the condition goes from not holding to holding', () => {
    const form = createForm({ page: page(discountFields) });
    form.setValue('total', 500);
    expect(values(form)['discount']).toBeNull();
    form.setValue('total', 1500);
    expect(values(form)['discount']).toBe(10);
    expect(form.getState().dirty).toEqual(expect.arrayContaining(['total', 'discount']));
  });

  it('lets people change the value afterwards, while the condition goes on holding', () => {
    const form = createForm({ page: page(discountFields) });
    form.setValue('total', 1500);
    form.setValue('discount', 5);
    form.setValue('total', 1600);
    expect(values(form)['discount']).toBe(5);
  });

  it('sets it again only after the condition stopped holding and starts again', () => {
    const form = createForm({ page: page(discountFields) });
    form.setValue('total', 1500);
    form.setValue('discount', 5);
    form.setValue('total', 900);
    expect(values(form)['discount']).toBe(5);
    form.setValue('total', 1200);
    expect(values(form)['discount']).toBe(10);
  });

  it('leaves alone a condition that already held when the form started', () => {
    const form = createForm({ page: page(discountFields), values: { total: 1500 } });
    expect(values(form)['discount']).toBeNull();
    form.setValue('total', 1700);
    expect(values(form)['discount']).toBeNull();
  });

  it('leaves alone a condition that already held in the record as loaded', async () => {
    const source = createMemoryDataSource({ records: { 'sale.order': { 1: { total: 1500, discount: 0 } } } });
    const form = createForm({ page: page(discountFields), dataSource: source, recordId: 1 });
    await form.load();
    expect(values(form)['discount']).toBe(0);
    form.setValue('total', 1800);
    expect(values(form)['discount']).toBe(0);
    form.setValue('total', 100);
    form.setValue('total', 1100);
    expect(values(form)['discount']).toBe(10);
  });

  it('works out the value from the record as it is when the condition starts to hold', () => {
    const form = createForm({
      page: page({ total: { type: 'float', label: 'Total' }, discount: { type: 'float', label: 'Discount', setWhen: [{ when: 'total > 1000', value: 'round(total * 0.05, 2)' }] } }),
    });
    form.setValue('total', 1234.5);
    expect(values(form)['discount']).toBe(61.73);
  });

  it('takes the rules in order: when two start together, the later one’s value stays', () => {
    const form = createForm({
      page: page({
        qty: { type: 'integer', label: 'Qty' },
        kind: { type: 'char', label: 'Kind', setWhen: [{ when: 'qty > 10', value: "'bulk'" }, { when: 'qty > 100', value: "'pallet'" }] },
      }),
    });
    form.setValue('qty', 150);
    expect(values(form)['kind']).toBe('pallet');
    form.setValue('qty', 50);
    expect(values(form)['kind']).toBe('pallet');
    form.setValue('qty', 5);
    form.setValue('qty', 20);
    expect(values(form)['kind']).toBe('bulk');
  });

  it('follows on: a worked-out total starts a condition, and what it sets is worked out from in turn', () => {
    const form = createForm({
      page: page({
        lines: {
          type: 'one2many',
          label: 'Lines',
          relation: 'line',
          fields: { qty: { type: 'float', label: 'Qty' }, price: { type: 'float', label: 'Price' }, subtotal: { type: 'float', label: 'Subtotal', compute: 'qty * price' } },
        },
        total: { type: 'float', label: 'Total', compute: "sum(lines, 'subtotal')" },
        discount: { type: 'float', label: 'Discount %', default: 0, setWhen: [{ when: 'total > 1000', value: '10' }] },
        due: { type: 'float', label: 'Due', compute: 'total - total * discount / 100' },
        vip: { type: 'boolean', label: 'VIP', setWhen: [{ when: 'discount >= 10', value: 'True' }] },
      }),
    });
    const key = form.addLine('lines', { qty: 2, price: 400 });
    expect(values(form)).toMatchObject({ total: 800, discount: 0, due: 800, vip: false });
    form.updateLine('lines', key, 'qty', 3);
    expect(values(form)).toMatchObject({ total: 1200, discount: 10, due: 1080, vip: true });
  });

  it('sets a line’s field when its condition starts to hold in that line, a new line included', () => {
    const form = createForm({
      page: page({
        lines: {
          type: 'one2many',
          label: 'Lines',
          relation: 'line',
          fields: { qty: { type: 'integer', label: 'Qty' }, pallet: { type: 'boolean', label: 'Pallet', setWhen: [{ when: 'qty >= 10', value: 'True' }] } },
        },
      }),
    });
    const small = form.addLine('lines', { qty: 2 });
    const big = form.addLine('lines', { qty: 12 });
    const lines = () => values(form)['lines'] as Line[];
    expect(lines().map((l) => l.values['pallet'])).toEqual([false, true]);
    form.updateLine('lines', big, 'pallet', false);
    form.updateLine('lines', big, 'qty', 20);
    form.updateLine('lines', small, 'qty', 10);
    expect(lines().map((l) => l.values['pallet'])).toEqual([true, false]);
  });

  it('sets nothing in a section or a note', () => {
    const form = createForm({
      page: page({
        lines: {
          type: 'one2many',
          label: 'Lines',
          relation: 'line',
          lineKinds: { field: 'kind', text: 'name' },
          fields: {
            kind: { type: 'char', label: 'Kind' },
            name: { type: 'char', label: 'Name' },
            qty: { type: 'integer', label: 'Qty', setWhen: [{ when: 'not qty', value: '1' }] },
          },
        },
      }),
    });
    form.addLine('lines', { kind: 'section', name: 'Chairs' });
    form.addLine('lines', {});
    expect((values(form)['lines'] as Line[]).map((l) => l.values['qty'])).toEqual([null, 1]);
  });

  it('starts again from the values as they are after a reset', () => {
    const form = createForm({ page: page(discountFields), values: { total: 2000 } });
    form.setValue('total', 10);
    form.reset();
    form.setValue('total', 1900);
    expect(values(form)['discount']).toBeNull();
  });

  it('takes a restored draft as it was left, without setting anything over it', () => {
    const items = new Map<string, string>();
    const store: DraftStore = { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v), removeItem: (k) => void items.delete(k) };
    items.set('fieldia:draft:set-when:new', JSON.stringify({ savedAt: '2026-10-04T10:00:00Z', values: { total: 1500, discount: 0 } }));
    const form = createForm({ page: page(discountFields), drafts: { store } });
    form.restoreDraft();
    expect(values(form)).toMatchObject({ total: 1500, discount: 0 });
    form.setValue('total', 1600);
    expect(values(form)['discount']).toBe(0);
  });

  it('sets values the server’s onchange brings about', async () => {
    const source = createMemoryDataSource({
      records: { 'sale.order': { 1: { total: 100, discount: 0, qty: 1 } } },
      onchange: { 'sale.order': { qty: (v) => ({ total: Number(v['qty']) * 600 }) } },
    });
    const form = createForm({ page: page({ ...discountFields, qty: { type: 'integer', label: 'Qty' } }), dataSource: source, recordId: 1 });
    await form.load();
    form.setValue('qty', 2);
    await form.settled();
    expect(values(form)).toMatchObject({ total: 1200, discount: 10 });
  });
});

describe('setWhen with on — set when a field changes, as Flectra’s onchange', () => {
  // Flectra: @api.onchange('certification') — ticked, scoring becomes "Scoring without answers".
  const survey = {
    certification: { type: 'boolean', label: 'Certification' },
    other: { type: 'char', label: 'Other' },
    scoring_type: {
      type: 'selection',
      label: 'Scoring',
      options: [{ value: 'none', label: 'No scoring' }, { value: 'without', label: 'Scoring without answers' }],
      setWhen: [{ on: ['certification'], when: 'certification', value: "'without'" }],
    },
    // With no condition: every change of the price sets the margin again.
    price: { type: 'float', label: 'Price' },
    margin: { type: 'float', label: 'Margin', setWhen: [{ on: ['price'], value: 'price * 0.2' }] },
  };

  it('sets the value when a field it is on changes and its condition holds, and only then', () => {
    const form = createForm({ page: page(survey), values: { scoring_type: 'none' } });
    form.setValue('certification', true);
    expect(values(form)['scoring_type']).toBe('without');
    // Changed by hand while it stays ticked: kept, whatever else changes.
    form.setValue('scoring_type', 'none');
    form.setValue('other', 'x');
    expect(values(form)['scoring_type']).toBe('none');
    // Unticked, nothing is set; ticked again, it is.
    form.setValue('certification', false);
    expect(values(form)['scoring_type']).toBe('none');
    form.setValue('certification', true);
    expect(values(form)['scoring_type']).toBe('without');
  });

  it('never acts while a field it is on keeps its value, even as its condition starts to hold', () => {
    const fields = {
      a: { type: 'integer', label: 'A' },
      b: { type: 'integer', label: 'B' },
      c: { type: 'integer', label: 'C', setWhen: [{ on: ['a'], when: 'b > 1', value: '7' }] },
    };
    const form = createForm({ page: page(fields), values: { a: 1, b: 0 } });
    form.setValue('b', 5);
    expect(values(form)['c']).toBeNull();
    form.setValue('a', 2);
    expect(values(form)['c']).toBe(7);
  });

  it('with no condition, sets it at each change, and leaves alone what the form started with', () => {
    const form = createForm({ page: page(survey), values: { price: 100, margin: 3 } });
    expect(values(form)['margin']).toBe(3);
    form.setValue('price', 200);
    expect(values(form)['margin']).toBe(40);
    form.setValue('margin', 1);
    form.setValue('price', 300);
    expect(values(form)['margin']).toBe(60);
  });

  it('is checked: the fields it is on are fields where it is', async () => {
    const { validatePage } = await import('../format/validate');
    const wrong = page({ a: { type: 'integer', label: 'A', setWhen: [{ on: ['nope'], value: '1' }] } });
    const result = validatePage(wrong);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('fields.a.setWhen[0].on[0]');
    expect(validatePage(page({ a: { type: 'integer', label: 'A', setWhen: [{ value: '1' }] } })).ok).toBe(false);
  });
});
