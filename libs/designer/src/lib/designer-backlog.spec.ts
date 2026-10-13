import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePage, type Field, type ListNode, type Page } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { columnProperties, listProperties } from './list-properties';
import { mount as mountEditor, openTab } from './test-editor';

/**
 * A list drawn as a work tracker's backlog, as the designer edits it: no box
 * to choose a row, a filter bar of a keyword and each field's values, rows
 * under their parent, and each column's cells — a state's dot, a kind's icon
 * before the title, a width, a side — in the list's and the column's panels.
 */

const backlog = JSON.parse(readFileSync(join(__dirname, '../../../../examples/pages/backlog.page.json'), 'utf8')) as Page;
const model: Record<string, Field> = {
  title: { type: 'char', label: 'Title' },
  order: { type: 'integer', label: 'Order' },
  work_type: { type: 'selection', label: 'Work Item Type', options: [{ value: 'bug', label: 'Bug' }, { value: 'task', label: 'Task' }] },
  state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
  area: { type: 'many2one', label: 'Area', relation: 'work.area' },
  notes: { type: 'html', label: 'Notes' },
  parent_id: { type: 'many2one', label: 'Parent', relation: 'bugs' },
  owner: { type: 'many2one', label: 'Owner', relation: 'res.users' },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const bugs = () => {
  const designer = createDesigner({ page: blankPage('list', 'Bugs'), model });
  designer.addColumn('order', 0);
  designer.addColumn('title');
  designer.addColumn('state');
  return designer;
};

describe('a list drawn as a backlog, by the designer', () => {
  it('takes the box to choose a row away, unless the list has buttons for the rows chosen', () => {
    const designer = bugs();
    expect(designer.setListOptions({ choose: false })).toBe(true);
    expect(list(designer).choose).toBe(false);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // No button for rows that cannot be chosen.
    expect(designer.addListAction('Archive')).toBe(false);
    expect(designer.getState().issues.join(' ')).toContain('there is no way to choose one');
    expect(designer.setListOptions({ choose: true })).toBe(true);
    expect(list(designer).choose).toBeUndefined();
    designer.addListAction('Archive');
    expect(designer.setListOptions({ choose: false })).toBe(false);
    expect(designer.getState().issues).toEqual(['The list has buttons for the rows chosen: take them away before the box to choose a row']);
  });

  it('offers a keyword and each field’s values in place of the search bar, bringing the fields from the model', () => {
    const designer = bugs();
    expect(designer.setListOptions({ search: 'fields', filterFields: ['work_type', 'state', 'area'] })).toBe(true);
    expect(list(designer)).toMatchObject({ search: 'fields', filterFields: ['work_type', 'state', 'area'] });
    expect(designer.getPage().fields['area']).toEqual(model['area']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ filterFields: ['notes'] })).toBe(false);
    expect(designer.getState().issues).toEqual(['The filter bar cannot list the values of Notes']);
    // The search bar back: the fields' values go with the filter bar, and the fields only they named leave the page.
    expect(designer.setListOptions({ search: 'bar' })).toBe(true);
    expect(list(designer).search).toBeUndefined();
    expect(list(designer).filterFields).toBeUndefined();
    expect(designer.getPage().fields['area']).toBeUndefined();
  });

  it('keeps a ranked list’s own order: its headers do not sort it', () => {
    const designer = bugs();
    expect(designer.setListOptions({ sortable: false })).toBe(true);
    expect(list(designer).sortable).toBe(false);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ sortable: true })).toBe(true);
    expect(list(designer).sortable).toBeUndefined();
  });

  it('gives a filter its own name on the bar, for a field it offers; the name goes with the field', () => {
    const designer = bugs();
    expect(designer.setListOptions({ search: 'fields', filterFields: ['state', 'area'] })).toBe(true);
    expect(designer.setListOptions({ filterLabel: { field: 'area', label: ' Where ' } })).toBe(true);
    expect(list(designer).filterLabels).toEqual({ area: 'Where' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // Its label again, or nothing, is no name of its own.
    expect(designer.setListOptions({ filterLabel: { field: 'area', label: 'Area' } })).toBe(true);
    expect(list(designer).filterLabels).toBeUndefined();
    expect(designer.setListOptions({ filterLabel: { field: 'work_type', label: 'Kind' } })).toBe(false);
    expect(designer.getState().issues).toEqual(['The filter bar does not offer Work Item Type: tick it first']);
    expect(designer.setListOptions({ filterLabel: { field: 'area', label: 'Where' } })).toBe(true);
    expect(designer.setListOptions({ filterFields: ['state'] })).toBe(true);
    expect(list(designer).filterLabels).toBeUndefined();
    expect(designer.setListOptions({ filterFields: ['state', 'area'], filterLabel: { field: 'area', label: 'Where' } })).toBe(true);
    expect(designer.setListOptions({ search: 'bar' })).toBe(true);
    expect(list(designer).filterLabels).toBeUndefined();
  });

  it('nests rows under a link to the list’s own records, and refuses any other', () => {
    const designer = bugs();
    expect(designer.setListOptions({ parentField: 'parent_id' })).toBe(true);
    expect(list(designer).parentField).toBe('parent_id');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ parentField: 'owner' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Rows nest under a link to the list’s own records; Owner is not one']);
    expect(designer.setListOptions({ parentField: null })).toBe(true);
    expect(list(designer).parentField).toBeUndefined();
    expect(designer.getPage().fields['parent_id']).toBeUndefined();
  });

  it('draws a column’s cells: a state’s dot, a kind’s icon before the title, a width, a side; a column gone takes its cells', () => {
    const designer = bugs();
    expect(designer.setListCell('state', { widget: 'dot', options: { colours: { active: '#007acc' } } })).toBe(true);
    expect(designer.setListCell('title', { lead: { field: 'work_type', looks: { bug: { icon: 'bug', colour: '#cc293d' } } }, width: 40 })).toBe(true);
    expect(designer.setListCell('order', { align: 'start' })).toBe(true);
    expect(list(designer).cells).toEqual({
      state: { widget: 'dot', options: { colours: { active: '#007acc' } } },
      title: { lead: { field: 'work_type', looks: { bug: { icon: 'bug', colour: '#cc293d' } } }, width: 40 },
      order: { align: 'start' },
    });
    // The field the icon comes from is on the page while the cell names it.
    expect(designer.getPage().fields['work_type']).toEqual(model['work_type']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListCell('title', { width: 0 })).toBe(false);
    expect(designer.getState().issues).toEqual(['A column is 1 to 200 characters wide, or 8 to 4000 pixels']);
    // In pixels for the whole column, as a tracker sizes its grid's.
    expect(designer.setListCell('title', { width: '908px' })).toBe(true);
    expect(list(designer).cells?.['title']).toEqual({ width: '908px' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    for (const width of ['7px', '4001px', '12.5px']) expect(designer.setListCell('title', { width: width as `${number}px` })).toBe(false);
    expect(designer.setListCell('title', { widget: 'dot' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A state’s dot is for a choice; Title is not one']);
    expect(designer.setListCell('title', { lead: { field: 'area', looks: {} } })).toBe(false);
    expect(designer.getState().issues).toEqual(['An icon before the words comes from a choice’s value; Area is not a choice']);
    expect(designer.setListCell('area', { width: 4 })).toBe(false);
    expect(designer.getState().issues).toEqual(['"area" is not a column']);
    expect(designer.setListCell('title', null)).toBe(true);
    expect(designer.getPage().fields['work_type']).toBeUndefined();
    expect(designer.removeColumn('state')).toBe(true);
    expect(list(designer).cells).toEqual({ order: { align: 'start' } });
  });

  it('keeps the backlog’s own fields when the columns and searches that also named them go', () => {
    const designer = createDesigner({ page: backlog, model: backlog.fields });
    expect(designer.setListOptions({ searchFields: [] })).toBe(true);
    for (const name of ['work_type', 'area', 'parent_id', 'tags', 'iteration']) expect([name, name in designer.getPage().fields]).toEqual([name, true]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});

describe('the backlog’s settings, in the panels', () => {
  const change = (input: HTMLInputElement | HTMLSelectElement, value?: string) => {
    if (value !== undefined) input.value = value;
    else if (input instanceof HTMLInputElement) input.checked = !input.checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  function mount(view: 'list' | string) {
    const designer = bugs();
    const panel = view === 'list' ? listProperties(elementFactory(document), designer) : columnProperties(elementFactory(document), designer, view);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const control = <T extends HTMLElement>(name: string) => panel.element.querySelector<T>(`[aria-label="${name}"]`)!;
    const shown = (element: Element) => !element.closest('[hidden]');
    return { designer, panel, control, shown };
  }

  it('the list’s panel: the box to choose, the filter bar and its fields, the parent', () => {
    const { designer, control, shown } = mount('list');
    const choose = control<HTMLInputElement>('A box to choose each row');
    expect(choose.checked).toBe(true);
    change(choose);
    expect(list(designer).choose).toBe(false);
    const search = control<HTMLSelectElement>('Search');
    const offerState = () => control<HTMLInputElement>('Offer State’s values');
    expect(shown(offerState())).toBe(false);
    change(search, 'fields');
    expect(list(designer).search).toBe('fields');
    expect(shown(offerState())).toBe(true);
    change(offerState());
    change(control<HTMLInputElement>('Offer Area’s values'));
    expect(list(designer).filterFields).toEqual(['state', 'area']);
    // An offered field's own name on the bar, its label the placeholder.
    const areaName = control<HTMLInputElement>('Area’s name on the filter bar');
    expect(areaName.placeholder).toBe('Area');
    change(areaName, 'Where');
    expect(list(designer).filterLabels).toEqual({ area: 'Where' });
    // Headers that sort the list, on unless taken away.
    const sorts = control<HTMLInputElement>('A header’s press sorts the list');
    expect(sorts.checked).toBe(true);
    change(sorts);
    expect(list(designer).sortable).toBe(false);
    const parent = control<HTMLSelectElement>('Rows under their parent, by');
    expect([...parent.options].map((o) => o.textContent)).toEqual(['None: every row at the top', 'Parent']);
    change(parent, 'parent_id');
    expect(list(designer).parentField).toBe('parent_id');
  });

  it('a column’s panel: drawn as a dot with each state’s colour, an icon by the kind, a width and a side', () => {
    const { designer, control, shown } = mount('state');
    const drawn = control<HTMLSelectElement>('Drawn as');
    change(drawn, 'dot');
    expect(list(designer).cells?.['state']).toEqual({ widget: 'dot' });
    change(control<HTMLInputElement>('Dot colour for Active'), '#007acc');
    expect(list(designer).cells?.['state']).toEqual({ widget: 'dot', options: { colours: { active: '#007acc' } } });
    change(control<HTMLSelectElement>('An icon before the words, by'), 'work_type');
    change(control<HTMLInputElement>('Icon for Bug'), 'bug');
    expect(list(designer).cells?.['state']?.lead).toEqual({ field: 'work_type', looks: { bug: { icon: 'bug' } } });
    change(control<HTMLInputElement>('Width'), '8');
    change(control<HTMLSelectElement>('Its words keep to'), 'end');
    expect(list(designer).cells?.['state']).toMatchObject({ width: 8, align: 'end' });
    // In pixels: the same number, the unit changed.
    change(control<HTMLSelectElement>('Width in'), 'px');
    expect(list(designer).cells?.['state']).toMatchObject({ width: '8px' });
    change(control<HTMLInputElement>('Width'), '70');
    expect(list(designer).cells?.['state']).toMatchObject({ width: '70px' });
    expect(control<HTMLInputElement>('Width').value).toBe('70');
    change(control<HTMLInputElement>('Width'), '');
    expect(list(designer).cells?.['state']?.width).toBeUndefined();
    expect(shown(drawn)).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('a column of words has no dot to draw', () => {
    const { shown, control } = mount('title');
    expect(shown(control('Drawn as'))).toBe(false);
    expect(shown(control('Width'))).toBe(true);
  });
});

describe('the Look tab’s Empty quiet fields', () => {
  it('says what to add, or shows nothing, and gives it back to the default when pressed again', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Bug') });
    designer.addQuestion('short-answer', { parent: 'section-1' });
    designer.select(null);
    const { host } = mountEditor(designer, { mode: 'advanced' });
    openTab(host, 'Look');
    const group = host.querySelector('.fd-properties [role="tabpanel"]:not([hidden]) [role="group"][aria-label="Empty quiet fields"]') as HTMLElement;
    const press = (words: string) => [...group.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === words)?.click();
    expect([...group.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Say what to add', 'Show nothing']);
    press('Show nothing');
    expect(designer.getPage().look?.quietHints).toBe(false);
    expect(group.querySelector('[aria-pressed="true"]')?.textContent).toBe('Show nothing');
    press('Say what to add');
    expect(designer.getPage().look?.quietHints).toBe(true);
    press('Say what to add');
    expect(designer.getPage().look?.quietHints).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});

describe('a backlog on the canvas', () => {
  it('draws its filter bar of fields, no box to choose a row, and its cells’ sides and dots', () => {
    const designer = createDesigner({ page: backlog, model: backlog.fields });
    const { host } = mountEditor(designer, { mode: 'advanced' });
    const canvas = host.querySelector('.fd-list-canvas') as HTMLElement;
    expect(canvas.querySelector('.fd-search-placeholder')?.textContent).toBe('Filter by keyword');
    expect([...canvas.querySelectorAll('.fd-canvas-filter-field')].map((f) => f.textContent)).toEqual(['Work Item Type ▾', 'State ▾', 'Area ▾', 'Iteration ▾', 'Tags ▾']);
    expect(canvas.querySelector('.fd-list-checkbox')).toBeNull();
    expect((canvas.querySelector('.fd-canvas-selection') as HTMLElement).hidden).toBe(true);
    expect(canvas.querySelector('th[data-node="order"]')?.classList.contains('fd-num')).toBe(false);
    expect(canvas.querySelector('td[data-node="state"] .fd-list-dot')).not.toBeNull();
  });
});
