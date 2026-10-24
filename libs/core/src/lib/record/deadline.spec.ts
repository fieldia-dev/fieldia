import type { Page } from '../format/page';
import { lazyPart, settleParts } from '../parts';
import type { DataSource, SaveRequest, UploadSignal } from './data-source';
import { createForm } from './form';
import type { Scheduler } from './scheduler';
import { tableInChunks } from './words-chunks';

/**
 * Nothing waits for ever (audit R-M1; proof A/form-proof.ts P2, B/ds.cjs): a save, a send, an onchange, a search and a
 * list's options each answer within the form's deadline (`timeout`, 30 s unless said) or end as the network's problem,
 * their `signal` aborted; a Discard wins over a save stuck on its way at once; a part or a language's chunk that stalls
 * settles as failed after `PART_WAIT_MS`.
 */

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** A scheduler the test moves by hand. */
function testClock() {
  let now = 0;
  const due: { at: number; run: () => void; id: number }[] = [];
  let next = 1;
  const scheduler = {
    setTimeout: (run: () => void, ms: number) => {
      const id = next++;
      due.push({ at: now + ms, run, id });
      return id;
    },
    clearTimeout: (id: unknown) => {
      const at = due.findIndex((one) => one.id === id);
      if (at !== -1) due.splice(at, 1);
    },
  } as unknown as Scheduler;
  return {
    scheduler,
    advance(ms: number) {
      now += ms;
      for (const one of [...due].sort((a, b) => a.at - b.at)) {
        if (one.at > now || !due.includes(one)) continue;
        due.splice(due.indexOf(one), 1);
        one.run();
      }
    },
  };
}

const page: Page = {
  fieldia: '0.11',
  id: 'p',
  title: 'P',
  data: { kind: 'record', model: 'm' },
  fields: {
    name: { type: 'char', label: 'Name' },
    price: { type: 'float', label: 'Price' },
    partner: { type: 'many2one', label: 'Partner', relation: 'res.partner' },
    kind: { type: 'selection', label: 'Kind', options: [], optionsFrom: { list: 'kinds' } },
  },
  layout: { type: 'sections', id: 's', children: ['name', 'price', 'partner', 'kind'].map((field) => ({ type: 'field', id: field, field })) },
} as Page;

