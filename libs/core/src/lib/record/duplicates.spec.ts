import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { saveProblemOf, type DataSource } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { alikeRecords } from './memory-duplicates';

/**
 * Possible duplicates (`duplicates` on a record's page) and Merge: the page setting and its checks, the data
 * source's `duplicates` and `merge` (docs/plans/wave1-contract.md's style: each optional), the form's calls to them,
 * and the memory source's answers — the same phone, email or id as people write them apart, a name close enough.
 */

const page = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.8',
    id: 'customer-card',
    data: { kind: 'record', model: 'partner' },
    fields: {
      name: { type: 'char', label: 'Name' },
      phone: { type: 'char', label: 'Phone' },
      email: { type: 'char', label: 'Email' },
      vat: { type: 'char', label: 'Tax ID' },
      country_id: { type: 'many2one', label: 'Country', relation: 'country' },
      notes: { type: 'html', label: 'Notes' },
      contacts: { type: 'one2many', label: 'Contacts', relation: 'contact', fields: { name: { type: 'char', label: 'Name' } } },
    },
    layout: {
      type: 'sections',
      id: 's',
      children: [{ type: 'section', id: 'g', children: ['name', 'phone', 'email', 'vat', 'country_id'].map((field) => ({ type: 'field', id: `f-${field}`, field })) }],
    },
    duplicates: { fields: ['name', 'phone', 'email', 'vat'] },
    ...more,
  }) as Page;

const partners = () => ({
  1: { name: 'Nile Traders', phone: '+20 2 2345 6789', email: 'orders@niletraders.example', vat: '123-456-789', country_id: { id: 1, label: 'Egypt' } },
  2: { name: 'Delta Foods', phone: '+20403334400', email: 'Orders@DeltaFoods.example', vat: null, country_id: { id: 1, label: 'Egypt' } },
  3: { name: 'Nile Traders Co.', phone: null, email: 'orders@niletraders.example', vat: '123456789', country_id: null },
  4: { name: 'Mona Adel', phone: '+201001234567', email: null, vat: null, country_id: { id: 2, label: 'Jordan' } },
});

const source = (more: Parameters<typeof createMemoryDataSource>[0] = {}) =>
  createMemoryDataSource({
    duplicates: alikeRecords(),
    records: {
      partner: partners(),
      country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' } },
      'sale.order': { 7: { name: 'S00007', partner_id: { id: 3, label: 'Nile Traders Co.' }, watchers: [{ id: 1, label: 'Nile Traders' }, { id: 3, label: 'Nile Traders Co.' }] } },
      // A record of another model with the same id as a merged one: its link is its own.
      'res.users': { 3: { name: 'Omar', partner_id: { id: 3, label: 'Omar Nabil' } } },
    },
    ...more,
  });

const asked = (values: Record<string, unknown>, fields: string[], recordId: number | null = null) => ({ model: 'partner', recordId, values, fields }) as Parameters<NonNullable<DataSource['duplicates']>>[0];

describe('the page setting: duplicates', () => {
  it('is read by both checks, on a record’s page, by fields of a kind records are compared by', () => {
    expect(validatePage(page()).ok).toBe(true);
    expect(checkPage(page()).ok).toBe(true);
    expect(validatePage(page({ duplicates: { fields: ['phone'], on: 'save' } })).ok).toBe(true);
  });

  it('refuses a field the page has not, one named twice, and one no record is compared by, saying why', () => {
    for (const check of [validatePage, checkPage]) {
      const found = check(page({ duplicates: { fields: ['phone', 'mobile', 'phone', 'contacts', 'notes'] } }));
      expect(found.ok).toBe(false);
      const issues = found.ok ? [] : found.issues;
      expect(issues).toEqual([
        { path: 'duplicates.fields[1]', message: 'no field "mobile"' },
        { path: 'duplicates.fields[2]', message: '"phone" is named twice' },
        { path: 'duplicates.fields[3]', message: '"contacts" is a one2many; records are compared by words, a number, a date, a choice or a link' },
        { path: 'duplicates.fields[4]', message: '"notes" is a html; records are compared by words, a number, a date, a choice or a link' },
      ]);
    }
  });

  it('is a record page’s, never a page of responses’ or a list’s', () => {
    const responses = checkPage(page({ data: { kind: 'responses' } }));
    expect(responses.ok ? [] : responses.issues.map((issue) => issue.path)).toEqual(['duplicates']);
    const list = checkPage(page({ layout: { type: 'list', id: 'l', columns: ['name', 'phone'] } as unknown as Page['layout'] }));
    expect(list.ok ? [] : list.issues.map((issue) => issue.message)).toEqual(['duplicates are asked as a record is typed, on its own page, not on a list of records']);
  });

  it('refuses an empty list of fields and an `on` it does not know, in words', () => {
    const empty = validatePage(page({ duplicates: { fields: [] } }));
    expect(empty.ok ? [] : empty.issues.map((issue) => issue.path)).toEqual(['duplicates.fields']);
    const quick = checkPage(page({ duplicates: { fields: [] } }));
    expect(quick.ok ? [] : quick.issues).toEqual([{ path: 'duplicates.fields', message: 'name the fields records are compared by: ["phone", "email"]' }]);
    const when = validatePage(page({ duplicates: { fields: ['phone'], on: 'open' as 'save' } }));
    expect(when.ok ? [] : when.issues).toEqual([{ path: 'duplicates.on', message: 'on is "type" (asked as the fields are typed in, and as the record is saved) or "save" (as it is saved)' }]);
  });
});

