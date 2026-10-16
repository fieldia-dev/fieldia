import type { ListNode } from '../format/layout';
import { createMemoryDataSource } from './memory-data-source';
import type { ResolvedFilter } from './data-source';
import { facetsToFilter, type Facet } from './search';

/**
 * Lists that add up and filter by time, as a data source answers them: a
 * date grouped by the span it falls in (`interval`), amounts totalled within
 * one currency only (`currencies`), and periods counted again each time a
 * list asks — none of it anything a source has to learn to filter.
 */

const invoices = () => ({
  1: { name: 'INV/001', city: 'Cairo', date: '2026-09-28', due: '2026-10-28', amount: 1000, currency_id: { id: 1, label: 'EGP' }, hours: 4 },
  2: { name: 'INV/002', city: 'Cairo', date: '2026-10-02', due: '2026-10-12', amount: 2500, currency_id: { id: 1, label: 'EGP' }, hours: null },
  3: { name: 'INV/003', city: 'Dubai', date: '2026-10-05', due: '2026-11-05', amount: 400, currency_id: { id: 2, label: 'USD' }, hours: 2 },
  4: { name: 'INV/004', city: 'Dubai', date: '2026-10-14', due: '2026-10-13', amount: 600, currency_id: { id: 2, label: 'USD' }, hours: 1 },
  5: { name: 'INV/005', city: 'Giza', date: null, due: null, amount: 50, currency_id: { id: 1, label: 'EGP' }, hours: null },
});
const source = () => createMemoryDataSource({ records: { invoice: invoices() } });

describe('a Group By of a date: by the span each record falls in', () => {
  it('groups by month, its first day the group’s value, in time order, those with no date last', async () => {
    expect(await source().groups({ model: 'invoice', field: 'date', filter: [], interval: 'month' })).toEqual([
      { value: '2026-09-01', label: '2026-09-01', count: 1 },
      { value: '2026-10-01', label: '2026-10-01', count: 3 },
      { value: null, label: '', count: 1 },
    ]);
  });

  it('groups by week from the day the request says a week starts on, and by day, quarter and year', async () => {
    const by = (interval: 'week' | 'day' | 'quarter' | 'year', weekStart?: number) => source().groups({ model: 'invoice', field: 'date', filter: [], interval, ...(weekStart === undefined ? {} : { weekStart }) }).then((groups) => groups.map((g) => [g.value, g.count]));
    // Monday weeks: 28 Sep and 2 Oct share one; Monday 5 Oct starts the next; 14 Oct its own.
    expect(await by('week', 1)).toEqual([['2026-09-28', 2], ['2026-10-05', 1], ['2026-10-12', 1], [null, 1]]);
    // Saturday weeks: 28 Sep and 2 Oct (from Sat 26 Sep), 5 Oct (from Sat 3 Oct), 14 Oct (from Sat 10 Oct).
    expect(await by('week', 6)).toEqual([['2026-09-26', 2], ['2026-10-03', 1], ['2026-10-10', 1], [null, 1]]);
    expect(await by('day')).toEqual([['2026-09-28', 1], ['2026-10-02', 1], ['2026-10-05', 1], ['2026-10-14', 1], [null, 1]]);
    expect(await by('quarter')).toEqual([['2026-07-01', 1], ['2026-10-01', 3], [null, 1]]);
    expect(await by('year')).toEqual([['2026-01-01', 4], [null, 1]]);
  });

  it('tells a date and time’s day where the request says, the next day east of midnight', async () => {
    const ds = createMemoryDataSource({ records: { visit: { 1: { start: '2026-09-30T22:30:00.000Z' }, 2: { start: '2026-09-30T20:00:00.000Z' } } } });
    const months = (timeZone: string) => ds.groups({ model: 'visit', field: 'start', filter: [], interval: 'month', timeZone }).then((groups) => groups.map((g) => [g.value, g.count]));
    expect(await months('Africa/Cairo')).toEqual([['2026-09-01', 1], ['2026-10-01', 1]]);
    expect(await months('UTC')).toEqual([['2026-09-01', 2]]);
  });

  it('totals under each span as it groups them, in the same order', async () => {
    const result = await source().totals({ model: 'invoice', filter: [], totals: { hours: ['sum'] }, groupBy: 'date', interval: 'month' });
    expect(result.groups?.map((g) => [g.value, g.count, g.totals['hours']?.sum])).toEqual([['2026-09-01', 1, 4], ['2026-10-01', 3, 3], [null, 1, 0]]);
  });
});

