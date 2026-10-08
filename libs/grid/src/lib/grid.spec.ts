import { createMemoryDataSource, type Line, type MemoryDataSourceOptions, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { memoryPreferences, type PreferenceStore } from '@fieldia/widgets';
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

async function mount(page: Page = order, rows: Line[] = lines, preferences: PreferenceStore = memoryPreferences(), onchange?: MemoryOnchange) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({
    records: { 'sale.order': { 1: { name: 'S00118', line_ids: rows } }, product: { 1: { name: 'Office chair' }, 2: { name: 'Desk lamp' }, 3: { name: 'Monitor arm' } } },
    ...(onchange ? { onchange } : {}),
  });
  handle = mountViewer(host, { page, dataSource, recordId: 1, widgets: gridWidgets, preferences });
  await handle.form.settled();
  await frames();
  const box = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
  return { host, form: handle.form, box, api: gridApiOf(box), dataSource };
}
type MemoryOnchange = NonNullable<MemoryDataSourceOptions['onchange']>;
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
    expect(price).toBe('E£1,890.00');
    expect(delivery).toBe('20 Oct 2026');
    const taxed = box.querySelector('.ag-row[row-index="0"] .ag-cell[col-id="taxed"] input[type=checkbox]') as HTMLInputElement;
    expect(taxed.checked).toBe(true);
  });

  it('closes a date cell once a day is picked from its calendar, keeping the date', async () => {
    const { box, api, form } = await mount();
    api!.startEditingCell({ rowIndex: 1, colKey: 'delivery' });
    const input = document.querySelector('.ag-popup-editor .fd-grid-editor input[type="date"]') as HTMLInputElement;
    // A pick from the browser's calendar: a value, no key pressed.
    input.value = '2026-11-03';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await frames();
    expect(api!.getEditingCells()).toHaveLength(0);
    expect(formLines(form)[1].values['delivery']).toBe('2026-11-03');
    expect(rowCells(box, 1)[4]).toBe('3 Nov 2026');
  });

  it('hands a column’s options to its editor without a widget, and closes once its calendar picks a day', async () => {
    const page = JSON.parse(JSON.stringify(order)) as Page;
    const node = (page.layout as unknown as { children: { children: Record<string, unknown>[] }[] }).children[0].children[1];
    node['cells'] = { delivery: { options: { weekNumbers: true } } };
    const { api, form } = await mount(page);
    api!.startEditingCell({ rowIndex: 1, colKey: 'delivery' });
    await frames();
    // Over its cell, so its month has room: a popup, as a link's list is.
    const calendar = document.querySelector('.ag-popup-editor .fd-grid-editor .fd-calendar-button') as HTMLButtonElement;
    expect(calendar).not.toBeNull();
    calendar.click();
    const day = [...document.querySelectorAll<HTMLButtonElement>('.fd-calendar tbody button')].find((b) => b.textContent === '12' && !b.classList.contains('fd-outside')) as HTMLButtonElement;
    day.click();
    await frames();
    expect(api!.getEditingCells()).toHaveLength(0);
    expect(formLines(form)[1].values['delivery']).toMatch(/^\d{4}-\d{2}-12$/);
  });

  it('keeps a date cell open while its date is typed', async () => {
    const { api, form } = await mount();
    api!.startEditingCell({ rowIndex: 1, colKey: 'delivery' });
    const input = document.querySelector('.ag-popup-editor .fd-grid-editor input[type="date"]') as HTMLInputElement;
    // The browser says change as soon as the typed year makes a date: typing, not a pick.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    input.value = '0002-11-03';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await frames();
    expect(api!.getEditingCells()).toHaveLength(1);
    expect(formLines(form)[1].values['delivery']).toBe('0002-11-03');
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

describe('a line in a dialog', () => {
  const dialogBox = () => document.querySelector('.fd-form-dialog') as HTMLElement | null;
  const footButton = (name: string) =>
    [...(dialogBox()?.querySelectorAll('.fd-form-dialog-foot button') ?? [])].find((b) => b.textContent === name) as HTMLButtonElement;

  it('opens every field of a line in a dialog, and Save & Close writes it back', async () => {
    const { box, form } = await mount();
    (box.querySelector('.ag-row[row-index="1"] button[aria-label="Open line"]') as HTMLButtonElement).click();
    await frames();
    expect(dialogBox()).not.toBeNull();
    const labels = [...(dialogBox()?.querySelectorAll('.fd-label') ?? [])].map((l) => l.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Product', 'Description', 'Quantity', 'Unit price', 'Delivery', 'Taxed']));
    const description = dialogBox()?.querySelector('[data-node="values-name"] input') as HTMLInputElement;
    expect(description.value).toBe('LED, warm white');
    description.value = 'LED, daylight';
    description.dispatchEvent(new Event('input', { bubbles: true }));
    // Nothing reaches the line until the dialog is saved.
    expect(formLines(form)[1].values['name']).toBe('LED, warm white');
    footButton('Save & Close').click();
    await frames();
    expect(dialogBox()).toBeNull();
    expect(formLines(form)[1].values['name']).toBe('LED, daylight');
    expect(rowCells(box, 1)).toContain('LED, daylight');
  });

  it('finds a product through the page’s source, shows the price the onchange gives it, and leaves the line until Save & Close', async () => {
    const PRICES: Record<number, number> = { 1: 1890, 2: 380, 3: 749 };
    const onchange: MemoryOnchange = {
      'sale.order': {
        line_ids: (values) => ({
          line_ids: (values['line_ids'] as Line[]).map((l) => ({ ...l, values: { ...l.values, price: PRICES[(l.values['product_id'] as { id: number }).id] } })),
        }),
      },
    };
    const { box, form, dataSource } = await mount(order, lines, memoryPreferences(), onchange);
    (box.querySelector('.ag-row[row-index="1"] button[aria-label="Open line"]') as HTMLButtonElement).click();
    await frames();
    const product = dialogBox()?.querySelector('[data-node="values-product_id"] input') as HTMLInputElement;
    product.focus();
    product.value = 'monitor';
    product.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 260));
    const option = [...(dialogBox()?.querySelectorAll('[role=option]') ?? [])].find((o) => o.textContent === 'Monitor arm') as HTMLElement;
    expect(option).toBeDefined();
    option.click();
    await frames();
    expect((dialogBox()?.querySelector('[data-node="values-price"] input') as HTMLInputElement).value).toMatch(/749\.00/);
    expect(formLines(form)[1].values).toEqual(expect.objectContaining({ product_id: { id: 2, label: 'Desk lamp' }, price: 380 }));
    // The dialog only looks things up through the source: it never loads, saves or recalculates a record of its own there.
    expect(dataSource.calls.filter((c) => (c.request as { model?: string }).model === 'values')).toEqual([]);
    footButton('Save & Close').click();
    await frames();
    expect(formLines(form)[1].values).toEqual(expect.objectContaining({ product_id: { id: 3, label: 'Monitor arm' }, price: 749 }));
  });

  it('Discard leaves the line as it was', async () => {
    const { box, form } = await mount();
    (box.querySelector('.ag-row[row-index="0"] button[aria-label="Open line"]') as HTMLButtonElement).click();
    await frames();
    const qty = dialogBox()?.querySelector('[data-node="values-qty"] input') as HTMLInputElement;
    qty.value = '99';
    qty.dispatchEvent(new Event('input', { bubbles: true }));
    footButton('Discard').click();
    await frames();
    expect(formLines(form)[0].values['qty']).toBe(4);
  });
});

describe('editing a whole line', () => {
  const rowMode = JSON.parse(JSON.stringify(order)) as Page & { layout: any };
  rowMode.layout.children[0].children[1].editMode = 'row';
  const editingCells = (api: ReturnType<typeof gridApiOf>) => api?.getEditingCells().map((c) => c.column?.getColId());

  it('opens every editable cell of the line at once', async () => {
    const { api } = await mount(rowMode);
    api?.startEditingCell({ rowIndex: 1, colKey: 'qty' });
    await frames();
    expect(editingCells(api)?.sort()).toEqual(['delivery', 'name', 'price', 'product_id', 'qty'].sort());
  });

  it('edits a link inside its cell, its list floating over the page where nothing clips it', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { box, api } = await mount(rowMode);
    api?.startEditingCell({ rowIndex: 1, colKey: 'product_id' });
    await frames();
    expect(box.querySelector('.ag-popup-editor')).toBeNull();
    const input = box.querySelector('.ag-row[row-index="1"] .ag-cell[col-id="product_id"] input') as HTMLInputElement;
    expect(input).not.toBeNull();
    // The list stays with its box; a browser draws it in the page's top layer (floatUnder).
    const list = input.closest('.fd-combo')?.querySelector('.fd-listbox') as HTMLElement;
    expect(list.getAttribute('role')).toBe('listbox');
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/#98/);
    api?.stopEditing();
    await frames();
    expect(list.isConnected).toBe(false);
    warn.mockRestore();
  });

  it('puts the whole line back on Escape, whichever editor the key was pressed in', async () => {
    const { box, form, api } = await mount(rowMode);
    api?.startEditingCell({ rowIndex: 1, colKey: 'qty' });
    await frames();
    const inputs = [...box.querySelectorAll('.ag-cell-inline-editing input')] as HTMLInputElement[];
    const name = box.querySelector('.ag-row[row-index="1"] .ag-cell[col-id="name"] input') as HTMLInputElement;
    const qty = box.querySelector('.ag-row[row-index="1"] .ag-cell[col-id="qty"] input') as HTMLInputElement;
    expect(inputs.length).toBeGreaterThan(2);
    name.value = 'Brass';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    qty.value = '9';
    qty.dispatchEvent(new Event('input', { bubbles: true }));
    expect(formLines(form)[1].values['name']).toBe('Brass');
    qty.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await frames();
    expect(api?.getEditingCells()).toEqual([]);
    expect(formLines(form)[1].values).toEqual(expect.objectContaining({ name: 'LED, warm white', qty: 6 }));
  });

  it('takes away a line added a moment ago when Escape is pressed in any of its cells', async () => {
    const { box, form, api } = await mount(rowMode);
    (box.querySelector('[data-add="line"]') as HTMLButtonElement).click();
    await frames();
    expect(editingCells(api)?.length).toBeGreaterThan(1);
    const name = box.querySelector('.ag-row[row-index="2"] .ag-cell[col-id="name"] input') as HTMLInputElement;
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await frames();
    expect(formLines(form)).toHaveLength(2);
  });
});

