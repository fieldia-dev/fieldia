import type { Page } from '../format/page';
import { loadedRecord, loadedRecordOf, type DataSource, type SaveRequest } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { valuesFromSource } from './from-source';

/**
 * One load boundary (audit R-H3, R-H4, R-M4): every record's values come in through the form's `load` — read as its
 * fields hold them, anything but one record refused, a failure said in words with its own Retry, a save of a record that
 * never loaded refused, typing during a load kept, a value the source holds that the page cannot read named and never
 * sent back over it, and one value out of the page's limits never stopping a save that does not touch it. The proofs
 * are the audit's (B/ds.cjs, ds2, ds3, ds4, view1, view4, view5; A/places-proof.ts).
 */

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const page: Page = {
  fieldia: '0.13',
  id: 'c',
  title: 'C',
  data: { kind: 'record', model: 'm' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    amount: { type: 'monetary', label: 'Amount', currency: 'EGP' },
    qty: { type: 'integer', label: 'Qty' },
    state: { type: 'selection', label: 'State', options: [{ value: 'a', label: 'A' }] },
    when: { type: 'date', label: 'When' },
    partner: { type: 'many2one', label: 'Partner', relation: 'res.partner' },
    tags: { type: 'many2many', label: 'Tags', relation: 'tag' },
    notes: { type: 'text', label: 'Notes' },
  },
  layout: { type: 'sheet', id: 'main', children: ['name', 'amount', 'qty', 'state', 'when', 'partner', 'tags', 'notes'].map((field) => ({ type: 'field', id: field, field })) },
} as Page;

/** A source holding record 7, its load answering as told, its saves kept. */
function source(load: () => Promise<unknown>) {
  const saves: SaveRequest[] = [];
  const ds: DataSource = { load: load as DataSource['load'], save: async (request) => (saves.push(JSON.parse(JSON.stringify(request))), { id: 7 }) };
  return { ds, saves };
}

describe('a load that fails, or answers no record', () => {
  it('B/ds3, ds4: a failed load says why, in words, with a Retry of its own; a save of the record never loaded sends nothing', async () => {
    let fail = true;
    const { ds, saves } = source(async () => {
      if (fail) throw new Error('Gateway Timeout');
      return { name: 'Nile Traders', amount: 52000, notes: 'Pays in 30 days' };
    });
    const form = createForm({ page, dataSource: ds, recordId: 7 });
    await form.load();
    expect(form.getState()).toMatchObject({ status: 'error', loaded: false, loadProblem: { kind: 'other', message: 'This record could not be loaded: Gateway Timeout' } });
    // Typed anyway (an app's own box, a test): kept, and never saved over a record nobody saw.
    form.setValue('name', 'Typed');
    expect(await form.save()).toBe(false);
    expect(saves).toEqual([]);
    expect(form.getState().saveProblem).toEqual({ kind: 'other', message: 'This record has not loaded yet, so nothing was saved.' });
    // Retry: its own, the record's load asked again — the typing laid over it as a change.
    fail = false;
    await form.load();
    expect(form.getState()).toMatchObject({ status: 'ready', loaded: true, loadProblem: null, saveProblem: null, dirty: ['name'] });
    expect(form.getState().values).toMatchObject({ name: 'Typed', amount: 52000, notes: 'Pays in 30 days' });
    expect(await form.save()).toBe(true);
    expect(saves[0].values).toMatchObject({ name: 'Typed', amount: 52000, notes: 'Pays in 30 days' });
  });

  it('B/ds2: an Odoo read() list or a REST envelope is refused as a load, never read as a record of empty fields', async () => {
    for (const [answer, words] of [
      [[{ id: 7, name: 'Stored' }], "This record could not be loaded: the data source's load answered a list, not one record's values"],
      [{ data: { name: 'Stored', amount: 10 } }, "This record could not be loaded: the data source's load answered { data: … } round the record: answer its values themselves"],
      [null, "This record could not be loaded: the data source's load answered null, not one record's values"],
    ] as const) {
      const { ds, saves } = source(async () => answer);
      const form = createForm({ page, dataSource: ds, recordId: 7 });
      await form.load();
      expect(form.getState()).toMatchObject({ status: 'error', loaded: false, loadProblem: { message: words } });
      form.setValue('name', 'Typed');
      expect(await form.save()).toBe(false);
      expect(saves).toEqual([]);
    }
  });

  it('loadedRecordOf refuses anything but one record', () => {
    expect(() => loadedRecordOf([{ name: 'x' }] as never)).toThrow("answered a list, not one record's values");
    expect(() => loadedRecordOf(null as never)).toThrow("answered null, not one record's values");
    expect(() => loadedRecordOf('x' as never)).toThrow("answered x, not one record's values");
    expect(() => loadedRecordOf(loadedRecord(null as never))).toThrow("answered null, not one record's values");
    expect(loadedRecordOf({ name: 'x' })).toEqual({ $loaded: true, values: { name: 'x' } });
  });

  it('a record an app hands the form with its values, never asked to load, saves as ever', async () => {
    const { ds, saves } = source(async () => ({}));
    const form = createForm({ page, dataSource: ds, recordId: 7, values: { name: 'Given' } });
    form.setValue('notes', 'x');
    expect(await form.save()).toBe(true);
    expect(saves).toHaveLength(1);
  });
});

