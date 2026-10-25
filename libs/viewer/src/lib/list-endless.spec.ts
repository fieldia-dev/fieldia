import { checkPage, createMemoryDataSource, type ListNode, type ListRequest, type Page } from '@fieldia/core';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/** A log of what the team did, a hundred entries, loaded as it is scrolled, ten at a time. */
const log: Page = {
  fieldia: '0.13',
  id: 'log',
  title: 'Activity',
  records: { one: 'entry', other: 'entries' },
  data: { kind: 'record', model: 'log.entry' },
  fields: { name: { type: 'char', label: 'What' }, n: { type: 'integer', label: 'Number' }, kind: { type: 'selection', label: 'Kind', options: [{ value: 'even', label: 'Even' }, { value: 'odd', label: 'Odd' }] } },
  layout: { type: 'list', id: 'list', columns: ['name', 'kind'], sort: [{ field: 'n' }], pageSize: 10, endless: true, filters: [{ id: 'even', label: 'Even', filter: [{ field: 'kind', op: '=', value: 'even' }] }] },
};
const entries = () => createMemoryDataSource({ records: { 'log.entry': Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i + 1, { name: `Entry ${i + 1}`, n: i + 1, kind: i % 2 ? 'even' : 'odd' }])) } });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions>, page: Page = log) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  await until(() => host.querySelectorAll('.fd-list-row').length > 0);
  return host;
}
const rows = (host: Element) => host.querySelectorAll('.fd-list-row').length;
const more = (host: Element) => host.querySelector('.fd-list-more-rows') as HTMLElement;
const range = (host: Element) => host.querySelector('.fd-pager-text')?.textContent;
const lists = (source: ReturnType<typeof entries>) => source.calls.filter((call) => call.method === 'list').map((call) => call.request as ListRequest);

describe('rows loaded as the list is scrolled', () => {
  it('shows its first page, its count of all, no arrows, and the next page at the end', async () => {
    const source = entries();
    const host = await mount({ dataSource: source });
    expect(rows(host)).toBe(10);
    expect(range(host)).toBe('1–10 of 100 entries');
    expect((host.querySelector('[aria-label="Next page"]') as HTMLElement).hidden).toBe(true);
    expect((host.querySelector('[aria-label="Previous page"]') as HTMLElement).hidden).toBe(true);
    expect(more(host).hidden).toBe(false);
    expect(more(host).textContent).toBe('Show 10 more');
    (more(host).querySelector('button') as HTMLButtonElement).click();
    await until(() => rows(host) === 20);
    expect(range(host)).toBe('1–20 of 100 entries');
    expect(lists(source).at(-1)).toEqual(expect.objectContaining({ offset: 10, limit: 10 }));
    // The rows before stay: the next page put after them.
    expect(host.querySelector('.fd-list-row td[data-col="name"]')?.textContent).toBe('Entry 1');
  });

  it('loads the next page from the keys past the last row, the focus on its first', async () => {
    const host = await mount({ dataSource: entries() });
    const last = [...host.querySelectorAll<HTMLElement>('.fd-list-row')].at(-1) as HTMLElement;
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await until(() => rows(host) === 20);
    await until(() => (document.activeElement as HTMLElement | null)?.textContent?.includes('Entry 11'));
  });

  it('keeps every row it loaded as it asks again, and starts from the first page for another search', async () => {
    const source = entries();
    const host = await mount({ dataSource: source });
    (more(host).querySelector('button') as HTMLButtonElement).click();
    await until(() => rows(host) === 20);
    await handle?.reload();
    expect(rows(host)).toBe(20);
    expect(lists(source).at(-1)).toEqual(expect.objectContaining({ offset: 0, limit: 20 }));
    // Another search: its first page alone.
    ([...host.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Search options') as HTMLButtonElement).click();
    ([...host.querySelectorAll('.fd-search-panel button')].find((b) => b.textContent === 'Even') as HTMLButtonElement).click();
    await until(() => range(host) === '1–10 of 50 entries');
    expect(rows(host)).toBe(10);
  });

  it('shows no more where every row has come, and says where they would come when the next page could not be loaded, with Retry', async () => {
    const source = entries();
    const list = source.list.bind(source);
    let down = true;
    source.list = (request) => (request.offset > 0 && down ? Promise.reject(new Error('The log is offline.')) : list(request));
    const host = await mount({ dataSource: source });
    (more(host).querySelector('button') as HTMLButtonElement).click();
    await until(() => more(host).querySelector('.fd-loader[data-way="failed"]')?.textContent === 'Couldn’t load. The log is offline. Retry');
    expect(rows(host)).toBe(10);
    down = false;
    (more(host).querySelector('.fd-loader[data-way="failed"] button') as HTMLButtonElement).click();
    await until(() => rows(host) === 20);
    expect(more(host).querySelector('.fd-loader')).toBeNull();
    // A short list: all of it at once, nothing more.
    const few = createMemoryDataSource({ records: { 'log.entry': { 1: { name: 'Only one', n: 1, kind: 'odd' } } } });
    handle?.destroy();
    const other = await mount({ dataSource: few });
    expect(more(other).hidden).toBe(true);
  });

  it('is checked: never with rows under their parent', () => {
    const result = checkPage({ ...log, fields: { ...log.fields, parent_id: { type: 'many2one', label: 'Parent', relation: 'log.entry' } }, layout: { ...(log.layout as ListNode), parentField: 'parent_id' } });
    expect(result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual(['layout.endless: rows under their parent come a page at a time: a list of them never loads as it is scrolled']);
  });
});
