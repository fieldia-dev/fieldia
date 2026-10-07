import type { ActionRequest, Line, Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridWidgets } from './grid';

/** The grid's buttons besides those on each line: lines chosen with a tick and a bar of buttons for them, buttons beside Add a line, and a copy of a line. */
const page = {
  fieldia: '0.1',
  id: 'mo',
  data: { kind: 'record', model: 'mrp.production' },
  fields: {
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'progress', label: 'In progress' }] },
    workorder_ids: {
      type: 'one2many',
      label: 'Work orders',
      relation: 'mrp.workorder',
      lineKinds: { field: 'kind', text: 'name' },
      fields: {
        kind: { type: 'selection', label: 'Kind', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
        name: { type: 'char', label: 'Operation' },
        hours: { type: 'float', label: 'Hours' },
      },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'field',
        id: 'f-wo',
        field: 'workorder_ids',
        widget: 'grid',
        options: { copy: true },
        selectedButtons: [
          { type: 'button', id: 'wo-start', label: 'Start', action: 'button_start', invisible: "state == 'draft'" },
          { type: 'button', id: 'wo-done', label: 'Done', action: 'button_finish' },
        ],
        controlButtons: [{ type: 'button', id: 'wo-catalog', label: 'Catalog', action: 'action_add_from_catalog', invisible: "state == 'draft'" }],
      },
    ],
  },
} as unknown as Page;

const lines = [
  { key: 's', values: { kind: 'section', name: 'Assembly', hours: null } },
  { key: 'a', id: 11, values: { kind: null, name: 'Cut', hours: 2 } },
  { key: 'b', id: 12, values: { kind: null, name: 'Glue', hours: 1 } },
];

let handle: ViewerHandle | null = null;
const frames = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(state = 'progress') {
  const asked: ActionRequest[] = [];
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, widgets: gridWidgets, values: { state, workorder_ids: lines } as never, onAction: (request) => void asked.push(request) });
  await frames();
  const grid = host.querySelector('[data-node="f-wo"] .fd-grid-lines') as HTMLElement;
  return { grid, asked, form: handle.form };
}

const pick = (grid: Element, index: number) => grid.querySelector(`.ag-row[row-index="${index}"] input.fd-line-pick`) as HTMLInputElement | null;
const tick = (box: HTMLInputElement) => {
  box.checked = !box.checked;
  box.dispatchEvent(new Event('change', { bubbles: true }));
};
const bar = (grid: Element) => grid.querySelector('.fd-lines-chosen') as HTMLElement;

describe('lines chosen in the grid, and buttons for them', () => {
  it('ticks items, never a section; the bar says how many and shows its buttons by the record', async () => {
    const { grid, form } = await mount('draft');
    expect(pick(grid, 0)).toBeNull();
    expect(bar(grid).hidden).toBe(true);
    tick(pick(grid, 1)!);
    expect(bar(grid).hidden).toBe(false);
    expect(bar(grid).querySelector('.fd-lines-chosen-count')?.textContent).toBe('1 chosen');
    expect((bar(grid).querySelector('[data-node="wo-start"]') as HTMLElement).hidden).toBe(true);
    form.setValue('state', 'progress');
    await frames();
    expect((bar(grid).querySelector('[data-node="wo-start"]') as HTMLElement).hidden).toBe(false);
  });

  it('chooses every item from the head, and runs with them in the table’s order', async () => {
    const { grid, asked } = await mount();
    tick(grid.querySelector('.ag-header input.fd-line-pick-all') as HTMLInputElement);
    expect(bar(grid).querySelector('.fd-lines-chosen-count')?.textContent).toBe('2 chosen');
    (bar(grid).querySelector('[data-node="wo-done"]') as HTMLButtonElement).click();
    await frames();
    expect(asked[0]).toMatchObject({ action: 'button_finish', lines: { keys: ['a', 'b'], ids: [11, 12] } });
  });
});

describe('the grid’s buttons beside Add a line, and a line copied', () => {
  it('shows a control button by the record and runs it', async () => {
    const { grid, asked, form } = await mount('draft');
    const catalog = () => grid.querySelector('.fd-lines-adds [data-node="wo-catalog"]') as HTMLButtonElement;
    expect(catalog().hidden).toBe(true);
    form.setValue('state', 'progress');
    await frames();
    expect(catalog().hidden).toBe(false);
    catalog().click();
    await frames();
    expect(asked[0]).toMatchObject({ action: 'action_add_from_catalog' });
  });

  it('puts a copy of a line right after it, never its saved id', async () => {
    const { grid, form } = await mount();
    const copy = grid.querySelector('.ag-row[row-index="1"] button.fd-line-copy') as HTMLButtonElement;
    expect(copy.getAttribute('aria-label')).toBe('Copy line 2');
    copy.click();
    await frames();
    const now = form.getState().values['workorder_ids'] as Line[];
    expect(now.map((l) => l.values['name'])).toEqual(['Assembly', 'Cut', 'Cut', 'Glue']);
    expect(now[2].id).toBeUndefined();
  });
});

describe('a grid’s line opening its own record’s page', () => {
  const matter = {
    fieldia: '0.1',
    id: 'matter',
    data: { kind: 'record', model: 'legal.matter' },
    fields: {
      hearing_ids: { type: 'one2many', label: 'Hearings', relation: 'legal.hearing', fields: { date: { type: 'date', label: 'Date' }, court: { type: 'char', label: 'Court' } } },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-h', field: 'hearing_ids', widget: 'grid', lineOpens: 'record' }] },
  } as unknown as Page;
  const hearing = {
    fieldia: '0.1',
    id: 'hearing',
    data: { kind: 'record', model: 'legal.hearing' },
    fields: { court: { type: 'char', label: 'Court' }, judge: { type: 'char', label: 'Presiding judge' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-court', field: 'court' }, { type: 'field', id: 'f-judge', field: 'judge' }] },
  } as unknown as Page;

  it('opens a saved line’s record page, and a new line’s fields', async () => {
    const { createMemoryDataSource } = await import('@fieldia/core');
    const host = document.createElement('div');
    document.body.append(host);
    const dataSource = createMemoryDataSource({ records: { 'legal.hearing': { 7: { court: 'Cairo Economic Court', judge: 'Hany Fawzy' } } } });
    handle = mountViewer(host, {
      page: matter,
      widgets: gridWidgets,
      dataSource,
      relatedPages: { 'legal.hearing': hearing },
      values: { hearing_ids: [{ key: 'a', id: 7, values: { date: '2026-10-20', court: 'Cairo Economic Court' } }, { key: 'b', values: { date: null, court: null } }] } as never,
    });
    await frames();
    const labelsIn = () => [...(document.querySelector('.fd-form-dialog')?.querySelectorAll('.fd-label') ?? [])].map((l) => l.textContent);
    (host.querySelector('.ag-row[row-index="0"] button[aria-label="Open line"]') as HTMLButtonElement).click();
    await frames();
    expect(labelsIn()).toEqual(['Court', 'Presiding judge']);
    (document.querySelector('.fd-form-dialog-foot button:last-child') as HTMLButtonElement).click();
    await frames();
    (host.querySelector('.ag-row[row-index="1"] button[aria-label="Open line"]') as HTMLButtonElement).click();
    await frames();
    expect(labelsIn()).toEqual(['Date', 'Court']);
  });
});
