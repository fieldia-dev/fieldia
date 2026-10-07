import type { ActionRequest, Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridApiOf, gridWidgets } from './grid';

/** The grid drawn by a table's own rules: cells by their line, columns by the record, tones, a badge and row buttons. */
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
        status: { type: 'selection', label: 'Line status', options: [{ value: 'wait', label: 'Waiting' }, { value: 'ok', label: 'Available' }] },
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
        widget: 'grid',
        columns: ['product', 'demand', 'quantity', 'lot', 'status'],
        cells: {
          product: { readonly: "parent.state != 'draft'" },
          quantity: { hidden: "state == 'draft'", tones: [{ tone: 'danger', when: 'quantity > demand' }], bold: 'quantity > 0' },
          lot: { invisible: "tracking == 'none'" },
          status: { badge: true, tones: [{ tone: 'success', when: "status == 'ok'" }, { tone: 'warning', when: "status == 'wait'" }] },
        },
        rowTones: [{ tone: 'muted', when: 'scrapped' }],
        rowButtons: [{ type: 'button', id: 'serials', label: 'Serials', invisible: "tracking == 'none'", action: 'action_assign_serial' }],
      },
    ],
  },
} as unknown as Page;

const moves = [
  { key: 'a', values: { product: 'Beech planks', demand: 60, quantity: 60, tracking: 'none', lot: 'L-1', status: 'ok', scrapped: false } },
  { key: 'b', values: { product: 'MDF board', demand: 25, quantity: 30, tracking: 'lot', lot: null, status: 'wait', scrapped: true } },
];

let handle: ViewerHandle | null = null;
const frames = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(state: string, asked: ActionRequest[] = []) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: transfer, widgets: gridWidgets, values: { state, move_ids: moves } as never, onAction: (request) => void asked.push(request) });
  await frames();
  const grid = host.querySelector('[data-node="f-moves"] .fd-grid-lines') as HTMLElement;
  return { host, grid, api: gridApiOf(grid)! };
}
/** Lines a and b are the grid's rows 0 and 1. */
const at = (key: string) => moves.findIndex((move) => move.key === key);
const cell = (grid: Element, key: string, column: string) => grid.querySelector(`.ag-row[row-index="${at(key)}"] .ag-cell[col-id="${column}"]`) as HTMLElement;
const row = (grid: Element, key: string) => grid.querySelector(`.ag-row[row-index="${at(key)}"]`) as HTMLElement;
const rowCells = (grid: Element, key: string) => [...grid.querySelectorAll(`.ag-row[row-index="${at(key)}"]`)] as HTMLElement[];

