import type { Page } from '@fieldia/core';
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
        cells: { allocated_hours: { widget: 'duration' }, share: { widget: 'percentage' }, progress: { widget: 'progressbar' } },
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
