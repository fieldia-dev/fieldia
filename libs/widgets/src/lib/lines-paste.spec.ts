import { createForm, createMemoryDataSource, type Field, type FieldNode, type Line, type Page } from '@fieldia/core';
// The widgets first: lines.ts and widgets.ts import each other, and the table is found among the widgets once both are in.
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

/**
 * A block copied from a spreadsheet, pasted in a table of lines' cell (as the
 * grid takes one, cell-paste.ts): across and down from that cell, each cell
 * read as its column reads what is typed, lines added for the rows past the
 * last, and what did not go in named with why — one value, or a paragraph's
 * lines, still the box's own paste.
 */

const page = (options: Record<string, unknown> = {}) =>
  ({
    fieldia: '0.9',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: {
      line_ids: {
        type: 'one2many',
        label: 'Order lines',
        relation: 'sale.order.line',
        lineKinds: { field: 'kind', text: 'name' },
        fields: {
          kind: { type: 'selection', label: 'Kind', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
          name: { type: 'char', label: 'Description' },
          notes: { type: 'text', label: 'Notes' },
          qty: { type: 'float', label: 'Quantity', digits: [8, 2] },
          price: { type: 'monetary', label: 'Unit price', currency: 'EGP' },
          subtotal: { type: 'monetary', label: 'Subtotal', currency: 'EGP', readonly: true },
          due: { type: 'date', label: 'Due' },
        },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'line_ids', columns: ['name', 'notes', 'qty', 'price', 'subtotal', 'due'], options }] },
  }) as unknown as Page;

function mount(options: Record<string, unknown> = {}, locale: 'en' | 'ar' = 'en') {
  const shown = page(options);
  const form = createForm({ page: shown, dataSource: createMemoryDataSource({}) });
  const node = (shown.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'line_ids', field: shown.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS[locale], locale });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  form.addLine('line_ids', { name: 'Office chair', qty: 4, price: 1890 });
  form.addLine('line_ids', { name: 'Desk lamp', qty: 6, price: 380 });
  return { form, el: widget.element };
}
const lines = (form: { getState(): { values: Record<string, unknown> } }) => form.getState().values['line_ids'] as Line[];
const box = (el: Element, row: number, column: string) => el.querySelectorAll('tbody tr')[row].querySelector(`td[data-column="${column}"] input, td[data-column="${column}"] textarea`) as HTMLInputElement;
const note = (el: Element) => el.querySelector('.fd-lines-paste-note') as HTMLElement;
/** A paste's names are looked up before anything is written: its writes come a moment after. */
const pasted = () => new Promise((resolve) => setTimeout(resolve, 0));
function paste(target: HTMLElement, text: string) {
  target.focus();
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? text : '') } });
  target.dispatchEvent(event);
  return event;
}

