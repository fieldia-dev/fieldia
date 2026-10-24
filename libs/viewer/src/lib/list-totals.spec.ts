import { createMemoryDataSource, type DataSource, type Page } from '@fieldia/core';
import { memoryPreferences, type PreferenceStore } from '@fieldia/widgets';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Lists that add up and filter by time: a column's total under the list, on
 * each Group By heading and for the rows ticked; a date grouped by the span it
 * falls in; and periods — today, this week, overdue — in the list's filters
 * and a person's own, counted from the viewer's clock every time it asks.
 */

const invoices: Page = {
  fieldia: '0.11',
  id: 'invoices',
  title: 'Invoices',
  data: { kind: 'record', model: 'invoice' },
  fields: {
    name: { type: 'char', label: 'Number' },
    city: { type: 'selection', label: 'City', options: [{ value: 'cairo', label: 'Cairo' }, { value: 'giza', label: 'Giza' }, { value: 'dubai', label: 'Dubai' }] },
    date: { type: 'date', label: 'Invoice date' },
    due: { type: 'date', label: 'Due date' },
    sent: { type: 'datetime', label: 'Sent' },
    amount: { type: 'monetary', label: 'Amount', currencyField: 'currency_id', money: { currency: 'code' } },
    currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
    hours: { type: 'float', label: 'Hours' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'posted', label: 'Posted' }, { value: 'paid', label: 'Paid' }] },
  },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name', 'city', 'date', 'amount', 'hours'],
    sort: [{ field: 'name' }],
    pageSize: 10,
    cells: { amount: { total: 'sum' }, hours: { total: 'avg' } },
    filters: [
      { id: 'overdue', label: 'Overdue', filter: [{ field: 'state', op: '!=', value: 'paid' }], period: { field: 'due', is: 'overdue' } },
      { id: 'this_month', label: 'This month', period: { field: 'date', is: 'thisMonth' } },
      { id: 'cairo', label: 'Cairo', filter: [{ field: 'city', op: '=', value: 'cairo' }] },
      { id: 'egp', label: 'In pounds', filter: [{ field: 'currency_id', op: '=', value: 1 }] },
      { id: 'sent_today', label: 'Sent today', period: { field: 'sent', is: 'today' } },
    ],
    groupBy: ['city', 'date'],
  },
};
const EGP = { id: 1, label: 'EGP' };
const USD = { id: 2, label: 'USD' };
const records = () => ({
  1: { name: 'INV/001', city: 'cairo', date: '2026-09-28', due: '2026-10-28', sent: '2026-09-28T07:00:00.000Z', amount: 1000, currency_id: EGP, hours: 4, state: 'posted' },
  2: { name: 'INV/002', city: 'cairo', date: '2026-10-02', due: '2026-10-12', sent: '2026-10-13T21:30:00.000Z', amount: 2500, currency_id: EGP, hours: 2, state: 'posted' },
  3: { name: 'INV/003', city: 'dubai', date: '2026-10-05', due: '2026-11-05', sent: '2026-10-05T08:00:00.000Z', amount: 400, currency_id: USD, hours: 1, state: 'posted' },
  4: { name: 'INV/004', city: 'giza', date: '2026-10-14', due: '2026-10-13', sent: '2026-10-13T20:30:00.000Z', amount: 600.5, currency_id: EGP, hours: null, state: 'paid' },
  5: { name: 'INV/005', city: 'giza', date: '2026-10-10', due: '2026-10-01', sent: null, amount: 250, currency_id: EGP, hours: 3, state: 'posted' },
});
/** Wednesday 14 October 2026, 09:40 in Cairo. */
const NOW = new Date('2026-10-14T06:40:00Z');

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = invoices, source: DataSource = createMemoryDataSource({ records: { invoice: records() } })) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: source, now: () => NOW, preferences: memoryPreferences(), ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const rows = (host: Element) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')] as HTMLTableRowElement[];
const names = (host: Element) => rows(host).map((row) => row.querySelectorAll('td')[1].textContent);
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name) as HTMLButtonElement | undefined;
/** A row of the totals, its words by column: the head's, then each column's, as a person reads across. */
const totalRow = (host: Element, which: 'all' | 'ticked') => {
  const row = host.querySelector(`.fd-list-totals tr[data-total="${which}"]`) as HTMLTableRowElement;
  return row.hidden ? null : [...row.children].map((cell) => cell.textContent);
};
const headings = (host: Element) => [...host.querySelectorAll('.fd-group-toggle')].map((toggle) => toggle.textContent);
const openMenu = (host: Element) => (host.querySelector('.fd-search-toggle') as HTMLButtonElement).click();