describe('typing while a record loads (B/view1, ds2)', () => {
  it('is kept and laid over the record as it lands, as the person’s changes', async () => {
    let land: (values: never) => void = () => undefined;
    const form = createForm({ page, dataSource: { load: () => new Promise((resolve) => (land = resolve)) } as DataSource, recordId: 1 });
    const loading = form.load();
    form.setValue('qty', 5);
    form.setValue('name', 'Typed while loading');
    land({ name: 'Stored', amount: 10, qty: 1 } as never);
    await loading;
    expect(form.getState().values).toMatchObject({ name: 'Typed while loading', amount: 10, qty: 5 });
    expect([...form.getState().dirty].sort()).toEqual(['name', 'qty']);
  });

  it('a write by the app is not the person’s typing: the record as it lands', async () => {
    let land: (values: never) => void = () => undefined;
    const form = createForm({ page, dataSource: { load: () => new Promise((resolve) => (land = resolve)) } as DataSource, recordId: 1 });
    const loading = form.load();
    form.setValues({ notes: 'from the app' });
    land({ name: 'Stored', notes: 'stored' } as never);
    await loading;
    expect(form.getState()).toMatchObject({ values: { name: 'Stored', notes: 'stored' }, dirty: [] });
  });
});

describe('values as a backend sends them (B/ds, view4, view5)', () => {
  it('valuesFromSource reads numbers sent as text, Odoo’s false and link shapes, and names what it cannot read', () => {
    expect(
      valuesFromSource(page.fields, {
        amount: '1200.50',
        qty: '7',
        when: false,
        partner: [7, 'Nile Traders'],
        tags: [{ id: 1, display_name: 'VIP' }, [2, 'New']],
        notes: 42,
        write_date: '2026-01-01',
      })
    ).toEqual({
      values: { amount: 1200.5, qty: 7, when: null, partner: { id: 7, label: 'Nile Traders' }, tags: [{ id: 1, display_name: 'VIP', label: 'VIP' }, { id: 2, label: 'New' }], notes: '42', write_date: '2026-01-01' },
      unreadable: {},
    });
    expect(valuesFromSource(page.fields, { tags: 'vip,new', amount: '1,200.50', when: '31/12/2026', partner: 'Nile Traders' }).unreadable).toEqual({
      tags: '"vip,new" does not read as a many2many',
      amount: '"1,200.50" does not read as a monetary',
      when: '"31/12/2026" does not read as a date',
      partner: '"Nile Traders" does not read as a many2one',
    });
  });

  it('a value it cannot read is said under its field, shown empty, and never sent back over what the source holds; the rest saves', async () => {
    const { ds, saves } = source(async () => ({ name: 'Kept', tags: 'vip,new', amount: '1200.50' }));
    const form = createForm({ page, dataSource: ds, recordId: 7 });
    await form.load();
    const state = form.getState();
    expect(state.unreadable).toEqual({ tags: '"vip,new" does not read as a many2many' });
    expect(state.values['tags']).toEqual([]);
    expect(state.values['amount']).toBe(1200.5);
    expect(state.warnings['tags']).toBe('Tags is stored in a way this page cannot show: it is kept as it is');
    expect(form.problem('amount')).toBeNull();
    form.setValue('name', 'Edited');
    expect(await form.save()).toBe(true);
    expect(saves[0].values).not.toHaveProperty('tags');
    expect(saves[0].changes.values).toEqual({ name: 'Edited' });
    // Written by the person, it is theirs to send.
    form.setValue('tags', [{ id: 3, label: 'Hot' }]);
    expect(await form.save()).toBe(true);
    expect(saves[1].values['tags']).toEqual([{ id: 3, label: 'Hot' }]);
  });

  it('A/places-proof, B/ds: a value the source holds past the field’s limits — places, digits, an option since retired — warns and never stops a save that does not touch it', async () => {
    const places = { ...page, fields: { ...page.fields, rate: { type: 'float', label: 'Rate', digits: [16, 2] }, big: { type: 'float', label: 'Big' } }, layout: { ...page.layout, children: [...(page.layout as { children: object[] }).children, { type: 'field', id: 'rate', field: 'rate' }, { type: 'field', id: 'big', field: 'big' }] } } as Page;
    const saves: SaveRequest[] = [];
    const form = createForm({ page: places, dataSource: { load: async () => ({ name: 'x', rate: 1.005, big: 1.2e16, state: 'zzz' }), save: async (request: SaveRequest) => (saves.push(request), { id: 1 }) } as DataSource, recordId: 1 });
    await form.load();
    expect(form.getState().warnings).toEqual({ rate: 'Rate takes at most 2 decimal places', big: 'Big takes at most 15 digits', state: 'Must be one of: A' });
    form.setValue('name', 'renamed');
    expect(await form.save()).toBe(true);
    expect(saves).toHaveLength(1);
    // Changed by the person: judged as any change is.
    form.setValue('rate', 1.005);
    form.setValue('rate', 2.005);
    expect(await form.save()).toBe(false);
    expect(form.getState().errors).toEqual({ rate: 'Rate takes at most 2 decimal places' });
    // Required still asks: an empty field is no value kept.
    const empty = createForm({ page, dataSource: { load: async () => ({ name: '' }), save: async () => ({ id: 1 }) } as DataSource, recordId: 1 });
    await empty.load();
    empty.setValue('notes', 'x');
    expect(await empty.save()).toBe(false);
    expect(empty.getState().errors).toEqual({ name: 'Name is required' });
  });

  it('a malformed value an app writes is refused under its field alone: every other condition and field reads on', async () => {
    const memory = createMemoryDataSource({ records: { m: { 1: { name: 'Kept' } } } });
    const withRule = { ...page, layout: { type: 'sheet', id: 'main', children: [{ type: 'field', id: 'name', field: 'name' }, { type: 'field', id: 'tags', field: 'tags' }, { type: 'field', id: 'notes', field: 'notes', invisible: 'not tags' }] } } as Page;
    const form = createForm({ page: withRule, dataSource: memory, recordId: 1 });
    await form.load();
    form.setValue('tags', 'vip,new' as never);
    expect(form.node('notes').invisible).toBe(true);
    expect(await form.save()).toBe(false);
    expect(form.getState().errors).toEqual({ tags: 'Tags must be a list of records' });
  });
});

describe('save() never throws', () => {
  it('a save that breaks on its way — a box’s reading — is said, nothing sent', async () => {
    const memory = createMemoryDataSource();
    const form = createForm({ page: { ...page, data: { kind: 'responses' } } as Page, dataSource: memory });
    form.setValue('name', 'Mona');
    form.settling(() => {
      throw new Error('the box broke');
    });
    await expect(form.save()).resolves.toBe(false);
    expect(form.getState().saveProblem).toEqual({ kind: 'other', message: 'Something went wrong, so nothing was sent: the box broke' });
    expect(memory.responses).toEqual([]);
    await tick();
  });
});