describe('a block pasted on a table of lines', () => {
  it('fills across and down from the cell, each cell read as its column reads what is typed, and says how many', async () => {
    const { form, el } = mount();
    expect(paste(box(el, 0, 'qty'), '3\t1,250.50\r\n٤\t200\r\n').defaultPrevented).toBe(true);
    await pasted();
    expect(lines(form).map((line) => [line.values['qty'], line.values['price']])).toEqual([
      [3, 1250.5],
      [4, 200],
    ]);
    expect(note(el).hidden).toBe(false);
    expect(note(el).textContent).toBe('Pasted into 4 cells.');
  });

  it('adds a line for each row past the last, as many as there are', async () => {
    const { form, el } = mount();
    paste(box(el, 1, 'name'), 'Desk lamp\tWarm white\t6\nMonitor arm\tFor the 27″ screens\t2\nCable tray\t\t10\n');
    await pasted();
    expect(lines(form).map((line) => [line.values['name'], line.values['notes'] ?? null, line.values['qty']])).toEqual([
      ['Office chair', null, 4],
      ['Desk lamp', 'Warm white', 6],
      ['Monitor arm', 'For the 27″ screens', 2],
      ['Cable tray', null, 10],
    ]);
    expect(note(el).textContent).toBe('Pasted into 9 cells. 2 lines added.');
  });

  it('names a cell that cannot take its text, with why, and leaves it as it was; a read-only cell too', async () => {
    const { form, el } = mount();
    paste(box(el, 0, 'qty'), '2\tabc\t99\t15/13/2026');
    await pasted();
    expect(lines(form)[0].values).toMatchObject({ qty: 2, price: 1890 });
    expect(note(el).textContent).toBe(
      'Pasted into 1 cell. Not pasted: Unit price, line 1 (Unit price: “⁨abc⁩” is not a number); Subtotal, line 1; Due, line 1 (Due: months go from 1 to 12)'
    );
  });

  it('reads dates in the page’s order and an amount written with its currency', async () => {
    const { form, el } = mount();
    paste(box(el, 0, 'price'), 'EGP 1,500\t\t3/11/2026');
    await pasted();
    expect(lines(form)[0].values).toMatchObject({ price: 1500, due: '2026-11-03' });
  });

  it('leaves what is past the most lines the table may have, and says so', async () => {
    const { form, el } = mount({ max: 3 });
    paste(box(el, 1, 'name'), 'Lamp\nArm\nTray\nShelf');
    await pasted();
    expect(lines(form).map((line) => line.values['name'])).toEqual(['Office chair', 'Lamp', 'Arm']);
    expect(note(el).textContent).toBe('Pasted into 2 cells. 1 line added. Only 3 lines are here, so the rest was not pasted');
  });

  it('names a cell on a section’s row by the section’s words', async () => {
    const { form, el } = mount();
    form.addLine('line_ids', { kind: 'section', name: 'Lighting' });
    paste(box(el, 1, 'qty'), '7\n8');
    await pasted();
    expect(lines(form)[1].values['qty']).toBe(7);
    expect(note(el).textContent).toBe('Pasted into 1 cell. Not pasted: Quantity, at “Lighting”');
  });

  it('leaves one value to the box’s own paste, and a paragraph’s lines to the paragraph', () => {
    const { el } = mount();
    /** Whether the box itself heard the paste: the table took none of it. */
    const theBoxs = (target: HTMLElement, text: string) => {
      let heard = false;
      const hear = () => (heard = true);
      target.addEventListener('paste', hear);
      paste(target, text);
      target.removeEventListener('paste', hear);
      return heard;
    };
    expect(theBoxs(box(el, 0, 'qty'), '12')).toBe(true);
    expect(theBoxs(box(el, 0, 'qty'), '12\r\n')).toBe(true);
    expect(theBoxs(box(el, 0, 'notes'), 'Two lines\nof notes')).toBe(true);
    expect(note(el).hidden).toBe(true);
    expect(theBoxs(box(el, 0, 'qty'), '1\t2')).toBe(false);
  });

  it('says it in Arabic', async () => {
    const { el } = mount({}, 'ar');
    paste(box(el, 0, 'qty'), '٣\t١٠٠');
    await pasted();
    expect(note(el).textContent).toBe('لُصق في 2 من الخلايا.');
  });

  it('lets the note go once the person types on', async () => {
    const { el } = mount();
    paste(box(el, 0, 'qty'), '3\t100');
    await pasted();
    box(el, 0, 'qty').dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
    expect(note(el).hidden).toBe(true);
  });
});

