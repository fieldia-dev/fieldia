import { createMemoryDataSource, type Page, type Values } from '@fieldia/core';
import { until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * How many records a list's search finds, said beside the search where its pager is not: a list under a filter bar
 * keeps its pager under its rows, shown only past a page — so "Homes to buy" on a desktop never said how many homes
 * its filters left, as its phone's sheet does ("Show 42 homes"; the owner's walk of 0.27). In the page's own words for
 * its records, one and more; nothing while none is found (the list says so), nor in a record (its tab counts).
 */

const homes: Page = {
  fieldia: '0.6',
  id: 'homes',
  title: 'Homes',
  records: { one: 'home', other: 'homes', a: 'a home' },
  data: { kind: 'record', model: 'home' },
  fields: {
    name: { type: 'char', label: 'Home' },
    kind: { type: 'selection', label: 'Type', options: [{ value: 'flat', label: 'Flat' }, { value: 'villa', label: 'Villa' }] },
  },
  layout: { type: 'list', id: 'homes', columns: ['name', 'kind'], search: 'fields', searchFields: ['name'], filterFields: ['kind'], gallery: { title: 'name' } },
} as Page;

const records = (): Record<string, Values> => ({
  1: { name: 'Flat in Dokki', kind: 'flat' },
  2: { name: 'Flat in Maadi', kind: 'flat' },
  3: { name: 'Villa in New Cairo', kind: 'villa' },
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(page: Page = homes) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { home: records() } }) });
  await until(() => host.querySelector('.fd-list-table tbody tr.fd-list-row'));
  return host;
}
const count = (host: Element) => host.querySelector('.fd-filter-bar .fd-list-found') as HTMLElement | null;

describe('a list’s count beside its search', () => {
  it('says how many records its filters leave, in the page’s words, as they change', async () => {
    const host = await mount();
    expect(count(host)?.hidden).toBe(false);
    expect(count(host)?.textContent).toBe('3 homes');
    expect(count(host)?.getAttribute('role')).toBe('status');
    const kind = host.querySelector('.fd-filter-pick[data-field="kind"]') as HTMLButtonElement;
    kind.click();
    const menu = () => document.getElementById(kind.getAttribute('aria-controls') as string) as HTMLElement | null;
    await until(() => menu()?.querySelectorAll('[role="menuitemcheckbox"]').length === 2);
    (menu()?.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')[1] as HTMLElement).click();
    await until(() => count(host)?.textContent === '1 home');
  });

  it('is said in its gallery too, and by "records" where the page names none', async () => {
    const unnamed = { ...homes, records: undefined } as Page;
    const host = await mount(unnamed);
    expect(count(host)?.textContent).toBe('3 records');
    (host.querySelector('.fd-list-views [data-view="gallery"], .fd-list-views button:nth-child(2)') as HTMLButtonElement | null)?.click();
    expect(count(host)?.hidden).toBe(false);
  });

  it('is none where the pager stands beside the search: a list with a search box', async () => {
    const host = await mount({ ...homes, layout: { ...(homes.layout as object), search: undefined, filterFields: undefined } } as Page);
    expect(count(host)).toBeNull();
    expect(host.querySelector('.fd-list-bar .fd-pager-text')?.textContent).toBe('1–3 of 3 homes');
  });
});
