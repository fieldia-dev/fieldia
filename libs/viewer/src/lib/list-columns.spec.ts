import { createMemoryDataSource, type ListNode, type Page } from '@fieldia/core';
import { memoryPreferences, type PreferenceStore } from '@fieldia/widgets';
import { columnsKey } from './list-columns';
import { until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * Columns people control (`optionalColumns`): shown and hidden from the
 * Columns menu at the header's end, put in their order there (Move up, Move
 * down, Alt with an arrow), sized by a header's grip, each kept for the person
 * in the viewer's `preferences` by page and list, and Reset back to the page's.
 * The rows, the totals and the Group By headings follow.
 */

const contacts: Page = {
  fieldia: '0.4',
  id: 'contacts',
  title: 'Contacts',
  data: { kind: 'record', model: 'contact' },
  fields: {
    name: { type: 'char', label: 'Name' },
    company: { type: 'char', label: 'Company' },
    email: { type: 'char', label: 'Email' },
    city: { type: 'selection', label: 'City', options: [{ value: 'cairo', label: 'Cairo' }, { value: 'giza', label: 'Giza' }] },
    value: { type: 'monetary', label: 'Value', currency: 'EGP' },
  },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name', 'company', 'email', 'city', 'value'],
    sort: [{ field: 'name' }],
    groupBy: ['city'],
    cells: { value: { total: 'sum' } },
    optionalColumns: { company: 'show', email: 'hide', city: 'show', value: 'show' },
  },
};
const records = () => ({
  1: { name: 'Mona Adel', company: 'Nile Traders', email: 'mona@nile.example', city: 'cairo', value: 1000 },
  2: { name: 'Omar Said', company: 'Delta Foods', email: 'omar@delta.example', city: 'giza', value: 2500 },
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(preferences: PreferenceStore = memoryPreferences(), page: Page = contacts) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { contact: records() } }), preferences });
  await until(() => host.querySelectorAll('.fd-list-table tbody tr.fd-list-row').length === 2);
  return host;
}
/** The headers a person sees, in order. */
const heads = (host: Element) => [...host.querySelectorAll('.fd-list-table thead th[data-col]')].filter((th) => !(th as HTMLElement).hidden).map((th) => th.textContent);
/** A row's cells a person sees, in order. */
const cells = (host: Element, row = 0) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')[row].querySelectorAll('td[data-col]')].filter((td) => !(td as HTMLElement).hidden).map((td) => td.textContent);
const menuButton = (host: Element) => host.querySelector('thead .fd-list-columns-button') as HTMLButtonElement;
const menu = (host: Element) => host.querySelector('.fd-list-columns-menu') as HTMLElement;
const item = (host: Element, column: string) => menu(host).querySelector(`[data-col="${column}"]`) as HTMLElement;
const box = (host: Element, column: string) => item(host, column).querySelector('input') as HTMLInputElement;
const items = (host: Element) => [...menu(host).querySelectorAll('.fd-list-columns-item')].map((li) => li.textContent?.replace(/[↑↓]/g, ''));

