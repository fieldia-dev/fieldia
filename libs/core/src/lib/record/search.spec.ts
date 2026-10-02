import type { Page } from '../format/page';
import type { ListNode } from '../format/layout';
import { matchesFilter } from './filter';
import { facetsToFilter, groupByFields, suggestions, type Facet } from './search';

const page: Page = {
  fieldia: '0.1',
  id: 'customers',
  data: { kind: 'record', model: 'partner' },
  fields: {
    name: { type: 'char', label: 'Name' },
    country_id: { type: 'many2one', label: 'Country', relation: 'country' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }, { value: 'draft', label: 'Draft' }] },
    credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
    is_company: { type: 'boolean', label: 'Is a company' },
  },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name', 'country_id', 'state', 'credit_limit'],
    filters: [
      { id: 'active', label: 'Active', filter: [{ field: 'state', op: '=', value: 'active' }] },
      { id: 'big', label: 'Big accounts', filter: [{ field: 'credit_limit', op: '>=', value: 100000 }] },
    ],
    groupBy: ['country_id', 'state'],
  },
};
const list = page.layout as ListNode;
const nile = { name: 'Nile Traders', country_id: { id: 1, label: 'Egypt' }, state: 'active', credit_limit: 250000 };
const amira = { name: 'Amira Clinics', country_id: { id: 1, label: 'Egypt' }, state: 'draft', credit_limit: 50000 };
const petra = { name: 'Petra Tours', country_id: { id: 2, label: 'Jordan' }, state: 'active', credit_limit: 80000 };

describe('suggestions', () => {
  it('offers to look for typed text in each text field, a matching choice by its label, and a link by its name', () => {
    const offered = suggestions('act', page, list);
    expect(offered.map((s) => s.label)).toEqual(['Search Name for: act', 'Status: Active', 'Search Country for: act']);
    expect(offered[1]).toEqual(expect.objectContaining({ field: 'state', op: '=', value: 'active', valueLabel: 'Active' }));
  });

  it('offers a number where the text is one, and nothing for an empty search', () => {
    expect(suggestions('80000', page, list).map((s) => s.label)).toContain('Search Credit limit for: 80000');
    expect(suggestions('80000', page, list).find((s) => s.field === 'credit_limit')).toEqual(expect.objectContaining({ op: '=', value: 80000 }));
    expect(suggestions('nile', page, list).some((s) => s.field === 'credit_limit')).toBe(false);
    expect(suggestions('   ', page, list)).toEqual([]);
  });

  it('looks only in the fields the list names for searching', () => {
    expect(suggestions('eg', page, { ...list, searchFields: ['country_id'] }).map((s) => s.field)).toEqual(['country_id']);
  });
});

describe('facetsToFilter', () => {
  const name = (value: string): Facet => ({ kind: 'field', field: 'name', label: 'Name', values: [{ op: 'ilike', value, label: value }] });

  it('ORs the values searched in one field, and ANDs the facets', () => {
    const facets: Facet[] = [
      { kind: 'field', field: 'name', label: 'Name', values: [{ op: 'ilike', value: 'nile', label: 'nile' }, { op: 'ilike', value: 'petra', label: 'petra' }] },
      { kind: 'field', field: 'country_id', label: 'Country', values: [{ op: 'ilike', value: 'jor', label: 'jor' }] },
    ];
    const filter = facetsToFilter(facets, list);
    expect([nile, amira, petra].filter((r) => matchesFilter(r, filter)).map((r) => r.name)).toEqual(['Petra Tours']);
    expect([nile, amira, petra].filter((r) => matchesFilter(r, facetsToFilter([name('i')], list))).map((r) => r.name)).toEqual(['Nile Traders', 'Amira Clinics']);
  });

  it('turns named filters chosen together into an OR of each one’s conditions', () => {
    const filter = facetsToFilter([{ kind: 'filters', ids: ['active', 'big'], labels: ['Active', 'Big accounts'] }], list);
    expect([nile, amira, petra].filter((r) => matchesFilter(r, filter)).map((r) => r.name)).toEqual(['Nile Traders', 'Petra Tours']);
  });

  it('keeps Group By out of the filter, and says which fields it groups by, in order', () => {
    const facets: Facet[] = [name('a'), { kind: 'groupBy', fields: ['state', 'country_id'], labels: ['Status', 'Country'] }];
    expect(facetsToFilter(facets, list)).toEqual([{ field: 'name', op: 'ilike', value: 'a' }]);
    expect(groupByFields(facets)).toEqual(['state', 'country_id']);
    expect(groupByFields([name('a')])).toEqual([]);
  });

  it('takes a custom filter as it was built', () => {
    const filter = facetsToFilter([{ kind: 'custom', label: 'Credit limit ≥ 60,000', filter: [{ field: 'credit_limit', op: '>=', value: 60000 }] }], list);
    expect([nile, amira, petra].filter((r) => matchesFilter(r, filter)).map((r) => r.name)).toEqual(['Nile Traders', 'Petra Tours']);
  });
});
