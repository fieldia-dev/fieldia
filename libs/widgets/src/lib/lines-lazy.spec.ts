import { createForm, createMemoryDataSource, type Field, type FieldNode, type Line, type Page, type Value } from '@fieldia/core';
import { plainLinesWidget } from './lines-plain';
import { linesPart, type PartFactory } from './widget-parts';
import { builtInWidgets, createWidget, linesWidget, widgetPart, type Widget, type WidgetFactory } from './widgets';

/**
 * A table of lines (a one2many's) and a many2many's table of records come in
 * the lines part (parts.ts). Before it has come — a widget made by something
 * that did not wait for it, as the viewer does — what they hold is drawn as
 * plain words, read only, and the value is kept; the part's table then takes
 * its place with the last state it was given. This file starts with no part
 * loaded (src/test-parts.ts leaves it so).
 */

const page = {
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'order' },
  fields: {
    currency: { type: 'char', label: 'Currency' },
    line_ids: {
      type: 'one2many',
      label: 'Order lines',
      relation: 'order.line',
      lineKinds: { field: 'display_type', text: 'name' },
      sequenceField: 'sequence',
      fields: {
        sequence: { type: 'integer', label: 'Sequence' },
        display_type: { type: 'selection', label: 'Line type', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
        name: { type: 'char', label: 'Description' },
        quantity: { type: 'integer', label: 'Quantity' },
        price: { type: 'monetary', label: 'Price', currency: 'EGP' },
        done: { type: 'boolean', label: 'Done' },
      },
    },
    tag_ids: {
      type: 'many2many',
      label: 'Requirements',
      relation: 'legal.compliance',
      fields: { name: { type: 'char', label: 'Requirement' } },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-lines', field: 'line_ids', columns: ['name', 'quantity', 'price'] },
      { type: 'field', id: 'f-tags', field: 'tag_ids', columns: ['name'] },
    ],
  },
} as unknown as Page;

const LINES: Line[] = [
  { key: 'a', values: { sequence: 1, display_type: 'section', name: 'Workstations' } },
  { key: 'b', values: { sequence: 2, display_type: null, name: 'Desk', quantity: 2, price: 1200 } },
  // A line with nothing in its columns yet: never nothing.
  { key: 'c', values: { sequence: 3, display_type: null, name: null, quantity: null, price: null } },
];

const node = (field: string, more: Partial<FieldNode> = {}): FieldNode => ({ type: 'field', id: `f-${field}`, field, ...more }) as FieldNode;
const fieldOf = (name: string) => page.fields[name] as Field;

function mount(name: string, value: Value, shown: FieldNode) {
  const dataSource = createMemoryDataSource({ records: { 'legal.compliance': { 1: { name: 'Anti-money laundering check' }, 2: { name: 'Conflict search' } } } });
  const form = createForm({ page, dataSource, values: { [name]: value } as never });
  const widget: Widget = createWidget({ form, name, field: fieldOf(name), node: shown, id: `w-${name}`, document });
  const box = document.createElement('div');
  box.append(widget.element);
  document.body.append(box);
  const refresh = () => widget.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, widget, box };
}

/** The words of each line, a no-break space (as money is written) read as a space. */
const words = (element: Element) => [...element.querySelectorAll('[role="listitem"]')].map((item) => item.textContent?.replace(/\u00a0/g, ' '));

afterEach(() => document.body.replaceChildren());

describe('the lines part', () => {
  it('is named by the table of lines and the table of records, and by nothing else that draws a one2many or a many2many', () => {
    expect((builtInWidgets['one2many'] as PartFactory).partOf(node('line_ids'))).toBe(linesPart);
    expect(builtInWidgets['one2many']).toBe(linesWidget);
    expect((builtInWidgets['many2many.table'] as PartFactory).partOf(node('tag_ids', { columns: ['name'] }))).toBe(linesPart);
    expect(widgetPart(fieldOf('line_ids'), node('line_ids'))).toBe(linesPart);
    expect(widgetPart(fieldOf('tag_ids'), node('tag_ids', { columns: ['name'] }))).toBe(linesPart);
    expect(widgetPart(fieldOf('tag_ids'), node('tag_ids', { widget: 'table', columns: ['name'] }))).toBe(linesPart);
    // Cards, tags and ticks: the main script's own.
    expect(widgetPart(fieldOf('line_ids'), node('line_ids', { widget: 'cards' }))).toBeUndefined();
    expect(widgetPart(fieldOf('tag_ids'), node('tag_ids'))).toBeUndefined();
    expect(widgetPart(fieldOf('tag_ids'), node('tag_ids', { widget: 'checkboxes' }))).toBeUndefined();
    // The app's own widget for the lines (a grid): none.
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(widgetPart(fieldOf('line_ids'), node('line_ids', { widget: 'grid' }), { 'one2many.grid': own })).toBeUndefined();
    expect(widgetPart(fieldOf('line_ids'), node('line_ids'), { one2many: own })).toBeUndefined();
  });
});

