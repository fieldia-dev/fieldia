import type { Fields } from '../format/field';
import { loadedRecordOf, saveProblemOf } from './data-source';
import { createMemoryDataSource } from './memory-data-source';

/**
 * Many records changed at once (`writeMany`, contract section 8): the same
 * value in each, each refused as its own save would be — a record this person
 * may not change, a field they may not, a version older than the record's —
 * and the rest changed. The memory source does it as a backend would.
 */

const fields: Fields = { stage: { type: 'selection', label: 'Stage', options: [{ value: 'new', label: 'New' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }] } };
const leads = () => ({
  1: { name: 'Villa in Sheikh Zayed', stage: 'new', agent: 7, owner_phone: '+201001234567' },
  2: { name: 'Flat in Maadi', stage: 'new', agent: 8, owner_phone: '+201112223334' },
  3: { name: 'Chalet in Sahel', stage: 'new', agent: 7, owner_phone: '' },
  4: { name: 'Office in New Cairo', stage: 'won', agent: 7, owner_phone: '+201009998887' },
});

describe('createMemoryDataSource — many records changed at once', () => {
  it('writes the value in each record named, and nothing else', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() } });
    await expect(ds.writeMany({ model: 'lead', ids: [1, 3], values: { stage: 'won' }, fields })).resolves.toEqual({ failed: [] });
    expect(ds.records['lead']['1']).toMatchObject({ name: 'Villa in Sheikh Zayed', stage: 'won' });
    expect(ds.records['lead']['3']).toMatchObject({ stage: 'won' });
    expect(ds.records['lead']['2']).toMatchObject({ stage: 'new' });
    expect(ds.calls.filter((call) => call.method === 'writeMany')).toHaveLength(1);
  });

  it('refuses, record by record, what the person may not change, and says why; the rest is changed', async () => {
    const ds = createMemoryDataSource({
      records: { lead: leads() },
      can: { lead: (values) => ({ ...(values['agent'] === 7 ? {} : { edit: false, reason: 'Only the lead’s agent can change it.' }), ...(values['stage'] === 'won' ? { readonlyFields: ['stage'] } : {}) }) },
    });
    const { failed } = await ds.writeMany({ model: 'lead', ids: [1, 2, 4, 9], values: { stage: 'lost' }, fields });
    expect(failed.map(({ id, message }) => [id, message])).toEqual([
      [2, 'Only the lead’s agent can change it.'],
      [4, 'You may not change this field'],
      [9, 'No lead record with id 9'],
    ]);
    expect(failed[0].problem).toMatchObject({ kind: 'rule' });
    expect(failed[1].problem).toMatchObject({ kind: 'fields', fields: { stage: 'You may not change this field' } });
    expect(ds.records['lead']['1']['stage']).toBe('lost');
    expect(ds.records['lead']['2']['stage']).toBe('new');
    expect(ds.records['lead']['4']['stage']).toBe('won');
  });

  it('refuses a record changed after the version it was listed at, naming who changed it, and moves the rest on', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() }, versions: { by: 'Sara' } });
    const listed = await ds.list({ model: 'lead', fields: ['name'], filter: [], sort: [], offset: 0, limit: 10 });
    const versions = Object.fromEntries(listed.records.map((record) => [String(record.id), record.version!]));
    ds.changeElsewhere('lead', 2, { stage: 'lost' }, { by: 'Mona', at: '2026-10-16T09:00:00Z' });
    const { failed } = await ds.writeMany({ model: 'lead', ids: [1, 2, 3], values: { stage: 'won' }, fields, versions });
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ id: 2, problem: { kind: 'conflict', conflict: { version: { by: 'Mona', at: '2026-10-16T09:00:00Z' } } } });
    expect(ds.records['lead']['2']['stage']).toBe('lost');
    // Each changed one moved on, named for who changed it.
    expect(loadedRecordOf(await ds.load({ model: 'lead', id: 1, fields })).version).toMatchObject({ by: 'Sara' });
    // Without a version a record is not checked, as a save that says none.
    await expect(ds.writeMany({ model: 'lead', ids: [2], values: { stage: 'new' }, fields })).resolves.toEqual({ failed: [] });
  });

  it('is a save of those fields alone: a partial one, its problems read as a save’s are', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() }, can: { lead: () => ({ edit: false }) } });
    const { failed } = await ds.writeMany({ model: 'lead', ids: [1], values: { stage: 'won' }, fields });
    expect(saveProblemOf(Object.assign(new Error(failed[0].message), { problem: failed[0].problem }))).toEqual({ kind: 'rule', message: 'You may not edit this record' });
  });
});
