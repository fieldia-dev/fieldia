import type { Fields } from '../format/field';
import { newRecordSave } from './data-source';
import { createMemoryDataSource } from './memory-data-source';

/**
 * Many records made at once (`createMany`, contract section 11): each with
 * its own values, answered in the order asked — the id each was made with, or
 * why it was not — as a list's Import of a file's rows needs. Where a source
 * has none, the list saves each as a new record (`newRecordSave`).
 */

const fields: Fields = {
  name: { type: 'char', label: 'Name', required: true },
  country_id: { type: 'many2one', label: 'Country', relation: 'country' },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
};

describe('a new record’s save, from its values alone', () => {
  it('sends every value, a many2many’s links as one set, the rest as changes', () => {
    const values = { name: 'Mona Adel', country_id: { id: 1, label: 'Egypt' }, tag_ids: [{ id: 3, label: 'VIP' }, { id: 5, label: 'Press' }] };
    expect(newRecordSave('contact', fields, values)).toEqual({
      model: 'contact',
      id: null,
      fields,
      changes: { values: { name: 'Mona Adel', country_id: { id: 1, label: 'Egypt' } }, lines: {}, links: { tag_ids: [{ op: 'set', ids: [3, 5] }] } },
      values,
    });
  });

  it('clears a many2many left empty, never leaves it unsaid', () => {
    expect(newRecordSave('contact', fields, { name: 'Omar', tag_ids: [] }).changes.links).toEqual({ tag_ids: [{ op: 'set', ids: [] }] });
  });
});

describe('createMemoryDataSource — many records made at once', () => {
  it('makes each record, in order, and answers each one’s id', async () => {
    const ds = createMemoryDataSource({ records: { contact: { 1: { name: 'Sara' } }, tag: { 3: { name: 'VIP' } } } });
    const answer = await ds.createMany({ model: 'contact', fields, records: [{ name: 'Mona Adel', tag_ids: [{ id: 3, label: 'VIP' }] }, { name: 'Omar Said' }] });
    expect(answer.records).toEqual([{ id: 2 }, { id: 3 }]);
    expect(ds.records['contact']['2']).toEqual({ name: 'Mona Adel', tag_ids: [{ id: 3, label: 'VIP' }] });
    expect(ds.records['contact']['3']).toEqual({ name: 'Omar Said' });
    expect(ds.calls.filter((call) => call.method === 'createMany')).toHaveLength(1);
    expect(ds.calls.some((call) => call.method === 'save')).toBe(false);
  });

  it('answers why a record was not made, and makes the rest', async () => {
    const ds = createMemoryDataSource({ records: { contact: {} } });
    const save = ds.save.bind(ds);
    // A store that refuses what a server would: here, no name of the page's own rules, made in a test's own write.
    ds.createMany = async (request) => {
      const records = [];
      for (const values of request.records) {
        if (!values['name']) records.push({ message: 'Name is required' });
        else records.push({ id: (await save(newRecordSave(request.model, request.fields, values))).id });
      }
      return { records };
    };
    const answer = await ds.createMany({ model: 'contact', fields, records: [{ name: 'Mona' }, { name: '' }, { name: 'Omar' }] });
    expect(answer.records).toEqual([{ id: 1 }, { message: 'Name is required' }, { id: 2 }]);
  });
});