describe('the memory source’s duplicates (alikeRecords)', () => {
  it('finds none without a way to tell, as a source that keeps no such thing', async () => {
    expect(await createMemoryDataSource({ records: { partner: partners() } }).duplicates(asked({ phone: '+20223456789' }, ['phone']))).toEqual({ matches: [] });
  });

  it('finds the same phone, email and id as people write them apart', async () => {
    const ds = source();
    // Spaces in a phone, an email in capitals, an id's dashes: each the same.
    expect((await ds.duplicates(asked({ phone: '+20223456789' }, ['phone']))).matches).toEqual([{ id: 1, name: 'Nile Traders', why: ['phone'], score: 1 }]);
    expect((await ds.duplicates(asked({ email: ' orders@deltafoods.EXAMPLE ' }, ['email']))).matches).toEqual([{ id: 2, name: 'Delta Foods', why: ['email'], score: 1 }]);
    expect((await ds.duplicates(asked({ vat: '123 456 789' }, ['vat']))).matches.map((match) => match.id)).toEqual([1, 3]);
    // Alike in more fields first, the likest equal.
    const both = (await ds.duplicates(asked({ email: 'orders@niletraders.example', vat: '123456789' }, ['email', 'vat']))).matches;
    expect(both.map((match) => [match.id, match.why])).toEqual([
      [1, ['email', 'vat']],
      [3, ['email', 'vat']],
    ]);
  });

  it('finds a name close enough, never one only a little like it, and says how alike', async () => {
    const ds = source();
    const like = async (name: string) => (await ds.duplicates(asked({ name }, ['name']))).matches.map((match) => [match.name, match.score]);
    expect(await like('nile traders')).toEqual([
      ['Nile Traders', 1],
      ['Nile Traders Co.', 0.9],
    ]);
    expect((await like('Nile Trader'))[0][0]).toBe('Nile Traders');
    expect((await like('Nile Trader'))[0][1]).toBeCloseTo(0.947, 3);
    expect(await like('Mona Adly')).toEqual([]);
    expect(await like('Nile')).toEqual([]);
  });

  it('never gives the record itself, and nothing for a value no record holds or an empty one', async () => {
    const ds = source();
    expect((await ds.duplicates(asked({ email: 'orders@niletraders.example' }, ['email'], 1))).matches.map((match) => match.id)).toEqual([3]);
    expect((await ds.duplicates(asked({ phone: '+201234567890' }, ['phone']))).matches).toEqual([]);
    expect((await ds.duplicates(asked({ vat: '' }, ['vat']))).matches).toEqual([]);
  });

  it('compares a link by its record', async () => {
    const ds = source();
    const found = (await ds.duplicates(asked({ country_id: { id: 2, label: 'Jordan' } }, ['country_id']))).matches;
    expect(found.map((match) => match.name)).toEqual(['Mona Adel']);
  });
});