describe('a list’s totals', () => {
  it('totals each column that asks, under every record the search finds: an amount in its one currency, an average', async () => {
    const host = await mount();
    openMenu(host);
    button(host, 'In pounds')!.click();
    await until(() => rows(host).length === 4 && totalRow(host, 'all')?.[4] === 'EGP 4,350.50');
    // The box column, then Number, City, Invoice date, Amount, Hours: the row's words in its first column.
    expect(totalRow(host, 'all')).toEqual(['', 'Total', '', '', 'EGP 4,350.50', 'Average 3.00']);
    expect(host.querySelector('.fd-list-totals td[data-field="amount"]')?.classList.contains('fd-num')).toBe(true);
    expect(totalRow(host, 'ticked')).toBeNull();
  });

  it('gives no total for amounts in more than one currency, and says why in sight, the sentence on pointing', async () => {
    const host = await mount();
    await until(() => totalRow(host, 'all'));
    expect(totalRow(host, 'all')).toEqual(['', 'Total', '', '', 'Several currencies', 'Average 2.50']);
    expect(host.querySelector('.fd-list-totals tr[data-total="all"] td[data-field="amount"]')?.getAttribute('title')).toBe('In more than one currency: no total');
  });

  it('totals the rows ticked while some are, over the list’s total', async () => {
    const host = await mount();
    const tick = (n: number) => (rows(host)[n].querySelector('.fd-list-checkbox') as HTMLInputElement).click();
    tick(0);
    tick(1);
    await until(() => totalRow(host, 'ticked')?.[4]);
    expect(totalRow(host, 'ticked')).toEqual(['', '2 selected', '', '', 'EGP 3,500.00', 'Average 3.00']);
    // A dollar ticked beside them: no honest sum of the three.
    tick(2);
    await until(() => totalRow(host, 'ticked')?.[1] === '3 selected');
    expect(totalRow(host, 'ticked')?.[4]).toBe('Several currencies');
    button(host, 'Clear')!.click();
    await until(() => !totalRow(host, 'ticked'));
  });

  it('sums each Group By heading in its own currency, in full as the totals row writes it', async () => {
    const host = await mount();
    openMenu(host);
    button(host, 'City')!.click();
    await until(() => headings(host).length === 3 && headings(host)[0]?.includes('·'));
    expect(headings(host)).toEqual(['Cairo (2) · Amount EGP 3,500.00 · Hours Average 3.00', 'Dubai (1) · Amount USD 400.00 · Hours Average 1.00', 'Giza (2) · Amount EGP 850.50 · Hours Average 3.00']);
    // Said by its button as it is seen: the count in words, then the sums.
    expect([...host.querySelectorAll('.fd-group-toggle')].map((toggle) => toggle.getAttribute('aria-label'))).toEqual([
      'Cairo, 2 records, Amount EGP\u00a03,500.00 · Hours Average 3.00',
      'Dubai, 1 record, Amount USD\u00a0400.00 · Hours Average 1.00',
      'Giza, 2 records, Amount EGP\u00a0850.50 · Hours Average 3.00',
    ]);
  });

  it('says a sum alone, with no column’s name, when one column is totalled', async () => {
    const page = { ...invoices, layout: { ...invoices.layout, cells: { amount: { total: 'sum' } } } } as Page;
    const host = await mount({}, page);
    openMenu(host);
    button(host, 'City')!.click();
    await until(() => headings(host)[0]?.includes('·'));
    expect(headings(host)[0]).toBe('Cairo (2) · EGP 3,500.00');
  });

  it('shows no totals — no row, no sums — from a source that cannot total, or a list that totals no column', async () => {
    const without = createMemoryDataSource({ records: { invoice: records() } }) as DataSource;
    delete without.totals;
    const host = await mount({}, invoices, without);
    expect(host.querySelector('.fd-list-totals')).toBeNull();
    openMenu(host);
    button(host, 'City')!.click();
    await until(() => headings(host).length === 3);
    expect(headings(host)[0]).toBe('Cairo (2)');
    handle?.destroy();
    const plain = { ...invoices, layout: { ...invoices.layout, cells: {} } } as Page;
    const second = await mount({}, plain);
    expect(second.querySelector('.fd-list-totals')).toBeNull();
  });
});