describe('a block pasted on lines with a link: each row its own line, names read as typing reads them', () => {
  const linked = {
    fieldia: '0.9',
    id: 'order',
    data: { kind: 'record', model: 'sale.order' },
    fields: {
      line_ids: {
        type: 'one2many',
        label: 'Order lines',
        relation: 'sale.order.line',
        fields: {
          product_id: { type: 'many2one', label: 'Product', relation: 'product' },
          name: { type: 'char', label: 'Description' },
          qty: { type: 'float', label: 'Quantity', digits: [8, 2] },
          price: { type: 'monetary', label: 'Unit price', currency: 'EGP' },
        },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'line_ids', columns: ['product_id', 'name', 'qty', 'price'] }] },
  } as unknown as Page;
  const products = { 1: { name: 'Desk lamp, LED' }, 2: { name: 'Monitor arm, dual' }, 3: { name: 'Cable tray, 120 cm' }, 4: { name: 'Shelf' }, 5: { name: 'shelf' } };

  function mountLinked(search?: () => Promise<never>) {
    const source = createMemoryDataSource({ records: { product: products } });
    const form = createForm({ page: linked, dataSource: search ? { ...source, search } : source });
    const node = (linked.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'line_ids', field: linked.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en, locale: 'en' });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    form.addLine('line_ids', { product_id: { id: 1, label: 'Desk lamp, LED' }, name: 'Warm white', qty: 2, price: 380 });
    return { form, el: widget.element };
  }
  const shown = (form: { getState(): { values: Record<string, unknown> } }) =>
    lines(form).map((line) => [(line.values['product_id'] as { label: string } | null)?.label ?? null, line.values['name'] ?? null, line.values['qty'] ?? null, line.values['price'] ?? null]);
  const settledPaste = async () => {
    for (let i = 0; i < 5; i++) await pasted();
  };

  it('reads each row’s product by its exact name, in any case, and puts the row on its own line', async () => {
    const { form, el } = mountLinked();
    paste(box(el, 0, 'product_id'), 'MONITOR ARM, DUAL\tTwo screens\t3\t1200\nCable tray, 120 cm\tUnder the desks\t6\t250');
    await settledPaste();
    expect(shown(form)).toEqual([
      ['Monitor arm, dual', 'Two screens', 3, 1200],
      ['Cable tray, 120 cm', 'Under the desks', 6, 250],
    ]);
    expect(note(el).textContent).toBe('Pasted into 8 cells. 1 line added.');
  });

  it('refuses a row whose name reads as no record, or as several, whole — never its cells on another product’s line', async () => {
    const { form, el } = mountLinked();
    paste(box(el, 0, 'product_id'), 'Laser printer\tTwo screens\t3\t1200\nShelf\tOak\t1\t90\nCable tray, 120 cm\tUnder the desks\t6\t250');
    await settledPaste();
    expect(shown(form)).toEqual([
      ['Desk lamp, LED', 'Warm white', 2, 380],
      ['Cable tray, 120 cm', 'Under the desks', 6, 250],
    ]);
    expect(note(el).textContent).toBe(
      'Pasted into 4 cells. 1 line added. Not pasted: the row starting “⁨Laser printer⁩”, none of it (Product: nothing is called “⁨Laser printer⁩”); the row starting “⁨Shelf⁩”, none of it (Product: more than one is called “⁨Shelf⁩”)'
    );
  });

  it('says a name it could not look up, the source failing, and pastes none of that row', async () => {
    const { form, el } = mountLinked(() => Promise.reject(new Error('offline')));
    paste(box(el, 0, 'product_id'), 'Monitor arm, dual\tTwo screens\t3\t1200');
    await settledPaste();
    expect(shown(form)).toEqual([['Desk lamp, LED', 'Warm white', 2, 380]]);
    expect(note(el).textContent).toBe('Not pasted: the row starting “⁨Monitor arm, dual⁩”, none of it (Product: “⁨Monitor arm, dual⁩” could not be looked up)');
  });

  it('a row with its product left empty empties the line’s product, as typing nothing does', async () => {
    const { form, el } = mountLinked();
    paste(box(el, 0, 'product_id'), '\tNo product\t1\t5');
    await settledPaste();
    expect(shown(form)).toEqual([[null, 'No product', 1, 5]]);
  });
});