describe('the grid by a table’s own rules', () => {
  it('hides a column by the record, and shows it once the record says', async () => {
    const { api } = await mount('draft');
    expect(api.getColumn('quantity')?.isVisible()).toBe(false);
    handle!.form.setValue('state', 'assigned');
    await frames();
    expect(api.getColumn('quantity')?.isVisible()).toBe(true);
  });

  it('hides a column from people without its roles, as Flectra’s groups= on a column', async () => {
    const page = JSON.parse(JSON.stringify(transfer));
    page.layout.children[1].cells.demand = { roles: ['stock.group_stock_manager'] };
    const show = async (roles: string[]) => {
      handle?.destroy();
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      handle = mountViewer(host, { page, widgets: gridWidgets, values: { state: 'assigned', move_ids: moves } as never, user: { id: 1, roles } });
      await frames();
      return gridApiOf(host.querySelector('[data-node="f-moves"] .fd-grid-lines') as HTMLElement)!;
    };
    expect((await show([])).getColumn('demand')?.isVisible()).toBe(false);
    expect((await show(['stock.group_stock_manager'])).getColumn('demand')?.isVisible()).toBe(true);
  });

  it('hides the × of a line its table keeps (lineDelete), and refuses its Enter too', async () => {
    const page = JSON.parse(JSON.stringify(transfer));
    page.layout.children[1].lineDelete = "parent.state == 'draft' or scrapped";
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    handle = mountViewer(host, { page, widgets: gridWidgets, values: { state: 'assigned', move_ids: moves } as never });
    await frames();
    const grid = host.querySelector('[data-node="f-moves"] .fd-grid-lines') as HTMLElement;
    const cross = (key: string) => cell(grid, key, '__delete').querySelector('.fd-line-delete') as HTMLButtonElement;
    expect(cross('a').hidden).toBe(true);
    expect(cross('b').hidden).toBe(false);
    const api = gridApiOf(grid)!;
    api.setFocusedCell(0, '__delete');
    (grid.querySelector('.ag-row[row-index="0"] .ag-cell[col-id="__delete"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect((handle.form.getState().values['move_ids'] as unknown[]).length).toBe(2);
    handle.form.setValue('state', 'draft');
    // The lines are drawn again on a frame of AG Grid's own: wait for the button to be back.
    for (let tries = 0; tries < 40 && !cross('a'); tries++) await frames();
    expect(cross('a').hidden).toBe(false);
  });

  it('shows the lines in the table’s order of their fields, the plain table too', async () => {
    const page = JSON.parse(JSON.stringify(transfer));
    page.layout.children[1].order = [{ field: 'scrapped', desc: true }, { field: 'product' }];
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    handle = mountViewer(host, { page, widgets: gridWidgets, values: { state: 'assigned', move_ids: moves } as never });
    await frames();
    const api = gridApiOf(host.querySelector('[data-node="f-moves"] .fd-grid-lines') as HTMLElement)!;
    const shown: string[] = [];
    api.forEachNodeAfterFilterAndSort((row) => shown.push(row.data!.key));
    expect(shown).toEqual(['b', 'a']);
    handle.destroy();
    delete page.layout.children[1].widget;
    handle = mountViewer(host, { page, values: { state: 'assigned', move_ids: moves } as never });
    expect([...host.querySelectorAll<HTMLElement>('tbody tr[data-line]')].map((tr) => tr.dataset['line'])).toEqual(['b', 'a']);
  });

  it('locks a cell by its line and its record, again when the record changes', async () => {
    const { api } = await mount('draft');
    const editable = (key: string, column: string) => api.getColumn(column)!.isCellEditable(api.getRowNode(key)!);
    expect(editable('a', 'product')).toBe(true);
    handle!.form.setValue('state', 'assigned');
    await frames();
    expect(editable('a', 'product')).toBe(false);
    // A cell its line hides is blank and not edited.
    expect(editable('a', 'lot')).toBe(false);
    expect(editable('b', 'lot')).toBe(true);
  });

  it('draws a hidden cell blank, tones and bolds cells and lines, and a choice as a toned badge', async () => {
    const { grid } = await mount('assigned');
    expect(cell(grid, 'a', 'lot').textContent).toBe('');
    expect(cell(grid, 'b', 'quantity').classList).toContain('fd-tone-danger');
    expect(cell(grid, 'b', 'quantity').classList).toContain('fd-cell-bold');
    expect(row(grid, 'b').classList).toContain('fd-tone-muted');
    expect(row(grid, 'a').classList).not.toContain('fd-tone-muted');
    const badge = cell(grid, 'a', 'status').querySelector('.fd-grid-badge') as HTMLElement;
    expect([badge.textContent, badge.dataset['tone']]).toEqual(['Available', 'success']);
  });

  it('draws a line’s buttons by its own condition, and presses them with the line', async () => {
    const asked: ActionRequest[] = [];
    const { grid } = await mount('assigned', asked);
    const serials = (key: string) => rowCells(grid, key).flatMap((r) => [...r.querySelectorAll<HTMLButtonElement>('[data-row-button="serials"]')]).filter((b) => !b.hidden);
    expect(serials('a')).toHaveLength(0);
    expect(serials('b')).toHaveLength(1);
    serials('b')[0].click();
    await frames();
    expect(asked[0]).toMatchObject({ action: 'action_assign_serial', line: { key: 'b' } });
  });
});

describe('the grid on a page that reads right to left', () => {
  it('runs its columns from the right, as the page does', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: transfer, widgets: gridWidgets, locale: 'ar', values: { state: 'assigned', move_ids: moves } as never });
    await frames();
    expect(host.querySelector('[data-node="f-moves"] .ag-rtl')).not.toBeNull();
    expect(host.querySelector('[data-node="f-moves"] .ag-ltr')).toBeNull();
  });
});

describe('the grid’s money in its record’s currency', () => {
  const order = {
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: {
      currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
      line_ids: {
        type: 'one2many',
        label: 'Lines',
        relation: 'sale.order.line',
        fields: { name: { type: 'char', label: 'Description' }, price: { type: 'monetary', label: 'Price', currencyField: 'parent.currency_id' } },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'line_ids', widget: 'grid', totals: ['price'] }] },
  } as unknown as Page;

  it('writes each line’s amount and the total in the record’s currency, and follows it', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: order, widgets: gridWidgets, values: { currency_id: { id: 1, label: 'EUR' }, line_ids: [{ key: 'a', values: { name: 'Desk', price: 1200 } }] } as never });
    await frames();
    const grid = host.querySelector('.fd-grid-lines') as HTMLElement;
    // The line's cell, then the total's under it.
    const prices = () => [...grid.querySelectorAll('.ag-cell[col-id="price"]')].map((c) => c.textContent);
    expect(prices()).toEqual(['€1,200.00', '€1,200.00']);
    handle.form.setValue('currency_id', { id: 2, label: 'USD' });
    await frames();
    expect(prices()).toEqual(['$1,200.00', '$1,200.00']);
    // Opened in its dialog, which has no record round it, the line's money keeps the record's currency.
    (grid.querySelector('button[aria-label="Open line"]') as HTMLButtonElement).click();
    await frames();
    expect(document.querySelector('.fd-form-dialog [data-node="values-price"] .fd-currency')?.textContent).toBe('$');
  });
});
