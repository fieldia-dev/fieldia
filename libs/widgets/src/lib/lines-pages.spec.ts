import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RecordId, type Values } from '@fieldia/core';
import { createWidget, type WidgetDialogs } from './widgets';
import { WIDGET_LABELS } from './labels';

/**
 * Lines with pages of their own: a plain table's line opening its record's
 * page by the table's model, or its fields; and a many2many shown as a table
 * of its records' fields, read from the data source, that adds by searching.
 */
const matter = {
  fieldia: '0.1',
  id: 'matter',
  data: { kind: 'record', model: 'legal.matter' },
  fields: {
    hearing_ids: {
      type: 'one2many',
      label: 'Hearings',
      relation: 'legal.hearing',
      fields: { date: { type: 'date', label: 'Date' }, court: { type: 'char', label: 'Court' }, judge: { type: 'char', label: 'Judge' } },
    },
    compliance_ids: {
      type: 'many2many',
      label: 'Compliance',
      relation: 'legal.compliance',
      fields: {
        name: { type: 'char', label: 'Requirement' },
        state: { type: 'selection', label: 'Status', options: [{ value: 'open', label: 'Open' }, { value: 'met', label: 'Met' }] },
      },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-hearings', field: 'hearing_ids', columns: ['date', 'court'], lineOpens: 'record' },
      { type: 'field', id: 'f-compliance', field: 'compliance_ids', widget: 'table', columns: ['name', 'state'] },
    ],
  },
} as unknown as Page;

const records = {
  'legal.compliance': {
    1: { name: 'Anti-money laundering check', state: 'open' },
    2: { name: 'Conflict search', state: 'met' },
    3: { name: 'Engagement letter', state: 'open' },
  },
};

function dialogs(opened: { model: string; recordId?: RecordId }[], answer: { values?: Values } | null = null, found: { id: RecordId; label: string } | null = null): WidgetDialogs {
  return {
    canOpen: (model) => model === 'legal.hearing' || model === 'legal.compliance',
    openRecord: async (model, request) => (opened.push({ model, recordId: request.recordId }), answer ? { id: request.recordId ?? 0, label: request.title, ...answer } : null),
    searchMore: async () => found,
    editValues: async (request) => (opened.push({ model: 'fields:' + Object.keys(request.fields).join(',') + (request.shown ? ` shown:${request.shown.join(',')}` : '') }), null),
  };
}

function mount(index: number, values: Values, dialogsGiven?: WidgetDialogs) {
  const dataSource = createMemoryDataSource({ records });
  const form = createForm({ page: matter, dataSource, values });
  const node = (matter.layout as { children: FieldNode[] }).children[index];
  const widget = createWidget({ form, name: node.field, field: matter.fields[node.field] as Field, node, id: 'fd-x', document, labels: WIDGET_LABELS.en, dialogs: dialogsGiven });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('a plain table’s line opening its own page', () => {
  const hearings = { hearing_ids: [{ key: 'a', id: 7, values: { date: '2026-10-20', court: 'Cairo Economic Court', judge: null } }, { key: 'b', values: { date: null, court: 'New', judge: null } }] };

  it('opens a saved line’s record by the table’s model, and takes back what it saved', async () => {
    const opened: { model: string; recordId?: RecordId }[] = [];
    const { el, form } = mount(0, hearings as never, dialogs(opened, { values: { court: 'Giza Court', judge: 'Hany Fawzy', other: 'x' } }));
    const open = el.querySelector('tr[data-line="a"] button.fd-line-open') as HTMLButtonElement;
    expect(open.getAttribute('aria-label')).toBe('Open line');
    open.click();
    await settle();
    expect(opened).toEqual([{ model: 'legal.hearing', recordId: 7 }]);
    const line = (form.getState().values['hearing_ids'] as { values: Values }[])[0];
    expect(line.values).toEqual({ date: '2026-10-20', court: 'Giza Court', judge: 'Hany Fawzy' });
  });

  it('opens a line not saved yet in a dialog of the table’s columns, every field kept as it is', async () => {
    const opened: { model: string }[] = [];
    const { el } = mount(0, hearings as never, dialogs(opened));
    (el.querySelector('tr[data-line="b"] button.fd-line-open') as HTMLButtonElement).click();
    await settle();
    // The judge, which the table has no column for, is the line's all the same, kept — never shown (0.35 showed it).
    expect(opened).toEqual([{ model: 'fields:date,court,judge shown:date,court' }]);
  });

  it('leaves out of a line’s dialog a column its rules hide on the record, as the table does', async () => {
    const opened: { model: string }[] = [];
    const page = { ...matter, layout: { ...matter.layout, children: [{ type: 'field', id: 'f-hearings', field: 'hearing_ids', columns: ['date', 'court'], cells: { court: { hidden: true } }, lineOpens: 'fields' }] } } as unknown as Page;
    const form = createForm({ page, dataSource: createMemoryDataSource({ records }), values: hearings as never });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'hearing_ids', field: page.fields['hearing_ids'] as Field, node, id: 'fd-x', document, labels: WIDGET_LABELS.en, dialogs: dialogs(opened) });
    document.body.replaceChildren(widget.element);
    widget.update({ value: form.getState().values['hearing_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    (widget.element.querySelector('tr[data-line="b"] button.fd-line-open') as HTMLButtonElement).click();
    await settle();
    expect(opened).toEqual([{ model: 'fields:date,court,judge shown:date' }]);
  });

  it('shows no ↗ without dialogs to open', () => {
    const { el } = mount(0, hearings as never);
    expect(el.querySelector('button.fd-line-open')).toBeNull();
  });
});

describe('a many2many as a table', () => {
  const linked = { compliance_ids: [{ id: 2, label: 'Conflict search' }, { id: 1, label: 'Anti-money laundering check' }] };
  const rowsOf = (el: Element) => [...el.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td[data-column]')].map((td) => td.textContent));

  it('shows its records’ fields, read from the data source, in the order linked', async () => {
    const { el } = mount(1, linked as never, dialogs([]));
    expect([...el.querySelectorAll('thead th[data-column]')].map((th) => th.textContent)).toEqual(['Requirement', 'Status']);
    await settle();
    expect(rowsOf(el)).toEqual([
      ['Conflict search', 'Met'],
      ['Anti-money laundering check', 'Open'],
    ]);
  });

  it('adds a record found by searching, and takes one away', async () => {
    const { el, form } = mount(1, linked as never, dialogs([], null, { id: 3, label: 'Engagement letter' }));
    (el.querySelector('button[data-add="line"]') as HTMLButtonElement).click();
    await settle();
    expect((form.getState().values['compliance_ids'] as { id: number }[]).map((r) => r.id)).toEqual([2, 1, 3]);
    expect(rowsOf(el)[2]).toEqual(['Engagement letter', 'Open']);
    (el.querySelector('tbody tr[data-record="2"] button.fd-line-delete') as HTMLButtonElement).click();
    expect((form.getState().values['compliance_ids'] as { id: number }[]).map((r) => r.id)).toEqual([1, 3]);
  });

  it('opens a record’s own page from its line', async () => {
    const opened: { model: string; recordId?: RecordId }[] = [];
    const { el } = mount(1, linked as never, dialogs(opened));
    (el.querySelector('tbody tr[data-record="1"] button.fd-line-open') as HTMLButtonElement).click();
    await settle();
    expect(opened).toEqual([{ model: 'legal.compliance', recordId: 1 }]);
  });
});
