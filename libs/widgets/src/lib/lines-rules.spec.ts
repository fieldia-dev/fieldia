import { createForm, type ActionRequest, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

/** A plain table drawn by its own rules: cells by their line, columns by the record, tones, bold and row buttons. */
const transfer = {
  fieldia: '0.1',
  id: 'transfer',
  data: { kind: 'record', model: 'stock.picking' },
  fields: {
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'assigned', label: 'Ready' }] },
    move_ids: {
      type: 'one2many',
      label: 'Operations',
      relation: 'stock.move',
      fields: {
        product: { type: 'char', label: 'Product' },
        demand: { type: 'float', label: 'Demand' },
        quantity: { type: 'float', label: 'Quantity' },
        tracking: { type: 'char', label: 'Tracking' },
        lot: { type: 'char', label: 'Lot' },
        scrapped: { type: 'boolean', label: 'Scrapped' },
      },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-state', field: 'state' },
      {
        type: 'field',
        id: 'f-moves',
        field: 'move_ids',
        columns: ['product', 'demand', 'quantity', 'lot'],
        totals: ['quantity'],
        cells: {
          product: { readonly: "parent.state != 'draft'", width: 24 },
          quantity: { hidden: "state == 'draft'", tones: [{ tone: 'danger', when: 'quantity > demand' }], bold: 'quantity > 0' },
          lot: { invisible: "tracking == 'none'", required: "tracking == 'lot'" },
        },
        rowTones: [{ tone: 'muted', when: 'scrapped' }],
        rowButtons: [{ type: 'button', id: 'serials', label: 'Serials', icon: 'list', invisible: "tracking == 'none'", steps: [{ do: 'call', action: 'action_assign_serial' }] }],
      },
    ],
  },
} as unknown as Page;

const moves = [
  { key: 'a', values: { product: 'Beech planks', demand: 60, quantity: 60, tracking: 'none', lot: null, scrapped: false } },
  { key: 'b', values: { product: 'MDF board', demand: 25, quantity: 30, tracking: 'lot', lot: null, scrapped: true } },
];

