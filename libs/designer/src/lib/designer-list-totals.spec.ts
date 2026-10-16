import { validatePage, type Field, type ListNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { columnProperties, listProperties } from './list-properties';

/**
 * A list that adds up and filters by time, made in the designer: a named
 * filter of a period a date falls in ("This month", "Overdue"), and a
 * column's total — each where its neighbours are, in the list's panel and the
 * column's, refused where it cannot be.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Number' },
  date: { type: 'date', label: 'Invoice date' },
  due: { type: 'date', label: 'Due date' },
  sent: { type: 'datetime', label: 'Sent' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'posted', label: 'Posted' }, { value: 'paid', label: 'Paid' }] },
  amount: { type: 'monetary', label: 'Amount', currencyField: 'currency_id' },
  currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const invoices = () => {
  const designer = createDesigner({ page: blankPage('list', 'Invoices'), model });
  designer.addColumn('date');
  designer.addColumn('amount');
  return designer;
};
const change = (input: HTMLInputElement | HTMLSelectElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('a named filter of a period', () => {
  it('keeps a period, alone or with a condition, and takes the date it names onto the page', () => {
    const designer = invoices();
    const id = designer.addListFilter('Overdue', [{ field: 'state', op: '!=', value: 'paid' }]) as string;
    expect(designer.updateListFilter(id, { period: { field: 'due', is: 'overdue' } })).toBe(true);
    expect(list(designer).filters?.[0]).toEqual({ id, label: 'Overdue', filter: [{ field: 'state', op: '!=', value: 'paid' }], period: { field: 'due', is: 'overdue' } });
    expect(designer.getPage().fields['due']).toEqual(model['due']);
    expect(designer.updateListFilter(id, { filter: null })).toBe(true);
    expect(list(designer).filters?.[0]).toEqual({ id, label: 'Overdue', period: { field: 'due', is: 'overdue' } });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    designer.undo();
    expect(list(designer).filters?.[0].filter).toEqual([{ field: 'state', op: '!=', value: 'paid' }]);
  });

  it('refuses a period of what holds no date, and a filter left with nothing', () => {
    const designer = invoices();
    const id = designer.addListFilter('This month', [{ field: 'date', op: 'set' }]) as string;
    expect(designer.updateListFilter(id, { period: { field: 'state', is: 'today' } })).toBe(false);
    expect(designer.getState().issues).toEqual(['A period is a date’s; Status holds no date']);
    expect(designer.updateListFilter(id, { filter: null })).toBe(false);
    expect(designer.getState().issues).toEqual(['A filter needs a condition']);
  });

  it('is made in the list’s panel: a date’s test “is in the period”, then the period from a list', () => {
    const designer = invoices();
    designer.addListFilter('This month', [{ field: 'date', op: 'set' }]);
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    designer.subscribe(() => panel.update(designer.getPage()));
    panel.update(designer.getPage());
    const row = () => panel.element.querySelector('.fd-list-filter') as HTMLElement;
    const test = () => row().querySelector('select[aria-label="Filter test"]') as HTMLSelectElement;
    expect([...test().options].map((o) => o.textContent)).toContain('is in the period');
    change(test(), 'period');
    expect(list(designer).filters?.[0]).toMatchObject({ label: 'This month', period: { field: 'date', is: 'thisMonth' } });
    expect(list(designer).filters?.[0].filter).toBeUndefined();
    const periods = row().querySelector('select[aria-label="Filter value"]') as HTMLSelectElement;
    expect([...periods.options].map((o) => o.textContent)).toEqual(['Today', 'Yesterday', 'This week', 'Last week', 'This month', 'Last month', 'This year', 'The last 7 days', 'The last 30 days', 'Overdue: before today']);
    expect(periods.value).toBe('thisMonth');
    change(periods, 'last7Days');
    expect(list(designer).filters?.[0].period).toEqual({ field: 'date', is: 'last7Days' });
    // Another date keeps its period; a test that is no period makes it a condition again.
    change(row().querySelector('select[aria-label="Filter field"]') as HTMLSelectElement, 'due');
    expect(list(designer).filters?.[0].period).toEqual({ field: 'due', is: 'last7Days' });
    change(test(), 'set');
    expect(list(designer).filters?.[0]).toMatchObject({ filter: [{ field: 'due', op: 'set' }] });
    expect(list(designer).filters?.[0].period).toBeUndefined();
    // Undone, the period's list shows the period again.
    designer.undo();
    expect((row().querySelector('select[aria-label="Filter value"]') as HTMLSelectElement).value).toBe('last7Days');
  });
});

describe('a column’s total', () => {
  it('keeps a number’s sum, average, lowest or highest, and any column’s count, refusing a sum of words', () => {
    const designer = invoices();
    expect(designer.setListCell('amount', { total: 'sum' })).toBe(true);
    expect(designer.setListCell('date', { total: 'count' })).toBe(true);
    expect(list(designer).cells).toEqual({ amount: { total: 'sum' }, date: { total: 'count' } });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListCell('name', { total: 'avg' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A sum, an average, the lowest and the highest are a number’s; Name is not one. Any column can count its records']);
  });

  it('is set in the column’s panel, beside its width and side: a number offers every kind, words a count', () => {
    const designer = invoices();
    const panel = columnProperties(elementFactory(document), designer, 'amount');
    document.body.replaceChildren(panel.element);
    designer.subscribe(() => panel.update(designer.getPage()));
    panel.update(designer.getPage());
    const total = panel.element.querySelector('[data-part="total"] select') as HTMLSelectElement;
    expect([...total.options].map((o) => o.textContent)).toEqual(['None', 'The sum', 'The average', 'The lowest', 'The highest', 'How many hold one']);
    change(total, 'sum');
    expect(list(designer).cells).toEqual({ amount: { total: 'sum' } });
    change(total, '');
    expect(list(designer).cells).toBeUndefined();
    const words = columnProperties(elementFactory(document), designer, 'name');
    words.update(designer.getPage());
    expect([...(words.element.querySelector('[data-part="total"] select') as HTMLSelectElement).options].map((o) => o.value)).toEqual(['', 'count']);
  });
});
