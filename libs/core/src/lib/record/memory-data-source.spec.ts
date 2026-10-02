import { createMemoryDataSource } from './memory-data-source';
import type { Fields } from '../format/field';

const fields = {
  name: { type: 'char', label: 'Name' },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
  child_ids: { type: 'one2many', label: 'Contacts', relation: 'partner', fields: { name: { type: 'char', label: 'Name' } } },
} as Fields;

function source() {
  return createMemoryDataSource({
    records: {
      partner: {
        1: { name: 'Nile Traders', tag_ids: [{ id: 10, label: 'VIP' }], child_ids: [{ key: 'c1', id: 2, values: { name: 'Mona' } }] },
      },
      tag: { 10: { name: 'VIP' }, 11: { name: 'Wholesale' }, 12: { name: 'Export' } },
      country: { 1: { name: 'Egypt', code: 'EG' }, 2: { name: 'Estonia', code: 'EE' }, 3: { name: 'Jordan', code: 'JO' } },
    },
    onchange: {
      partner: { name: (values) => ({ ref: String(values['name'] ?? '').slice(0, 3).toUpperCase() }) },
    },
  });
}

describe('createMemoryDataSource — implements every DataSource method', () => {
  it('loads a copy of a record', async () => {
    const ds = source();
    const values = await ds.load({ model: 'partner', id: 1, fields });
    expect(values['name']).toBe('Nile Traders');
    (values['tag_ids'] as unknown[]).length = 0;
    expect((await ds.load({ model: 'partner', id: 1, fields }))['tag_ids']).toHaveLength(1);
  });

  it('refuses to load a record it does not have', async () => {
    await expect(source().load({ model: 'partner', id: 99, fields })).rejects.toThrow('No partner record with id 99');
  });

  it('creates a record and gives it the next id', async () => {
    const ds = source();
    const result = await ds.save({ model: 'partner', id: null, fields, values: {}, changes: { values: { name: 'Delta Co' }, lines: {}, links: {} } });
    expect(result.id).toBe(2);
    expect(ds.records['partner'][2]['name']).toBe('Delta Co');
  });

  it('applies line and link operations as a backend would', async () => {
    const ds = source();
    const result = await ds.save({
      model: 'partner',
      id: 1,
      fields,
      values: {},
      changes: {
        values: { name: 'Nile Traders Ltd' },
        lines: { child_ids: [{ op: 'create', key: 'new1', values: { name: 'Omar' } }, { op: 'delete', id: 2 }] },
        links: { tag_ids: [{ op: 'link', id: 11 }, { op: 'unlink', id: 10 }] },
      },
    });
    const stored = ds.records['partner'][1];
    expect(stored['name']).toBe('Nile Traders Ltd');
    expect(stored['tag_ids']).toEqual([{ id: 11, label: 'Wholesale' }]);
    expect(stored['child_ids']).toEqual([{ key: 'new1', id: expect.any(Number), values: { name: 'Omar' } }]);
    expect(result.values).toEqual(stored);
  });

  it('updates a line by id, and handles set and clear', async () => {
    const ds = source();
    await ds.save({
      model: 'partner',
      id: 1,
      fields,
      values: {},
      changes: { values: {}, lines: { child_ids: [{ op: 'update', id: 2, values: { name: 'Mona A.' } }] }, links: { tag_ids: [{ op: 'set', ids: [11, 12] }] } },
    });
    expect(ds.records['partner'][1]['child_ids']).toEqual([{ key: 'c1', id: 2, values: { name: 'Mona A.' } }]);
    expect(ds.records['partner'][1]['tag_ids']).toEqual([{ id: 11, label: 'Wholesale' }, { id: 12, label: 'Export' }]);
    await ds.save({ model: 'partner', id: 1, fields, values: {}, changes: { values: {}, lines: {}, links: { tag_ids: [{ op: 'clear' }] } } });
    expect(ds.records['partner'][1]['tag_ids']).toEqual([]);
  });

  it('runs onchange rules and reports nothing for fields without one', async () => {
    const ds = source();
    expect(await ds.onchange({ model: 'partner', id: 1, changed: 'name', values: { name: 'Delta' } })).toEqual({ values: { ref: 'DEL' } });
    expect(await ds.onchange({ model: 'partner', id: 1, changed: 'email', values: {} })).toEqual({});
  });

  it('warns about a change without blocking it, beside any recalculation', async () => {
    const ds = createMemoryDataSource({
      onchange: { partner: { credit_limit: () => ({ approved: false }) } },
      warnings: { partner: { credit_limit: (values) => (Number(values['credit_limit']) > 100000 ? 'Above the approval limit' : null) } },
    });
    expect(await ds.onchange({ model: 'partner', id: 1, changed: 'credit_limit', values: { credit_limit: 250000 } })).toEqual({
      values: { approved: false },
      warning: 'Above the approval limit',
    });
    expect(await ds.onchange({ model: 'partner', id: 1, changed: 'credit_limit', values: { credit_limit: 5000 } })).toEqual({ values: { approved: false } });
  });

  it('searches by label, applies a filter and a limit', async () => {
    const ds = source();
    expect((await ds.search({ model: 'country', query: 'e' })).map((r) => r.label)).toEqual(['Egypt', 'Estonia']);
    expect(await ds.search({ model: 'country', query: '', filter: [{ field: 'code', op: '=', value: 'JO' }] })).toEqual([{ id: 3, label: 'Jordan' }]);
    expect(await ds.search({ model: 'country', query: '', limit: 1 })).toHaveLength(1);
  });

  it('keeps each submitted response', async () => {
    const ds = source();
    expect(await ds.submit({ pageId: 'feedback', values: { rating: 5 } })).toEqual({ id: 1 });
    expect(ds.responses).toEqual([{ pageId: 'feedback', values: { rating: 5 } }]);
  });

  it('logs every call, for tests that need to know what was asked', async () => {
    const ds = source();
    await ds.search({ model: 'country', query: 'jo' });
    expect(ds.calls.map((c) => c.method)).toEqual(['search']);
  });
});