function mount(state: string, asked: ActionRequest[] = [], readonly = false) {
  const form = createForm({ page: transfer, values: { state, move_ids: moves } as never, onAction: (request) => void asked.push(request) });
  const node = (transfer.layout as { children: FieldNode[] }).children[1];
  const widget = createWidget({ form, name: 'move_ids', field: transfer.fields['move_ids'] as Field, node, id: 'fd-moves', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['move_ids'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

const heads = (el: Element) => [...el.querySelectorAll('thead th')].filter((th) => !(th as HTMLElement).hidden).map((th) => th.textContent);
const row = (el: Element, key: string) => el.querySelector(`tbody tr[data-line="${key}"]`) as HTMLTableRowElement;
const cell = (el: Element, key: string, column: string) => row(el, key).querySelector(`td[data-column="${column}"]`) as HTMLTableCellElement;

describe('a plain table by its own rules', () => {
  it('hides a column by the record, its head, cells and total with it, and shows it once the record says', () => {
    const { form, el } = mount('draft');
    expect(heads(el)).toEqual(['', 'Product', 'Demand', 'Lot', '']);
    expect(cell(el, 'a', 'quantity').hidden).toBe(true);
    expect((el.querySelector('tfoot td[data-column="quantity"]') as HTMLElement).hidden).toBe(true);
    form.setValue('state', 'assigned');
    expect(heads(el)).toEqual(['', 'Product', 'Demand', 'Quantity', 'Lot', '']);
    expect(cell(el, 'a', 'quantity').hidden).toBe(false);
  });

  it('hides a column from people without its roles, as Flectra’s groups= on a column', () => {
    const page = JSON.parse(JSON.stringify(transfer)) as Page;
    const ruled = (page.layout as { children: FieldNode[] }).children[1];
    ruled.cells!['demand'] = { roles: ['stock.group_stock_manager'] };
    const draw = (roles: string[]) => {
      const form = createForm({ page, values: { state: 'assigned', move_ids: moves } as never, user: { id: 1, roles } });
      const widget = createWidget({ form, name: 'move_ids', field: transfer.fields['move_ids'] as Field, node: ruled, id: 'fd-moves', document, labels: WIDGET_LABELS.en });
      widget.update({ value: form.getState().values['move_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
      return widget.element;
    };
    expect(heads(draw([]))).toEqual(['', 'Product', 'Quantity', 'Lot', '']);
    expect(cell(draw([]), 'a', 'demand').hidden).toBe(true);
    expect(heads(draw(['stock.group_stock_manager']))).toEqual(['', 'Product', 'Demand', 'Quantity', 'Lot', '']);
  });

  it('locks, blanks and requires each cell by its own line, with the record as parent', () => {
    const { form, el } = mount('draft');
    expect((cell(el, 'a', 'product').querySelector('input') as HTMLInputElement).readOnly).toBe(false);
    form.setValue('state', 'assigned');
    expect((cell(el, 'a', 'product').querySelector('input') as HTMLInputElement).readOnly).toBe(true);
    // Flectra keeps the cell, empty: the column lines up.
    expect(cell(el, 'a', 'lot').hidden).toBe(false);
    expect((cell(el, 'a', 'lot').querySelector('input') as HTMLElement).closest('[hidden]')).not.toBeNull();
    expect(cell(el, 'b', 'lot').querySelector('input')?.getAttribute('aria-required')).toBe('true');
  });

  it('tones a line and a cell, bolds a cell, and sets a column’s width', () => {
    const { el } = mount('assigned');
    expect(row(el, 'b').dataset['tone']).toBe('muted');
    expect(row(el, 'a').dataset['tone']).toBeUndefined();
    expect(cell(el, 'b', 'quantity').dataset['tone']).toBe('danger');
    expect(cell(el, 'b', 'quantity').classList.contains('fd-cell-bold')).toBe(true);
    expect((el.querySelector('thead th[data-column="product"]') as HTMLElement).style.width).toBe('24ch');
  });

  it('draws a line’s buttons by its own condition, and presses them with the line', async () => {
    const asked: ActionRequest[] = [];
    const { el } = mount('assigned', asked);
    const serials = (key: string) => row(el, key).querySelector('[data-row-button="serials"]') as HTMLButtonElement;
    expect(serials('a').hidden).toBe(true);
    expect(serials('b').hidden).toBe(false);
    expect(serials('b').getAttribute('aria-label')).toBe('Serials');
    serials('b').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked[0]).toMatchObject({ action: 'action_assign_serial', line: { key: 'b' } });
  });

  it('keeps a line’s buttons on a read-only table, as the grid and Flectra’s lists do: they act on the saved line', async () => {
    const asked: ActionRequest[] = [];
    const { el } = mount('assigned', asked, true);
    const serials = (key: string) => row(el, key).querySelector('[data-row-button="serials"]') as HTMLButtonElement;
    expect(serials('a').hidden).toBe(true);
    expect(serials('b').hidden).toBe(false);
    serials('b').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked[0]).toMatchObject({ action: 'action_assign_serial', line: { key: 'b' } });
  });
});

describe('a plain table’s badge cells', () => {
  const page = {
    fieldia: '0.1',
    id: 'contract',
    data: { kind: 'record', model: 'sale.contract' },
    fields: {
      milestone_ids: {
        type: 'one2many',
        label: 'Milestones',
        relation: 'sale.contract.milestone',
        fields: {
          name: { type: 'char', label: 'Milestone' },
          state: { type: 'selection', label: 'Status', options: [{ value: 'pending', label: 'Pending' }, { value: 'done', label: 'Done' }] },
        },
      },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [{ type: 'field', id: 'f-ms', field: 'milestone_ids', cells: { state: { badge: true, tones: [{ tone: 'success', when: "state == 'done'" }] } } }],
    },
  } as unknown as Page;

  it('draws a choice as a pill in its cell’s tone, and grey while none holds', () => {
    const form = createForm({ page, values: { milestone_ids: [{ key: 'a', values: { name: 'Design', state: 'done' } }, { key: 'b', values: { name: 'Build', state: 'pending' } }] } as never });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'milestone_ids', field: page.fields['milestone_ids'] as Field, node, id: 'fd-ms', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    widget.update({ value: form.getState().values['milestone_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    const pill = (key: string) => cell(widget.element, key, 'state').querySelector('.fd-value-badge') as HTMLElement;
    expect(pill('a').textContent).toBe('Done');
    expect(cell(widget.element, 'a', 'state').dataset['tone']).toBe('success');
    expect(pill('b').textContent).toBe('Pending');
    expect(cell(widget.element, 'b', 'state').dataset['tone']).toBeUndefined();
    expect(cell(widget.element, 'a', 'state').querySelector('select')).toBeNull();
  });
});
