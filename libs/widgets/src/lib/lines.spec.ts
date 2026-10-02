import { createForm, createMemoryDataSource, type Field, type FieldNode, type Line, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

const page = {
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'order' },
  fields: {
    line_ids: {
      type: 'one2many',
      label: 'Order lines',
      relation: 'order.line',
      fields: {
        product_id: { type: 'many2one', label: 'Product', relation: 'product', required: true },
        quantity: { type: 'integer', label: 'Quantity', min: 1 },
        note: { type: 'char', label: 'Note' },
      },
    },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'line_ids', columns: ['product_id', 'quantity'] }] },
} as unknown as Page;

function mount(readonly = false) {
  const dataSource = createMemoryDataSource({ records: { product: { 1: { name: 'Green tea' }, 2: { name: 'Espresso' } } } });
  const form = createForm({ page, dataSource });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'line_ids', field: page.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

const lines = (form: ReturnType<typeof mount>['form']) => form.getState().values['line_ids'] as Line[];
const rows = (el: Element) => [...el.querySelectorAll('tbody tr')];
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('one2many lines', () => {
  it('shows the chosen columns as a table', () => {
    const { el } = mount();
    expect([...el.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Product', 'Quantity', '']);
  });

  it('adds a line and focuses its first cell', () => {
    const { form, el } = mount();
    (el.querySelector('.fd-lines-add') as HTMLButtonElement).click();
    expect(lines(form)).toHaveLength(1);
    expect(rows(el)).toHaveLength(1);
    expect(document.activeElement).toBe(rows(el)[0].querySelector('input'));
  });

  it('edits a cell into that line only', () => {
    const { form, el } = mount();
    form.addLine('line_ids', { quantity: 1 });
    form.addLine('line_ids', { quantity: 2 });
    const quantity = rows(el)[1].querySelectorAll('input')[1] as HTMLInputElement;
    type(quantity, '5');
    expect(lines(form).map((l) => l.values['quantity'])).toEqual([1, 5]);
  });

  it('keeps the other rows, and focus, when a line is added or removed', () => {
    const { form, el } = mount();
    form.addLine('line_ids');
    const first = rows(el)[0];
    const cell = first.querySelectorAll('input')[1] as HTMLInputElement;
    cell.focus();
    form.addLine('line_ids');
    expect(rows(el)[0]).toBe(first);
    expect(document.activeElement).toBe(cell);
    (rows(el)[1].querySelector('[aria-label="Delete line"]') as HTMLButtonElement).click();
    expect(rows(el)).toEqual([first]);
  });

  it('searches a relation inside a line', async () => {
    const { form, el } = mount();
    form.addLine('line_ids');
    const product = rows(el)[0].querySelector('input[role=combobox]') as HTMLInputElement;
    type(product, 'esp');
    await new Promise((resolve) => setTimeout(resolve, 260));
    product.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    product.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(lines(form)[0].values['product_id']).toEqual({ id: 2, label: 'Espresso' });
  });

  it('marks the cell a validation error belongs to', () => {
    const { form, el } = mount();
    form.addLine('line_ids', { quantity: 0 });
    form.validate();
    const cells = rows(el)[0].querySelectorAll('td');
    expect(cells[0].querySelector('.fd-cell-error')?.textContent).toBe('Product is required');
    expect(cells[1].querySelector('.fd-cell-error')?.textContent).toBe('Quantity must be at least 1');
    expect(cells[1].querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('names every cell for assistive technology', () => {
    const { form, el } = mount();
    form.addLine('line_ids');
    const quantity = rows(el)[0].querySelectorAll('input')[1] as HTMLInputElement;
    expect(el.querySelector(`label[for="${quantity.id}"]`)?.textContent).toBe('Quantity');
  });

  it('offers no add or delete when readonly', () => {
    const { form, el } = mount(true);
    form.addLine('line_ids', { quantity: 3 });
    expect((el.querySelector('.fd-lines-add') as HTMLButtonElement).hidden).toBe(true);
    expect(el.querySelector('[aria-label="Delete line"]')).toBeNull();
    expect((rows(el)[0].querySelectorAll('input')[1] as HTMLInputElement).readOnly).toBe(true);
  });
});
