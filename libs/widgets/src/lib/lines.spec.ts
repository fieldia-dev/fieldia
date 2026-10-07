import { createForm, createMemoryDataSource, type Field, type FieldNode, type Line, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

const page = {
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'order' },
  fields: {
    line_ids: {
      type: 'one2many',
      label: 'Order lines',
      relation: 'order.line',
      fields: {
        product_id: { type: 'many2one', label: 'Product', relation: 'product', required: true },
        quantity: { type: 'integer', label: 'Quantity', min: 1 },
        note: { type: 'char', label: 'Note' },
      },
    },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'line_ids', columns: ['product_id', 'quantity'] }] },
} as unknown as Page;

function mount(readonly = false) {
  const dataSource = createMemoryDataSource({ records: { product: { 1: { name: 'Green tea' }, 2: { name: 'Espresso' } } } });
  const form = createForm({ page, dataSource });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'line_ids', field: page.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

const lines = (form: ReturnType<typeof mount>['form']) => form.getState().values['line_ids'] as Line[];
const rows = (el: Element) => [...el.querySelectorAll('tbody tr')];
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('one2many lines', () => {
  it('shows the chosen columns as a table', () => {
    const { el } = mount();
    // A grip to move each line by comes first.
    expect([...el.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['', 'Product', 'Quantity', '']);
  });

  it('adds a line and focuses its first cell', () => {
    const { form, el } = mount();
    (el.querySelector('.fd-lines-add') as HTMLButtonElement).click();
    expect(lines(form)).toHaveLength(1);
    expect(rows(el)).toHaveLength(1);
    expect(document.activeElement).toBe(rows(el)[0].querySelector('input'));
  });

  it('edits a cell into that line only', () => {
    const { form, el } = mount();
    form.addLine('line_ids', { quantity: 1 });
    form.addLine('line_ids', { quantity: 2 });
    const quantity = rows(el)[1].querySelectorAll('input')[1] as HTMLInputElement;
    type(quantity, '5');
    expect(lines(form).map((l) => l.values['quantity'])).toEqual([1, 5]);
  });

  it('keeps the other rows, and focus, when a line is added or removed', () => {
    const { form, el } = mount();
    form.addLine('line_ids');
    const first = rows(el)[0];
    const cell = first.querySelectorAll('input')[1] as HTMLInputElement;
    cell.focus();
    form.addLine('line_ids');
    expect(rows(el)[0]).toBe(first);
    expect(document.activeElement).toBe(cell);
    (rows(el)[1].querySelector('[aria-label="Delete line"]') as HTMLButtonElement).click();
    expect(rows(el)).toEqual([first]);
  });

  it('searches a relation inside a line', async () => {
    const { form, el } = mount();
    form.addLine('line_ids');
    const product = rows(el)[0].querySelector('input[role=combobox]') as HTMLInputElement;
    type(product, 'esp');
    await new Promise((resolve) => setTimeout(resolve, 260));
    product.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    product.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(lines(form)[0].values['product_id']).toEqual({ id: 2, label: 'Espresso' });
  });

  it('marks the cell a validation error belongs to', () => {
    const { form, el } = mount();
    form.addLine('line_ids', { quantity: 0 });
    form.validate();
    const cells = rows(el)[0].querySelectorAll('td:not(.fd-lines-grip)');
    expect(cells[0].querySelector('.fd-cell-error')?.textContent).toBe('Product is required');
    expect(cells[1].querySelector('.fd-cell-error')?.textContent).toBe('Quantity must be at least 1');
    expect(cells[1].querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('names every cell for assistive technology', () => {
    const { form, el } = mount();
    form.addLine('line_ids');
    const quantity = rows(el)[0].querySelectorAll('input')[1] as HTMLInputElement;
    expect(el.querySelector(`label[for="${quantity.id}"]`)?.textContent).toBe('Quantity');
  });

  it('offers no add or delete when readonly', () => {
    const { form, el } = mount(true);
    form.addLine('line_ids', { quantity: 3 });
    expect(el.querySelector('.fd-lines-add')?.closest('[hidden]')).not.toBeNull();
    expect(el.querySelector('[aria-label="Delete line"]')).toBeNull();
    expect((rows(el)[0].querySelectorAll('input')[1] as HTMLInputElement).readOnly).toBe(true);
  });
});

describe('one2many lines with sections and notes', () => {
  const sectioned = {
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'order' },
    fields: {
      line_ids: {
        type: 'one2many',
        label: 'Order lines',
        relation: 'order.line',
        lineKinds: { field: 'display_type', text: 'name' },
        sequenceField: 'sequence',
        fields: {
          sequence: { type: 'integer', label: 'Sequence' },
          display_type: { type: 'selection', label: 'Line type', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
          product_id: { type: 'many2one', label: 'Product', relation: 'product', required: true },
          name: { type: 'text', label: 'Description' },
          quantity: { type: 'integer', label: 'Quantity' },
        },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'line_ids' }] },
  } as unknown as Page;

  function mountSectioned() {
    const form = createForm({ page: sectioned });
    const node = (sectioned.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'line_ids', field: sectioned.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return { form, el: widget.element };
  }

  it('never shows the field that says what a line is, or the one that keeps their order, as a column', () => {
    const { el } = mountSectioned();
    expect([...el.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['', 'Product', 'Description', 'Quantity', '']);
  });

  it('shows a section as one wide heading and a note as one wide text, each with its delete button', () => {
    const { form, el } = mountSectioned();
    form.addLine('line_ids', { display_type: 'section', name: 'Workstations' });
    form.addLine('line_ids', { product_id: { id: 1, label: 'Chair' }, name: 'Black', quantity: 2 });
    form.addLine('line_ids', { display_type: 'note', name: 'Fitted on delivery day.' });
    const [section, item, note] = rows(el);
    expect(section.classList.contains('fd-line-section')).toBe(true);
    expect(section.querySelectorAll('td')).toHaveLength(3);
    expect((section.querySelectorAll('td')[1] as HTMLTableCellElement).colSpan).toBe(3);
    expect((section.querySelector('input') as HTMLInputElement).value).toBe('Workstations');
    expect(item.querySelectorAll('td')).toHaveLength(5);
    expect(note.classList.contains('fd-line-note')).toBe(true);
    expect((note.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Fitted on delivery day.');
    expect(note.querySelector('[aria-label="Delete line"]')).not.toBeNull();
  });

  it('adds a section or a note from its own button and puts the cursor in its text', () => {
    const { form, el } = mountSectioned();
    expect([...el.querySelectorAll('.fd-lines-add')].map((b) => b.textContent)).toEqual(['+ Add a line', '+ Add a section', '+ Add a note']);
    (el.querySelector('[data-add="section"]') as HTMLButtonElement).click();
    expect(lines(form)[0].values['display_type']).toBe('section');
    expect(document.activeElement).toBe(rows(el)[0].querySelector('input'));
    type(rows(el)[0].querySelector('input') as HTMLInputElement, 'Lighting');
    expect(lines(form)[0].values['name']).toBe('Lighting');
    (el.querySelector('[data-add="note"]') as HTMLButtonElement).click();
    expect(lines(form)[1].values['display_type']).toBe('note');
    expect(document.activeElement).toBe(rows(el)[1].querySelector('textarea'));
  });

  it('adds up the totals columns in a footer, leaving sections and notes out, and keeps it current', () => {
    const totalled = JSON.parse(JSON.stringify(sectioned)) as Page & { layout: { children: FieldNode[] } };
    totalled.layout.children[0] = { ...totalled.layout.children[0], totals: ['quantity'] };
    const form = createForm({ page: totalled });
    const node = totalled.layout.children[0];
    const widget = createWidget({ form, name: 'line_ids', field: totalled.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    // A section that still holds a number (a line turned into one) is not counted.
    form.addLine('line_ids', { display_type: 'section', name: 'Workstations', quantity: 3 });
    const first = form.addLine('line_ids', { quantity: 2 });
    form.addLine('line_ids', { quantity: 5 });
    const footer = () => [...widget.element.querySelectorAll('tfoot td')].map((td) => td.textContent);
    expect(footer()).toEqual(['', 'Total', '', '7', '']);
    form.updateLine('line_ids', first, 'quantity', 10);
    expect(footer()).toEqual(['', 'Total', '', '15', '']);
  });

  it('leaves out an optional column the page starts hidden', () => {
    const optional = JSON.parse(JSON.stringify(sectioned)) as Page & { layout: { children: FieldNode[] } };
    optional.layout.children[0] = { ...optional.layout.children[0], optionalColumns: { quantity: 'hide', name: 'show' } };
    const form = createForm({ page: optional });
    const widget = createWidget({ form, name: 'line_ids', field: optional.fields['line_ids'] as Field, node: optional.layout.children[0], id: 'fd-lines', document, labels: WIDGET_LABELS.en });
    expect([...widget.element.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['', 'Product', 'Description', '']);
  });

  it('names its add buttons as the page says: a line, a section and a note', () => {
    const named = JSON.parse(JSON.stringify(sectioned)) as Page & { layout: { children: FieldNode[] } };
    named.layout.children[0] = { ...named.layout.children[0], options: { addLabel: 'Add a product', addSectionLabel: 'Add a heading', addNoteLabel: 'Add a remark' } };
    const form = createForm({ page: named });
    const widget = createWidget({ form, name: 'line_ids', field: named.fields['line_ids'] as Field, node: named.layout.children[0], id: 'fd-lines', document, labels: WIDGET_LABELS.en });
    expect([...widget.element.querySelectorAll('.fd-lines-add')].map((b) => b.textContent)).toEqual(['+ Add a product', '+ Add a heading', '+ Add a remark']);
  });

  it('offers no section or note buttons to lines without kinds', () => {
    const { el } = mount();
    expect(el.querySelectorAll('.fd-lines-add')).toHaveLength(1);
  });
});

describe('a line dragged by its grip', () => {
  /** Three lines, 40 px tall each from the top, as a browser lays them out. */
  function three() {
    const { form, el } = mount();
    for (const note of ['a', 'b', 'c']) {
      form.addLine('line_ids');
      form.updateLine('line_ids', lines(form).at(-1)!.key, 'note', note);
    }
    rows(el).forEach((tr, i) => ((tr as HTMLElement).getBoundingClientRect = () => ({ top: i * 40, height: 40, bottom: i * 40 + 40 }) as DOMRect));
    const press = (tr: Element, type: string, y: number) => tr.querySelector('.fd-line-grip')!.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientY: y }));
    const notes = () => lines(form).map((line) => line.values['note']);
    return { el, press, notes };
  }

  it('follows the pointer, the lines it passes making room, and moves once it is let go', () => {
    const { el, press, notes } = three();
    const [a, b, c] = rows(el) as HTMLElement[];
    press(a, 'pointerdown', 20);
    press(a, 'pointermove', 22);
    // A press that hardly moves is not a drag yet.
    expect(a.classList.contains('fd-line-lifted')).toBe(false);
    press(a, 'pointermove', 65);
    expect(a.classList.contains('fd-line-lifted')).toBe(true);
    expect(a.style.transform).toBe('translateY(45px)');
    expect(b.style.transform).toBe('translateY(-40px)');
    expect(c.style.transform).toBe('');
    // Nothing is changed while it is held.
    expect(notes()).toEqual(['a', 'b', 'c']);
    press(a, 'pointerup', 65);
    expect(notes()).toEqual(['b', 'a', 'c']);
    expect(rows(el).map((tr) => (tr as HTMLElement).style.transform)).toEqual(['', '', '']);
    expect(el.querySelector('.fd-line-lifted, .fd-lines-dragging')).toBeNull();
  });

  it('moves up past the lines above it', () => {
    const { el, press, notes } = three();
    const [a, b, c] = rows(el) as HTMLElement[];
    press(c, 'pointerdown', 100);
    press(c, 'pointermove', 15);
    expect([a.style.transform, b.style.transform]).toEqual(['translateY(40px)', 'translateY(40px)']);
    press(c, 'pointerup', 15);
    expect(notes()).toEqual(['c', 'a', 'b']);
  });

  it('goes back where it was on Escape, and on a cancelled pointer', () => {
    const { el, press, notes } = three();
    const [a, b] = rows(el) as HTMLElement[];
    press(a, 'pointerdown', 20);
    press(a, 'pointermove', 65);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect([a.style.transform, b.style.transform]).toEqual(['', '']);
    press(a, 'pointerup', 65);
    expect(notes()).toEqual(['a', 'b', 'c']);
    press(a, 'pointerdown', 20);
    press(a, 'pointermove', 65);
    press(a, 'pointercancel', 65);
    expect(notes()).toEqual(['a', 'b', 'c']);
    expect(el.querySelector('.fd-line-lifted')).toBeNull();
  });
});

describe('a table’s columns by their values', () => {
  it('are sized as lines come and go, never while a cell is typed in', () => {
    const { form, el } = mount();
    form.addLine('line_ids');
    const key = lines(form)[0].key;
    const width = () => (el.querySelector('thead th[data-column="note"], thead th[data-column="product_id"]') as HTMLElement).style.width;
    const before = width();
    form.updateLine('line_ids', key, 'product_id', { id: 2, label: 'A much longer product name than any before it' });
    // Typed in: the column stays where it was under the person's hands.
    expect(width()).toBe(before);
    form.addLine('line_ids');
    // A line came: the columns are measured again, with the long name.
    expect(width()).not.toBe(before);
  });
});