describe('columns a person shows, hides and orders', () => {
  it('opens on the page’s columns, those it starts hidden hidden, a Columns menu at the header’s end', async () => {
    const host = await mount();
    expect(heads(host)).toEqual(['Name', 'Company', 'City', 'Value']);
    expect(cells(host)).toEqual(['Mona Adel', 'Nile Traders', 'Cairo', 'E£\u00a01,000.00']);
    expect(host.querySelector('.fd-list')?.hasAttribute('data-shaped')).toBe(true);
    expect(menuButton(host).getAttribute('aria-label')).toBe('Columns');
    expect(menuButton(host).getAttribute('aria-expanded')).toBe('false');
    // The first shown column is kept in view as the table scrolls sideways.
    expect(host.querySelector('thead th[data-pin]')?.getAttribute('data-col')).toBe('name');
  });

  it('shows and hides a column from the menu, the rows and the totals following, and keeps it for the person', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    menuButton(host).click();
    expect(menu(host).hidden).toBe(false);
    expect(menuButton(host).getAttribute('aria-expanded')).toBe('true');
    expect(items(host)).toEqual(['Name', 'Company', 'Email', 'City', 'Value']);
    // Name is no column the page lets them hide: no box, never a box that does nothing.
    expect(item(host, 'name').querySelector('input')).toBeNull();
    expect(box(host, 'email').checked).toBe(false);
    expect(document.activeElement).toBe(box(host, 'company'));
    box(host, 'email').click();
    expect(heads(host)).toEqual(['Name', 'Company', 'Email', 'City', 'Value']);
    expect(cells(host)[2]).toBe('mona@nile.example');
    box(host, 'company').click();
    expect(heads(host)).toEqual(['Name', 'Email', 'City', 'Value']);
    // The totals row under the columns shown.
    await until(() => !(host.querySelector('.fd-list-totals tr[data-total="all"]') as HTMLElement).hidden);
    const totals = [...(host.querySelector('.fd-list-totals tr[data-total="all"]') as HTMLElement).children];
    // The box's, the Total under Name, then Email, City and Value, and the menu's column.
    expect(totals).toHaveLength(6);
    expect(totals.map((cell) => cell.getAttribute('data-field'))).toEqual([null, null, 'email', 'city', 'value', null]);
    expect(preferences.get(columnsKey(contacts, contacts.layout as ListNode))).toEqual([
      { colId: 'name', width: null, hide: false },
      { colId: 'company', width: null, hide: true },
      { colId: 'email', width: null, hide: false },
      { colId: 'city', width: null, hide: false },
      { colId: 'value', width: null, hide: false },
    ]);
    // Next time, as they left it.
    handle?.destroy();
    document.body.replaceChildren();
    const again = await mount(preferences);
    expect(heads(again)).toEqual(['Name', 'Email', 'City', 'Value']);
  });

  it('never hides the last column shown', async () => {
    const page: Page = { ...contacts, layout: { ...(contacts.layout as ListNode), columns: ['company', 'email'], cells: {}, optionalColumns: { company: 'show', email: 'hide' } } };
    const host = await mount(memoryPreferences(), page);
    menuButton(host).click();
    box(host, 'company').click();
    expect(box(host, 'company').checked).toBe(true);
    expect(heads(host)).toEqual(['Company']);
  });

  it('orders the columns with Move up and Move down, and with Alt and an arrow, the focus staying on the column moved', async () => {
    const host = await mount();
    menuButton(host).click();
    // Hide, never disable: the first has no Move up, the last no Move down.
    expect((item(host, 'name').querySelector('[data-move="up"]') as HTMLElement).hidden).toBe(true);
    expect((item(host, 'value').querySelector('[data-move="down"]') as HTMLElement).hidden).toBe(true);
    // Past Email, hidden: the menu says where it went, the table shows it where it is now.
    (item(host, 'city').querySelector('[data-move="up"]') as HTMLButtonElement).click();
    expect(items(host)).toEqual(['Name', 'Company', 'City', 'Email', 'Value']);
    (item(host, 'city').querySelector('[data-move="up"]') as HTMLButtonElement).click();
    expect(heads(host)).toEqual(['Name', 'City', 'Company', 'Value']);
    expect(cells(host)).toEqual(['Mona Adel', 'Cairo', 'Nile Traders', expect.any(String)]);
    expect(document.activeElement).toBe(item(host, 'city').querySelector('[data-move="up"]'));
    box(host, 'value').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
    expect(items(host)).toEqual(['Name', 'City', 'Company', 'Value', 'Email']);
    expect(document.activeElement).toBe(box(host, 'value'));
    // The first column moved: it is the one kept in view.
    (item(host, 'city').querySelector('[data-move="up"]') as HTMLButtonElement).click();
    expect(heads(host)).toEqual(['City', 'Name', 'Company', 'Value']);
    expect(host.querySelector('thead th[data-pin]')?.getAttribute('data-col')).toBe('city');
  });

  it('closes with Escape, the focus back on its button, and Reset puts back the page’s columns', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    menuButton(host).click();
    expect((menu(host).querySelector('.fd-list-columns-reset') as HTMLElement).hidden).toBe(true);
    box(host, 'company').click();
    expect((menu(host).querySelector('.fd-list-columns-reset') as HTMLElement).hidden).toBe(false);
    menu(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu(host).hidden).toBe(true);
    expect(document.activeElement).toBe(menuButton(host));
    menuButton(host).click();
    (menu(host).querySelector('.fd-list-columns-reset') as HTMLButtonElement).click();
    expect(heads(host)).toEqual(['Name', 'Company', 'City', 'Value']);
    expect(preferences.get(columnsKey(contacts, contacts.layout as ListNode))).toBeNull();
  });

  it('sizes a column from its grip with the arrow keys, kept for the person', async () => {
    const preferences = memoryPreferences();
    const host = await mount(preferences);
    const company = host.querySelector('thead th[data-col="company"]') as HTMLElement;
    const grip = company.querySelector('.fd-list-grip') as HTMLElement;
    expect(grip.getAttribute('role')).toBe('separator');
    expect(grip.getAttribute('aria-label')).toBe('Resize Company');
    // jsdom lays nothing out: the column starts at no width, and takes the narrowest a person may give.
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(company.hasAttribute('data-width-px')).toBe(true);
    const width = company.style.getPropertyValue('--fd-col-px');
    expect(width).toBe('48px');
    grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(company.style.getPropertyValue('--fd-col-px')).toBe('64px');
    expect((host.querySelector('tbody tr.fd-list-row td[data-col="company"]') as HTMLElement).style.getPropertyValue('--fd-col-px')).toBe('64px');
    expect(grip.getAttribute('aria-valuenow')).toBe('64');
    expect((preferences.get(columnsKey(contacts, contacts.layout as ListNode)) as { colId: string; width: number | null }[]).find((one) => one.colId === 'company')?.width).toBe(64);
    // Twice on its grip: the page's width again.
    grip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(company.hasAttribute('data-width-px')).toBe(false);
  });

  it('spans its Group By headings across the columns shown', async () => {
    const host = await mount();
    (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
    ([...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'City') as HTMLButtonElement).click();
    await until(() => host.querySelector('.fd-list-group'));
    // The box, the four columns, the menu's.
    expect((host.querySelector('.fd-list-group > td') as HTMLTableCellElement).colSpan).toBe(6);
    menuButton(host).click();
    box(host, 'email').click();
    expect((host.querySelector('.fd-list-group > td') as HTMLTableCellElement).colSpan).toBe(7);
  });

  it('reads what was kept leniently: a column the page has since added in its place, one it took away gone, one it no longer lets them hide shown', async () => {
    const preferences = memoryPreferences();
    preferences.set(columnsKey(contacts, contacts.layout as ListNode), [
      { colId: 'value', width: 120, hide: false },
      { colId: 'gone', width: null, hide: true },
      { colId: 'name', width: null, hide: true },
      { colId: 'company', width: 5000, hide: true },
    ]);
    const host = await mount(preferences);
    expect(heads(host)).toEqual(['Value', 'Name', 'City']);
    expect((host.querySelector('thead th[data-col="value"]') as HTMLElement).style.getPropertyValue('--fd-col-px')).toBe('120px');
    // Wider than any column may be: the widest.
    expect((host.querySelector('thead th[data-col="company"]') as HTMLElement).style.getPropertyValue('--fd-col-px')).toBe('1200px');
  });
});