describe('an empty grid', () => {
  it('shows its columns and a short line saying it has none, and its first line is added from the button and edited at once', async () => {
    const { box, form, api } = await mount(order, []);
    expect(box.querySelectorAll('.ag-header-cell').length).toBeGreaterThan(0);
    expect(box.querySelectorAll('.ag-row').length).toBe(0);
    expect(box.querySelector('.fd-grid-empty')?.textContent).toBe('No lines yet');
    (box.querySelector('[data-add="line"]') as HTMLButtonElement).click();
    await frames();
    expect(formLines(form)).toHaveLength(1);
    expect(box.querySelector('.fd-grid-empty')).toBeNull();
    expect(api?.getEditingCells().map((c) => [c.rowIndex, c.column?.getColId()])).toEqual([[0, 'product_id']]);
  });

  it('says the page’s own words while empty, as the plain table does', async () => {
    const worded = JSON.parse(JSON.stringify(order)) as Page & { layout: any };
    worded.layout.children[0].children[1].options = { emptyLabel: 'No products ordered yet.' };
    const { box } = await mount(worded, []);
    expect(box.querySelector('.fd-grid-empty')?.textContent).toBe('No products ordered yet.');
  });
});

describe('the grid’s columns', () => {
  /** The order, whose delivery date starts hidden and whose tax column may be hidden. */
  const choosy = JSON.parse(JSON.stringify(order)) as Page & { layout: any };
  choosy.layout.children[0].children[1].optionalColumns = { delivery: 'hide', taxed: 'show' };
  const shownIds = (api: ReturnType<typeof gridApiOf>) => api?.getAllDisplayedColumns().map((c) => c.getColId());

  it('starts an optional column hidden when the page says so, and the chooser shows or hides it', async () => {
    const { box, api } = await mount(choosy);
    expect(shownIds(api)).not.toContain('delivery');
    const button = box.querySelector('button[aria-label="Choose columns"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const chooser = box.querySelector('.fd-grid-chooser') as HTMLElement;
    expect(chooser.hidden).toBe(false);
    const boxes = [...chooser.querySelectorAll('label')].map((l) => [l.textContent, (l.querySelector('input') as HTMLInputElement).checked]);
    expect(boxes).toEqual([
      ['Delivery', false],
      ['Taxed', true],
    ]);
    (chooser.querySelector('input') as HTMLInputElement).click();
    expect(shownIds(api)).toContain('delivery');
    chooser.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(chooser.hidden).toBe(true);
  });

  it('keeps nothing for a person who arranged nothing, though the grid sizes its columns by its lines', async () => {
    const preferences = memoryPreferences();
    const { api } = await mount(choosy, lines, preferences);
    // A width the grid sets itself, as it does by its lines: told as the API's, not a person's drag.
    api?.setColumnWidths([{ key: 'name', newWidth: 300 }], true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(preferences.get('order.f-lines.columns')).toBeFalsy();
  });

  // Two grids mounted one after the other: slow on a busy machine, so more than the usual five seconds.
  it('remembers widths, order and choices in the preferences, and brings them back', async () => {
    const preferences = memoryPreferences();
    const first = await mount(choosy, lines, preferences);
    // As a person drags a column's edge.
    first.api?.setColumnWidths([{ key: 'qty', newWidth: 222 }], true, 'uiColumnResized');
    first.api?.moveColumns(['price'], 1);
    first.api?.setColumnsVisible(['delivery'], true);
    // AG Grid tells its listeners a moment later: wait for all three to be kept, however busy the machine.
    for (let waited = 0; waited < 3000; waited += 20) {
      const kept = JSON.stringify(preferences.get('order.f-lines.columns') ?? '');
      if (kept.includes('222') && kept.includes('delivery')) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(preferences.get('order.f-lines.columns')).not.toBeNull();
    handle?.destroy();
    handle = null;
    document.body.replaceChildren();
    const again = await mount(choosy, lines, preferences);
    expect(again.api?.getColumn('qty')?.getActualWidth()).toBe(222);
    expect(shownIds(again.api)?.slice(0, 2)).toEqual(['product_id', 'price']);
    expect(shownIds(again.api)).toContain('delivery');
  }, 15000);
});

describe('the grid’s problems', () => {
  /** The order, with a product required on every line. */
  const strict = JSON.parse(JSON.stringify(order)) as Page & { fields: Record<string, any> };
  strict.fields['line_ids'].fields.product_id.required = true;
  const productCell = (box: HTMLElement, row: number) => box.querySelector(`.ag-row[row-index="${row}"] .ag-cell[col-id="product_id"]`) as HTMLElement;

  it('marks a required cell left empty, says which line under the table, and clears once it is filled', async () => {
    const { box, form } = await mount(strict);
    const key = form.addLine('line_ids');
    expect(form.validate()).toBe(false);
    await frames();
    expect(productCell(box, 2).classList.contains('fd-grid-invalid')).toBe(true);
    expect(productCell(box, 0).classList.contains('fd-grid-invalid')).toBe(false);
    expect(box.getAttribute('aria-invalid')).toBe('true');
    const problems = box.querySelector('.fd-grid-problems') as HTMLElement;
    expect(problems.hidden).toBe(false);
    expect(problems.textContent).toBe('Line 3: Product is required');
    form.updateLine('line_ids', key, 'product_id', { id: 3, label: 'Monitor arm' });
    await frames();
    expect(productCell(box, 2).classList.contains('fd-grid-invalid')).toBe(false);
    expect(box.getAttribute('aria-invalid')).toBe('false');
    expect(problems.hidden).toBe(true);
  });

  it('opens the first problem for editing when the page asks for the focus', async () => {
    const { box, form, api } = await mount(strict);
    form.addLine('line_ids');
    form.validate();
    await frames();
    const handled = !box.dispatchEvent(new CustomEvent('fd-focus-problem', { cancelable: true }));
    expect(handled).toBe(true);
    await frames();
    expect(api?.getEditingCells().map((c) => [c.rowIndex, c.column?.getColId()])).toEqual([[2, 'product_id']]);
  });
});

describe('the grid totals', () => {
  it('pins a totals row under the lines and keeps it current', async () => {
    const totalled = JSON.parse(JSON.stringify(order)) as Page & { layout: any };
    totalled.layout.children[0].children[1].totals = ['qty', 'price'];
    const { box, form } = await mount(totalled);
    const totals = () => [...box.querySelectorAll('.ag-grid-pinned-bottom-rows .ag-row .ag-cell')].map((c) => (c as HTMLElement).textContent?.trim());
    expect(totals()).toEqual(['Total', '', '10.00', 'E£2,270.00', '', '', '', '']);
    form.updateLine('line_ids', 'l1', 'qty', 14);
    await frames();
    expect(totals()).toEqual(['Total', '', '20.00', 'E£2,270.00', '', '', '', '']);
  });

  it('never takes a key pressed on the totals row for one meant for the first line', async () => {
    const totalled = JSON.parse(JSON.stringify(order)) as Page & { layout: any };
    totalled.layout.children[0].children[1].totals = ['qty'];
    const { box, form, api } = await mount(totalled);
    api?.setFocusedCell(0, '__delete', 'bottom');
    const cell = box.querySelector('.ag-grid-pinned-bottom-rows .ag-cell[col-id="__delete"]') as HTMLElement;
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(formLines(form).map((l) => l.key)).toEqual(['l1', 'l2']);
  });
});

describe('the grid with sections and notes', () => {
  /** The same order, whose lines may be section headings and notes. */
  const sectioned = JSON.parse(JSON.stringify(order)) as Page & { fields: Record<string, any> };
  sectioned.fields['line_ids'].lineKinds = { field: 'display_type', text: 'name' };
  sectioned.fields['line_ids'].fields = {
    display_type: { type: 'selection', label: 'Line type', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
    ...sectioned.fields['line_ids'].fields,
  };
  const withKinds: Line[] = [
    { key: 's1', id: 10, values: { display_type: 'section', name: 'Workstations' } },
    lines[0],
    { key: 'n1', id: 13, values: { display_type: 'note', name: 'Fitted on delivery day.' } },
    lines[1],
  ];

  it('never shows the field that says what a line is as a column', async () => {
    const { api } = await mount(sectioned, withKinds);
    expect(api?.getColumns()?.map((c) => c.getColId())).not.toContain('display_type');
  });

  it('draws a section and a note across the line’s columns, beside the delete button', async () => {
    const { box } = await mount(sectioned, withKinds);
    // The open button is for items: a section or note has an empty cell there.
    expect(rowCells(box, 0)).toEqual(['Workstations', '', '×']);
    expect(rowCells(box, 2)).toEqual(['Fitted on delivery day.', '', '×']);
    expect(rowCells(box, 1)[0]).toBe('Office chair');
    expect(box.querySelector('.ag-row[row-index="0"]')?.classList.contains('fd-grid-section')).toBe(true);
    expect(box.querySelector('.ag-row[row-index="2"]')?.classList.contains('fd-grid-note')).toBe(true);
  });

  it('names its add buttons as the page says: a line, a section and a note', async () => {
    const named = JSON.parse(JSON.stringify(sectioned));
    named.layout.children[0].children[1].options = { addLabel: 'Add a product', addSectionLabel: 'Add a heading', addNoteLabel: 'Add a remark' };
    const { box } = await mount(named, withKinds);
    expect([...box.querySelectorAll('.fd-lines-add')].map((b) => b.textContent)).toEqual(['+ Add a product', '+ Add a heading', '+ Add a remark']);
  });

  it('adds a section from its button and edits its heading in place', async () => {
    const { box, form, api } = await mount(sectioned, withKinds);
    expect([...box.querySelectorAll('.fd-lines-add')].map((b) => b.textContent)).toEqual(['+ Add a line', '+ Add a section', '+ Add a note']);
    (box.querySelector('[data-add="section"]') as HTMLButtonElement).click();
    await frames();
    const added = formLines(form)[4];
    expect(added.values['display_type']).toBe('section');
    expect(api?.getEditingCells().map((c) => [c.rowIndex, c.column?.getColId()])).toEqual([[4, 'product_id']]);
    const input = box.querySelector('.ag-cell-inline-editing input') as HTMLInputElement;
    input.value = 'Lighting';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(formLines(form)[4].values['name']).toBe('Lighting');
  });

  it('holds a line’s handle at its start and its buttons at its end, in sight however far the lines scroll sideways', async () => {
    const ordered = JSON.parse(JSON.stringify(sectioned)) as Page & { fields: Record<string, any> };
    ordered.fields['line_ids'].sequenceField = 'sequence';
    ordered.fields['line_ids'].fields.sequence = { type: 'integer', label: 'Sequence' };
    const { api } = await mount(ordered, withKinds.map((line, i) => ({ ...line, values: { ...line.values, sequence: (i + 1) * 10 } })));
    expect(api?.getColumnDef('__handle')?.pinned).toBe('left');
    expect(api?.getColumnDef('__delete')?.pinned).toBe('right');
    // Right to left, the line starts at the right.
    handle?.destroy();
    const rtl = { ...ordered, language: 'ar' } as Page;
    const host = document.createElement('div');
    document.body.append(host);
    const dataSource = createMemoryDataSource({ records: { 'sale.order': { 1: { name: 'S00118', line_ids: withKinds } } } });
    handle = mountViewer(host, { page: rtl, dataSource, recordId: 1, widgets: gridWidgets, locale: 'ar' });
    await handle.form.settled();
    await frames();
    const mirrored = gridApiOf(host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement);
    expect(mirrored?.getColumnDef('__handle')?.pinned).toBe('right');
    expect(mirrored?.getColumnDef('__delete')?.pinned).toBe('left');
  });

  it('leads each line with a drag handle when the lines keep an order, and never shows that field', async () => {
    const ordered = JSON.parse(JSON.stringify(sectioned)) as Page & { fields: Record<string, any> };
    ordered.fields['line_ids'].sequenceField = 'sequence';
    ordered.fields['line_ids'].fields.sequence = { type: 'integer', label: 'Sequence' };
    const numbered = withKinds.map((line, i) => ({ ...line, values: { ...line.values, sequence: (i + 1) * 10 } }));
    const { api, box, form } = await mount(ordered, numbered);
    const shown = api?.getAllDisplayedColumns().map((c) => c.getColId());
    expect(shown?.[0]).toBe('__handle');
    expect(shown).not.toContain('sequence');
    expect(api?.getColumnDef('__handle')?.rowDrag).toBeTruthy();
    // A section still spans the item columns, beside the handle and the delete button.
    expect(rowCells(box, 0)).toEqual(['', 'Workstations', '', '×']);

    // Alt+Down moves the focused line, which stays focused.
    api?.setFocusedCell(1, 'name');
    const focused = box.querySelector('.ag-row[row-index="1"] .ag-cell[col-id="name"]') as HTMLElement;
    focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    expect(formLines(form).map((l) => l.key)).toEqual(['s1', 'n1', 'l1', 'l2']);
    expect(formLines(form).map((l) => l.values['sequence'])).toEqual([10, 20, 30, 40]);
    expect(api?.getFocusedCell()?.rowIndex).toBe(2);
  });

  it('leaves sections and notes out of the totals, even one that still holds a number', async () => {
    const totalled = JSON.parse(JSON.stringify(sectioned)) as Page & { layout: any };
    totalled.layout.children[0].children[1].totals = ['qty'];
    const rows = withKinds.map((line) => (line.key === 'n1' ? { ...line, values: { ...line.values, qty: 99 } } : line));
    const { box } = await mount(totalled, rows);
    expect(box.querySelector('.ag-grid-pinned-bottom-rows .ag-cell[col-id="qty"]')?.textContent?.trim()).toBe('10.00');
  });

  it('edits a note in a box that starts one line tall', async () => {
    const { box, api } = await mount(sectioned, withKinds);
    api?.startEditingCell({ rowIndex: 2, colKey: 'product_id' });
    await frames();
    const area = box.querySelector('.ag-cell-inline-editing textarea') as HTMLTextAreaElement;
    expect(area.value).toBe('Fitted on delivery day.');
    expect(area.rows).toBe(1);
  });
});

describe('a grid whose columns shrink to fit (fit: shrink)', () => {
  it('lets its columns go narrower, sharing the width, its headers wrapping, before it scrolls', async () => {
    const shrinking = JSON.parse(JSON.stringify(order)) as Page & { layout: any };
    shrinking.layout.children[0].children[1].fit = 'shrink';
    const { api } = await mount(shrinking);
    const product = api?.getColumnDef('product_id');
    const price = api?.getColumnDef('price');
    expect(product).toEqual(expect.objectContaining({ minWidth: 72, wrapHeaderText: true, autoHeaderHeight: true }));
    expect(product?.flex).toBeGreaterThan(0);
    expect(price?.minWidth).toBe(80);
    const { api: plain } = await mount();
    expect(plain?.getColumnDef('product_id')?.minWidth).toBeGreaterThan(72);
  });
});

describe('a grid’s columns by what they hold', () => {
  it('gives words the room their longest value needs, and numbers the room their kind needs, never cut', async () => {
    const { api } = await mount();
    const state = (column: string) => api?.getColumnState().find((c) => c.colId === column);
    // Words share the width by the room their values need: the descriptions more than the products' short names.
    expect(state('name')?.flex).toBeGreaterThan(state('product_id')?.flex as number);
    // Numbers and money are as wide as their values, not a share: never cut when the grid is tight.
    expect(state('qty')?.flex).toBeFalsy();
    // Room for its label's longest word, which a wrapping header never breaks: "Quantity".
    expect(state('qty')?.width).toBe(Math.round(8 * 7.6 + 40));
    // Money keeps room for a total in the millions.
    expect(state('price')?.width).toBe(Math.round(14 * 7.6 + 40));
  });
});


describe('a cell’s editor', () => {
  /** The order, its description a paragraph of several lines. */
  const paragraphs = JSON.parse(JSON.stringify(order)) as Page & { fields: Record<string, any> };
  paragraphs.fields['line_ids'].fields.name = { type: 'text', label: 'Description' };
  const popupEditor = () => document.querySelector('.ag-popup-editor .fd-grid-editor') as HTMLElement | null;

  it('opens a date over its cell, as wide as its value needs and never narrower than its cell', async () => {
    const { api } = await mount();
    api!.startEditingCell({ rowIndex: 0, colKey: 'delivery' });
    await frames();
    const editor = popupEditor();
    expect(editor?.dataset['type']).toBe('date');
    expect(editor?.querySelector('input[type="date"]')).not.toBeNull();
    // Its width is the value's (the stylesheet's max-content), its cell's at the least; never a fixed one.
    expect(editor?.style.minWidth).toMatch(/px$/);
    expect(editor?.style.width).toBe('');
  });

  it('opens a paragraph in a box of several lines over its cell, where Enter starts a new line', async () => {
    // A cell with a box of its own: AG Grid closes a popup whose cell has none (jsdom draws nothing).
    const rect = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 10, bottom: 50, right: 110, width: 100, height: 40, x: 10, y: 10, toJSON: () => ({}) });
    const { api, form } = await mount(paragraphs);
    api!.startEditingCell({ rowIndex: 1, colKey: 'name' });
    await frames();
    const editor = popupEditor();
    const area = editor?.querySelector('textarea') as HTMLTextAreaElement;
    expect(area).not.toBeNull();
    expect(parseFloat(editor!.style.minWidth)).toBeGreaterThanOrEqual(320);
    expect(area.rows).toBeGreaterThanOrEqual(3);
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await frames();
    expect(api!.getEditingCells()).toHaveLength(1);
    area.value = 'LED,\nwarm white';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    // Ctrl/Cmd+Enter finishes it, as a note's.
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await frames();
    expect(api!.getEditingCells()).toHaveLength(0);
    expect(formLines(form)[1].values['name']).toBe('LED,\nwarm white');
    rect.mockRestore();
  });

  it('opens a link over a narrow cell wide enough to read its name, as tall as its row', async () => {
    const rect = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 10, bottom: 50, right: 106, width: 96, height: 40, x: 10, y: 10, toJSON: () => ({}) });
    const { api } = await mount();
    api!.startEditingCell({ rowIndex: 0, colKey: 'product_id' });
    await frames();
    const editor = popupEditor();
    expect(editor?.dataset['type']).toBe('many2one');
    // Not the cell's 96 px, which shows "[PM-1" of "[PM-12] Patient monitor PM-12".
    expect(parseFloat(editor!.style.minWidth)).toBeGreaterThanOrEqual(240);
    expect(editor!.style.width).toBe('');
    expect(editor!.style.height).toBe('40px');
    rect.mockRestore();
  });

  it('widens a link’s editor to show a longer name whole, as far as the window allows', async () => {
    const rect = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 10, bottom: 50, right: 250, width: 240, height: 40, x: 10, y: 10, toJSON: () => ({}) });
    // The name needs 330 px where the box gives 200.
    const scroll = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(330);
    const client = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    const { api } = await mount();
    api!.startEditingCell({ rowIndex: 0, colKey: 'product_id' });
    await frames();
    expect(parseFloat(popupEditor()!.style.minWidth)).toBe(240 + 130 + 8);
    // Never wider than the most it grows to.
    scroll.mockReturnValue(2000);
    api!.stopEditing(true);
    api!.startEditingCell({ rowIndex: 0, colKey: 'product_id' });
    await frames();
    expect(parseFloat(popupEditor()!.style.minWidth)).toBe(480);
    [rect, scroll, client].forEach((spy) => spy.mockRestore());
  });

  it('shows a value from its start when its text is selected on the way in', async () => {
    const { box, api } = await mount();
    api!.setFocusedCell(0, 'name');
    api!.startEditingCell({ rowIndex: 0, colKey: 'name' });
    await frames();
    const input = box.querySelector('.ag-cell-inline-editing input') as HTMLInputElement;
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
    // Selected backwards, the caret's end is the start: the browser scrolls there, not to the value's end.
    expect(input.selectionDirection).toBe('backward');
    expect(input.scrollLeft).toBe(0);
  });

  it('gives a value too long for its cell the whole cell, padding and all', async () => {
    const widths = jest.spyOn(HTMLInputElement.prototype, 'scrollWidth', 'get').mockReturnValue(120);
    const room = jest.spyOn(HTMLInputElement.prototype, 'clientWidth', 'get').mockReturnValue(64);
    const { box, api } = await mount();
    api!.startEditingCell({ rowIndex: 0, colKey: 'price' });
    await frames();
    expect(box.querySelector('.ag-cell-inline-editing .fd-grid-editor')?.classList).toContain('fd-grid-editor-tight');
    widths.mockRestore();
    room.mockRestore();
  });
});