describe('a request that never answers (A/form-proof P2)', () => {
  it('ends at its deadline as the network’s problem, its signal aborted; the next save goes', async () => {
    const clock = testClock();
    const signals: UploadSignal[] = [];
    const sent: SaveRequest[] = [];
    let hang = true;
    const ds: DataSource = {
      async load() {
        return { name: 'x', price: 1 };
      },
      save(request) {
        signals.push(request.signal as UploadSignal);
        sent.push(request);
        return hang ? new Promise(() => undefined) : Promise.resolve({ id: 1 });
      },
    };
    const form = createForm({ page, dataSource: ds, recordId: 1, timeout: 5000, scheduler: clock.scheduler });
    await form.load();
    form.setValue('price', 2);
    const saving = form.save();
    await tick();
    expect(form.getState().status).toBe('saving');
    clock.advance(4999);
    await tick();
    expect(form.getState().status).toBe('saving');
    clock.advance(1);
    expect(await saving).toBe(false);
    expect(form.getState().saveProblem).toEqual({ kind: 'network', message: 'The server did not answer in time' });
    expect(signals[0].aborted).toBe(true);
    // Handed to the source, never copied with what is kept or compared.
    expect(JSON.stringify(sent[0])).not.toContain('signal');
    hang = false;
    expect(await form.save()).toBe(true);
    // The same save tried again: its key.
    expect(sent[1].key).toBe(sent[0].key);
  });

  it('a Discard wins over a save stuck on its way within 5 s; another record waits only for its deadline', async () => {
    const clock = testClock();
    const ds: DataSource = {
      async load({ id }) {
        return { name: `record ${id}`, price: 1 };
      },
      save: () => new Promise(() => undefined),
    };
    const form = createForm({ page, dataSource: ds, recordId: 1, scheduler: clock.scheduler });
    await form.load();
    form.setValue('price', 2);
    void form.save();
    await tick();
    const leaving = form.leave({ discard: true }).then((left) => `left:${left}`);
    // A save answering as saves do would land meanwhile (a dialog's new record is its caller's); this one is stuck.
    expect(await Promise.race([leaving, tick(20).then(() => 'still waiting')])).toBe('still waiting');
    clock.advance(5000);
    expect(await Promise.race([leaving, tick(50).then(() => 'still waiting')])).toBe('left:true');
    await tick();
    expect(form.getState()).toMatchObject({ status: 'ready', saveProblem: null });
    // Another save stuck: openRecord waits for it — until its deadline, 30 s unless said — then asks.
    form.setValue('price', 3);
    void form.save();
    await tick();
    const opening = form.openRecord(2);
    expect(await Promise.race([opening.then(() => 'opened'), tick(20).then(() => 'waiting')])).toBe('waiting');
    clock.advance(30_000);
    // The save ended at its deadline; the way out asked on, no longer waiting behind it.
    expect(await Promise.race([opening.then(() => 'went on'), tick(50).then(() => 'still waiting')])).toBe('went on');
  });

  it('Discard (reset) while a save is stuck: the stuck save ends saying nothing', async () => {
    const clock = testClock();
    const ds: DataSource = { load: async () => ({ name: 'x', price: 1 }), save: () => new Promise(() => undefined) };
    const form = createForm({ page, dataSource: ds, recordId: 1, timeout: 1000, scheduler: clock.scheduler });
    await form.load();
    form.setValue('price', 2);
    const saving = form.save();
    await tick();
    form.reset();
    clock.advance(1000);
    expect(await saving).toBe(false);
    expect(form.getState()).toMatchObject({ saveProblem: null, values: { price: 1 } });
  });

  it('a search and a list’s options end at their deadline too; `timeout: 0` waits as long as it takes', async () => {
    const clock = testClock();
    const never = () => new Promise<never>(() => undefined);
    const ds: DataSource = { load: async () => ({}), search: never, options: never };
    const form = createForm({ page, dataSource: ds, recordId: 1, timeout: 2000, scheduler: clock.scheduler });
    await form.load();
    const search = form.search('partner', 'Nile');
    form.loadChoices('kind');
    await tick();
    expect(form.getState().choices['kind']).toMatchObject({ loading: true });
    clock.advance(2000);
    await expect(search).rejects.toMatchObject({ problem: { kind: 'network' } });
    await tick();
    expect(form.getState().choices['kind']).toMatchObject({ error: 'The server did not answer in time' });
    const unbounded = createForm({ page, dataSource: ds, recordId: 1, timeout: 0, scheduler: clock.scheduler });
    await unbounded.load();
    const waits = unbounded.search('partner', 'Nile');
    clock.advance(10 * 60_000);
    expect(await Promise.race([waits.then(() => 'answered', () => 'failed'), tick(20).then(() => 'still waiting')])).toBe('still waiting');
  });
});

describe('a part or a language’s chunk that stalls', () => {
  afterEach(() => jest.useRealTimers());

  it('settles as failed after PART_WAIT_MS: what waits for it goes on', async () => {
    jest.useFakeTimers();
    const stalled = lazyPart('stalled', () => new Promise<never>(() => undefined));
    const settled = settleParts([stalled]).then(() => 'settled');
    const loading = stalled.load().then(
      () => 'came',
      (error: Error) => error.message
    );
    await jest.advanceTimersByTimeAsync(29_999);
    expect(stalled.coming).toBe(true);
    await jest.advanceTimersByTimeAsync(1);
    expect(await loading).toBe('fieldia.stalled.js did not come within 30 s');
    expect(await settled).toBe('settled');
    expect(stalled.coming).toBe(false);
  });

  it('a language’s chunk shows English after it, and its words still go in when they come', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    let arrive: (words: { hello: string }) => void = () => undefined;
    const table: Record<string, { hello: string }> = { en: { hello: 'Hello' } };
    const chunks = tableInChunks(table, { tr: () => new Promise((resolve) => (arrive = resolve)) });
    const ready = chunks.fetch('tr').then(() => 'ready');
    await jest.advanceTimersByTimeAsync(30_000);
    expect(await ready).toBe('ready');
    expect(table['tr'].hello).toBe('Hello');
    arrive({ hello: 'Merhaba' });
    await jest.advanceTimersByTimeAsync(0);
    expect(table['tr'].hello).toBe('Merhaba');
    warn.mockRestore();
  });
});