describe('the memory source’s merge', () => {
  it('keeps one record with the values picked, takes the others away, and moves what linked to them', async () => {
    const ds = source();
    await ds.merge({ model: 'partner', keepId: 1, mergeIds: [3], values: { phone: '+20223456789', vat: '123456789' }, fields: page().fields });
    expect(ds.records['partner'][1]).toEqual({ ...partners()[1], phone: '+20223456789', vat: '123456789' });
    expect(ds.records['partner'][3]).toBeUndefined();
    // The order's customer is the one kept; its watchers hold it once.
    expect(ds.records['sale.order'][7]).toEqual({ name: 'S00007', partner_id: { id: 1, label: 'Nile Traders' }, watchers: [{ id: 1, label: 'Nile Traders' }] });
    // Another model's record of the same id is its own.
    expect(ds.records['res.users'][3]['partner_id']).toEqual({ id: 3, label: 'Omar Nabil' });
  });

  it('refuses, changing nothing, where the person may not change the one kept or take another away', async () => {
    const ds = source({ can: { partner: (values) => (values['name'] === 'Nile Traders Co.' ? { delete: false, reason: 'Only the credit team removes a customer.' } : undefined) } });
    const refused = await ds.merge({ model: 'partner', keepId: 1, mergeIds: [3], values: { vat: 'X' }, fields: page().fields }).then(() => null, saveProblemOf);
    expect(refused).toEqual({ kind: 'rule', message: 'Only the credit team removes a customer.' });
    expect(ds.records['partner'][1]['vat']).toBe('123-456-789');
    expect(ds.records['partner'][3]).toBeDefined();
  });

  it('moves the kept record’s version on, so a page that opened it before is told', async () => {
    const ds = source({ versions: { by: 'Sara' } });
    const before = await ds.load({ model: 'partner', id: 1, fields: page().fields });
    await ds.merge({ model: 'partner', keepId: 1, mergeIds: [3], values: {}, fields: page().fields });
    const after = await ds.load({ model: 'partner', id: 1, fields: page().fields });
    expect((after as { version: { token: string } }).version.token).not.toBe((before as { version: { token: string } }).version.token);
  });
});

describe('the form: findDuplicates and merge', () => {
  it('asks only where the page names fields and its source has duplicates', () => {
    const ds = source();
    expect(createForm({ page: page(), dataSource: ds }).canFindDuplicates()).toBe(true);
    expect(createForm({ page: page({ duplicates: undefined }), dataSource: ds }).canFindDuplicates()).toBe(false);
    const { duplicates: _gone, ...without } = ds;
    expect(createForm({ page: page(), dataSource: without as DataSource }).canFindDuplicates()).toBe(false);
    expect(createForm({ page: page() }).canFindDuplicates()).toBe(false);
  });

  it('asks with the fields named that hold a value, every value, and the record; never with none', async () => {
    const ds = source();
    const form = createForm({ page: page(), dataSource: ds });
    expect(await form.findDuplicates()).toEqual([]);
    expect(ds.calls.filter((call) => call.method === 'duplicates')).toEqual([]);
    form.setValue('phone', '+20 2 2345 6789');
    form.setValue('vat', '  ');
    const found = await form.findDuplicates();
    expect(found.map((match) => match.name)).toEqual(['Nile Traders']);
    const call = ds.calls.filter((one) => one.method === 'duplicates')[0].request as { model: string; recordId: null; fields: string[]; values: Record<string, unknown> };
    expect(call.model).toBe('partner');
    expect(call.recordId).toBeNull();
    expect(call.fields).toEqual(['phone']);
    expect(call.values['phone']).toBe('+20 2 2345 6789');
  });

  it('never gives the record shown, whatever the source says, and the likest first where it scores them', async () => {
    const careless: DataSource = {
      load: async () => partners()[1],
      duplicates: async () => ({ matches: [{ id: 2, name: 'Delta Foods', why: ['email'], score: 0.5 }, { id: '1', name: 'Nile Traders', why: ['email'], score: 1 }, { id: 3, name: 'Nile Traders Co.', why: ['email'], score: 0.9 }] }),
    };
    const form = createForm({ page: page(), dataSource: careless, recordId: 1 });
    await form.load();
    expect((await form.findDuplicates()).map((match) => match.id)).toEqual([3, 2]);
  });

  it('reads another record and merges through the source, leaving the form as it is', async () => {
    const ds = source();
    const form = createForm({ page: page(), dataSource: ds, recordId: 3 });
    await form.load();
    expect(form.canMerge()).toBe(true);
    expect(await form.readRecord(1)).toEqual(partners()[1]);
    await form.merge({ keepId: 1, mergeIds: [3], values: { vat: '123456789' } });
    const call = ds.calls.find((one) => one.method === 'merge')?.request as { model: string; keepId: number; mergeIds: number[]; values: object; fields: object };
    expect(call).toEqual({ model: 'partner', keepId: 1, mergeIds: [3], values: { vat: '123456789' }, fields: page().fields });
    expect(form.getState().recordId).toBe(3);
    expect(form.getState().values['name']).toBe('Nile Traders Co.');
    const { merge: _gone, ...without } = ds;
    expect(createForm({ page: page(), dataSource: without as DataSource }).canMerge()).toBe(false);
  });
});

