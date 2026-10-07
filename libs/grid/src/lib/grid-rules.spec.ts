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
