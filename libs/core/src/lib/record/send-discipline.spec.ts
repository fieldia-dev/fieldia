import type { Page } from '../format/page';
import type { DataSource, SaveRequest, SubmitRequest } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { memoryOutbox } from './outbox-form';

/**
 * One send discipline (audit R-H6, R-M2, R-M3, S-M6): every save and send carries one idempotency key from its first
 * try — a retry and an outbox's copy the same — so a server keeps it once; `save()` asked again with nothing changed is
 * the same save; a page of responses never sends the same answers twice; the outbox's kept saves go before a live save
 * of the same record, each at its version now, a new record's as the same save; a claim is held while its send goes;
 * and an outbox the browser cannot keep says so. The proofs are the audit's (A/form-proof.ts P1, A/submit-proof.ts,
 * A/outbox-proof.ts, B/ds.cjs; security trust/outbox-proof).
 */

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const record: Page = {
  fieldia: '0.11',
  id: 'p',
  title: 'P',
  data: { kind: 'record', model: 'm' },
  fields: { name: { type: 'char', label: 'Name' }, price: { type: 'float', label: 'Price' } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f1', field: 'name' }, { type: 'field', id: 'f2', field: 'price' }] },
} as Page;

const responses: Page = { ...record, id: 'fb', data: { kind: 'responses' } } as Page;

const visit = (kind: 'record' | 'responses' = 'record'): Page =>
  ({
    fieldia: '0.11',
    id: 'site-visit',
    data: kind === 'record' ? { kind: 'record', model: 'visit' } : { kind: 'responses' },
    outbox: true,
    fields: { unit: { type: 'char', label: 'Unit', required: true }, notes: { type: 'text', label: 'Notes' }, price: { type: 'float', label: 'Price' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-unit', field: 'unit' }, { type: 'field', id: 'f-notes', field: 'notes' }, { type: 'field', id: 'f-price', field: 'price' }] },
  }) as Page;

describe('one key from the first try', () => {
  it('A/form-proof P1: a save whose answer was lost, saved again, makes one record — the same key both times', async () => {
    const memory = createMemoryDataSource();
    let lose = true;
    const ds: DataSource = {
      ...memory,
      save: async (request) => {
        const saved = await memory.save(request);
        if (lose) {
          lose = false;
          throw new TypeError('Failed to fetch');
        }
        return saved;
      },
    };
    const form = createForm({ page: record, dataSource: ds });
    form.setValue('name', 'Acme');
    form.setValue('price', 5);
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem?.kind).toBe('network');
    expect(await form.save()).toBe(true);
    expect(Object.keys(memory.records['m'])).toHaveLength(1);
    const [first, second] = memory.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);
    expect(first.key).toMatch(/^send-/);
    expect(second.key).toBe(first.key);
    // The next save is another: a key of its own.
    form.setValue('price', 6);
    expect(await form.save()).toBe(true);
    expect((memory.calls.filter((call) => call.method === 'save').pop()?.request as SaveRequest).key).not.toBe(first.key);
  });

  it('B/ds: a new record its source answers without an id is said, and saved again as the same save — never a second record', async () => {
    for (const answer of [undefined, { id: undefined }] as unknown[]) {
      const memory = createMemoryDataSource();
      let first = true;
      const ds: DataSource = {
        save: async (request) => {
          const saved = await memory.save(request);
          if (!first) return saved;
          first = false;
          return answer as Awaited<ReturnType<NonNullable<DataSource['save']>>>;
        },
      };
      const form = createForm({ page: record, dataSource: ds });
      form.setValue('name', 'X');
      expect(await form.save()).toBe(false);
      expect(form.getState().saveProblem).toEqual({ kind: 'other', message: 'The record went, but its data source gave back no id: save again — it is the same save, never a second record.' });
      form.setValue('name', 'Y');
      expect(await form.save()).toBe(true);
      expect(Object.values(memory.records['m'])).toEqual([expect.objectContaining({ name: 'Y' })]);
    }
  });
});

describe('save() asked twice', () => {
  it('A/submit-proof: two saves at once on a page of responses send once; a third with the same answers sends nothing', async () => {
    let n = 0;
    const ds: DataSource = {
      async submit() {
        n++;
        await tick(20);
        return { id: n };
      },
    };
    const form = createForm({ page: responses, dataSource: ds });
    form.setValue('name', 'Mona');
    expect(await Promise.all([form.save(), form.save()])).toEqual([true, true]);
    expect(n).toBe(1);
    expect(await form.save()).toBe(false);
    expect(n).toBe(1);
    expect(form.getState().status).toBe('saved');
  });

  it('answers changed after they went go again as the same response, by its key; started again, a new one', async () => {
    const memory = createMemoryDataSource();
    const form = createForm({ page: responses, dataSource: memory });
    form.setValue('name', 'Mona');
    await form.save();
    form.setValue('name', 'Mona Adel');
    expect(await form.save()).toBe(true);
    expect(memory.responses).toHaveLength(1);
    expect(memory.responses[0].values['name']).toBe('Mona Adel');
    form.reset();
    form.setValue('name', 'Karim');
    await form.save();
    expect(memory.responses).toHaveLength(2);
    expect(memory.responses[1].key).not.toBe(memory.responses[0].key);
  });

  it('a new record saved twice at once is saved once', async () => {
    let m = 0;
    const ds: DataSource = {
      async load() {
        return {};
      },
      async save() {
        m++;
        await tick(20);
        return { id: 50 + m };
      },
    };
    const form = createForm({ page: record, dataSource: ds });
    form.setValue('name', 'A');
    await Promise.all([form.save(), form.save()]);
    expect(m).toBe(1);
    expect(form.getState().recordId).toBe(51);
  });
});

describe('the outbox drains before a live save of the same record (A/outbox-proof)', () => {
  it('A: a new record kept offline, then saved again once the signal is back, is one record — with what was typed since', async () => {
    let off = false;
    const ds = createMemoryDataSource({ offline: () => off });
    const store = memoryOutbox();
    const form = createForm({ page: visit(), dataSource: ds, outbox: store });
    off = true;
    form.setValues({ unit: 'C-3' });
    expect(await form.save()).toBe(true);
    off = false;
    form.setValues({ notes: 'typed after signal came back' });
    expect(await form.save()).toBe(true);
    await tick(20);
    await form.joined('outbox')?.send();
    expect(Object.values(ds.records['visit'])).toEqual([expect.objectContaining({ unit: 'C-3', notes: 'typed after signal came back' })]);
    expect(form.getState().recordId).toBe(Number(Object.keys(ds.records['visit'])[0]));
    expect(store.items).toEqual([]);
  });

  it('B and C: a stored record’s kept save goes before the newer live one — with versions too, never refused by its own', async () => {
    for (const versions of [false, true]) {
      let off = false;
      const ds = createMemoryDataSource({ offline: () => off, versions, records: { visit: { 5: { unit: 'A', notes: '', price: 10 } } } });
      const store = memoryOutbox();
      const form = createForm({ page: visit(), dataSource: ds, outbox: store, recordId: 5 });
      await form.load();
      off = true;
      form.setValue('price', 20);
      await form.save();
      off = false;
      form.setValue('price', 30);
      expect(await form.save()).toBe(true);
      await tick(20);
      await form.joined('outbox')?.send();
      expect(ds.records['visit']['5']['price']).toBe(30);
      expect(form.getState()).toMatchObject({ values: { price: 30 }, conflict: null, saveProblem: null });
      expect(store.items).toEqual([]);
    }
  });

  it('still without signal, a live save of a record with kept saves waits behind them', async () => {
    let off = false;
    const ds = createMemoryDataSource({ offline: () => off, records: { visit: { 5: { unit: 'A', notes: '', price: 10 } } } });
    const store = memoryOutbox();
    const form = createForm({ page: visit(), dataSource: ds, outbox: store, recordId: 5 });
    await form.load();
    off = true;
    form.setValue('price', 20);
    await form.save();
    form.setValue('price', 30);
    await form.save();
    expect(store.items.map((item) => (item.request as SaveRequest).changes.values)).toEqual([{ price: 20 }, { price: 30 }]);
    off = false;
    await form.joined('outbox')?.send();
    expect(ds.records['visit']['5']['price']).toBe(30);
  });

  it('S-M6: a send whose answer was lost is kept and sent later by the key of its first try: one row', async () => {
    const memory = createMemoryDataSource();
    let lose = true;
    const ds: DataSource = {
      ...memory,
      submit: async (request) => {
        const kept = await memory.submit(request);
        if (lose) {
          lose = false;
          throw new TypeError('Failed to fetch');
        }
        return kept;
      },
    };
    const store = memoryOutbox();
    const form = createForm({ page: visit('responses'), dataSource: ds, outbox: store });
    form.setValues({ unit: 'C-3', notes: 'one visit' });
    await form.save();
    await form.joined('outbox')?.send();
    expect(memory.responses).toHaveLength(1);
    const sends = memory.calls.filter((call) => call.method === 'submit').map((call) => call.request as SubmitRequest);
    expect(sends.map((one) => one.key)).toEqual([sends[0].key, sends[0].key]);
    expect(sends[1].queued?.key).toBe(sends[0].key);
  });
});

describe('a claim held while its send goes', () => {
  afterEach(() => jest.useRealTimers());

  it('is renewed each third of its time: a second tab never takes a send that takes longer than the claim', async () => {
    jest.useFakeTimers();
    let release: () => void = () => undefined;
    let sent = 0;
    const slow: DataSource = {
      submit: () =>
        new Promise((resolve) => {
          sent++;
          release = () => resolve({ id: sent });
        }),
    };
    const store = memoryOutbox();
    const first = createForm({ page: visit('responses'), dataSource: { submit: () => Promise.reject(new TypeError('Failed to fetch')) }, outbox: store });
    first.setValues({ unit: 'B-12' });
    await first.save();
    expect(store.items).toHaveLength(1);
    const tabOne = createForm({ page: visit('responses'), dataSource: slow, outbox: store });
    const going = tabOne.joined('outbox')?.send();
    await jest.advanceTimersByTimeAsync(0);
    expect(sent).toBe(1);
    // Past the claim's first two minutes, still sending (a film on a slow signal): another tab finds it held.
    await jest.advanceTimersByTimeAsync(150_000);
    const tabTwo = createForm({ page: visit('responses'), dataSource: slow, outbox: store });
    await tabTwo.joined('outbox')?.send();
    expect(sent).toBe(1);
    release();
    await going;
    expect(store.items).toEqual([]);
  });
});

describe('an outbox the browser cannot keep', () => {
  it('says so: what waits does not outlive the page', async () => {
    const form = createForm({ page: visit('responses'), dataSource: { submit: () => Promise.reject(new TypeError('Failed to fetch')) } });
    form.setValues({ unit: 'B-12' });
    await form.save();
    await tick();
    expect(form.getState().outbox).toMatchObject({ waiting: 1, kept: true, lasting: false });
  });
});
