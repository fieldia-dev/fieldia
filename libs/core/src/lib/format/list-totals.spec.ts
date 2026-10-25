import { ListCellSchema, ListNodeSchema, validatePage } from '../../index';

/**
 * A list that adds up and filters by time: a column's total, and a named
 * filter of a period a date falls in. The page names each by field, so a
 * period of no date and a sum of no number are refused before anything
 * draws; a list without them is as it was.
 */

const fields = {
  name: { type: 'char', label: 'Number' },
  city: { type: 'selection', label: 'City', options: [{ value: 'cairo', label: 'Cairo' }] },
  date: { type: 'date', label: 'Invoice date' },
  sent: { type: 'datetime', label: 'Sent' },
  amount: { type: 'monetary', label: 'Amount', currencyField: 'currency_id' },
  currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
  hours: { type: 'float', label: 'Hours' },
};
const page = (list: Record<string, unknown>) => ({
  fieldia: '0.13',
  id: 'invoices',
  data: { kind: 'record', model: 'invoice' },
  fields,
  layout: { type: 'list', id: 'list', columns: ['name', 'city', 'date', 'amount', 'hours'], ...list },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a list that adds up and filters by time', () => {
  it('takes a total on a column and a filter of a period, alone or with its conditions', () => {
    expect(
      problems(
        page({
          cells: { amount: { total: 'sum', align: 'end' }, hours: { total: 'avg' }, name: { total: 'count' }, date: { total: 'count' } },
          filters: [
            { id: 'this_month', label: 'This month', period: { field: 'date', is: 'thisMonth' } },
            { id: 'late', label: 'Sent last week, Cairo', filter: [{ field: 'city', op: '=', value: 'cairo' }], period: { field: 'sent', is: 'lastWeek' } },
            { id: 'cairo', label: 'Cairo', filter: [{ field: 'city', op: '=', value: 'cairo' }] },
          ],
          groupBy: ['city', 'date'],
        })
      )
    ).toEqual([]);
    for (const is of ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'last7Days', 'last30Days', 'overdue']) {
      expect(problems(page({ filters: [{ id: 'p', label: 'P', period: { field: 'date', is } }] }))).toEqual([]);
    }
    for (const total of ['sum', 'avg', 'min', 'max', 'count']) expect(ListCellSchema.safeParse({ total }).success).toBe(true);
  });

  it('refuses a filter with neither conditions nor a period, a period it does not know, and a total that is none', () => {
    expect(problems(page({ filters: [{ id: 'empty', label: 'Empty' }] })).join('\n')).toMatch(/layout\.filters\[0\]: a filter holds conditions \(filter\), a period \(period\) or both/);
    expect(problems(page({ filters: [{ id: 'p', label: 'P', period: { field: 'date', is: 'nextWeek' } }] })).join('\n')).toMatch(/layout\.filters\[0\]\.period\.is/);
    expect(problems(page({ filters: [{ id: 'p', label: 'P', period: { field: 'date', is: 'today', from: 3 } }] })).join('\n')).toMatch(/layout\.filters\[0\]\.period/);
    expect(ListCellSchema.safeParse({ total: 'median' }).success).toBe(false);
    expect(ListNodeSchema.safeParse({ type: 'list', id: 'l', columns: ['name'], filters: [{ id: 'p', label: 'P', filter: [] }] }).success).toBe(false);
  });

  it('refuses a period of a field that holds no date, or of no field, and a sum of words', () => {
    expect(problems(page({ filters: [{ id: 'p', label: 'P', period: { field: 'city', is: 'today' } }] }))).toEqual([
      'layout.filters[0].period.field: "city" is a selection; a period is of a date, or a date and time',
    ]);
    expect(problems(page({ filters: [{ id: 'p', label: 'P', period: { field: 'ghost', is: 'today' } }] })).join('\n')).toMatch(/layout\.filters\[0\]\.period\.field: .*ghost/);
    expect(problems(page({ cells: { name: { total: 'sum' } } }))).toEqual([
      'layout.cells.name.total: "name" is a char; its total "sum" is of numbers — an integer, a float or an amount — and any column\'s is "count"',
    ]);
    expect(problems(page({ cells: { date: { total: 'max' } } })).join('\n')).toMatch(/"date" is a date; its total "max" is of numbers/);
  });
});
