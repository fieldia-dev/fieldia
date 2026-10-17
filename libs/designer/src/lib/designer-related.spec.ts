import { validatePage, type RelatedNode, type SectionNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { layoutChanges } from './layout-changes';
import { relatedContent } from './panel-related';
import { toolbox } from './toolbox';
import { QUESTION_KINDS } from './kinds';
import { en } from './locales/en';

/**
 * A related list on a record's page, in the designer (`type: "related"`): added from the toolbox's records, its link
 * named for the page's model; its records, their link, its columns, rows a page, New and View all set in its panel;
 * on a record's page only.
 */

function withRelated() {
  const designer = createDesigner({ page: blankPage('sheet', 'Partner') });
  const id = designer.addBlock('related') as string;
  const node = () => {
    const sections = (designer.getPage().layout as { children: SectionNode[] }).children;
    return sections.flatMap((s) => s.children).find((n) => n.id === id) as RelatedNode;
  };
  return { designer, id, node };
}

describe('a related list on a page, in the designer', () => {
  it('is added as a block, its link named for the page’s model, one column of its records’ names, and the page is valid', () => {
    const { designer, node } = withRelated();
    expect(node()).toEqual({
      type: 'related',
      id: expect.stringMatching(/^related/),
      title: 'Related records',
      model: 'record',
      field: 'partner_id',
      fields: { name: { type: 'char', label: 'Name' } },
      columns: ['name'],
    });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('is refused on a page of answers, which no record is', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    expect(designer.addBlock('related')).toBeFalsy();
    expect(designer.getState().issues.join(' ')).toContain('A related list belongs on a record’s page');
  });

  it('takes its records, their link, its columns, rows, New and View all, each undone as any change', () => {
    const { designer, id, node } = withRelated();
    expect(
      designer.updateRelated(id, {
        title: 'Invoices',
        model: 'invoice',
        columns: [
          { name: 'name', field: { type: 'char', label: 'Number' } },
          { name: 'amount', field: { type: 'monetary', label: 'Total' } },
          { name: 'invoice_date', field: { type: 'date', label: 'Date' } },
        ],
        limit: 8,
        create: false,
        viewAll: { page: 'invoices', as: 'page' },
      })
    ).toBe(true);
    expect(node()).toMatchObject({ title: 'Invoices', model: 'invoice', columns: ['name', 'amount', 'invoice_date'], limit: 8, create: false, viewAll: { page: 'invoices', as: 'page' } });
    expect(node().fields['amount']).toEqual({ type: 'monetary', label: 'Total' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // A dialog is View all's own way: not written.
    designer.updateRelated(id, { viewAll: { page: 'invoices', as: 'dialog' }, create: true, limit: null });
    expect(node().viewAll).toEqual({ page: 'invoices' });
    expect(node().create).toBeUndefined();
    expect(node().limit).toBeUndefined();
    designer.updateRelated(id, { viewAll: null });
    expect(node().viewAll).toBeUndefined();
    designer.undo();
    expect(node().viewAll).toEqual({ page: 'invoices' });
  });

  it('takes a column away with what named it, keeping the fields no column shows: the link, an amount’s currency', () => {
    const { designer, id, node } = withRelated();
    const page = designer.getPage();
    // Set as its JSON would: a currency and the link among its fields, cells, an order and a search.
    const placed = node();
    designer.replacePage({
      ...page,
      layout: {
        ...(page.layout as object),
        children: [
          {
            type: 'section',
            id: 'section-1',
            children: [
              {
                ...placed,
                fields: { ...placed.fields, amount: { type: 'monetary', label: 'Total', currencyField: 'currency_id' }, currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' } },
                columns: ['name', 'amount'],
                cells: { amount: { total: 'sum' } },
                sort: [{ field: 'amount', desc: true }],
                searchFields: ['amount'],
              },
            ],
          },
        ],
      },
    } as unknown as typeof page);
    expect(designer.updateRelated(id, { columns: [{ name: 'name', field: { type: 'char', label: 'Number' } }] })).toBe(true);
    expect(Object.keys(node().fields).sort()).toEqual(['currency_id', 'name', 'partner_id']);
    expect(node().cells).toBeUndefined();
    expect(node().sort).toBeUndefined();
    expect(node().searchFields).toBeUndefined();
  });

  it('refuses no model, a name that is no field’s, a column twice and no column at all, saying why', () => {
    const { designer, id, node } = withRelated();
    const refused = (patch: Parameters<typeof designer.updateRelated>[1], words: string) => {
      expect(designer.updateRelated(id, patch)).toBe(false);
      expect(designer.getState().issues.join(' ')).toContain(words);
    };
    refused({ model: ' ' }, 'Name the model of the records it lists');
    refused({ field: 'partner id' }, '“partner id” is not a field’s name');
    refused({ columns: [{ name: '2nd', field: { type: 'char', label: 'Second' } }] }, '“2nd” is not a field’s name');
    refused({ columns: [{ name: 'a', field: { type: 'char', label: 'A' } }, { name: 'a', field: { type: 'integer', label: 'B' } }] }, '“a” is a column already');
    refused({ columns: [] }, 'A related list shows one column at least.');
    expect(node().columns).toEqual(['name']);
  });

  it('takes a card for a phone of its own records’ fields, refusing one of no column’s, and lets a column go from it', () => {
    const { designer, id, node } = withRelated();
    designer.updateRelated(id, {
      columns: [
        { name: 'name', field: { type: 'char', label: 'Number' } },
        { name: 'amount', field: { type: 'integer', label: 'Total' } },
      ],
    });
    expect(designer.updateRelated(id, { card: { title: 'name', fields: ['amount'], lead: true } })).toBe(true);
    expect(node().card).toEqual({ title: 'name', fields: ['amount'], lead: true });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.updateRelated(id, { card: { title: 'name', status: 'state' } })).toBe(false);
    expect(designer.getState().issues.join(' ')).toContain('“state” is none of its records’ fields');
    // A column taken away goes from its card too; none left, the card takes the columns'.
    designer.updateRelated(id, { columns: [{ name: 'name', field: { type: 'char', label: 'Number' } }] });
    expect(node().card).toEqual({ title: 'name', lead: true });
    designer.updateRelated(id, { card: null });
    expect(node().card).toBeUndefined();
    designer.undo();
    expect(node().card).toEqual({ title: 'name', lead: true });
  });

  it('is said as a change: added, changed', () => {
    const { designer, id } = withRelated();
    const before = designer.getPage();
    designer.updateRelated(id, { title: 'Invoices' });
    expect(layoutChanges(before, designer.getPage()).lines.join(' ')).toContain('the related list “Invoices”');
  });
});

describe('a related list’s panel', () => {
  function mount() {
    const made = withRelated();
    const content = relatedContent(elementFactory(document), made.designer, made.id);
    const host = document.createElement('div');
    host.append(...content.rows);
    document.body.replaceChildren(host);
    const update = () => content.update(made.designer.getPage());
    made.designer.subscribe(update);
    update();
    const control = <T extends HTMLElement>(label: string) => host.querySelector<T>(`[aria-label="${label}"]`)!;
    const type = (input: HTMLInputElement, value: string, event = 'input') => {
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event(event, { bubbles: true }));
    };
    return { ...made, host, control, type };
  }

  it('sets its title, its records and their link, keeping a name half typed until it is left', () => {
    const { node, control, type } = mount();
    type(control<HTMLInputElement>('Title'), 'Viewings');
    expect(node().title).toBe('Viewings');
    type(control<HTMLInputElement>('Records of'), 'viewing', 'change');
    type(control<HTMLInputElement>('Their link to this record'), 'home_id', 'change');
    expect(node()).toMatchObject({ model: 'viewing', field: 'home_id' });
    const link = control<HTMLInputElement>('Their link to this record');
    type(link, 'home id', 'change');
    expect(link.getAttribute('aria-invalid')).toBe('true');
    expect(node().field).toBe('home_id');
  });

  it('adds a column, names it, types its words without losing the box, picks its kind and takes it away', () => {
    const { node, host, control, type } = mount();
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Add a column')!.click();
    expect(node().columns).toEqual(['name', 'column_2']);
    expect(document.activeElement).toBe(control('Column 2: its words'));
    const words = control<HTMLInputElement>('Column 2: its words');
    type(words, 'When');
    expect(node().fields['column_2'].label).toBe('When');
    // The box typed in is the one still on the page, with the focus.
    expect(control('Column 2: its words')).toBe(words);
    expect(document.activeElement).toBe(words);
    type(control<HTMLInputElement>('Column 2: its field'), 'starts_at', 'change');
    const kind = control<HTMLSelectElement>('Column 2: its kind');
    kind.value = 'datetime';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    expect(node().fields['starts_at']).toEqual({ type: 'datetime', label: 'When' });
    control<HTMLButtonElement>('Remove the column When').click();
    expect(node().columns).toEqual(['name']);
  });

  it('sets rows a page, New, and View all’s page and where it opens, shown once it has a page', () => {
    const { node, control, type, host } = mount();
    const rows = control<HTMLInputElement>('Rows a page');
    type(rows, '10');
    rows.dispatchEvent(new Event('change', { bubbles: true }));
    expect(node().limit).toBe(10);
    const create = control<HTMLInputElement>('Offer New, which makes one with its link to this record filled in');
    expect(create.checked).toBe(true);
    create.click();
    expect(node().create).toBe(false);
    const opensIn = host.querySelector<HTMLElement>('[data-setting="View all opens in"]')!;
    expect(opensIn.hidden).toBe(true);
    type(control<HTMLInputElement>('View all opens the page'), 'viewings', 'change');
    expect(node().viewAll).toEqual({ page: 'viewings' });
    expect(opensIn.hidden).toBe(false);
    opensIn.querySelector<HTMLButtonElement>('[data-choice="panel"]')!.click();
    expect(node().viewAll).toEqual({ page: 'viewings', as: 'panel' });
  });

  it('turns its records into cards on a phone, as a list’s panel does, of its own fields, with no gallery', () => {
    const { designer, id, node, control, host } = mount();
    designer.updateRelated(id, {
      columns: [
        { name: 'name', field: { type: 'char', label: 'Number' } },
        { name: 'state', field: { type: 'char', label: 'Status' } },
      ],
    });
    const row = host.querySelector<HTMLElement>('[data-setting="Cards on a phone"]')!;
    expect(row.querySelector('[aria-label="A gallery of cards, on any width"]')).toBeNull();
    const onPhone = control<HTMLInputElement>('Each record as a card on a phone');
    expect(onPhone.checked).toBe(false);
    onPhone.click();
    expect(node().card).toEqual({});
    // What it shows: its own records' fields, by their words.
    const status = control<HTMLSelectElement>('Status pill');
    expect([...status.options].map((option) => option.textContent)).toEqual(['As the columns say', 'Number', 'Status']);
    status.value = 'state';
    status.dispatchEvent(new Event('change', { bubbles: true }));
    expect(node().card).toEqual({ status: 'state' });
    onPhone.click();
    expect(node().card).toBeUndefined();
  });
});

describe('the toolbox’s related list', () => {
  it('is among the records on a record’s page, in Simple and Advanced, and not on a page of answers', () => {
    const box = toolbox({ el: elementFactory(document), doc: document, kinds: QUESTION_KINDS, words: en, layout: true, related: true, onPick: () => undefined });
    document.body.replaceChildren(box.element);
    const tile = () => box.element.querySelector<HTMLElement>('[data-tool="block:related"]')!;
    box.update({ modelFields: [], tabs: false, related: true });
    expect(tile().hidden).toBe(false);
    expect(tile().closest('[data-group]')?.getAttribute('data-group')).toBe('Records');
    box.update({ modelFields: [], tabs: false, related: true, advanced: true });
    expect(tile().hidden).toBe(false);
    box.update({ modelFields: [], tabs: false, related: false });
    expect(tile().hidden).toBe(true);
  });
});
