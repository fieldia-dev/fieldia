import { validatePage, type Field, type ListNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  email: { type: 'char', label: 'Email' },
  country_id: { type: 'many2one', label: 'Country', relation: 'country' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }] },
  credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
  child_ids: { type: 'one2many', label: 'Contacts', relation: 'contact', fields: { name: { type: 'char', label: 'Name' } } },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const customers = () => createDesigner({ page: blankPage('list', 'Customers'), model });

describe('a list page', () => {
  it('starts with a name column, and is valid as it is', () => {
    const designer = customers();
    expect(list(designer)).toEqual({ type: 'list', id: 'list', columns: ['name'] });
    expect(designer.getPage().data).toEqual({ kind: 'record', model: 'customers' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('adds the model’s fields as columns, where they are dropped, and refuses what a list cannot show', () => {
    const designer = customers();
    expect(designer.addColumn('email')).toBe(true);
    expect(designer.addColumn('state', 1)).toBe(true);
    expect(list(designer).columns).toEqual(['name', 'state', 'email']);
    expect(designer.getPage().fields['state']).toEqual(model['state']);
    expect(designer.modelFields().map((f) => f.name)).toEqual(['country_id', 'credit_limit', 'child_ids']);
    expect(designer.addColumn('email')).toBe(false);
    expect(designer.getState().issues).toEqual(['Email is a column already']);
    expect(designer.addColumn('child_ids')).toBe(false);
    expect(designer.getState().issues).toEqual(['A list cannot show Contacts in a column: it holds lines']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('moves a column, and takes one away, but never the last', () => {
    const designer = customers();
    designer.addColumn('email');
    designer.addColumn('state');
    expect(designer.moveColumn('state', 0)).toBe(true);
    expect(list(designer).columns).toEqual(['state', 'name', 'email']);
    expect(designer.removeColumn('name')).toBe(true);
    expect(list(designer).columns).toEqual(['state', 'email']);
    designer.removeColumn('email');
    expect(designer.removeColumn('state')).toBe(false);
    expect(designer.getState().issues).toEqual(['A list needs a column']);
    // A column taken away leaves the page, and the toolbox offers it again.
    expect(designer.getPage().fields['email']).toBeUndefined();
    expect(designer.modelFields().map((f) => f.name)).toContain('email');
  });

  it('sorts, sets how many rows a page holds, and where the search bar looks', () => {
    const designer = customers();
    designer.addColumn('credit_limit');
    expect(designer.setListOptions({ sort: [{ field: 'credit_limit', desc: true }, { field: 'name' }], pageSize: 25, searchFields: ['name'] })).toBe(true);
    expect(list(designer)).toMatchObject({ sort: [{ field: 'credit_limit', desc: true }, { field: 'name' }], pageSize: 25, searchFields: ['name'] });
    expect(designer.setListOptions({ pageSize: 0 })).toBe(false);
    expect(designer.getState().issues).toEqual(['A page of the list holds 1 to 500 rows']);
    expect(designer.setListOptions({ sort: [], searchFields: [] })).toBe(true);
    expect(list(designer).sort).toBeUndefined();
    expect(list(designer).searchFields).toBeUndefined();
  });

  it('keeps named filters for the search bar, one on when the list opens', () => {
    const designer = customers();
    const active = designer.addListFilter('Active', [{ field: 'state', op: '=', value: 'active' }]) as string;
    expect(active).toBeTruthy();
    expect(list(designer).filters).toEqual([{ id: active, label: 'Active', filter: [{ field: 'state', op: '=', value: 'active' }] }]);
    // The field it reads comes onto the page from the model.
    expect(designer.getPage().fields['state']).toEqual(model['state']);
    expect(designer.updateListFilter(active, { label: 'Active customers', on: true })).toBe(true);
    expect(list(designer).defaultFilters).toEqual([active]);
    expect(designer.addListFilter('Nothing', [])).toBe(false);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.removeListFilter(active)).toBe(true);
    expect(list(designer).filters).toBeUndefined();
    expect(list(designer).defaultFilters).toBeUndefined();
  });

  it('groups by the fields chosen', () => {
    const designer = customers();
    expect(designer.setListOptions({ groupBy: ['country_id', 'state'] })).toBe(true);
    expect(list(designer).groupBy).toEqual(['country_id', 'state']);
    expect(designer.getPage().fields['country_id']).toEqual(model['country_id']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('gives the list buttons for the rows chosen', () => {
    const designer = customers();
    const archive = designer.addListAction('Archive') as string;
    expect(list(designer).actions).toEqual([{ type: 'button', id: archive, label: 'Archive', action: 'archive' }]);
    expect(designer.updateListAction(archive, { confirm: 'Archive these customers?', style: 'danger' })).toBe(true);
    expect(list(designer).actions?.[0]).toMatchObject({ confirm: 'Archive these customers?', style: 'danger' });
    // Nothing in "Asks first": it acts at once, and the page says nothing about asking.
    designer.updateListAction(archive, { confirm: '' });
    expect(list(designer).actions?.[0]).not.toHaveProperty('confirm');
    expect(designer.removeListAction(archive)).toBe(true);
    expect(list(designer).actions).toBeUndefined();
  });

  it('refuses list edits on a page that is not a list', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), model });
    expect(designer.addColumn('email')).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a list has columns']);
  });
});
