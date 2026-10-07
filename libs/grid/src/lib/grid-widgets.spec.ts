import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridApiOf, gridWidgets } from './grid';

/** The grid with columns drawn by widgets of their own: hours as HH:MM, a share as a per cent, a progress bar. */
const page = {
  fieldia: '0.1',
  id: 'task',
  data: { kind: 'record', model: 'project.task' },
  fields: {
    child_ids: {
      type: 'one2many',
      label: 'Sub-tasks',
      relation: 'project.task',
      fields: {
        name: { type: 'char', label: 'Title' },
        allocated_hours: { type: 'float', label: 'Allocated' },
        share: { type: 'float', label: 'Share' },
        progress: { type: 'float', label: 'Progress' },
        priority: { type: 'selection', label: 'Priority', options: [{ value: '0', label: 'Normal' }, { value: '1', label: 'Urgent' }] },
      },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'field',
        id: 'f-lines',
        field: 'child_ids',
        widget: 'grid',
        totals: ['allocated_hours'],
        cells: { allocated_hours: { widget: 'duration' }, share: { widget: 'percentage' }, progress: { widget: 'progressbar' }, priority: { widget: 'priority' } },
      },
    ],
  },
} as unknown as Page;

let handle: ViewerHandle | null = null;
const frames = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const lines = [
    { key: 'a', values: { name: 'Survey', allocated_hours: 6.5, share: 0.25, progress: 40 } },
    { key: 'b', values: { name: 'Drawings', allocated_hours: 2.25, share: 0.75, progress: 100 } },
  ];
  handle = mountViewer(host, { page, widgets: gridWidgets, values: { child_ids: lines } as never });
  await frames();
  const grid = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
  return { host, grid, api: gridApiOf(grid)! };
}
const cell = (grid: Element, index: number, column: string) => grid.querySelector(`.ag-row[row-index="${index}"] .ag-cell[col-id="${column}"]`) as HTMLElement;

describe('the grid’s cells drawn by a widget of their own', () => {
  it('says hours as HH:MM and a share as a per cent, and adds the hours up so', async () => {
    const { grid } = await mount();
    expect(cell(grid, 0, 'allocated_hours').textContent).toBe('06:30');
    expect(cell(grid, 1, 'share').textContent).toBe('75%');
    const total = grid.querySelector('.ag-row-pinned .ag-cell[col-id="allocated_hours"], .ag-floating-bottom .ag-cell[col-id="allocated_hours"]') as HTMLElement;
    expect(total.textContent).toBe('08:45');
  });

  it('draws a progress bar in the cell itself, named by its column, with no editor over it', async () => {
    const { grid, api } = await mount();
    const bar = cell(grid, 0, 'progress').querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute('aria-valuetext')).toBe('40%');
    expect(bar.getAttribute('aria-label')).toBe('Progress');
    api.startEditingCell({ rowIndex: 0, colKey: 'progress' });
    expect(api.getEditingCells()).toEqual([]);
  });

  it('takes a click on a star in its cell, as the plain table does', async () => {
    const { grid } = await mount();
    const star = cell(grid, 1, 'priority').querySelector('button[role="radio"]') as HTMLButtonElement;
    expect(star.closest('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Priority');
    star.click();
    await frames();
    expect((handle!.form.getState().values['child_ids'] as { values: { priority: string } }[])[1].values.priority).toBe('1');
  });

  it('types hours in its editor as HH:MM', async () => {
    const { grid, api } = await mount();
    api.startEditingCell({ rowIndex: 0, colKey: 'allocated_hours' });
    await frames();
    const input = grid.querySelector('.fd-grid-editor input') as HTMLInputElement;
    expect(input.value).toBe('06:30');
    input.value = '1:45';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect((handle!.form.getState().values['child_ids'] as { values: { allocated_hours: number } }[])[0].values.allocated_hours).toBe(1.75);
  });
});

describe('an analytic distribution as a column of the grid', () => {
  const order = {
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: {
      order_line: {
        type: 'one2many',
        label: 'Lines',
        relation: 'sale.order.line',
        fields: { name: { type: 'char', label: 'Description' }, analytic_distribution: { type: 'json', label: 'Analytic' } },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'order_line', widget: 'grid', cells: { analytic_distribution: { widget: 'distribution', options: { model: 'account.analytic.account' } } } }] },
  } as unknown as Page;

  async function mountOrder() {
    const host = document.createElement('div');
    document.body.append(host);
    const dataSource = createMemoryDataSource({ records: { 'account.analytic.account': { 1: { name: 'Cairo office' }, 3: { name: 'Marketing' } } } });
    handle = mountViewer(host, { page: order, widgets: gridWidgets, dataSource, values: { order_line: [{ key: 'a', values: { name: 'Desks', analytic_distribution: { '1': 60, '3': 40 } } }] } as never });
    await frames();
    await frames();
    const grid = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
    return { grid, api: gridApiOf(grid)! };
  }

  it('says each account by its name with its share in the cell', async () => {
    const { grid } = await mountOrder();
    expect(cell(grid, 0, 'analytic_distribution').textContent).toBe('Cairo office 60%, Marketing 40%');
  });

  it('opens its lines to edit, writing a share into the line as it is typed', async () => {
    const { grid, api } = await mountOrder();
    api.startEditingCell({ rowIndex: 0, colKey: 'analytic_distribution' });
    await frames();
    const editor = document.querySelector('.fd-grid-editor .fd-distribution') as HTMLElement;
    expect(editor).not.toBeNull();
    const shares = [...editor.querySelectorAll<HTMLInputElement>('input.fd-share')];
    expect(shares.map((s) => s.value)).toEqual(['60', '40']);
    shares[0].value = '70';
    shares[0].dispatchEvent(new Event('input', { bubbles: true }));
    const lines = handle!.form.getState().values['order_line'] as { values: Record<string, unknown> }[];
    expect(lines[0].values['analytic_distribution']).toEqual({ '1': 70, '3': 40 });
    api.stopEditing();
    await frames();
    await frames();
    expect(cell(grid, 0, 'analytic_distribution').textContent).toBe('Cairo office 70%, Marketing 40%');
  });
});
