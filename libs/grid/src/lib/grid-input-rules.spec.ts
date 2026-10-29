import { createMemoryDataSource, type Line, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { gridApiOf, gridWidgets } from './grid';

/**
 * The input rules in the grid (FIELDIA INPUT RULES, 8): the key that opens a
 * cell's editor goes into it, through the box's rules; a cell holding text that
 * does not read shows that text, marked, and its column's total waits for its
 * line in words; a block pasted from a spreadsheet fills across and down,
 * naming the cells it could not fill.
 */

const order: Page = {
  fieldia: '0.13',
  id: 'order',
  title: 'Sales order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    line_ids: {
      type: 'one2many',
      label: 'Order lines',
      relation: 'sale.order.line',
      fields: {
        name: { type: 'char', label: 'Description' },
        qty: { type: 'float', label: 'Quantity', digits: [8, 2] },
        price: { type: 'monetary', label: 'Unit price', currency: 'EGP' },
        subtotal: { type: 'monetary', label: 'Subtotal', currency: 'EGP', readonly: true },
      },
    },
  },
  layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-lines', field: 'line_ids', widget: 'grid', totals: ['qty', 'price'] }] }] },
};

const lines: Line[] = [
  { key: 'l1', id: 11, values: { name: 'Office chair', qty: 4, price: 1890, subtotal: 7560 } },
  { key: 'l2', id: 12, values: { name: 'Desk lamp', qty: 6, price: 380, subtotal: 2280 } },
];

let handle: ViewerHandle | null = null;
const frames = () => new Promise((resolve) => setTimeout(resolve, 50));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(locale: 'en' | 'ar' = 'en', options?: Record<string, unknown>) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: { 'sale.order': { 1: { line_ids: lines } } } });
  // The table's node with options of its own: its most lines (`max`).
  const page = options ? (JSON.parse(JSON.stringify(order).replace('"totals":', `"options":${JSON.stringify(options)},"totals":`)) as Page) : order;
  handle = mountViewer(host, { page, dataSource, recordId: 1, widgets: gridWidgets, locale });
  await handle.form.settled();
  await frames();
  const box = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
  return { box, form: handle.form, api: gridApiOf(box)! };
}
const formLines = (form: { getState(): { values: Record<string, unknown> } }) => form.getState().values['line_ids'] as Line[];
const cellOf = (box: HTMLElement, row: number, column: string) =>
  [...box.querySelectorAll<HTMLElement>(`.ag-row[row-index="${row}"] .ag-cell[col-id="${column}"]`)].find((cell) => !cell.closest('.ag-grid-pinned-bottom-rows')) as HTMLElement;
const totalOf = (box: HTMLElement, column: string) => box.querySelector(`.ag-grid-pinned-bottom-rows .ag-cell[col-id="${column}"]`) as HTMLElement;
const microtasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a grid cell’s first key', () => {
  for (const [key, then, value] of [
    ['5', '7', 57],
    ['-', '3', -3],
    ['٣', '٤', 34],
    ['.', '5', 0.5],
  ] as const) {
    it(`goes into the editor it opens: "${key}${then}" is ${value}`, async () => {
      const { box, api, form } = await mount();
      api.setFocusedCell(0, 'qty');
      api.startEditingCell({ rowIndex: 0, colKey: 'qty', key });
      await microtasks();
      const input = box.querySelector('.fd-grid-editor input') as HTMLInputElement;
      expect(input.value).toBe(key);
      input.setRangeText(then, input.value.length, input.value.length, 'end');
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: then }));
      expect(formLines(form)[0].values['qty']).toBe(value);
    });
  }

  it('refuses a letter as typing does, with the hint, and keeps the value', async () => {
    const { box, api, form } = await mount();
    api.setFocusedCell(0, 'qty');
    api.startEditingCell({ rowIndex: 0, colKey: 'qty', key: 'a' });
    await microtasks();
    const input = box.querySelector('.fd-grid-editor input') as HTMLInputElement;
    expect(input.value).not.toContain('a');
    expect(box.querySelector('.fd-refusal-hint')?.textContent).toBe('Quantity: numbers only');
    expect(formLines(form)[0].values['qty']).toBe(4);
  });

  it('after Escape, is the next key at once: Escape closes the editor before it returns, the focus on its cell', async () => {
    const { box, api, form } = await mount();
    api.setFocusedCell(0, 'qty');
    api.startEditingCell({ rowIndex: 0, colKey: 'qty' });
    await microtasks();
    const input = box.querySelector('.fd-grid-editor input') as HTMLInputElement;
    input.value = '9';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '9' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    // No wait at all: a key pressed straight after lands on the cell, never in the editor going away.
    expect(api.getEditingCells()).toHaveLength(0);
    expect(document.activeElement).toBe(cellOf(box, 0, 'qty'));
    expect(formLines(form)[0].values['qty']).toBe(4);
    await frames();
    expect(api.getEditingCells()).toHaveLength(0);
    expect(formLines(form)[0].values['qty']).toBe(4);
  });

  it('opens on an IME’s key with its text chosen, for the IME’s words to replace', async () => {
    const { box, api } = await mount();
    api.setFocusedCell(0, 'qty');
    const cell = cellOf(box, 0, 'qty');
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', bubbles: true }));
    await microtasks();
    const input = box.querySelector('.fd-grid-editor input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
  });
});

