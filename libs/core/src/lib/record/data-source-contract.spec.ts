import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '../format/page';
import { ConflictError, loadedRecord, loadedRecordOf, saveProblemOf, type SaveRequest } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { FileValue, Values } from './values';

/**
 * What 0.21 adds to the data source, each optional so a source without it
 * keeps today's behaviour: a record's version and what the person may do
 * with it, every id a search matches, totals, and files stored as they are
 * picked. docs/plans/wave1-contract.md says it in words.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
const customer: Page = JSON.parse(readFileSync(join(EXAMPLES, 'customer.page.json'), 'utf8'));
const fields = { name: { type: 'char', label: 'Name' } } as const;
const saving = (id: number | null, values: Values, more: Partial<SaveRequest> = {}): SaveRequest => ({ model: 'lead', id, fields, values, changes: { values, lines: {}, links: {} }, ...more });

const leads = () => ({
  1: { name: 'Villa in Sheikh Zayed', stage: 'new', agent: { id: 7, label: 'Mona' }, budget: 4000000, commission: 0.025, owner_phone: '+201001234567' },
  2: { name: 'Flat in Maadi', stage: 'won', agent: { id: 8, label: 'Omar' }, budget: 2500000, commission: 0.02, owner_phone: '+201112223334' },
  3: { name: 'Chalet in Sahel', stage: 'new', agent: null, budget: null, commission: null, owner_phone: '' },
  4: { name: 'Office in New Cairo', stage: 'new', agent: { id: 7, label: 'Mona' }, budget: 9000000, commission: 0.03, owner_phone: '+201009998887' },
});

describe('a loaded record: its values, or its values with more to tell', () => {
  it('reads bare values, as every source gave them before, as a record with nothing more to tell', () => {
    expect(loadedRecordOf({ name: 'Nile Traders' })).toEqual({ $loaded: true, values: { name: 'Nile Traders' } });
  });

  it('keeps the version and permissions a source tells, and leaves out what it does not', () => {
    const told = loadedRecord({ name: 'Nile Traders' }, { version: { token: 'v3', by: 'Mona', at: '2026-10-13T10:42:00Z' }, can: { delete: false } });
    expect(loadedRecordOf(told)).toEqual({ $loaded: true, values: { name: 'Nile Traders' }, version: { token: 'v3', by: 'Mona', at: '2026-10-13T10:42:00Z' }, can: { delete: false } });
    expect(loadedRecord({ name: 'x' })).toEqual({ $loaded: true, values: { name: 'x' } });
  });

  it('is not fooled by a record whose fields are named values and version', () => {
    const odd = { values: { a: 1 }, version: 'draft' } as unknown as Values;
    expect(loadedRecordOf(odd).values).toBe(odd);
  });

  it('opens a form from a source that tells more, with the values alone in the form', async () => {
    const ds = createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', email: 'hello@nile.example' } } }, versions: true, can: { partner: () => ({ delete: false }) } });
    const form = createForm({ page: customer, dataSource: ds, recordId: 1 });
    await form.load();
    expect(form.getState().status).toBe('ready');
    expect(form.getState().values['name']).toBe('Nile Traders');
    expect(Object.keys(form.getState().values)).not.toContain('$loaded');
    expect(Object.keys(form.getState().values)).not.toContain('version');
  });
});

describe('createMemoryDataSource — versions, and a save over someone else’s', () => {
  it('gives bare values and no version when it keeps none, as before', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() } });
    expect(await ds.load({ model: 'lead', id: 1, fields })).toEqual(leads()[1]);
    const saved = await ds.save(saving(1, { stage: 'won' }));
    expect(saved.version).toBeUndefined();
  });

  it('gives a version with each load, and a new one with each save, named for who saves', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() }, versions: { by: 'Sara' } });
    const opened = loadedRecordOf(await ds.load({ model: 'lead', id: 1, fields }));
    expect(opened.values['name']).toBe('Villa in Sheikh Zayed');
    expect(opened.version?.token).toEqual(expect.any(String));
    const saved = await ds.save(saving(1, { stage: 'visit' }, { version: opened.version }));
    expect(saved.version).toEqual({ token: expect.any(String), by: 'Sara', at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) });
    expect(saved.version?.token).not.toBe(opened.version?.token);
    // The next save carries the new one, and goes through.
    await expect(ds.save(saving(1, { stage: 'offer' }, { version: saved.version }))).resolves.toMatchObject({ id: 1 });
  });

  it('refuses a save opened before someone else’s, naming them, when and what they left', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() }, versions: true });
    const opened = loadedRecordOf(await ds.load({ model: 'lead', id: 1, fields }));
    const theirs = ds.changeElsewhere('lead', 1, { stage: 'lost' }, { by: 'Mona', at: '2026-10-13T10:42:00Z' });
    const refused = await ds.save(saving(1, { name: 'Villa, Zayed' }, { version: opened.version })).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ConflictError);
    const problem = saveProblemOf(refused);
    expect(problem.kind).toBe('conflict');
    expect(problem.conflict?.version).toEqual({ token: theirs.token, by: 'Mona', at: '2026-10-13T10:42:00Z' });
    expect(problem.conflict?.theirs).toMatchObject({ name: 'Villa in Sheikh Zayed', stage: 'lost' });
    // Nothing of the refused save was kept.
    expect(ds.records['lead'][1]['name']).toBe('Villa in Sheikh Zayed');
  });

  it('keeps mine: saving again with the version the record has now', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() }, versions: true });
    const opened = loadedRecordOf(await ds.load({ model: 'lead', id: 1, fields }));
    ds.changeElsewhere('lead', 1, { stage: 'lost' }, { by: 'Mona' });
    const problem = saveProblemOf(await ds.save(saving(1, { name: 'Villa, Zayed' }, { version: opened.version })).catch((error: unknown) => error));
    await ds.save(saving(1, { name: 'Villa, Zayed' }, { version: problem.conflict?.version }));
    // Mine over theirs: my change, and theirs where I changed nothing.
    expect(ds.records['lead'][1]).toMatchObject({ name: 'Villa, Zayed', stage: 'lost' });
  });

  it('does not check a save that says no version, nor a new record', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() }, versions: true });
    ds.changeElsewhere('lead', 1, { stage: 'lost' }, { by: 'Mona' });
    await expect(ds.save(saving(1, { stage: 'won' }))).resolves.toMatchObject({ id: 1 });
    await expect(ds.save(saving(null, { name: 'New lead' }))).resolves.toMatchObject({ id: 5, version: { token: expect.any(String) } });
  });
});

describe('createMemoryDataSource — what the person may do with a record', () => {
  const guarded = () =>
    createMemoryDataSource({
      records: { lead: leads() },
      versions: true,
      // Agents change only their own leads; nobody deletes a won one; the owner's phone is the manager's to change.
      can: {
        lead: (values, id) => {
          const own = (values['agent'] as { id: number } | null)?.id === 7;
          return {
            ...(own ? {} : { edit: false, archive: false, reason: 'Only the lead’s agent can change it.' }),
            ...(values['stage'] === 'won' ? { delete: false } : {}),
            ...(id === 4 ? { duplicate: false, hiddenFields: ['commission'] } : {}),
            readonlyFields: ['owner_phone'],
          };
        },
      },
    });

  it('tells it with the load, and leaves hidden fields’ values out', async () => {
    const ds = guarded();
    const mine = loadedRecordOf(await ds.load({ model: 'lead', id: 4, fields }));
    expect(mine.can).toEqual({ duplicate: false, hiddenFields: ['commission'], readonlyFields: ['owner_phone'] });
    expect(mine.values).not.toHaveProperty('commission');
    const theirs = loadedRecordOf(await ds.load({ model: 'lead', id: 2, fields }));
    expect(theirs.can).toMatchObject({ edit: false, archive: false, delete: false, reason: 'Only the lead’s agent can change it.' });
  });

  it('tells it, and the version, with each row of a list', async () => {
    const listed = await guarded().list({ model: 'lead', fields: ['name', 'commission'], filter: [], sort: [], offset: 0, limit: 10 });
    expect(listed.records[1]).toMatchObject({ id: 2, can: { edit: false }, version: { token: expect.any(String) } });
    expect(listed.records[3].values).toEqual({ name: 'Office in New Cairo' });
  });

  it('refuses what it does not allow, as a backend would, and says why', async () => {
    const ds = guarded();
    expect(saveProblemOf(await ds.save(saving(2, { stage: 'lost' })).catch((e: unknown) => e))).toEqual({ kind: 'rule', message: 'Only the lead’s agent can change it.' });
    expect(saveProblemOf(await ds.save(saving(1, { owner_phone: '+201000000000' })).catch((e: unknown) => e))).toMatchObject({
      kind: 'fields',
      fields: { owner_phone: 'You may not change this field' },
    });
    await expect(ds.delete({ model: 'lead', id: 2, fields })).rejects.toThrow('Only the lead’s agent can change it.');
    await expect(ds.archive({ model: 'lead', id: 2, fields, archive: true })).rejects.toThrow('Only the lead’s agent can change it.');
    await expect(ds.copy({ model: 'lead', id: 4, fields })).rejects.toThrow('You may not duplicate this record');
    // What it allows goes through.
    await expect(ds.save(saving(1, { stage: 'visit' }))).resolves.toMatchObject({ id: 1, can: { readonlyFields: ['owner_phone'] } });
    // What a save gives back leaves hidden fields out, as a load does.
    expect((await ds.save(saving(4, { stage: 'visit' }))).values).not.toHaveProperty('commission');
    await expect(ds.delete({ model: 'lead', id: 3, fields })).resolves.toBeUndefined();
  });
});

describe('createMemoryDataSource — every id a search matches', () => {
  it('gives them all, in the list’s order, beside one page, when asked', async () => {
    const ds = createMemoryDataSource({ records: { lead: leads() } });
    const asked = { model: 'lead', fields: ['name'], filter: [{ field: 'stage', op: '=' as const, value: 'new' }], sort: [{ field: 'budget', desc: true }], offset: 0, limit: 1 };
    const result = await ds.list({ ...asked, allIds: true });
    expect(result.records.map((r) => r.id)).toEqual([4]);
    expect(result).toMatchObject({ total: 3, allIds: [4, 1, 3] });
    expect(await ds.list(asked)).not.toHaveProperty('allIds');
  });
});

describe('createMemoryDataSource — totals', () => {
  const ds = () => createMemoryDataSource({ records: { lead: leads() } });

  it('totals each field over every record the search finds: sums, averages, least, most and a count', async () => {
    const result = await ds().totals({ model: 'lead', filter: [], totals: { budget: ['sum', 'avg', 'min', 'max', 'count'], commission: ['max'] } });
    expect(result).toEqual({
      count: 4,
      totals: { budget: { sum: 15500000, avg: 15500000 / 3, min: 2500000, max: 9000000, count: 3 }, commission: { max: 0.03 } },
    });
  });

  it('totals under each value of a field, grouped as groups are, nothing last', async () => {
    const result = await ds().totals({ model: 'lead', filter: [], totals: { budget: ['sum'] }, groupBy: 'agent' });
    expect(result.groups).toEqual([
      { value: 7, label: 'Mona', count: 2, totals: { budget: { sum: 13000000 } } },
      { value: 8, label: 'Omar', count: 1, totals: { budget: { sum: 2500000 } } },
      { value: null, label: '', count: 1, totals: { budget: { sum: 0 } } },
    ]);
  });

  it('totals the ticked rows alone by their ids, and nothing as 0 and null', async () => {
    const ticked = await ds().totals({ model: 'lead', filter: [{ field: 'id', op: 'in', value: [1, 2] }], totals: { budget: ['sum'] } });
    expect(ticked.totals).toEqual({ budget: { sum: 6500000 } });
    const none = await ds().totals({ model: 'lead', filter: [{ field: 'stage', op: '=', value: 'gone' }], totals: { budget: ['sum', 'avg', 'count'] } });
    expect(none).toEqual({ count: 0, totals: { budget: { sum: 0, avg: null, count: 0 } } });
  });
});

describe('createMemoryDataSource — a file stored as it is picked', () => {
  const photo = () => new File([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], 'front.png', { type: 'image/png' });

  it('stores it and gives its link, name, size, kind and id: a file value the field keeps as it is', async () => {
    const ds = createMemoryDataSource();
    const stored: FileValue = await ds.upload(photo(), { model: 'listing', field: 'photos', recordId: null });
    expect(stored).toEqual({ fileId: 1, url: 'data:image/png;base64,iVBORwECAw==', name: 'front.png', size: 7, type: 'image/png' });
    expect(ds.calls[0]).toMatchObject({ method: 'upload', request: { model: 'listing', field: 'photos', recordId: null } });
  });

  it('tells its progress, in four steps when slowed for a demo', async () => {
    const seen: [number, number][] = [];
    await createMemoryDataSource({ delayMs: 4 }).upload(photo(), { model: 'listing', field: 'photos', recordId: 3, onProgress: (sent, total) => seen.push([sent, total]) });
    expect(seen).toEqual([[2, 7], [4, 7], [5, 7], [7, 7]]);
  });

  it('stops when told to, with an AbortError', async () => {
    const stop = new AbortController();
    const upload = createMemoryDataSource({ delayMs: 4 }).upload(photo(), {
      model: 'listing',
      field: 'photos',
      recordId: 3,
      signal: stop.signal,
      onProgress: () => stop.abort(),
    });
    await expect(upload).rejects.toMatchObject({ name: 'AbortError' });
  });
});
