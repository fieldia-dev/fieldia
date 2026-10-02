import { createMemoryDataSource, type Page } from '@fieldia/core';

/** Customers as a list: four of them, two to a page. */
export const customers: Page = {
  fieldia: '0.1',
  id: 'customers',
  title: 'Customers',
  data: { kind: 'record', model: 'partner' },
  fields: {
    name: { type: 'char', label: 'Name' },
    country_id: { type: 'many2one', label: 'Country', relation: 'country' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }, { value: 'blocked', label: 'Blocked' }] },
    credit_limit: { type: 'monetary', label: 'Credit limit', currencyField: 'currency_id' },
    currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' },
  },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name', 'country_id', 'state', 'credit_limit'],
    sort: [{ field: 'name' }],
    pageSize: 2,
    filters: [
      { id: 'active', label: 'Active', filter: [{ field: 'state', op: '=', value: 'active' }] },
      { id: 'blocked', label: 'Blocked', filter: [{ field: 'state', op: '=', value: 'blocked' }] },
    ],
    groupBy: ['country_id', 'state'],
    actions: [{ type: 'button', id: 'archive', label: 'Archive', action: 'archive' }],
  },
};

export const partners = () =>
  createMemoryDataSource({
    records: {
      partner: {
        1: { name: 'Nile Traders', country_id: { id: 1, label: 'Egypt' }, state: 'active', credit_limit: 250000, currency_id: { id: 1, label: 'EGP' } },
        2: { name: 'Amira Clinics', country_id: { id: 1, label: 'Egypt' }, state: 'draft', credit_limit: 50000, currency_id: { id: 1, label: 'EGP' } },
        3: { name: 'Petra Tours', country_id: { id: 2, label: 'Jordan' }, state: 'active', credit_limit: 80000, currency_id: { id: 2, label: 'JOD' } },
        4: { name: 'Zamalek Studio', country_id: null, state: 'blocked', credit_limit: null },
      },
    },
  });

/** Wait, up to two seconds, for something the list does after an answer comes back. */
export async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}