describe('a grid’s headers', () => {
  it('wraps a long label onto a second line rather than cut it, and says the whole label on pointing at it', async () => {
    const worded = JSON.parse(JSON.stringify(order)) as Page & { fields: Record<string, any> };
    worded.fields['line_ids'].fields.name.label = 'Customer reference';
    const { api } = await mount(worded);
    // A header wraps between its words, never inside one: its column has room for the longest.
    expect(api?.getColumnDef('name')?.minWidth).toBeGreaterThanOrEqual(Math.round('reference'.length * 7.6 + 40));
    for (const column of ['product_id', 'qty', 'price', 'delivery', 'taxed']) {
      expect(api?.getColumnDef(column)).toEqual(expect.objectContaining({ wrapHeaderText: true, autoHeaderHeight: true }));
    }
    expect(api?.getColumnDef('qty')?.headerTooltip).toBe('Quantity');
  });
});

describe('a status drawn as a badge', () => {
  it('takes the room its longest status needs, never sharing it away', async () => {
    const badged = JSON.parse(JSON.stringify(order)) as Page & { fields: Record<string, any>; layout: any };
    badged.fields['line_ids'].fields.state = {
      type: 'selection',
      label: 'Status',
      options: [{ value: 'draft', label: 'Draft' }, { value: 'pending', label: 'Pending Clearance' }],
    };
    badged.layout.children[0].children[1].cells = { state: { badge: true } };
    const { api } = await mount(badged);
    const state = api?.getColumnState().find((c) => c.colId === 'state');
    // Its longest status, though no line holds it yet.
    expect(state?.flex).toBeFalsy();
    // And the pill's own padding round its words.
    expect(state?.width).toBeGreaterThanOrEqual(Math.round('Pending Clearance'.length * 7.6 + 40) + 18);
  });
});

