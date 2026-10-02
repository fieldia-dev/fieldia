import { createMemoryDataSource, type Line, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridApiOf, gridWidgets } from './grid';

/** A sales order with its lines, shown in the grid. */
const order: Page = {
  fieldia: '0.1',
  id: 'order',
  title: 'Sales order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    name: { type: 'char', label: 'Order' },
    line_ids: {
      type: 'one2many',
      label: 'Order lines',
      relation: 'sale.order.line',
      fields: {
        product_id: { type: 'many2one', label: 'Product', relation: 'product' },
        name: { type: 'char', label: 'Description' },
        qty: { type: 'float', label: 'Quantity', digits: [8, 2] },
        price: { type: 'monetary', label: 'Unit price', currency: 'EGP' },
        delivery: { type: 'date', label: 'Delivery' },
        taxed: { type: 'boolean', label: 'Taxed' },
      },
    },
  },
  layout: {
    type: 'sections',
    id: 'sections',
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-name', field: 'name' },
          { type: 'field', id: 'f-lines', field: 'line_ids', widget: 'grid' },
        ],
      },
    ],
  },
};

const lines: Line[] = [
  { key: 'l1', id: 11, values: { product_id: { id: 1, label: 'Office chair' }, name: 'Ergonomic, black', qty: 4, price: 1890, delivery: '2026-10-20', taxed: true } },
  { key: 'l2', id: 12, values: { product_id: { id: 2, label: 'Desk lamp' }, name: 'LED, warm white', qty: 6, price: 380, delivery: null, taxed: false } },
];

let handle: ViewerHandle | null = null;
/** AG Grid draws cell renderers on an animation frame. */
const frames = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({
    records: { 'sale.order': { 1: { name: 'S00118', line_ids: lines } }, product: { 1: { name: 'Office chair' }, 2: { name: 'Desk lamp' }, 3: { name: 'Monitor arm' } } },
  });
  handle = mountViewer(host, { page: order, dataSource, recordId: 1, widgets: gridWidgets });
  await handle.form.settled();
  await frames();
  const box = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
  return { host, form: handle.form, box, api: gridApiOf(box) };
}
const rowCells = (box: HTMLElement, index: number) =>
  [...box.querySelectorAll(`.ag-row[row-index="${index}"] .ag-cell`)].map((c) => (c as HTMLElement).textContent?.trim());
const formLines = (form: { getState(): { values: Record<string, unknown> } }) => form.getState().values['line_ids'] as Line[];

describe('the grid', () => {
  it('replaces the plain table only where a page asks for it', async () => {
    const { box, api } = await mount();
    expect(box).not.toBeNull();
    expect(api).toBeDefined();
  });

  it('shows each line as a row, its line fields as columns', async () => {
    const { box } = await mount();
    const headers = [...box.querySelectorAll('.ag-header-cell-text')].map((h) => h.textContent).filter(Boolean);
    expect(headers).toEqual(['Product', 'Description', 'Quantity', 'Unit price', 'Delivery', 'Taxed']);
    expect(box.querySelectorAll('.ag-row')).toHaveLength(2);
  });

  it('shows values as people read them: a link by its name, money with its currency, a date, yes or no', async () => {
    const { box } = await mount();
    const [product, description, qty, price, delivery] = rowCells(box, 0);
    expect([product, description, qty]).toEqual(['Office chair', 'Ergonomic, black', '4.00']);
    expect(price).toBe('EGP 1,890.00');
    expect(delivery).toBe('20 Oct 2026');
    const taxed = box.querySelector('.ag-row[row-index="0"] .ag-cell[col-id="taxed"] input[type=checkbox]') as HTMLInputElement;
    expect(taxed.checked).toBe(true);
  });

  it('edits a cell with the field’s own widget, and the change reaches the form at once', async () => {
    const { box, api, form } = await mount();
    api!.startEditingCell({ rowIndex: 1, colKey: 'name' });
    const input = box.querySelector('.ag-cell-inline-editing input') as HTMLInputElement;
    expect(input.classList.contains('fd-input')).toBe(true);
    input.value = 'LED, daylight';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Still editing, and the form already has it.
    expect(api!.getEditingCells()).toHaveLength(1);
    expect(formLines(form)[1].values['name']).toBe('LED, daylight');
    expect(form.getState().dirty).toContain('line_ids');
    api!.stopEditing();
    expect(rowCells(box, 1)[1]).toBe('LED, daylight');
  });

  it('ticks yes or no in place, without opening an editor', async () => {
    const { box, form } = await mount();
    (box.querySelector('.ag-row[row-index="1"] .ag-cell[col-id="taxed"] input[type=checkbox]') as HTMLInputElement).click();
    expect(formLines(form)[1].values['taxed']).toBe(true);
  });

  it('adds a line from the button and starts editing its first cell', async () => {
    const { host, box, api, form } = await mount();
    const add = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Add a line')) as HTMLButtonElement;
    add.click();
    expect(formLines(form)).toHaveLength(3);
    expect(box.querySelectorAll('.ag-row')).toHaveLength(3);
    expect(api!.getEditingCells()).toEqual([expect.objectContaining({ rowIndex: 2 })]);
    expect(api!.getEditingCells()[0]?.column?.getColId()).toBe('product_id');
  });

  it('removes a line', async () => {
    const { box, form } = await mount();
    (box.querySelector('.ag-row[row-index="0"] [aria-label="Delete line"]') as HTMLButtonElement).click();
    expect(formLines(form).map((l) => l.key)).toEqual(['l2']);
    expect(box.querySelectorAll('.ag-row')).toHaveLength(1);
  });

  it('keeps the rows in step when the form changes them, such as after Discard', async () => {
    const { host, box, form } = await mount();
    form.removeLine('line_ids', 'l1');
    expect(box.querySelectorAll('.ag-row')).toHaveLength(1);
    form.reset();
    expect(box.querySelectorAll('.ag-row')).toHaveLength(2);
    expect(host).toBeTruthy();
  });
});
