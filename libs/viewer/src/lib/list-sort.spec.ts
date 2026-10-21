import type { ListNode, ListRequest } from '@fieldia/core';
import { pressedSort, sortWith } from './list-sort';
import { customers, partners, until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

describe('the keys a header’s press chooses', () => {
  it('makes a plain press the one key, the other way when it led ascending', () => {
    expect(pressedSort([{ field: 'name' }], 'credit', false)).toEqual([{ field: 'credit' }]);
    expect(pressedSort([{ field: 'name' }], 'name', false)).toEqual([{ field: 'name', desc: true }]);
    expect(pressedSort([{ field: 'name', desc: true }], 'name', false)).toEqual([{ field: 'name' }]);
    // A press on a key that does not lead makes it the one key, ascending; the others go.
    expect(pressedSort([{ field: 'agent' }, { field: 'date', desc: true }], 'date', false)).toEqual([{ field: 'date' }]);
  });

  it('adds a key with Shift, turns it the other way with Shift again, and takes it away the third time', () => {
    let keys = pressedSort([{ field: 'agent' }], 'date', true);
    expect(keys).toEqual([{ field: 'agent' }, { field: 'date' }]);
    keys = pressedSort(keys, 'date', true);
    expect(keys).toEqual([{ field: 'agent' }, { field: 'date', desc: true }]);
    keys = pressedSort(keys, 'date', true);
    expect(keys).toEqual([{ field: 'agent' }]);
    // The last key is never taken away: it turns back to ascending.
    expect(pressedSort([{ field: 'agent', desc: true }], 'agent', true)).toEqual([{ field: 'agent' }]);
    // Nearest a place (a map's) is no column's order: Shift starts from the columns alone.
    expect(pressedSort([{ field: 'place', near: { lat: 30, lng: 31 } }], 'price', true)).toEqual([{ field: 'price' }]);
  });

  it('asks for the keys chosen, then the list’s own order where it names other fields', () => {
    expect(sortWith([{ field: 'agent' }, { field: 'date', desc: true }], [{ field: 'date' }, { field: 'name' }])).toEqual([{ field: 'agent' }, { field: 'date', desc: true }, { field: 'name' }]);
    expect(sortWith([], [{ field: 'name' }])).toEqual([{ field: 'name' }]);
  });
});

describe('a list ordered by several headers', () => {
  let handle: ViewerHandle | null = null;
  afterEach(() => {
    handle?.destroy();
    handle = null;
    document.body.replaceChildren();
  });

  const names = (host: Element) => [...host.querySelectorAll('.fd-list-row')].map((tr) => tr.querySelectorAll('td')[1].textContent);
  const header = (host: Element, words: string) => [...host.querySelectorAll<HTMLElement>('.fd-list-table thead th')].find((th) => th.querySelector('.fd-list-head')?.textContent === words) as HTMLElement;
  const press = (host: Element, words: string, shiftKey = false) => header(host, words).querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey }));

  it('adds a column with Shift, numbers each, says its place to a screen reader, and asks the source in that order', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const source = partners();
    handle = mountViewer(host, { page: { ...customers, layout: { ...(customers.layout as ListNode), pageSize: 4 } }, dataSource: source });
    await until(() => names(host).length === 4);
    press(host, 'Country');
    await until(() => names(host)[0] === 'Amira Clinics' && header(host, 'Country').getAttribute('aria-sort') === 'ascending');
    // One key: no number, as before.
    expect(header(host, 'Country').querySelector('.fd-list-sort-rank')).toBeNull();
    press(host, 'Credit limit', true);
    press(host, 'Credit limit', true);
    await until(() => names(host)[0] === 'Nile Traders');
    expect(names(host)).toEqual(['Nile Traders', 'Amira Clinics', 'Petra Tours', 'Zamalek Studio']);
    const last = source.calls.filter((call) => call.method === 'list').at(-1)?.request as ListRequest;
    expect(last.sort).toEqual([{ field: 'country_id' }, { field: 'credit_limit', desc: true }, { field: 'name' }]);
    // The first key's aria-sort, as a table says one; each key's arrow and number.
    const credit = header(host, 'Credit limit');
    expect(header(host, 'Country').getAttribute('aria-sort')).toBe('ascending');
    expect(credit.hasAttribute('aria-sort')).toBe(false);
    expect(credit.getAttribute('data-sort')).toBe('descending');
    expect(header(host, 'Country').querySelector('.fd-list-sort-rank')?.textContent).toBe('1');
    expect(credit.querySelector('.fd-list-sort-rank')?.textContent).toBe('2');
    expect(credit.querySelector('.fd-list-sort-rank')?.getAttribute('aria-hidden')).toBe('true');
    expect(credit.querySelector('button .fd-sr-only')?.textContent).toBe(' sorted 2 of 2, descending');
    // A third Shift takes it away: one key again, no numbers.
    press(host, 'Credit limit', true);
    await until(() => !credit.hasAttribute('data-sort'));
    expect(host.querySelectorAll('.fd-list-sort-rank')).toHaveLength(0);
    expect(host.querySelectorAll('.fd-list-table .fd-sr-only')).toHaveLength(0);
    // A plain press: that column alone.
    press(host, 'Credit limit', true);
    press(host, 'Name');
    await until(() => names(host).join() === 'Amira Clinics,Nile Traders,Petra Tours,Zamalek Studio');
    expect(header(host, 'Name').getAttribute('aria-sort')).toBe('ascending');
    expect(header(host, 'Country').hasAttribute('data-sort')).toBe(false);
  });

  it('says a key’s place in the page’s language', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: customers, dataSource: partners(), locale: 'ar' });
    await until(() => names(host).length === 2);
    press(host, 'Country', true);
    await until(() => header(host, 'Country').getAttribute('data-sort') === 'ascending');
    expect(header(host, 'Country').querySelector('.fd-sr-only')?.textContent).toBe(' مرتب 2 من 2، تصاعديًا');
    expect(header(host, 'Name').getAttribute('aria-sort')).toBe('ascending');
  });
});
