import { createMemoryDataSource, type DataSource, type ListRequest, type Page } from '@fieldia/core';
import { memoryPreferences } from '@fieldia/widgets';
import { columnsKey } from './list-columns';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A list on paper: Print, in its bar where the page asks (`"print": true`),
 * prints every record the search finds — each page of them asked of the data
 * source — the columns as the list shows them, under its Group By headings
 * with their counts and their sums, the totals under them; over them the
 * list's title, its filters in words, how many and the day. The list itself
 * is left off the paper, and the printout goes once printed.
 */

const invoices: Page = {
  fieldia: '0.6',
  id: 'invoices',
  title: 'Invoices',
  timeZone: 'Africa/Cairo',
  print: { header: 'Nile Accounting · Cairo', footer: 'Amounts in each invoice’s currency.' },
  data: { kind: 'record', model: 'invoice' },
  fields: {
    name: { type: 'char', label: 'Number' },
    city: { type: 'selection', label: 'City', options: [{ value: 'cairo', label: 'Cairo' }, { value: 'giza', label: 'Giza' }] },
    date: { type: 'date', label: 'Invoice date' },
    amount: { type: 'monetary', label: 'Amount', currencyField: 'currency_id', money: { currency: 'code' } },
    currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'posted', label: 'Posted' }, { value: 'paid', label: 'Paid' }] },
  },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name', 'city', 'date', 'amount'],
    sort: [{ field: 'name' }],
    pageSize: 2,
    cells: { amount: { total: 'sum' } },
    filters: [{ id: 'posted', label: 'Posted', filter: [{ field: 'state', op: '=', value: 'posted' }] }],
    groupBy: ['city'],
    print: true,
  },
};
const EGP = { id: 1, label: 'EGP' };
const records = () => ({
  1: { name: 'INV/001', city: 'cairo', date: '2026-09-28', amount: 1000, currency_id: EGP, state: 'posted' },
  2: { name: 'INV/002', city: 'cairo', date: '2026-10-02', amount: 2500, currency_id: EGP, state: 'posted' },
  3: { name: 'INV/003', city: 'giza', date: '2026-10-05', amount: 400, currency_id: EGP, state: 'paid' },
  4: { name: 'INV/004', city: 'giza', date: '2026-10-14', amount: 600.5, currency_id: EGP, state: 'posted' },
  5: { name: 'INV/005', city: 'giza', date: '2026-10-10', amount: 250, currency_id: EGP, state: 'posted' },
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  jest.restoreAllMocks();
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(page: Page = invoices, source: DataSource = createMemoryDataSource({ records: { invoice: records() } }), options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: source, now: () => new Date('2026-10-16T08:05:00Z'), preferences: memoryPreferences(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const printButton = (host: Element) => host.querySelector('.fd-list-print-button') as HTMLButtonElement;
const sheet = (host: Element) => host.querySelector('.fd-print-sheet') as HTMLElement | null;
/** A row's words, the space that holds a currency to its amount read as a space. */
const cells = (row: Element) => [...row.children].map((cell) => cell.textContent?.replace(/\u00a0/g, ' '));
const bodyRows = (host: Element) => [...(sheet(host)?.querySelectorAll('tbody tr') ?? [])].map(cells);
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name) as HTMLButtonElement | undefined;
const openMenu = (host: Element) => (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();
/** The browser's print, its dialog open until the test says it closed: told before, not yet after. */
const printOpen = () => jest.spyOn(window, 'print').mockImplementation(() => void window.dispatchEvent(new Event('beforeprint')));

describe('a list’s Print', () => {
  it('is not in the bar of a list that does not ask for it: as 0.24', async () => {
    const host = await mount({ ...invoices, layout: { ...invoices.layout, print: undefined } } as Page);
    expect(printButton(host).hidden).toBe(true);
  });

  it('prints every record the search finds, not a page of them, with the totals and what the search is', async () => {
    const host = await mount();
    const print = printOpen();
    expect(printButton(host).hidden).toBe(false);
    expect(printButton(host).textContent).toBe('Print');
    // Two to a page on screen: five on paper.
    expect(host.querySelectorAll('.fd-list-table tbody tr').length).toBe(2);
    printButton(host).click();
    await until(() => print.mock.calls.length === 1);
    const out = sheet(host) as HTMLElement;
    expect(out.classList.contains('fd-print-this')).toBe(true);
    expect(document.documentElement.classList.contains('fd-print-one')).toBe(true);
    expect(out.querySelector('.fd-print-title')?.textContent).toBe('Invoices');
    expect(out.querySelector('.fd-print-when')?.textContent).toMatch(/^Printed 16 Oct 2026, 11:05/);
    expect(out.querySelector('.fd-print-words')?.textContent).toBe('Nile Accounting · Cairo');
    expect(out.querySelector('.fd-print-foot')?.textContent).toBe('Amounts in each invoice’s currency.');
    // Its footer at the foot of every sheet, its room kept there.
    expect(out.hasAttribute('data-print-room')).toBe(true);
    expect([...out.querySelectorAll('.fd-print-about > div')].map((line) => line.textContent)).toEqual(['5 records']);
    expect(cells(out.querySelector('thead tr') as Element)).toEqual(['Number', 'City', 'Invoice date', 'Amount']);
    // Each value as its cell says it: a choice by its label, a date in words, money with its currency.
    expect(bodyRows(host)).toEqual([
      ['INV/001', 'Cairo', '28 Sept 2026', 'EGP 1,000.00'],
      ['INV/002', 'Cairo', '2 Oct 2026', 'EGP 2,500.00'],
      ['INV/003', 'Giza', '5 Oct 2026', 'EGP 400.00'],
      ['INV/004', 'Giza', '14 Oct 2026', 'EGP 600.50'],
      ['INV/005', 'Giza', '10 Oct 2026', 'EGP 250.00'],
    ]);
    expect(out.querySelectorAll('tbody td.fd-num').length).toBe(5);
    expect(cells(out.querySelector('tfoot tr') as Element)).toEqual(['Total', '', '', 'EGP 4,750.50']);
    // The button waits while the browser prints; once it is done, the printout goes.
    expect(printButton(host).getAttribute('aria-busy')).toBe('true');
    window.dispatchEvent(new Event('afterprint'));
    await until(() => !sheet(host));
    await until(() => !printButton(host).hasAttribute('aria-busy'));
    expect(document.documentElement.classList.contains('fd-print-one')).toBe(false);
  });

  it('heads the records with the list’s Group By: each group’s count and sums in their columns, its filters in words', async () => {
    const host = await mount();
    openMenu(host);
    button(host, 'Posted')!.click();
    button(host, 'City')!.click();
    await until(() => host.querySelectorAll('.fd-group-toggle').length === 2);
    const print = printOpen();
    printButton(host).click();
    await until(() => print.mock.calls.length === 1);
    const out = sheet(host) as HTMLElement;
    expect([...out.querySelectorAll('.fd-print-about > div')].map((line) => line.textContent)).toEqual(['Filters: Posted', 'Grouped by City', '4 records']);
    // The heading's words across the columns before the first with a sum; its sum in the Amount column.
    expect(bodyRows(host)).toEqual([
      ['Cairo (2)', 'EGP 3,500.00'],
      ['INV/001', 'Cairo', '28 Sept 2026', 'EGP 1,000.00'],
      ['INV/002', 'Cairo', '2 Oct 2026', 'EGP 2,500.00'],
      ['Giza (2)', 'EGP 850.50'],
      ['INV/004', 'Giza', '14 Oct 2026', 'EGP 600.50'],
      ['INV/005', 'Giza', '10 Oct 2026', 'EGP 250.00'],
    ]);
    expect(out.querySelector('tbody tr')?.classList.contains('fd-print-group')).toBe(true);
    expect((out.querySelector('tbody tr td') as HTMLTableCellElement).colSpan).toBe(3);
    expect(cells(out.querySelector('tfoot tr') as Element)).toEqual(['Total', '', '', 'EGP 4,350.50']);
    window.dispatchEvent(new Event('afterprint'));
    await until(() => !sheet(host));
  });

  it('prints the columns the person chose, in their order, as Export writes them', async () => {
    const shaped = { ...invoices, layout: { ...invoices.layout, groupBy: undefined, optionalColumns: { city: 'show', date: 'hide' } } } as Page;
    const preferences = memoryPreferences();
    // City hidden and Amount moved after Invoice date by the person; Invoice date, hidden by the page, shown by them.
    preferences.set(columnsKey(shaped, shaped.layout as Extract<Page['layout'], { type: 'list' }>), [
      { colId: 'name', width: null, hide: false },
      { colId: 'date', width: null, hide: false },
      { colId: 'amount', width: null, hide: false },
      { colId: 'city', width: null, hide: true },
    ]);
    const host = await mount(shaped, undefined, { preferences });
    const print = printOpen();
    printButton(host).click();
    await until(() => print.mock.calls.length === 1);
    const out = sheet(host) as HTMLElement;
    expect(cells(out.querySelector('thead tr') as Element)).toEqual(['Number', 'Invoice date', 'Amount']);
    expect(bodyRows(host)[0]).toEqual(['INV/001', '28 Sept 2026', 'EGP 1,000.00']);
    expect(cells(out.querySelector('tfoot tr') as Element)).toEqual(['Total', '', 'EGP 4,750.50']);
    window.dispatchEvent(new Event('afterprint'));
    await until(() => !sheet(host));
  });

  it('asks the source a page at a time, as Export does, and says so as it goes', async () => {
    const memory = createMemoryDataSource({ records: { invoice: records() } });
    const asked: ListRequest[] = [];
    const source: DataSource = { ...memory, list: (request) => (asked.push(request), memory.list!(request)) };
    const host = await mount(invoices, source);
    const print = printOpen();
    asked.length = 0;
    printButton(host).click();
    await until(() => print.mock.calls.length === 1);
    expect(asked.map((request) => [request.offset, request.limit])).toEqual([[0, 500]]);
    window.dispatchEvent(new Event('afterprint'));
    await until(() => !sheet(host));
  });

  it('says why when the records cannot be had, and prints nothing', async () => {
    const memory = createMemoryDataSource({ records: { invoice: records() } });
    let fail = false;
    const source: DataSource = { ...memory, list: (request) => (fail ? Promise.reject(new Error('offline')) : memory.list!(request)) };
    const said: string[] = [];
    const host = await mount(invoices, source, { host: { say: (message) => void said.push(message) } });
    const print = printOpen();
    fail = true;
    printButton(host).click();
    await until(() => said.length === 1);
    expect(said).toEqual(['Could not get the records to print.']);
    expect(print).not.toHaveBeenCalled();
    expect(sheet(host)).toBeNull();
  });
});

describe('a list’s Print, on a page that names its records', () => {
  it('counts them over its rows in their words', async () => {
    const host = await mount({ ...invoices, records: { one: 'invoice', other: 'invoices', a: 'an invoice' } });
    const print = printOpen();
    printButton(host).click();
    await until(() => print.mock.calls.length === 1);
    expect([...(sheet(host) as HTMLElement).querySelectorAll('.fd-print-about > div')].map((line) => line.textContent)).toEqual(['5 invoices']);
    window.dispatchEvent(new Event('afterprint'));
    await until(() => !sheet(host));
  });
});
