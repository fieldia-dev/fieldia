import { createMemoryDataSource, type ActionRequest, type DataSource, type ListRequest, type Page } from '@fieldia/core';
import { customers, partners, until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * "Select all 4 that match": every row on show ticked, the list offers every
 * record its search matches (`allIds`, contract section 5), and its buttons
 * then get every one of them. A source that gives fewer ids than match is
 * said to have ("3 of 4 could be selected"); one that ignores `allIds` is
 * paged through. A page turned keeps them; a new search, Clear or the
 * header's box lets them go.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = customers) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: partners(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const rows = (host: Element) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')] as HTMLTableRowElement[];
const names = (host: Element) => rows(host).map((row) => row.querySelectorAll('td')[1].textContent);
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && !b.closest('[hidden]')) as HTMLButtonElement | undefined;
const every = (host: Element) => host.querySelector('.fd-list-every') as HTMLButtonElement;
const count = (host: Element) => host.querySelector('.fd-list-count')?.textContent;
const tickAll = (host: Element) => {
  const box = host.querySelector('thead .fd-list-checkbox') as HTMLInputElement;
  box.checked = true;
  box.dispatchEvent(new Event('change'));
};
const ticked = (host: Element) => rows(host).map((row) => (row.querySelector('.fd-list-checkbox') as HTMLInputElement).checked);

/** The memory source, its list's answers changed as a backend's might be. */
function answering(change: (answer: Awaited<ReturnType<NonNullable<DataSource['list']>>>, request: ListRequest) => void) {
  const source = partners();
  const list = source.list.bind(source);
  source.list = async (request) => {
    const answer = await list(request);
    change(answer, request);
    return answer;
  };
  return source;
}

describe('every record that matches, chosen', () => {
  it('is offered once each row on show is ticked and more match, and hands the list’s buttons every one', async () => {
    const requests: ActionRequest[] = [];
    const host = await mount({ onAction: (request) => void requests.push(request) });
    expect(every(host).hidden).toBe(true);
    tickAll(host);
    expect(count(host)).toBe('2 selected');
    expect(every(host).hidden).toBe(false);
    expect(every(host).textContent).toBe('Select all 4 that match');
    every(host).click();
    await until(() => count(host) === '4 selected');
    expect(every(host).hidden).toBe(true);
    // A page turned keeps them, its rows ticked.
    button(host, 'Next page')!.click();
    await until(() => names(host)[0] === 'Petra Tours');
    expect(ticked(host)).toEqual([true, true]);
    expect(count(host)).toBe('4 selected');
    button(host, 'Archive')!.click();
    await until(() => requests.length === 1);
    expect(requests[0].recordIds).toEqual([2, 1, 3, 4]);
  });

  it('asks for the ids alone, in the list’s order and with its search', async () => {
    const source = partners();
    const host = await mount({ dataSource: source });
    tickAll(host);
    every(host).click();
    await until(() => count(host) === '4 selected');
    const asked = source.calls.filter((call) => call.method === 'list').map((call) => call.request as ListRequest).find((request) => request.allIds);
    expect(asked).toMatchObject({ model: 'partner', allIds: true, limit: 0, offset: 0, sort: [{ field: 'name' }], fields: ['name'] });
  });

  it('says how many of how many when the source gives fewer ids than match, never “all”', async () => {
    const source = answering((answer) => {
      if (answer.allIds) answer.allIds = answer.allIds.slice(0, 3);
    });
    const host = await mount({ dataSource: source });
    tickAll(host);
    every(host).click();
    await until(() => count(host) === '3 of 4 could be selected');
    // One let go: a count, as any.
    (rows(host)[0].querySelector('.fd-list-checkbox') as HTMLInputElement).click();
    expect(count(host)).toBe('2 selected');
  });

  it('pages through a source that gives no ids alone, its own page size kept', async () => {
    const source = answering((answer, request) => {
      delete answer.allIds;
      // A source that answers two at a time, whatever was asked.
      if (request.limit > 2) answer.records = answer.records.slice(0, 2);
    });
    const host = await mount({ dataSource: source });
    tickAll(host);
    every(host).click();
    await until(() => count(host) === '4 selected');
    // Asked from where its last answer ended, for the field it names its records by alone.
    const paged = source.calls.filter((call) => call.method === 'list').map((call) => call.request as ListRequest).filter((request) => request.fields.join() === 'name' && !request.allIds);
    expect(paged.map((request) => request.offset)).toEqual([0, 2]);
    const requests: ActionRequest[] = [];
    handle?.destroy();
    const again = await mount({ dataSource: source, onAction: (request) => void requests.push(request) });
    tickAll(again);
    every(again).click();
    await until(() => count(again) === '4 selected');
    button(again, 'Archive')!.click();
    await until(() => requests.length === 1);
    expect(requests[0].recordIds).toEqual([2, 1, 3, 4]);
  });

  it('lets them go with a new search, with Clear, and with the header’s box', async () => {
    const host = await mount();
    tickAll(host);
    every(host).click();
    await until(() => count(host) === '4 selected');
    button(host, 'Clear')!.click();
    expect(host.querySelector('.fd-list-selection')?.hasAttribute('hidden')).toBe(true);
    expect(ticked(host)).toEqual([false, false]);

    tickAll(host);
    every(host).click();
    await until(() => count(host) === '4 selected');
    const header = host.querySelector('thead .fd-list-checkbox') as HTMLInputElement;
    header.checked = false;
    header.dispatchEvent(new Event('change'));
    expect(host.querySelector('.fd-list-selection')?.hasAttribute('hidden')).toBe(true);

    tickAll(host);
    every(host).click();
    await until(() => count(host) === '4 selected');
    // Active only: two records, both on the page, none of the others chosen.
    button(host, 'Search options')!.click();
    button(host, 'Active')!.click();
    await until(() => names(host).join() === 'Nile Traders,Petra Tours');
    expect(host.querySelector('.fd-list-selection')?.hasAttribute('hidden')).toBe(true);
  });

  it('is not offered when every record that matches is on show already, nor under groups', async () => {
    const host = await mount({ dataSource: createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' }, 2: { name: 'Amira Clinics' } } } }) });
    tickAll(host);
    expect(count(host)).toBe('2 selected');
    expect(every(host).hidden).toBe(true);
  });

  it('writes a count as the page writes numbers', async () => {
    const records = Object.fromEntries(Array.from({ length: 1284 }, (_, i) => [i + 1, { name: `Client ${String(i + 1).padStart(4, '0')}` }]));
    const host = await mount({ dataSource: createMemoryDataSource({ records: { partner: records } }) });
    tickAll(host);
    expect(every(host).textContent).toBe('Select all 1,284 that match');
    every(host).click();
    await until(() => count(host) === '1,284 selected');
  });
});