describe('a line being dragged', () => {
  /** The order, its lines in an order, its first column a yes or no. */
  const ordered = JSON.parse(JSON.stringify(order)) as Page & { fields: Record<string, any>; layout: any };
  ordered.fields['line_ids'].sequenceField = 'sequence';
  ordered.fields['line_ids'].fields.sequence = { type: 'integer', label: 'Sequence' };
  ordered.layout.children[0].children[1].columns = ['taxed', 'qty', 'product_id', 'name'];
  const dragText = (api: ReturnType<typeof gridApiOf>, index: number) =>
    (api?.getGridOption('rowDragText') as (p: unknown, count: number) => string)({ rowNode: api?.getDisplayedRowAtIndex(index), defaultTextValue: '' }, 1);

  it('is named by its first column of words, never by a yes or no', async () => {
    const { api } = await mount(ordered);
    expect(dragText(api, 0)).toBe('Office chair');
  });

  it('is named by its place when that column is empty', async () => {
    const unnamed = lines.map((line, i) => (i === 1 ? { ...line, values: { ...line.values, product_id: null } } : line));
    const { api } = await mount(ordered, unnamed);
    expect(dragText(api, 1)).toBe('Line 2');
  });

  it('heads its card with that column too', async () => {
    const carded = JSON.parse(JSON.stringify(ordered));
    carded.layout.children[0].children[1].cards = 'always';
    const { box } = await mount(carded);
    expect([...box.querySelectorAll('.fd-line-card-title')].map((t) => t.textContent)).toEqual(['Office chair', 'Desk lamp']);
  });
});
