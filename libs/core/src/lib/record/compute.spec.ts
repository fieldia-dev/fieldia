import type { Field } from '../format/field';
import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { Line } from './values';

/**
 * Values worked out from others (`compute`): on load, and whenever a field
 * they read changes, in the order they depend on each other — inside lines
 * too. A worked-out field is read-only, and saved like any other.
 */

const page = (fields: Record<string, unknown>, extra: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.1',
    id: 'compute',
    data: { kind: 'record', model: 'sale.order' },
    fields,
    layout: {
      type: 'sections',
      id: 'root',
      children: Object.keys(fields).map((name) => ({ type: 'field', id: `n_${name}`, field: name })),
    },
    ...extra,
  }) as Page;

const lineFields = {
  name: { type: 'char', label: 'Description' },
  kind: { type: 'selection', label: 'Kind', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
  qty: { type: 'float', label: 'Quantity' },
  price: { type: 'float', label: 'Price' },
  subtotal: { type: 'float', label: 'Subtotal', compute: 'qty * price' },
};

const orderFields = {
  lines: { type: 'one2many', label: 'Lines', relation: 'sale.order.line', fields: lineFields, lineKinds: { field: 'kind', text: 'name' } },
  total: { type: 'float', label: 'Total', compute: "sum(lines, 'subtotal')" },
  count: { type: 'integer', label: 'Items', compute: 'count(lines)' },
};

const lines = (form: { getState(): { values: Record<string, unknown> } }) => form.getState().values['lines'] as Line[];

describe('compute — values worked out from others', () => {
  it('works them out from the starting values', () => {
    const form = createForm({
      page: page({ price: { type: 'float', label: 'Price', default: 10 }, qty: { type: 'integer', label: 'Qty' }, total: { type: 'float', label: 'Total', compute: 'price * qty' } }),
      values: { qty: 3 },
    });
    expect(form.getState().values['total']).toBe(30);
  });

  it('works them out again whenever a field they read changes', () => {
    const form = createForm({ page: page({ price: { type: 'float', label: 'Price' }, qty: { type: 'integer', label: 'Qty' }, total: { type: 'float', label: 'Total', compute: 'price * qty' } }) });
    expect(form.getState().values['total']).toBeNull();
    form.setValue('price', 2.5);
    expect(form.getState().values['total']).toBeNull();
    form.setValue('qty', 4);
    expect(form.getState().values['total']).toBe(10);
    expect(form.getState().dirty).toEqual(expect.arrayContaining(['qty', 'price', 'total']));
  });

  it('says at once that typed words are not a number, and works out nothing from them rather than NaN', () => {
    const form = createForm({ page: page({ price: { type: 'float', label: 'Price' }, qty: { type: 'float', label: 'Quantity' }, total: { type: 'float', label: 'Total', compute: 'price * qty' } }) });
    form.setValue('price', 2.5);
    form.setValue('qty', 4);
    expect(form.getState().errors).toEqual({});
    // "4.00" with more typed at its end: two decimal marks, no number.
    form.setValue('qty', '4.001234567.5');
    expect(form.getState().errors).toEqual({ qty: 'Quantity must be a number' });
    expect(form.getState().values['total']).toBeNull();
    // Put right, the error goes and the total comes back.
    form.setValue('qty', 4.5);
    expect(form.getState().errors).toEqual({});
    expect(form.getState().values['total']).toBe(11.25);
  });

  it('says at once that words in a line’s number cell are not a number, and works out nothing from them', () => {
    const form = createForm({ page: page(orderFields) });
    const key = form.addLine('lines', { name: 'Desk', qty: 2, price: 10 });
    expect(form.getState().values['total']).toBe(20);
    form.updateLine('lines', key, 'qty', '2.00.5');
    expect(form.getState().errors).toEqual({ [`lines.${key}.qty`]: 'Quantity must be a number' });
    expect(form.getState().values['total']).toBe(0);
    form.updateLine('lines', key, 'qty', 3);
    expect(form.getState().errors).toEqual({});
    expect(form.getState().values['total']).toBe(30);
  });

  it('works out each after the values it reads, whatever order the page lists them in', () => {
    const form = createForm({
      page: page({
        grand: { type: 'float', label: 'Grand total', compute: 'total + tax' },
        tax: { type: 'float', label: 'Tax', compute: 'round(total * 0.14, 2)' },
        total: { type: 'float', label: 'Total', compute: 'price * qty' },
        price: { type: 'float', label: 'Price' },
        qty: { type: 'integer', label: 'Qty' },
      }),
    });
    form.setValue('price', 100);
    form.setValue('qty', 3);
    expect(form.getState().values).toMatchObject({ total: 300, tax: 42, grand: 342 });
  });

  it('keeps the expression’s value even when something writes over it', () => {
    const form = createForm({ page: page({ a: { type: 'integer', label: 'A' }, b: { type: 'integer', label: 'B', compute: 'a * 2' } }) });
    form.setValue('a', 2);
    form.setValue('b', 99);
    expect(form.getState().values['b']).toBe(4);
  });

  it('fits the value to its field: whole numbers, the field’s decimals, text, yes or no', () => {
    const form = createForm({
      page: page({
        a: { type: 'float', label: 'A' },
        whole: { type: 'integer', label: 'Whole', compute: 'a / 3' },
        cents: { type: 'monetary', label: 'Cents', digits: [12, 2], compute: 'a / 3' },
        loose: { type: 'float', label: 'Loose', compute: 'a / 4' },
        words: { type: 'char', label: 'Words', compute: 'a * 2' },
        big: { type: 'boolean', label: 'Big', compute: 'a > 5' },
        day: { type: 'date', label: 'Day', compute: 'a' },
        tags: { type: 'many2many', label: 'Tags', relation: 'tag' },
        tagged: { type: 'boolean', label: 'Tagged', compute: 'tags' },
        any: { type: 'json', label: 'Any', compute: '[1, 2]' },
      }),
    });
    form.setValue('a', 10);
    expect(form.getState().values).toMatchObject({ whole: 3, cents: 3.33, loose: 2.5, words: '20', big: true, day: null, any: [1, 2], tagged: false });
    form.setValue('a', null);
    expect(form.getState().values).toMatchObject({ whole: null, cents: null, loose: null, words: null, big: false, day: null });
  });

  it('shows a worked-out field read-only', () => {
    const form = createForm({ page: page({ a: { type: 'integer', label: 'A' }, b: { type: 'integer', label: 'B', compute: 'a * 2' } }) });
    expect(form.node('n_b').readonly).toBe(true);
    expect(form.fieldReadonly('b')).toBe(true);
    expect(form.node('n_a').readonly).toBe(false);
    expect(form.fieldReadonly('a')).toBe(false);
  });

  it('works out today’s date from the clock the form is given', () => {
    const form = createForm({
      page: page({ due: { type: 'date', label: 'Due', compute: 'today()' } }),
      now: () => new Date(2031, 1, 3, 23, 30),
    });
    expect(form.getState().values['due']).toBe('2031-02-03');
  });
});

describe('compute — inside lines, and sums over them', () => {
  it('works out a line’s field from that line’s fields, and the page’s sums from the lines', () => {
    const form = createForm({ page: page(orderFields) });
    const first = form.addLine('lines', { qty: 2, price: 3 });
    expect(lines(form)[0].values['subtotal']).toBe(6);
    expect(form.getState().values).toMatchObject({ total: 6, count: 1 });
    const second = form.addLine('lines', { qty: 1, price: 0.1 });
    form.updateLine('lines', second, 'qty', 3);
    expect(lines(form)[1].values['subtotal']).toBe(0.3);
    expect(form.getState().values).toMatchObject({ total: 6.3, count: 2 });
    form.removeLine('lines', first);
    expect(form.getState().values).toMatchObject({ total: 0.3, count: 1 });
  });

  it('leaves sections and notes alone, and does not count them', () => {
    const form = createForm({ page: page(orderFields) });
    form.addLine('lines', { kind: 'section', name: 'Chairs' });
    form.addLine('lines', { qty: 2, price: 5 });
    expect(lines(form)[0].values['subtotal']).toBeNull();
    expect(form.getState().values).toMatchObject({ total: 10, count: 1 });
  });

  it('works out nothing in a section or a note, even what needs no values', () => {
    const form = createForm({ page: page({ lines: { ...orderFields.lines, fields: { ...lineFields, mark: { type: 'char', label: 'Mark', compute: "'item'" } } } }) });
    form.addLine('lines', { kind: 'note', name: 'Fragile' });
    form.addLine('lines', { qty: 1 });
    expect(lines(form).map((l) => l.values['mark'])).toEqual([null, 'item']);
  });

  it('lets a condition add up the lines too', () => {
    const p = page(orderFields);
    (p.layout as { children: { invisible?: string }[] }).children[0].invisible = "sum(lines, 'subtotal') > 100";
    const form = createForm({ page: p });
    form.addLine('lines', { qty: 1, price: 50 });
    expect(form.node('n_lines').invisible).toBe(false);
    form.addLine('lines', { qty: 1, price: 60 });
    expect(form.node('n_lines').invisible).toBe(true);
  });

  it('leaves the lines as they were when nothing in them changed', () => {
    const form = createForm({ page: page({ ...orderFields, note: { type: 'char', label: 'Note' } }) });
    form.addLine('lines', { qty: 2, price: 3 });
    const before = lines(form);
    form.setValue('note', 'Deliver on Sunday');
    expect(lines(form)).toBe(before);
  });

  it('works out a line edited in a dialog before it is written', async () => {
    const form = createForm({ page: page(orderFields) });
    const key = form.addLine('lines', { qty: 1, price: 4 });
    expect(await form.previewLine('lines', key, { qty: 5 })).toMatchObject({ qty: 5, price: 4, subtotal: 20 });
    expect(lines(form)[0].values['subtotal']).toBe(4);
  });
});

describe('compute — a stored record', () => {
  const fields = {
    price: { type: 'float', label: 'Price' },
    qty: { type: 'integer', label: 'Qty' },
    total: { type: 'float', label: 'Total', compute: 'price * qty' },
  } satisfies Record<string, Field | Record<string, unknown>>;

  it('works them out on load, without calling the record changed', async () => {
    const source = createMemoryDataSource({ records: { 'sale.order': { 1: { price: 5, qty: 2, total: 999 } } } });
    const form = createForm({ page: page(fields), dataSource: source, recordId: 1 });
    await form.load();
    expect(form.getState().values['total']).toBe(10);
    expect(form.getState().dirty).toEqual([]);
  });

  it('saves a worked-out value like any other', async () => {
    const source = createMemoryDataSource({ records: { 'sale.order': { 1: { price: 5, qty: 2, total: 10 } } } });
    const form = createForm({ page: page(fields), dataSource: source, recordId: 1 });
    await form.load();
    form.setValue('qty', 3);
    expect(form.changes().values).toEqual({ qty: 3, total: 15 });
    expect(await form.save()).toBe(true);
    expect(source.records['sale.order']['1']).toMatchObject({ qty: 3, total: 15 });
  });

  it('works them out again from what the server’s onchange sends back', async () => {
    const source = createMemoryDataSource({
      records: { 'sale.order': { 1: { price: 5, qty: 2, total: 10 } } },
      onchange: { 'sale.order': { qty: () => ({ price: 7 }) } },
    });
    const form = createForm({ page: page(fields), dataSource: source, recordId: 1 });
    await form.load();
    form.setValue('qty', 3);
    await form.settled();
    expect(form.getState().values).toMatchObject({ price: 7, qty: 3, total: 21 });
  });

  it('sends a survey’s worked-out answers with the others', async () => {
    const source = createMemoryDataSource();
    const form = createForm({ page: page(fields, { data: { kind: 'responses' } }), dataSource: source });
    form.setValue('price', 2);
    form.setValue('qty', 4);
    expect(await form.save()).toBe(true);
    expect(source.responses[0].values).toMatchObject({ price: 2, qty: 4, total: 8 });
  });
});