describe('a grid cell holding what is no number', () => {
  it('shows its own words, marked with why, and its column’s total waits for its line: never NaN, never 26 for 0x1A', async () => {
    const { box, form } = await mount();
    form.updateLine('line_ids', 'l2', 'qty', '0x1A' as never);
    await frames();
    expect(cellOf(box, 1, 'qty').textContent?.trim()).toBe('0x1A');
    expect(cellOf(box, 1, 'qty').classList.contains('fd-grid-invalid')).toBe(true);
    const total = totalOf(box, 'qty');
    expect(total.textContent).toBe('—Fix line 2 to see this total');
    expect(total.querySelector('.fd-sr-only')?.textContent).toBe('Fix line 2 to see this total');
    expect(total.textContent).not.toMatch(/NaN|26/);
    // The other column adds up as before.
    expect(totalOf(box, 'price').textContent?.trim()).toBe('E£ 2,270.00');
  });

  it('keeps text left in its editor that does not read, shows it as typed, and says why once it is left', async () => {
    const { box, api, form } = await mount();
    api.startEditingCell({ rowIndex: 0, colKey: 'qty' });
    await microtasks();
    const input = box.querySelector('.fd-grid-editor input') as HTMLInputElement;
    input.value = '12 34';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '4' }));
    api.stopEditing();
    await frames();
    expect(formLines(form)[0].values['qty']).toBe(4);
    expect(form.getState().unread['line_ids.l1.qty']?.text).toBe('12 34');
    expect(cellOf(box, 0, 'qty').textContent?.trim()).toBe('12 34');
    expect(cellOf(box, 0, 'qty').classList.contains('fd-grid-invalid')).toBe(true);
    expect(box.querySelector('.fd-grid-problems')?.textContent).toBe('Line 1: Digits are grouped in threes, like 1,234,567');
    expect((totalOf(box, 'qty').querySelector('.fd-grid-total') as HTMLElement).title).toBe('Fix line 1 to see this total');
    // Put right, the total adds up again.
    api.startEditingCell({ rowIndex: 0, colKey: 'qty' });
    await microtasks();
    const again = box.querySelector('.fd-grid-editor input') as HTMLInputElement;
    again.value = '5';
    again.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '5' }));
    api.stopEditing();
    await frames();
    expect(totalOf(box, 'qty').textContent?.trim()).toBe('11.00');
  });

  it('lets the text go when Escape puts the line back', async () => {
    const { box, api, form } = await mount();
    api.startEditingCell({ rowIndex: 0, colKey: 'qty' });
    await microtasks();
    const input = box.querySelector('.fd-grid-editor input') as HTMLInputElement;
    input.value = '12 34';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '4' }));
    input.closest('.fd-grid-editor')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    api.stopEditing(true);
    await frames();
    expect(form.getState().unread['line_ids.l1.qty']).toBeUndefined();
    expect(cellOf(box, 0, 'qty').textContent?.trim()).toBe('4.00');
  });
});

describe('a block pasted on a chosen cell', () => {
  /** Pasted: its names looked up first (none here), then written a moment after. */
  function paste(text: string) {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? text : '') } });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event;
  }
  async function chosen(locale: 'en' | 'ar' = 'en', options?: Record<string, unknown>) {
    const mounted = await mount(locale, options);
    mounted.api.setFocusedCell(0, 'qty');
    await frames();
    return mounted;
  }

  it('fills across and down, each cell read as its column reads what is typed, and says how many', async () => {
    const { box, form } = await chosen();
    expect(paste('3\t100\n4\t200\n').defaultPrevented).toBe(true);
    await microtasks();
    expect(formLines(form).map((l) => [l.values['qty'], l.values['price']])).toEqual([[3, 100], [4, 200]]);
    const note = box.querySelector('.fd-grid-paste-note') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.getAttribute('role')).toBe('status');
    expect(note.textContent).toBe('Pasted into 4 cells.');
  });

  it('reads Arabic digits, and leaves cells it cannot read and read-only ones, naming them; rows past the last line add lines', async () => {
    const { box, form } = await chosen();
    paste('٣\tabc\t9\n٤\t١٠٠\n5\t6');
    await microtasks();
    expect(formLines(form).map((l) => [l.values['qty'], l.values['price'], l.values['subtotal']])).toEqual([
      [3, 1890, 7560],
      [4, 100, 2280],
      [5, 6, null],
    ]);
    // Each named, and why where its box says why: a read-only cell is only named.
    expect(box.querySelector('.fd-grid-paste-note')?.textContent).toBe('Pasted into 5 cells. 1 line added. Not pasted: Unit price, line 1 (Unit price: “⁨abc⁩” is not a number); Subtotal, line 1');
  });

  it('adds a line for each row past the last, as the plain table does: no line for a row of nothing', async () => {
    const { box, form } = await chosen();
    paste('1\t10\n2\t20\n3\t30\n4\t40\n\t\n');
    await microtasks();
    expect(formLines(form).map((l) => [l.values['qty'], l.values['price']])).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
      [4, 40],
    ]);
    expect(box.querySelector('.fd-grid-paste-note')?.textContent).toBe('Pasted into 8 cells. 2 lines added.');
  });

  it('adds lines up to the table’s most, and says what it left past them', async () => {
    const { box, form } = await chosen('en', { max: 3 });
    paste('1\t10\n2\t20\n3\t30\n4\t40');
    await microtasks();
    expect(formLines(form).map((l) => [l.values['qty'], l.values['price']])).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
    expect(box.querySelector('.fd-grid-paste-note')?.textContent).toBe('Pasted into 6 cells. 1 line added. Only 3 lines are here, so the rest was not pasted');
  });

  it('says the lines added in the page’s language', async () => {
    const { box } = await chosen('ar');
    paste('1\t10\n2\t20\n3\t30');
    await microtasks();
    expect(box.querySelector('.fd-grid-paste-note')?.textContent).toBe('لُصق في 6 من الخلايا. أُضيف سطر واحد.');
  });

  it('speaks the page’s language', async () => {
    const { box } = await chosen('ar');
    paste('abc');
    await microtasks();
    expect(box.querySelector('.fd-grid-paste-note')?.textContent).toBe('لم يُلصق في: Quantity، السطر 1 (Quantity: «⁨abc⁩» ليس رقمًا)');
  });

  it('counts one cell as one, in the page’s language: never “1 cells”', async () => {
    const { box } = await chosen();
    paste('3');
    await microtasks();
    expect(box.querySelector('.fd-grid-paste-note')?.textContent).toBe('Pasted into 1 cell.');
    const arabic = await chosen('ar');
    paste('3');
    await microtasks();
    expect(arabic.box.querySelector('.fd-grid-paste-note')?.textContent).toBe('لُصق في خلية واحدة.');
  });
});

