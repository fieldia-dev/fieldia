import { createForm, createMemoryDataSource, type Field, type FieldNode, type Line, type Page } from '@fieldia/core';
// The widgets first: lines.ts and widgets.ts import each other, and the table is found among the widgets once both are in.
import { createWidget } from './widgets';
import { columnTotal, itemNumber } from './lines';
import { WIDGET_LABELS } from './labels';
import { linesPart } from './widget-parts';

/**
 * Lines are counted as people count them: the items, never the headings and
 * notes between them. And a number a line works out from a cell that does not
 * read waits for it, as the totals do: a dash, said in words.
 */

const isItem = (line: Line) => line.values['kind'] !== 'section' && line.values['kind'] !== 'note';
const lines = (...rows: (number | string | null)[]): Line[] =>
  rows.map((row, i): Line => ({ key: `l${i}`, values: typeof row === 'string' && row.startsWith('#') ? { kind: 'section', name: row.slice(1) } : { kind: null, qty: row } }));

describe('a line’s number', () => {
  it('is its place among the items: a heading or a note before it is no line', () => {
    const order = lines('#Workstations', 12, 6, '#Lighting', 12);
    expect(['l1', 'l2', 'l4'].map((key) => itemNumber(order, key, isItem))).toEqual([1, 2, 3]);
    expect(itemNumber(order, 'l0', isItem)).toBe(0);
  });

  it('is what a waiting total names', () => {
    expect(columnTotal(lines('#Workstations', 'abc', 6), 'qty', isItem, () => false)).toEqual({ waits: 1 });
    expect(columnTotal(lines('#Workstations', 12, '#Lighting', 'x'), 'qty', isItem, () => false)).toEqual({ waits: 2 });
  });
});

describe('a table of lines with a heading and a worked-out subtotal', () => {
  const page = {
    fieldia: '0.2',
    id: 'order',
    data: { kind: 'record', model: 'order' },
    fields: {
      line_ids: {
        type: 'one2many',
        label: 'Order lines',
        relation: 'order.line',
        lineKinds: { field: 'kind', text: 'name' },
        fields: {
          kind: { type: 'selection', label: 'Kind', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
          name: { type: 'char', label: 'Item' },
          qty: { type: 'float', label: 'Quantity' },
          price: { type: 'float', label: 'Price' },
          subtotal: { type: 'float', label: 'Subtotal', compute: 'qty * price' },
        },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'line_ids', columns: ['name', 'qty', 'price', 'subtotal'], totals: ['qty', 'subtotal'], options: { confirmDelete: true } }] },
  } as unknown as Page;

  async function mount() {
    await linesPart.load();
    const form = createForm({ page, dataSource: createMemoryDataSource({}) });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'line_ids', field: page.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en, locale: 'en' });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    form.addLine('line_ids', { kind: 'section', name: 'Workstations' });
    form.addLine('line_ids', { name: 'Office chair', qty: 12, price: 10 });
    form.addLine('line_ids', { name: 'Desk', qty: 2, price: 100 });
    return { form, el: widget.element };
  }
  const row = (el: Element, n: number) => el.querySelectorAll('tbody tr')[n] as HTMLElement;
  const foot = (el: Element, column: string) => el.querySelector(`tfoot td[data-column="${column}"]`) as HTMLElement;

  it('makes the line’s Subtotal and both totals wait while its Quantity does not read, naming line 1', async () => {
    const { el } = await mount();
    const chair = row(el, 1);
    expect(foot(el, 'subtotal').textContent).toBe('320.00');
    const qty = chair.querySelector('td[data-column="qty"] input') as HTMLInputElement;
    qty.focus();
    qty.value = '1 2';
    qty.dispatchEvent(new Event('input', { bubbles: true }));
    qty.blur();
    const waiting = chair.querySelector('td[data-column="subtotal"] .fd-cell-waits') as HTMLElement;
    expect(waiting?.title).toBe('Fix Quantity to see this line’s Subtotal');
    expect(waiting.querySelector('[aria-hidden="true"]')?.textContent).toBe('—');
    expect((chair.querySelector('td[data-column="subtotal"] input') as HTMLElement).hidden).toBe(true);
    expect(foot(el, 'qty').title).toBe('Fix line 1 to see this total');
    expect(foot(el, 'subtotal').title).toBe('Fix line 1 to see this total');
    // The desk, line 2, keeps its own.
    expect(row(el, 2).querySelector('td[data-column="subtotal"] .fd-cell-waits')).toBeNull();
    // Put right, the numbers come back.
    qty.focus();
    qty.value = '3';
    qty.dispatchEvent(new Event('input', { bubbles: true }));
    qty.blur();
    expect(chair.querySelector('td[data-column="subtotal"] .fd-cell-waits')).toBeNull();
    expect(foot(el, 'subtotal').textContent).toBe('230.00');
  });
});