describe('a table drawn before the lines part came', () => {
  it('shows each line as plain words, read only, never nothing while there are lines; the value kept; then the table in its place, with the last lines', async () => {
    expect(linesPart.loaded).toBeUndefined();
    const { form, widget, box } = mount('line_ids', LINES, (page.layout as { children: FieldNode[] }).children[0]);
    const before = form.getState().values['line_ids'];
    // Meanwhile its lines as words: a section's text, a line's values as its cells show them at rest, a line with none by its place.
    expect(widget.element.classList.contains('fd-lines-plain')).toBe(true);
    expect(words(widget.element)).toEqual(['Workstations', 'Desk · 2 · E£ 1,200.00', 'line 3']);
    expect(widget.element.querySelector('input, select, textarea, button')).toBeNull();
    // Nothing written to the value: the same lines, the record not changed by drawing them.
    expect(form.getState().values['line_ids']).toBe(before);
    expect(form.getState().dirty).toEqual([]);
    expect(document.getElementById('fieldia-lines-styles')).toBeNull();
    // A line changed and one added meanwhile, as the page's own steps or another box would: shown as they are.
    form.updateLine('line_ids', 'c', 'name', 'Chair');
    const added = form.addLine('line_ids', { name: 'Lamp', quantity: 1 });
    expect(words(widget.element)).toEqual(['Workstations', 'Desk · 2 · E£ 1,200.00', 'Chair', 'Lamp · 1']);
    const meanwhile = form.getState().values['line_ids'] as Line[];

    await linesPart.load();
    await Promise.resolve();
    // The table in the same place, drawn from the last lines it was given; the lines themselves as they were.
    expect(box.children).toHaveLength(1);
    expect(box.firstElementChild).toBe(widget.element);
    expect(widget.element.classList.contains('fd-lines')).toBe(true);
    expect(widget.element.querySelector('.fd-lines-plain')).toBeNull();
    const rows = [...widget.element.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
    expect(rows.map((row) => row.dataset['line'])).toEqual(['a', 'b', 'c', added]);
    expect((rows[3].querySelector('td[data-column="name"] input') as HTMLInputElement).value).toBe('Lamp');
    expect(form.getState().values['line_ids']).toBe(meanwhile);
    // Its own sheet came with it, in its place among Fieldia's.
    expect(document.getElementById('fieldia-lines-styles')).not.toBeNull();
    // From now on it is the part's own, at once, and edits its lines.
    const again = mount('line_ids', LINES, node('line_ids'));
    expect(again.widget.element.querySelector('.fd-lines-table')).not.toBeNull();
    const quantity = again.widget.element.querySelector('tr[data-line="b"] td[data-column="quantity"] input') as HTMLInputElement;
    quantity.focus();
    quantity.value = '3';
    quantity.dispatchEvent(new Event('input', { bubbles: true }));
    quantity.blur();
    expect((again.form.getState().values['line_ids'] as Line[])[1].values['quantity']).toBe(3);
    widget.destroy?.();
    again.widget.destroy?.();
  });

  it('a many2many’s table of records: their names meanwhile, then its table of them', async () => {
    const linked = [
      { id: 1, label: 'Anti-money laundering check' },
      { id: 2, label: 'Conflict search' },
    ];
    // The part is in by now (the test above brought it): a fresh module set starts without it.
    await jest.isolateModulesAsync(async () => {
      const { createForm: freshForm, createMemoryDataSource: freshSource } = await import('@fieldia/core');
      const fresh = await import('./widgets');
      const { linesPart: freshPart } = await import('./widget-parts');
      expect(freshPart.loaded).toBeUndefined();
      const form = freshForm({ page, dataSource: freshSource(), values: { tag_ids: linked } as never });
      const widget = fresh.createWidget({ form, name: 'tag_ids', field: fieldOf('tag_ids'), node: node('tag_ids', { columns: ['name'] }), id: 'w-tags', document });
      document.body.append(widget.element);
      widget.update({ value: form.getState().values['tag_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
      expect(words(widget.element)).toEqual(['Anti-money laundering check', 'Conflict search']);
      expect(form.getState().values['tag_ids']).toEqual(linked);
      await freshPart.load();
      await Promise.resolve();
      expect(widget.element.classList.contains('fd-links')).toBe(true);
      expect([...widget.element.querySelectorAll('tbody tr')].map((row) => (row as HTMLElement).dataset['record'])).toEqual(['1', '2']);
      expect(form.getState().values['tag_ids']).toEqual(linked);
      widget.destroy?.();
    });
  });

  it('an empty table meanwhile: no words, its value left as it is, and words again as soon as it has a line', () => {
    const form = createForm({ page, values: { line_ids: [] } as never });
    const plain = plainLinesWidget({ form, name: 'line_ids', field: fieldOf('line_ids'), node: node('line_ids', { columns: ['name', 'quantity'], options: { min: 2 } }), id: 'w-plain', document });
    const show = () => plain.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: true, invalid: true, describedBy: 'w-plain-error' });
    show();
    expect(plain.element.children).toHaveLength(0);
    // The lines a table starts with at least are the table's to add, once it is drawn: none meanwhile.
    expect(form.getState().values['line_ids']).toEqual([]);
    expect(plain.element.getAttribute('aria-invalid')).toBe('true');
    expect(plain.element.getAttribute('aria-describedby')).toBe('w-plain-error');
    form.addLine('line_ids', { name: 'Desk' });
    show();
    expect(words(plain.element)).toEqual(['Desk']);
  });
});