describe('totals of amounts each in its own currency', () => {
  it('totals an amount in one currency, and names it', async () => {
    const cairo = await source().totals({ model: 'invoice', filter: [{ field: 'city', op: '=', value: 'Cairo' }], totals: { amount: ['sum', 'avg', 'min', 'max', 'count'] }, currencies: { amount: 'currency_id' } });
    expect(cairo).toEqual({ count: 2, totals: { amount: { sum: 3500, avg: 1750, min: 1000, max: 2500, count: 2 } }, currencies: { amount: { id: 1, label: 'EGP' } } });
  });

  it('gives no sum, average, least or most over more than one currency — only how many hold one', async () => {
    const all = await source().totals({ model: 'invoice', filter: [], totals: { amount: ['sum', 'avg', 'min', 'max', 'count'], hours: ['sum'] }, currencies: { amount: 'currency_id' } });
    expect(all).toEqual({ count: 5, totals: { amount: { sum: null, avg: null, min: null, max: null, count: 5 }, hours: { sum: 7 } }, currencies: { amount: null } });
  });

  it('totals each group in its own currency, the groups in one each honest, a mixed one not', async () => {
    const result = await source().totals({ model: 'invoice', filter: [], totals: { amount: ['sum'] }, groupBy: 'city', currencies: { amount: 'currency_id' } });
    expect(result.groups?.map((g) => [g.label, g.totals['amount']?.sum, g.currencies?.['amount']])).toEqual([
      ['Cairo', 3500, { id: 1, label: 'EGP' }],
      ['Dubai', 1000, { id: 2, label: 'USD' }],
      ['Giza', 50, { id: 1, label: 'EGP' }],
    ]);
    const byMonth = await source().totals({ model: 'invoice', filter: [], totals: { amount: ['sum'] }, groupBy: 'date', interval: 'month', currencies: { amount: 'currency_id' } });
    expect(byMonth.groups?.map((g) => [g.value, g.totals['amount']?.sum, g.currencies?.['amount']])).toEqual([
      ['2026-09-01', 1000, { id: 1, label: 'EGP' }],
      ['2026-10-01', null, null],
      [null, 50, { id: 1, label: 'EGP' }],
    ]);
  });

  it('totals no records as 0 in no currency, and the ticked rows by their ids', async () => {
    const none = await source().totals({ model: 'invoice', filter: [{ field: 'city', op: '=', value: 'Luxor' }], totals: { amount: ['sum', 'max'] }, currencies: { amount: 'currency_id' } });
    expect(none).toEqual({ count: 0, totals: { amount: { sum: 0, max: null } }, currencies: { amount: null } });
    const ticked = await source().totals({ model: 'invoice', filter: [{ field: 'id', op: 'in', value: [3, 4] }], totals: { amount: ['sum'] }, currencies: { amount: 'currency_id' } });
    expect(ticked).toMatchObject({ count: 2, totals: { amount: { sum: 1000 } }, currencies: { amount: { id: 2, label: 'USD' } } });
  });

  it('says nothing of currencies when none is asked about, as before', async () => {
    const plain = await source().totals({ model: 'invoice', filter: [], totals: { amount: ['sum'] } });
    expect(plain).toEqual({ count: 5, totals: { amount: { sum: 4550 } } });
  });
});

describe('a period in a list’s search, counted again each time it asks', () => {
  const list: ListNode = {
    type: 'list',
    id: 'invoices',
    columns: ['name', 'due', 'amount'],
    filters: [
      { id: 'overdue', label: 'Overdue', filter: [{ field: 'city', op: '!=', value: 'Giza' }], period: { field: 'due', is: 'overdue' } },
      { id: 'this_month', label: 'This month', period: { field: 'date', is: 'thisMonth' } },
      { id: 'cairo', label: 'Cairo', filter: [{ field: 'city', op: '=', value: 'Cairo' }] },
    ],
  };
  /** The list's own counting, as it would be on a day: here Overdue on 14 October is before the 14th, This month October. */
  const on = (today: string) => (period: { field: string; is: string }): ResolvedFilter[] =>
    period.is === 'overdue'
      ? [{ field: period.field, op: '<', value: today }]
      : [{ field: period.field, op: '>=', value: `${today.slice(0, 7)}-01` }, { field: period.field, op: '<', value: today.slice(0, 7) === '2026-10' ? '2026-11-01' : '2026-10-01' }];

  it('makes a named filter’s period plain conditions, with its own conditions beside them', () => {
    const facets: Facet[] = [{ kind: 'filters', ids: ['overdue'], labels: ['Overdue'] }];
    expect(facetsToFilter(facets, list, on('2026-10-14'))).toEqual([
      { field: 'city', op: '!=', value: 'Giza' },
      { field: 'due', op: '<', value: '2026-10-14' },
    ]);
    // A day later, the same filter is a day later.
    expect(facetsToFilter(facets, list, on('2026-10-15'))).toContainEqual({ field: 'due', op: '<', value: '2026-10-15' });
  });

  it('joins named filters any of which hold, a period’s two ends together', () => {
    const facets: Facet[] = [{ kind: 'filters', ids: ['this_month', 'cairo'], labels: ['This month', 'Cairo'] }];
    expect(facetsToFilter(facets, list, on('2026-10-14'))).toEqual([
      {
        any: [
          { all: [{ field: 'date', op: '>=', value: '2026-10-01' }, { field: 'date', op: '<', value: '2026-11-01' }] },
          { field: 'city', op: '=', value: 'Cairo' },
        ],
      },
    ]);
  });

  it('counts a custom filter’s period again, as a favourite kept from last month is this month', () => {
    const lastMonth: ResolvedFilter[] = [{ field: 'date', op: '>=', value: '2026-09-01' }, { field: 'date', op: '<', value: '2026-10-01' }];
    const kept: Facet = { kind: 'custom', label: 'Date: This month', period: { field: 'date', is: 'thisMonth' }, filter: lastMonth };
    expect(facetsToFilter([kept], list, on('2026-10-14'))).toEqual([{ field: 'date', op: '>=', value: '2026-10-01' }, { field: 'date', op: '<', value: '2026-11-01' }]);
    // Without a way to count days, what it was counted as.
    expect(facetsToFilter([kept], list)).toEqual(lastMonth);
  });

  it('finds the records a source already knows how to find', async () => {
    const ds = source();
    const filter = facetsToFilter([{ kind: 'filters', ids: ['overdue'], labels: ['Overdue'] }], list, on('2026-10-14'));
    const found = await ds.list({ model: 'invoice', fields: ['name'], filter, sort: [{ field: 'name' }], offset: 0, limit: 10 });
    expect(found.records.map((r) => r.values['name'])).toEqual(['INV/002', 'INV/004']);
  });
});