describe('a Group By of a date, by the span it falls in', () => {
  it('offers a date’s year, quarter, month, week and day, and heads each group in words, in time order', async () => {
    const host = await mount({}, { ...invoices, layout: { ...invoices.layout, cells: { amount: { total: 'count' } } } } as Page);
    openMenu(host);
    const spans = host.querySelector('.fd-search-spans[aria-label="Invoice date"]') as HTMLElement;
    expect([...spans.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Year', 'Quarter', 'Month', 'Week', 'Day']);
    button(spans, 'Month')!.click();
    await until(() => headings(host)[0]?.startsWith('September'));
    expect(headings(host)).toEqual(['September 2026 (1) · Count 1', 'October 2026 (4) · Count 4']);
    expect([...host.querySelectorAll('.fd-facet-text')].map((chip) => chip.textContent)).toEqual(['Invoice date: Month']);
    // Opened, a month shows its own records.
    (host.querySelectorAll('.fd-group-toggle')[1] as HTMLButtonElement).click();
    await until(() => rows(host).length === 4);
    expect(names(host)).toEqual(['INV/002', 'INV/003', 'INV/004', 'INV/005']);
  });

  it('heads a week by its number and year, a quarter and a year, and a day by its date', async () => {
    const host = await mount();
    openMenu(host);
    const spans = host.querySelector('.fd-search-spans') as HTMLElement;
    const by = async (span: string, first: string) => {
      for (const pressed of spans.querySelectorAll('button[aria-pressed="true"]')) (pressed as HTMLButtonElement).click();
      button(spans, span)!.click();
      await until(() => headings(host)[0]?.startsWith(first));
      return headings(host).map((heading) => heading?.replace(/ ·.*/, ''));
    };
    // Monday weeks: 28 Sep and 2 Oct in week 40, 5 Oct in 41, 10 and 14 Oct in 41 and 42.
    expect(await by('Week', 'Week 40')).toEqual(['Week 40, 2026 (2)', 'Week 41, 2026 (2)', 'Week 42, 2026 (1)']);
    expect(await by('Quarter', 'Q3')).toEqual(['Q3 2026 (1)', 'Q4 2026 (4)']);
    expect(await by('Year', '2026')).toEqual(['2026 (5)']);
    expect(await by('Day', '28 September')).toEqual(['28 September 2026 (1)', '2 October 2026 (1)', '5 October 2026 (1)', '10 October 2026 (1)', '14 October 2026 (1)']);
  });

  it('starts a week on Saturday in Arabic, and opens a week to the records of its seven days', async () => {
    const host = await mount({ locale: 'ar' });
    openMenu(host);
    const spans = host.querySelector('.fd-search-spans') as HTMLElement;
    (spans.querySelectorAll('button')[3] as HTMLButtonElement).click();
    // Saturday weeks: 26 Sep (28 Sep, 2 Oct), 3 Oct (5 Oct), 10 Oct (10 and 14 Oct), each numbered by the ISO week
    // holding most of its days.
    await until(() => headings(host).length === 3);
    expect(headings(host).map((heading) => heading?.replace(/ ·.*/, ''))).toEqual(['الأسبوع 40، 2026 (2)', 'الأسبوع 41، 2026 (1)', 'الأسبوع 42، 2026 (2)']);
    (host.querySelectorAll('.fd-group-toggle')[2] as HTMLButtonElement).click();
    await until(() => rows(host).length === 2);
    expect(names(host)).toEqual(['INV/004', 'INV/005']);
  });

  it('groups by the value itself when the source cannot group by a span', async () => {
    const source = createMemoryDataSource({ records: { invoice: records() } });
    const groups = source.groups.bind(source);
    // A source of 0.23, which knows nothing of `interval`.
    source.groups = ({ model, field, filter }) => groups({ model, field, filter });
    const host = await mount({}, { ...invoices, layout: { ...invoices.layout, cells: {} } } as Page, source);
    openMenu(host);
    button(host.querySelector('.fd-search-spans') as HTMLElement, 'Month')!.click();
    await until(() => headings(host).length === 5);
    expect(headings(host)[0]).toBe('2026-09-28 (1)');
    (host.querySelectorAll('.fd-group-toggle')[0] as HTMLButtonElement).click();
    await until(() => rows(host).length === 1);
    expect(names(host)).toEqual(['INV/001']);
  });
});

describe('periods in a list’s filters, counted from today', () => {
  it('finds what is overdue, and what is this month, by the list’s own filters', async () => {
    const host = await mount();
    openMenu(host);
    button(host, 'Overdue')!.click();
    await until(() => rows(host).length === 2);
    expect(names(host)).toEqual(['INV/002', 'INV/005']);
    button(host, 'Overdue')!.click();
    button(host, 'This month')!.click();
    await until(() => rows(host).length === 4);
    expect(names(host)).toEqual(['INV/002', 'INV/003', 'INV/004', 'INV/005']);
  });

  it('counts a date and time’s today where the page is: late last night in Cairo is today there', async () => {
    const page = { ...invoices, timeZone: 'Africa/Cairo' } as Page;
    const host = await mount({}, page);
    openMenu(host);
    button(host, 'Sent today')!.click();
    // 21:30 UTC on the 13th is 00:30 on the 14th in Cairo; 20:30 UTC is 23:30 on the 13th.
    await until(() => rows(host).length === 1);
    expect(names(host)).toEqual(['INV/002']);
  });

  it('is counted again from the clock each time the list asks', async () => {
    let now = NOW;
    const host = await mount({ now: () => now });
    openMenu(host);
    button(host, 'Overdue')!.click();
    await until(() => rows(host).length === 2);
    // A month on, INV/001 (due 28 October) and INV/003 (due 5 November) are overdue too.
    now = new Date('2026-11-14T06:40:00Z');
    await handle!.reload();
    await until(() => rows(host).length === 4);
    expect(names(host)).toEqual(['INV/001', 'INV/002', 'INV/003', 'INV/005']);
  });
});

describe('a period in a person’s own filter', () => {
  async function custom(host: HTMLElement, field: string, period: string) {
    openMenu(host);
    (host.querySelector('.fd-search-add') as HTMLButtonElement).click();
    const form = host.querySelector('.fd-custom-filter') as HTMLElement;
    const [which, condition] = form.querySelectorAll('select');
    which.value = field;
    which.dispatchEvent(new Event('change', { bubbles: true }));
    expect([...condition.options].map((o) => o.textContent)).toContain('in the period');
    condition.value = 'period';
    condition.dispatchEvent(new Event('change', { bubbles: true }));
    const periods = form.querySelector('.fd-custom-filter-value select') as HTMLSelectElement;
    expect([...periods.options].map((o) => o.textContent)).toEqual(['Today', 'Yesterday', 'This week', 'Last week', 'This month', 'Last month', 'This year', 'Last 7 days', 'Last 30 days', 'Overdue']);
    periods.value = period;
    (form.querySelector('.fd-button-primary') as HTMLButtonElement).click();
  }
  const chips = (host: Element) => [...host.querySelectorAll('.fd-facet-text')].map((chip) => chip.textContent);

  it('names a period of a date, as a chip says it, and finds its records', async () => {
    const host = await mount();
    await custom(host, 'date', 'last7Days');
    await until(() => rows(host).length === 2);
    expect(chips(host)).toEqual(['Invoice date: Last 7 days']);
    expect(names(host)).toEqual(['INV/004', 'INV/005']);
  });

  it('kept as a favourite, is counted again the day it is used', async () => {
    let now = NOW;
    const preferences: PreferenceStore = memoryPreferences();
    const host = await mount({ now: () => now, preferences });
    await custom(host, 'date', 'thisWeek');
    // The week of Monday 12 October: INV/004 alone.
    await until(() => rows(host).length === 1);
    expect(names(host)).toEqual(['INV/004']);
    // Kept as "This week's", and used again a week before: that week's invoices.
    const favourites = host.querySelector('[data-group-kind="favourites"]') as HTMLElement;
    (favourites.querySelector('.fd-search-add') as HTMLButtonElement).click();
    const name = favourites.querySelector('input.fd-input') as HTMLInputElement;
    name.value = 'This week’s';
    (favourites.querySelector('.fd-button-primary') as HTMLButtonElement).click();
    expect(JSON.stringify(preferences.get('favourites:invoices'))).toContain('"period":{"field":"date","is":"thisWeek"}');
    now = new Date('2026-10-07T06:40:00Z');
    button(favourites, 'This week’s')!.click();
    // The week of Monday 5 October: INV/003 and INV/005.
    await until(() => rows(host).length === 2);
    expect(names(host)).toEqual(['INV/003', 'INV/005']);
  });

  it('is not offered where no period can be counted: a field that holds no date', async () => {
    const host = await mount();
    openMenu(host);
    (host.querySelector('.fd-search-add') as HTMLButtonElement).click();
    const [which, condition] = host.querySelectorAll('.fd-custom-filter select') as NodeListOf<HTMLSelectElement>;
    which.value = 'hours';
    which.dispatchEvent(new Event('change', { bubbles: true }));
    expect([...condition.options].map((o) => o.value)).not.toContain('period');
  });
});