describe('"It’s someone new" kept on the app’s server: notDuplicates and markNotDuplicate', () => {
  it('the memory source keeps each pair once, either way round, never a record and itself, by model', async () => {
    const ds = source();
    await ds.markNotDuplicate({ model: 'partner', recordId: 3, matchId: 1 });
    await ds.markNotDuplicate({ model: 'partner', recordId: '1', matchId: '3' });
    await ds.markNotDuplicate({ model: 'partner', recordId: 3, matchId: 3 });
    await ds.markNotDuplicate({ model: 'partner', recordId: 3, matchId: 2 });
    expect(ds.notDuplicatePairs).toEqual({ partner: [[3, 1], [3, 2]] });
    expect(await ds.notDuplicates({ model: 'partner', recordId: '3' })).toEqual([1, 2]);
    // A pair either way round: Nile Traders is someone else for Nile Traders Co. as much as the other way.
    expect(await ds.notDuplicates({ model: 'partner', recordId: 1 })).toEqual([3]);
    expect(await ds.notDuplicates({ model: 'partner', recordId: 4 })).toEqual([]);
    expect(await ds.notDuplicates({ model: 'contact', recordId: 3 })).toEqual([]);
  });

  it('the memory source refuses a record it does not keep, and starts from the pairs an earlier visit kept', async () => {
    await expect(source().markNotDuplicate({ model: 'partner', recordId: 99, matchId: 1 })).rejects.toThrow('No partner record with id 99');
    const given: Record<string, [number, number][]> = { partner: [[41, 1]] };
    const ds = source({ notDuplicatePairs: given });
    expect(await ds.notDuplicates({ model: 'partner', recordId: 1 })).toEqual([41]);
    // Its own copy: what it was given is left as it was.
    await ds.markNotDuplicate({ model: 'partner', recordId: 1, matchId: 2 });
    expect(given).toEqual({ partner: [[41, 1]] });
  });

  it('the form asks them for the record shown, saved; keepsNotDuplicates only where the source has both', async () => {
    const ds = source({ notDuplicatePairs: { partner: [[3, 1]] } });
    const fresh = createForm({ page: page(), dataSource: ds });
    expect(fresh.keepsNotDuplicates()).toBe(true);
    // A new record has none, and asks nothing; it is kept apart once it is saved.
    expect(await fresh.notDuplicates()).toEqual([]);
    await expect(fresh.markNotDuplicate(1)).rejects.toThrow();
    expect(ds.calls.filter((call) => call.method === 'notDuplicates' || call.method === 'markNotDuplicate')).toEqual([]);
    const form = createForm({ page: page(), dataSource: ds, recordId: 3 });
    await form.load();
    expect(await form.notDuplicates()).toEqual([1]);
    await form.markNotDuplicate(2);
    expect(ds.calls.find((call) => call.method === 'markNotDuplicate')?.request).toEqual({ model: 'partner', recordId: 3, matchId: 2 });
    expect(await form.notDuplicates()).toEqual([1, 2]);
    const { notDuplicates: _read, ...writes } = ds;
    const { markNotDuplicate: _write, ...reads } = ds;
    expect(createForm({ page: page(), dataSource: writes as DataSource }).keepsNotDuplicates()).toBe(false);
    expect(createForm({ page: page(), dataSource: reads as DataSource }).keepsNotDuplicates()).toBe(false);
  });

  it('never gives the record shown, nor what is not an id, whatever the source says', async () => {
    const careless: DataSource = { load: async () => partners()[3], notDuplicates: async () => [1, '3', 3, null, { id: 2 }] as never, markNotDuplicate: async () => undefined };
    const form = createForm({ page: page(), dataSource: careless, recordId: 3 });
    await form.load();
    expect(await form.notDuplicates()).toEqual([1]);
  });
});