describe('a grid with its most lines (options.max), as the plain table keeps it', () => {
  const adds = (box: HTMLElement) => box.querySelector('.fd-lines-adds') as HTMLElement;
  const copies = (box: HTMLElement) => [...box.querySelectorAll<HTMLButtonElement>('.fd-line-copy')];

  it('hides Add once it holds its most lines, never disabled, and shows it again as one goes', async () => {
    const { box, form } = await mount('en', { max: 3 });
    expect(adds(box).hidden).toBe(false);
    (box.querySelector('.fd-lines-add[data-add="line"]') as HTMLButtonElement).click();
    await frames();
    expect(formLines(form)).toHaveLength(3);
    expect(adds(box).hidden).toBe(true);
    expect(box.querySelector('.fd-lines-add[disabled]')).toBeNull();
    form.removeLine('line_ids', formLines(form)[2].key);
    await frames();
    expect(adds(box).hidden).toBe(false);
  });

  it('hides a line’s copy button at its most lines, as Add', async () => {
    const { box, form } = await mount('en', { max: 3, copy: true });
    expect(copies(box).length).toBeGreaterThan(0);
    expect(copies(box).every((button) => !button.hidden)).toBe(true);
    form.addLine('line_ids');
    await frames();
    expect(copies(box).every((button) => button.hidden)).toBe(true);
  });

  it('adds no line with Enter at the end of the last line once full', async () => {
    const { api, form } = await mount('en', { max: 2 });
    api.startEditingCell({ rowIndex: 1, colKey: 'qty' });
    await frames();
    const editor = document.querySelector('.fd-grid-editor input') as HTMLInputElement;
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await frames();
    expect(formLines(form)).toHaveLength(2);
  });

  it('adds a line with Enter at the end of the last line while there is room, as before', async () => {
    const { api, form } = await mount('en', { max: 3 });
    api.startEditingCell({ rowIndex: 1, colKey: 'qty' });
    await frames();
    const editor = document.querySelector('.fd-grid-editor input') as HTMLInputElement;
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await frames();
    expect(formLines(form)).toHaveLength(3);
  });
});

describe('a grid on a page that asks for its labels small inside sentences', () => {
  it('names the cell a line’s worked-out amount waits for small; without it, as before', async () => {
    for (const [lower, words] of [
      [true, 'Fix quantity to see this line’s subtotal'],
      [false, 'Fix Quantity to see this line’s Subtotal'],
    ] as const) {
      const host = document.createElement('div');
      document.body.append(host);
      const page = { ...order, lowerLabels: lower } as Page;
      handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { 'sale.order': { 1: { line_ids: lines } } } }), recordId: 1, widgets: gridWidgets });
      await handle.form.settled();
      await frames();
      const box = host.querySelector('[data-node="f-lines"] .fd-grid-lines') as HTMLElement;
      const api = gridApiOf(box)!;
      api.startEditingCell({ rowIndex: 0, colKey: 'qty' });
      await microtasks();
      const input = box.querySelector('.fd-grid-editor input') as HTMLInputElement;
      input.value = '12 34';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '4' }));
      api.stopEditing();
      await frames();
      expect(cellOf(box, 0, 'subtotal').textContent).toContain(words);
      handle.destroy();
      handle = null;
    }
  });
});