describe('createMemoryDataSource — lists and groups', () => {
  const partners = () =>
    createMemoryDataSource({
      records: {
        partner: {
          1: { name: 'Nile Traders', country_id: { id: 1, label: 'Egypt' }, credit_limit: 250000, state: 'active' },
          2: { name: 'Amira Clinics', country_id: { id: 1, label: 'Egypt' }, credit_limit: 50000, state: 'draft' },
          3: { name: 'Petra Tours', country_id: { id: 2, label: 'Jordan' }, credit_limit: 80000, state: 'active' },
          4: { name: 'Zamalek Studio', country_id: null, credit_limit: null, state: 'blocked' },
        },
      },
    });

  it('lists the fields asked for, filtered, sorted and in pages, with how many there are in all', async () => {
    const ds = partners();
    const first = await ds.list!({ model: 'partner', fields: ['name', 'state'], filter: [{ field: 'state', op: '!=', value: 'blocked' }], sort: [{ field: 'name' }], offset: 0, limit: 2 });
    expect(first).toEqual({
      total: 3,
      records: [
        { id: 2, values: { name: 'Amira Clinics', state: 'draft' } },
        { id: 1, values: { name: 'Nile Traders', state: 'active' } },
      ],
    });
    const second = await ds.list!({ model: 'partner', fields: ['name'], filter: [{ field: 'state', op: '!=', value: 'blocked' }], sort: [{ field: 'name' }], offset: 2, limit: 2 });
    expect(second).toEqual({ total: 3, records: [{ id: 3, values: { name: 'Petra Tours' } }] });
  });

  it('sorts a link by its label and a number by its value, empty last either way', async () => {
    const ds = partners();
    const byCountry = await ds.list!({ model: 'partner', fields: ['name'], filter: [], sort: [{ field: 'country_id' }, { field: 'name' }], offset: 0, limit: 10 });
    expect(byCountry.records.map((r) => r.id)).toEqual([2, 1, 3, 4]);
    const byLimit = await ds.list!({ model: 'partner', fields: ['name'], filter: [], sort: [{ field: 'credit_limit', desc: true }], offset: 0, limit: 10 });
    expect(byLimit.records.map((r) => r.id)).toEqual([1, 3, 2, 4]);
  });

  it('counts the records under each value of a field: a link by its record, nothing as its own group, last', async () => {
    const ds = partners();
    expect(await ds.groups!({ model: 'partner', field: 'country_id', filter: [] })).toEqual([
      { value: 1, label: 'Egypt', count: 2 },
      { value: 2, label: 'Jordan', count: 1 },
      { value: null, label: '', count: 1 },
    ]);
    expect(await ds.groups!({ model: 'partner', field: 'state', filter: [{ field: 'credit_limit', op: 'set', value: null }] })).toEqual([
      { value: 'active', label: 'active', count: 2 },
      { value: 'draft', label: 'draft', count: 1 },
    ]);
  });
});
