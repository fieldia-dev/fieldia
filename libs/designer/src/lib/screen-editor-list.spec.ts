import type { Field, ListNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount, press, tile, type } from './test-editor';

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  email: { type: 'char', label: 'Email' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }] },
  credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
  child_ids: { type: 'one2many', label: 'Contacts', relation: 'contact', fields: { name: { type: 'char', label: 'Name' } } },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const customers = () => createDesigner({ page: blankPage('list', 'Customers'), model });
const headings = (host: Element) => [...host.querySelectorAll('.fd-list-table thead th[data-node]')].map((th) => th.textContent?.trim());
const column = (host: Element, name: string) => host.querySelector(`.fd-list-table th[data-node="${name}"]`) as HTMLElement;
const panelTitle = (host: Element) => host.querySelector('.fd-panel-title')?.textContent;

describe('screen editor — a list page', () => {
  it('draws the list as the viewer does, with rows of made-up records, and offers only the model’s fields', () => {
    const { host } = mount(customers());
    expect(headings(host)).toEqual(['Name']);
    expect(host.querySelectorAll('.fd-list-table tbody tr')).toHaveLength(5);
    expect(host.querySelector('.fd-list-table tbody td[data-node="name"]')?.textContent).toBe('Acme Trading');
    expect(host.querySelector('.fd-search')).not.toBeNull();
    // No new fields on a list: a list shows what the model has.
    expect(tile(host, 'kind:short-answer').closest('[hidden]')).not.toBeNull();
    expect(tile(host, 'layout:section').closest('[hidden]')).not.toBeNull();
    expect(tile(host, 'model:email').closest('[hidden]')).toBeNull();
    // Nor a field a column cannot show.
    expect(tile(host, 'model:child_ids')).toBeNull();
    expect(panelTitle(host)).toBe('List');
  });

  it('adds a column from the toolbox, or from the table’s own “Add a column”, which leaves out what a column cannot show', () => {
    const designer = customers();
    const { host } = mount(designer);
    tile(host, 'model:email').click();
    expect(list(designer).columns).toEqual(['name', 'email']);
    expect(headings(host)).toEqual(['Name', 'Email']);
    expect(host.querySelector('.fd-list-table tbody td[data-node="email"]')?.textContent).toBe('hello@acme.example');
    button(host, 'Add a column')?.click();
    const menu = document.querySelector('.fd-menu') as HTMLElement;
    const offered = [...menu.querySelectorAll('[role="menuitemradio"]')].map((b) => b.textContent?.trim());
    expect(offered).toEqual(['Status', 'Credit limit']);
    (menu.querySelector('[role="menuitemradio"]') as HTMLElement).click();
    expect(list(designer).columns).toEqual(['name', 'email', 'state']);
    expect(host.querySelector('.fd-list-table tbody td[data-node="state"]')?.textContent).toBe('Active');
  });

  it('picks a column with a click: a bar on it moves it or takes it away, and the panel has the rest', () => {
    const designer = customers();
    designer.addColumn('email');
    designer.addColumn('credit_limit');
    designer.select(null);
    const { host } = mount(designer);
    column(host, 'email').click();
    expect(designer.getState().selected).toBe('column:email');
    expect(column(host, 'email').classList.contains('fd-picked')).toBe(true);
    expect(panelTitle(host)).toBe('Column');
    button(column(host, 'email'), 'Move left')?.click();
    expect(list(designer).columns).toEqual(['email', 'name', 'credit_limit']);
    expect(button(column(host, 'email'), 'Move left')).toBeUndefined();
    // The order from the column's panel: the list opens sorted by it.
    choose(field(host, 'Order the list by it'), 'desc');
    expect(list(designer).sort).toEqual([{ field: 'email', desc: true }]);
    expect(column(host, 'email').getAttribute('aria-sort')).toBe('descending');
    button(column(host, 'email'), 'Remove the column')?.click();
    expect(list(designer).columns).toEqual(['name', 'credit_limit']);
    expect(list(designer).sort).toBeUndefined();
    expect(designer.getState().selected).toBeNull();
    expect(tile(host, 'model:email')).not.toBeNull();
  });

  it('moves the picked column with Alt and the arrows, and takes it away with Delete', () => {
    const designer = customers();
    designer.addColumn('email');
    const { host } = mount(designer);
    column(host, 'name').click();
    press('ArrowRight', { altKey: true }, document.body);
    expect(list(designer).columns).toEqual(['email', 'name']);
    press('Delete', {}, document.body);
    expect(list(designer).columns).toEqual(['email']);
    // The last column stays: the reason shows instead.
    column(host, 'email').click();
    press('Delete', {}, document.body);
    expect(list(designer).columns).toEqual(['email']);
    expect(designer.getState().issues).toEqual(['A list needs a column']);
  });

  it('sets the rows a page holds, where the search looks, and the groupings, in the list’s panel', () => {
    const designer = customers();
    designer.addColumn('state');
    designer.select(null);
    const { host } = mount(designer);
    type(field(host, 'Rows on a page'), '25');
    expect(list(designer).pageSize).toBe(25);
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–25 / 128');
    choose(field(host, 'Sorted by'), 'state');
    expect(list(designer).sort).toEqual([{ field: 'state' }]);
    (field(host, 'Search looks in Name') as HTMLInputElement).click();
    expect(list(designer).searchFields).toEqual(['name']);
    button(host, 'Add a grouping')?.click();
    const menu = document.querySelector('.fd-menu') as HTMLElement;
    ([...menu.querySelectorAll('[role="menuitemradio"]')].find((b) => b.textContent?.trim() === 'Status') as HTMLElement).click();
    expect(list(designer).groupBy).toEqual(['state']);
    button(host, 'Remove the grouping Status')?.click();
    expect(list(designer).groupBy).toBeUndefined();
  });

  it('keeps named filters: a name, a condition, and on when the list opens, shown in the search bar', () => {
    const designer = customers();
    designer.select(null);
    const { host } = mount(designer);
    button(host, 'Add a filter')?.click();
    const filters = () => list(designer).filters ?? [];
    expect(filters()).toHaveLength(1);
    const id = filters()[0].id;
    type(field(host, 'Filter name'), 'Active');
    choose(field(host, 'Filter field'), 'state');
    choose(field(host, 'Filter value'), 'active');
    expect(filters()[0]).toEqual({ id, label: 'Active', filter: [{ field: 'state', op: '=', value: 'active' }] });
    // Not on when the list opens: the search bar does not show it yet.
    expect(host.querySelectorAll('.fd-search .fd-facet')).toHaveLength(0);
    (field(host, 'On when the list opens') as HTMLInputElement).click();
    expect(list(designer).defaultFilters).toEqual([id]);
    expect([...host.querySelectorAll('.fd-search .fd-facet')].map((f) => f.textContent)).toEqual(['Active']);
    button(host, 'Remove the filter Active')?.click();
    expect(list(designer).filters).toBeUndefined();
    expect(host.querySelectorAll('.fd-search .fd-facet')).toHaveLength(0);
  });

  it('gives the list buttons for the rows chosen: added on the canvas, named where they stand', () => {
    const designer = customers();
    const { host } = mount(designer);
    button(host, 'Add a button')?.click();
    const action = (list(designer).actions ?? [])[0];
    expect(action).toMatchObject({ type: 'button', label: 'New button' });
    const words = host.querySelector(`.fd-list-selection [data-part="${action.id}"] input`) as HTMLInputElement;
    expect(document.activeElement).toBe(words);
    type(words, 'Archive');
    expect((list(designer).actions ?? [])[0].label).toBe('Archive');
    expect(document.activeElement).toBe(words);
    expect(panelTitle(host)).toBe('Button');
    type(field(host, 'Asks first'), 'Archive these customers?');
    expect((list(designer).actions ?? [])[0].confirm).toBe('Archive these customers?');
    button(host, 'Delete')?.click();
    expect(list(designer).actions).toBeUndefined();
  });
});
