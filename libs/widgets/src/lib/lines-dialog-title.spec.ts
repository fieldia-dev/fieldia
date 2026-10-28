import { createForm, type Field, type FieldNode, type Line, type Locale, type Page, type Values } from '@fieldia/core';
import { createWidget, type WidgetDialogs } from './widgets';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { ar } from './locales/ar';
import { es } from './locales/es';
import { mountKind, press } from './test-kinds';

/**
 * A line opened in a dialog is titled as one record — by the words its table names it by, the same its ↑ and ↓ and a
 * move said aloud name it by — never by the table's plural (the 0.36 walk: one sales order line titled "Order lines",
 * one tender requirement "Requirements"). A card is titled as its card is ("Contact 2", the page's own word for one).
 */

/** The titles the dialogs were asked for, in order: a record's page or the line's fields. */
function dialogs(titles: string[]): WidgetDialogs {
  return {
    canOpen: () => true,
    openRecord: async (_model, request) => (titles.push(`record: ${request.title}`), null),
    searchMore: async () => null,
    editValues: async (request) => (titles.push(request.title), null),
  };
}

const ORDER = {
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    line_ids: {
      type: 'one2many',
      label: 'Order lines',
      relation: 'sale.order.line',
      lineKinds: { field: 'display_type', text: 'name' },
      fields: {
        display_type: { type: 'selection', label: 'Line type', options: [{ value: 'section', label: 'Section' }] },
        qty: { type: 'float', label: 'Quantity' },
        product_id: { type: 'many2one', label: 'Product', relation: 'product' },
        name: { type: 'char', label: 'Description' },
      },
    },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'line_ids', columns: ['qty', 'product_id', 'name'], lineOpens: 'fields' }] },
} as unknown as Page;

const orderLines = {
  line_ids: [
    { key: 's', values: { display_type: 'section', name: 'Workstations', qty: null, product_id: null } },
    { key: 'a', values: { display_type: null, qty: 2, product_id: { id: 4, label: 'Office chair, ergonomic' }, name: 'Black mesh back' } },
    { key: 'b', values: { display_type: null, qty: 1, product_id: null, name: '  ' } },
    { key: 'c', values: { display_type: null, qty: 3, product_id: null, name: 'Cable trays' } },
  ],
};

function mount(page: Page, values: Values, titles: string[], locale: Locale = 'en', labels: WidgetLabels = WIDGET_LABELS.en) {
  const form = createForm({ page, values });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: node.field, field: page.fields[node.field] as Field, node, id: 'fd-x', document, labels, locale, dialogs: dialogs(titles) });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const open = (el: Element, key: string) => (el.querySelector(`tr[data-line="${key}"] button.fd-line-open`) as HTMLButtonElement).click();

describe('a table’s line in a dialog is titled as one line', () => {
  it('by its first column holding words — a link by its name, a description — never the table’s plural', async () => {
    const titles: string[] = [];
    const { el } = mount(ORDER, orderLines, titles);
    open(el, 'a');
    await settle();
    open(el, 'c');
    await settle();
    // The quantity is the first column, a number: a line is named by words — the product's name, else its description.
    expect(titles).toEqual(['Office chair, ergonomic', 'Cable trays']);
  });

  it('by its number as people count lines where it has no words: a section before it is no line', async () => {
    const titles: string[] = [];
    const { el } = mount(ORDER, orderLines, titles);
    open(el, 'b');
    await settle();
    expect(titles).toEqual(['Line 2']);
  });

  it('in the page’s language, its capital as that language writes one', async () => {
    const spanish: string[] = [];
    open(mount(ORDER, orderLines, spanish, 'es', es).el, 'b');
    await settle();
    const arabic: string[] = [];
    open(mount(ORDER, orderLines, arabic, 'ar', ar).el, 'b');
    await settle();
    expect([...spanish, ...arabic]).toEqual(['Línea 2', 'السطر 2']);
  });

  it('a line opening its own record’s page is titled the same, by its words, not by a date before them', async () => {
    const page = {
      fieldia: '0.1',
      id: 'matter',
      data: { kind: 'record', model: 'legal.matter' },
      fields: { hearing_ids: { type: 'one2many', label: 'Hearings', relation: 'legal.hearing', fields: { date: { type: 'date', label: 'Date' }, court: { type: 'char', label: 'Court' } } } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-hearings', field: 'hearing_ids', columns: ['date', 'court'], lineOpens: 'record' }] },
    } as unknown as Page;
    const titles: string[] = [];
    const { el } = mount(page, { hearing_ids: [{ key: 'a', id: 7, values: { date: '2026-10-20', court: 'Cairo Economic Court' } }] } as never, titles);
    open(el, 'a');
    await settle();
    expect(titles).toEqual(['record: Cairo Economic Court']);
    expect(el.querySelector('tr[data-line="a"] .fd-line-move')?.getAttribute('aria-label')).toBe('Move Cairo Economic Court up');
  });

  it('names a line the same on its ↑ and ↓ and as its move is said aloud: a link by its name', () => {
    const titles: string[] = [];
    const { el, form } = mount(ORDER, orderLines, titles);
    const row = (key: string) => el.querySelector(`tr[data-line="${key}"]`) as HTMLTableRowElement;
    expect([...row('a').querySelectorAll('.fd-line-move')].map((b) => b.getAttribute('aria-label'))).toEqual(['Move Office chair, ergonomic up', 'Move Office chair, ergonomic down']);
    expect([...row('b').querySelectorAll('.fd-line-move')].map((b) => b.getAttribute('aria-label'))).toEqual(['Move line 2 up', 'Move line 2 down']);
    const box = row('a').querySelector('td[data-column="name"] input') as HTMLInputElement;
    // jsdom scrolls nothing: the moved line kept in sight asks for it.
    jest.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    box.focus();
    press(box, 'ArrowDown', { altKey: true });
    expect((form.getState().values['line_ids'] as Line[]).map((line) => line.key)).toEqual(['s', 'b', 'a', 'c']);
    expect(el.querySelector('.fd-sr-only[role=status]')?.textContent).toBe('Office chair, ergonomic moved to place 3 of 4');
  });
});

describe('a card’s line in a dialog is titled as its card is', () => {
  const CONTACTS = {
    type: 'one2many',
    label: 'Contacts & Addresses',
    relation: 'res.partner',
    fields: { type: { type: 'selection', label: 'Type', options: [{ value: 'contact', label: 'Contact' }] }, name: { type: 'char', label: 'Name' } },
  };
  const lineForm = { children: [{ type: 'field', id: 'c-name', field: 'name' }] };

  it('by the page’s word for one with its number ("Contact 2"), else "Entry 2"', async () => {
    for (const [options, title] of [[{ itemLabel: 'Contact' }, 'Contact 2'], [{}, 'Entry 2']] as const) {
      const titles: string[] = [];
      const { el, form } = mountKind(CONTACTS, { widget: 'cards', options, lineForm } as Partial<FieldNode>, { dialogs: dialogs(titles) });
      form.addLine('x', { name: 'Mona Adel' });
      form.addLine('x', { name: 'Omar Said' });
      (el.querySelectorAll('.fd-repeat-card')[1].querySelector('button.fd-line-open') as HTMLButtonElement).click();
      await settle();
      expect(titles).toEqual([title]);
    }
  });
});
