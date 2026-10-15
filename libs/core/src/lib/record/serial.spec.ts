import type { ActionStep } from '../format/actions';
import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import type { DataSource, SaveRequest, UploadFile, UploadRequest, UploadedFile } from './data-source';
import { createForm, workAtRisk, type Form, type FormOptions } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { ActionHost, ActionResult } from './run';
import type { RecordId, Values } from './values';

/**
 * Round 5 of save safety (docs/plans/wave1-contract.md, section 10): the race
 * class removed. Every way out waits for a save on its way and files on
 * theirs, then checks the record as it is now; a save's answer lands only on
 * the record it was started for (generations); and the person's work at risk
 * is worked out from the record as the last finished save left it, never from
 * flags kept by runs. Each route's test fails without the check.
 */

const lead: Page = {
  fieldia: '0.1',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    phone: { type: 'char', label: 'Phone' },
    budget: { type: 'float', label: 'Budget' },
    ref: { type: 'char', label: 'Reference' },
    doc: { type: 'binary', label: 'Deed' },
    active: { type: 'boolean', label: 'Active', default: true },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    toolbar: {
      menu: [
        { id: 'm-archive', builtin: 'archive' },
        { id: 'm-duplicate', builtin: 'duplicate' },
        { id: 'm-delete', builtin: 'delete' },
      ],
    },
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-phone', field: 'phone' },
          { type: 'field', id: 'f-budget', field: 'budget' },
          { type: 'field', id: 'f-ref', field: 'ref' },
          { type: 'field', id: 'f-doc', field: 'doc' },
        ],
      },
    ],
  },
};

const leads = (): Record<string, Values> => ({
  1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', budget: 4000000, ref: '', doc: null, active: true },
  2: { name: 'Flat in Maadi', phone: '+201112223334', budget: 2500000, ref: '', doc: null, active: true },
});

type Held = 'load' | 'save' | 'copy' | 'delete' | 'archive' | 'upload';

/**
 * A source a test holds call by call: `hold(method)` keeps the next call of
 * it on its way until `release(method)`; `held(method)` settles once it is
 * held. Without `upload`, it has only what 0.20 had: load, save, copy, delete
 * and archive.
 */
function heldSource(more: { upload?: boolean; refuseDelete?: boolean } = {}) {
  const records = leads();
  let next = 3;
  let files = 0;
  const calls: { method: string; request: unknown }[] = [];
  const holds = new Map<Held, number>();
  const waiting = new Map<Held, (() => void)[]>();
  const told = new Map<Held, (() => void)[]>();
  const list = <T>(map: Map<Held, T[]>, method: Held) => map.get(method) ?? (map.set(method, []).get(method) as T[]);
  async function gate(method: Held) {
    const count = holds.get(method) ?? 0;
    if (!count) return;
    holds.set(method, count - 1);
    const going = new Promise<void>((resolve) => list(waiting, method).push(resolve));
    for (const tell of list(told, method).splice(0)) tell();
    await going;
  }
  const source = {
    records,
    calls,
    hold(method: Held = 'save') {
      holds.set(method, (holds.get(method) ?? 0) + 1);
    },
    held(method: Held = 'save'): Promise<void> {
      if (list(waiting, method).length) return Promise.resolve();
      return new Promise<void>((resolve) => list(told, method).push(resolve));
    },
    release(method: Held = 'save') {
      list(waiting, method).shift()?.();
    },
    count: (method: string) => calls.filter((call) => call.method === method).length,
    async load({ id }: { id: RecordId }) {
      calls.push({ method: 'load', request: { id } });
      await gate('load');
      return { ...records[id as number] };
    },
    async save(request: SaveRequest) {
      calls.push({ method: 'save', request });
      await gate('save');
      const id = (request.id ?? next++) as number;
      // A source that saves whole records: what the form sends is what it keeps.
      records[id] = { ...(records[id] ?? {}), ...request.values };
      return { id };
    },
    async copy({ id }: { id: RecordId }) {
      calls.push({ method: 'copy', request: { id } });
      await gate('copy');
      const copy = next++;
      records[copy] = { ...records[id as number], name: `${records[id as number]['name']} (copy)` };
      return { id: copy };
    },
    async delete({ id }: { id: RecordId }) {
      calls.push({ method: 'delete', request: { id } });
      await gate('delete');
      if (more.refuseDelete) throw new Error('This lead has payments: it cannot be deleted');
      delete records[id as number];
    },
    async archive({ id, archive }: { id: RecordId; archive: boolean }) {
      calls.push({ method: 'archive', request: { id, archive } });
      await gate('archive');
      records[id as number] = { ...records[id as number], active: !archive };
    },
    ...(more.upload
      ? {
          async upload(file: UploadFile, request: UploadRequest): Promise<UploadedFile> {
            calls.push({ method: 'upload', request: { field: request.field, name: file.name } });
            await gate('upload');
            return { url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type, fileId: ++files };
          },
        }
      : {}),
  } satisfies DataSource & Record<string, unknown>;
  return source;
}
type Source = ReturnType<typeof heldSource>;

/** A host that answers each question as told (No when it runs out), or leaves it open for the test to answer (`'open'`). */
function host(answers: (boolean | 'open')[] = []) {
  const asked: { message: string; how?: { discard?: boolean } }[] = [];
  const closed: number[] = [];
  const urls: string[] = [];
  const open: ((yes: boolean) => void)[] = [];
  const made: ActionHost = {
    open: async () => ({ saved: false }),
    say: () => undefined,
    ask: (message, how) => {
      asked.push({ message, ...(how ? { how } : {}) });
      const answer = answers.shift() ?? false;
      return answer === 'open' ? new Promise<boolean>((resolve) => open.push(resolve)) : Promise.resolve(answer);
    },
    close: () => void closed.push(closed.length + 1),
    openUrl: (url) => void urls.push(url),
  };
  return { host: made, asked, closed, urls, answer: (yes: boolean) => open.shift()?.(yes) };
}

const DISCARD = { message: 'Discard your changes?', how: { discard: true } };
const deed: UploadFile = { name: 'deed.pdf', size: 4, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(4) };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function opened(ds: DataSource, more: Partial<FormOptions> = {}, page: Page = lead): Promise<Form> {
  const form = createForm({ page, dataSource: ds, recordId: 1, ...more });
  await form.load();
  await form.settled();
  return form;
}

beforeAll(() => expect(validatePage(lead).ok).toBe(true));

/**
 * The phone changed and Ctrl+Enter pressed: its save held on its way. With
 * `typed`, the budget is typed while it is. Then `out` takes a way out.
 */
async function wayOutWhileSaving(form: Form, ds: Source, out: () => Promise<unknown>, typed: boolean) {
  form.setValue('phone', '+201009998887');
  ds.hold('save');
  const saving = form.save();
  await ds.held('save');
  if (typed) form.setValue('budget', 4300000);
  const going = out();
  return { saving, going };
}

describe('serialised: a way out taken while a save is on its way waits for it, then checks the record as it is now', () => {
  /** Each route out of the form, as a step or a call takes it; `after` checks it went where it goes. */
  const routes: { name: string; more?: Partial<FormOptions>; saves?: true; take(form: Form): Promise<unknown>; went(form: Form, ds: Source, made: ReturnType<typeof host>): void }[] = [
    { name: '1. form.openRecord(2)', take: (form) => form.openRecord(2), went: (form) => expect(form.getState()).toMatchObject({ recordId: 2, dirty: [] }) },
    { name: '1. form.openRecord(null)', take: (form) => form.openRecord(null), went: (form) => expect(form.getState().recordId).toBeNull() },
    { name: '2. form.load() again', take: (form) => form.load(), went: (form) => expect(form.getState().dirty).toEqual([]) },
    { name: '9. a reload step', take: (form) => form.run([{ do: 'reload' }]), went: (form) => expect(form.getState().dirty).toEqual([]) },
    { name: '10. a reset step', take: (form) => form.run([{ do: 'reset' }]), went: (form) => expect(form.getState().dirty).toEqual([]) },
    { name: '11. a close step, through the app’s own host.close', take: (form) => form.run([{ do: 'close' }]), went: (_form, _ds, made) => expect(made.closed).toEqual([1]) },
    { name: '12. an openUrl step in this tab', take: (form) => form.run([{ do: 'openUrl', url: "'https://example.com/'", newTab: false }]), went: (_form, _ds, made) => expect(made.urls).toEqual(['https://example.com/']) },
    { name: '13. an archive step', take: (form) => form.run([{ do: 'archive' }]), went: (_form, ds) => expect(ds.records[1]['active']).toBe(false) },
    // Duplicate saves the changes first, as in 0.20: they go with the copy. Its save waits its turn behind the one on its way.
    { name: '14. a duplicate step, copied by the source', saves: true, take: (form) => form.run([{ do: 'duplicate' }]), went: (form) => expect(form.getState().recordId).toBe(3) },
    { name: '17. an action’s answer { record }', more: { onAction: () => ({ record: 2 }) }, take: (form) => form.run([{ do: 'call', action: 'go' }]), went: (form) => expect(form.getState().recordId).toBe(2) },
    { name: '18. an action’s answer { reload: true }', more: { onAction: () => ({ reload: true }) }, take: (form) => form.run([{ do: 'call', action: 'go' }]), went: (form) => expect(form.getState().dirty).toEqual([]) },
    { name: '3. form.leave()', take: (form) => form.leave(), went: () => undefined },
  ];

  for (const route of routes) {
    it(`${route.name}: nothing typed during the save — waits, the save lands on record 1, then it goes, unasked`, async () => {
      const ds = heldSource();
      const made = host();
      const form = await opened(ds, { host: made.host, ...route.more });
      const { saving, going } = await wayOutWhileSaving(form, ds, () => route.take(form), false);
      await tick();
      // It waits, and says so: nothing asked, nothing left yet.
      expect(form.getState().leaving).toBe(!route.saves);
      expect(made.asked).toEqual([]);
      expect(made.closed).toEqual([]);
      ds.release('save');
      expect(await saving).toBe(true);
      await going;
      await form.settled();
      expect(made.asked).toEqual([]);
      expect(form.getState().leaving).toBe(false);
      expect(ds.records[1]).toMatchObject({ name: 'Villa in Sheikh Zayed', phone: '+201009998887', budget: 4000000 });
      route.went(form, ds, made);
    });

    if (route.saves) {
      it(`${route.name}: the budget typed during the save is saved before the copy, as in 0.20: nothing asked, nothing lost`, async () => {
        const ds = heldSource();
        const made = host();
        const form = await opened(ds, { host: made.host });
        const { saving, going } = await wayOutWhileSaving(form, ds, () => route.take(form), true);
        ds.release('save');
        await saving;
        await going;
        await form.settled();
        expect(made.asked).toEqual([]);
        expect(ds.records[1]).toMatchObject({ phone: '+201009998887', budget: 4300000 });
        route.went(form, ds, made);
      });
      continue;
    }

    it(`${route.name}: the budget typed during the save — asked once it landed; Cancel keeps record 1, and the next save writes only the budget`, async () => {
      const ds = heldSource();
      const made = host([false]);
      const form = await opened(ds, { host: made.host, ...route.more });
      const { saving, going } = await wayOutWhileSaving(form, ds, () => route.take(form), true);
      await tick();
      expect(made.asked).toEqual([]);
      ds.release('save');
      expect(await saving).toBe(true);
      await going;
      await form.settled();
      expect(made.asked).toEqual([DISCARD]);
      expect(made.closed).toEqual([]);
      expect(made.urls).toEqual([]);
      expect(form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'], dirty: ['budget'] });
      expect(form.getState().values).toMatchObject({ name: 'Villa in Sheikh Zayed', phone: '+201009998887', budget: 4300000 });
      expect(ds.records[1]).toMatchObject({ phone: '+201009998887', budget: 4000000, active: true });
      expect(ds.count('copy')).toBe(0);
      expect(await form.save()).toBe(true);
      expect(ds.records[1]).toMatchObject({ name: 'Villa in Sheikh Zayed', phone: '+201009998887', budget: 4300000 });
      expect(ds.records[2]).toMatchObject({ name: 'Flat in Maadi', budget: 2500000 });
    });
  }

  it('a second way out taken while one waits joins that wait and its one question: never another', async () => {
    const ds = heldSource();
    const made = host(['open']);
    const form = await opened(ds, { host: made.host, onAction: () => ({ record: 2 }) });
    const { saving, going } = await wayOutWhileSaving(form, ds, () => form.openRecord(2), true);
    const second = form.run([{ do: 'reload' }]);
    const third = form.leave();
    await tick();
    expect(made.asked).toEqual([]);
    ds.release('save');
    await saving;
    await until(() => made.asked.length > 0);
    expect(made.asked).toEqual([DISCARD]);
    made.answer(false);
    expect(await going).toBe(false);
    expect(await second).toMatchObject({ done: false, reason: 'no' });
    expect(await third).toBe(false);
    expect(made.asked).toEqual([DISCARD]);
    expect(form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'] });
  });

  it('a way out the save’s own beforeSave steps take does not wait for that save: nothing waits on itself', async () => {
    const ds = heldSource();
    const page: Page = { ...lead, on: { beforeSave: [{ do: 'call', action: 'check' }] } };
    const made = host();
    const form = await opened(ds, { host: made.host, onAction: () => ({ reload: true }) }, page);
    form.setValue('phone', '+201009998887');
    // The reload its call asks for drops the change, as in 0.20: no save went through, nothing is at risk.
    expect(await form.save()).toBe(true);
    expect(made.asked).toEqual([]);
  });

  it('a file still on its way: the way out waits for it, saying so, and asks once it landed', async () => {
    const ds = heldSource({ upload: true });
    const made = host([false]);
    const form = await opened(ds, { host: made.host });
    ds.hold('upload');
    form.upload('doc', [deed]);
    await ds.held('upload');
    const going = form.run([{ do: 'reload' }]);
    await tick();
    expect(form.getState().leaving).toBe(true);
    expect(made.asked).toEqual([]);
    ds.release('upload');
    expect(await going).toMatchObject({ done: false, reason: 'no' });
    expect(made.asked).toEqual([DISCARD]);
    expect(form.getState()).toMatchObject({ leaving: false, unsent: ['doc'] });
    expect(form.getState().values['doc']).toMatchObject({ name: 'deed.pdf', fileId: 1 });
  });
});

describe('generations: an answer lands only on the record it was started for', () => {
  it('a save started while the question is open, then Discard: its late answer is dropped, never laid over record 2', async () => {
    const ds = heldSource();
    const made = host(['open']);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    await typedDuring(form, ds);
    const going = form.openRecord(2);
    await until(() => made.asked.length > 0);
    // The app saves what is shown while the person is asked.
    ds.hold('save');
    const late = form.save();
    await ds.held('save');
    made.answer(true);
    expect(await going).toBe(true);
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [], unsent: [] });
    ds.release('save');
    expect(await late).toBe(true);
    await form.settled();
    // The source has it; the form shows record 2 as it was.
    expect(ds.records[1]).toMatchObject({ budget: 4300000 });
    expect(form.getState()).toMatchObject({ recordId: 2, status: 'ready', dirty: [] });
    expect(form.getState().values).toMatchObject({ name: 'Flat in Maadi', budget: 2500000, phone: '+201112223334' });
  });

  it('the person’s Discard during a save: its answer lands as the record stored it, the reset values never laid over it', async () => {
    const ds = heldSource();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    ds.hold('save');
    const saving = form.save();
    await ds.held('save');
    form.reset();
    ds.release('save');
    expect(await saving).toBe(true);
    expect(form.getState()).toMatchObject({ recordId: 1, dirty: [], unsent: [] });
    expect(form.getState().values['phone']).toBe('+201009998887');
    // Nothing old is left to write back over it.
    form.setValue('ref', 'R-9');
    expect(await form.save()).toBe(true);
    expect(ds.records[1]).toMatchObject({ phone: '+201009998887', ref: 'R-9' });
  });

  it('a new record reset during its first save gets the id its save made: the next save changes it, never makes another', async () => {
    const ds = heldSource();
    const form = createForm({ page: lead, dataSource: ds });
    await form.settled();
    form.setValue('name', 'Plot in New Cairo');
    ds.hold('save');
    const saving = form.save();
    await ds.held('save');
    form.reset();
    ds.release('save');
    await saving;
    expect(form.getState().recordId).toBe(3);
    form.setValue('budget', 1);
    await form.save();
    expect(Object.keys(ds.records)).toEqual(['1', '2', '3']);
  });

  it('a run’s call answering after the record was replaced: its values are dropped, and the run stops', async () => {
    const ds = heldSource();
    let answer!: (result: ActionResult) => void;
    const form = await opened(ds, { onAction: () => new Promise<ActionResult>((resolve) => (answer = resolve)) });
    const run = form.run([{ do: 'call', action: 'slow' }, { do: 'set', field: 'ref', value: "'after'" }]);
    await tick();
    expect(await form.openRecord(2)).toBe(true);
    answer({ values: { ref: 'R-1' } });
    expect(await run).toMatchObject({ done: false, reason: 'cannot' });
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [] });
    expect(form.getState().values['ref']).toBe('');
  });

  it('a conflict’s Reload pressed while Keep mine’s save is on its way waits for it: the record shown is the one stored after it', async () => {
    const memory = createMemoryDataSource({ records: { lead: leads() }, versions: { by: 'Sara' } });
    let holding = false;
    let go: (() => void) | null = null;
    const ds: DataSource = {
      ...memory,
      async save(request) {
        if (holding) {
          holding = false;
          await new Promise<void>((resolve) => (go = resolve));
        }
        return memory.save(request);
      },
    };
    const form = await opened(ds);
    form.setValue('budget', 4300000);
    memory.changeElsewhere('lead', 1, { phone: '+201000000000' }, { by: 'Mona' });
    expect(await form.save()).toBe(false);
    expect(form.getState().conflict).not.toBeNull();
    holding = true;
    const keeping = form.keepMine();
    await until(() => go);
    const reloading = form.reloadTheirs();
    await tick();
    (go as unknown as () => void)();
    expect(await keeping).toBe(true);
    expect(await reloading).toBe(true);
    expect(form.getState().values).toMatchObject({ budget: 4300000, phone: '+201000000000' });
    expect(form.getState()).toMatchObject({ setAside: null, dirty: [] });
  });

  it('a run whose record another way out replaced stops before its next step: nothing of it lands on record 2', async () => {
    const ds = heldSource();
    const made = host(['open']);
    const form = await opened(ds, { host: made.host });
    const run = form.run([{ do: 'ask', message: 'Send the offer?' }, { do: 'set', field: 'ref', value: "'after'" }]);
    await until(() => made.asked.length);
    expect(await form.openRecord(2)).toBe(true);
    made.answer(true);
    expect(await run).toMatchObject({ done: false, reason: 'cannot', stoppedAt: 1, message: 'Another record is shown now: the rest of these steps did not run.' });
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [] });
  });

  it('a run goes on with the records its own steps show: an answer’s record, a reload, Duplicate’s copy', async () => {
    const ds = heldSource();
    const form = await opened(ds, { onAction: () => ({ record: 2 }) });
    expect((await form.run([{ do: 'call', action: 'next' }, { do: 'set', field: 'ref', value: "'R-2'" }])).done).toBe(true);
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: ['ref'] });
    expect((await form.run([{ do: 'reload' }, { do: 'set', field: 'ref', value: "'R-again'" }])).done).toBe(true);
    expect(form.getState().values['ref']).toBe('R-again');
    expect((await form.run([{ do: 'duplicate' }, { do: 'set', field: 'ref', value: "'R-copy'" }])).done).toBe(true);
    expect(form.getState()).toMatchObject({ recordId: 3 });
    expect(form.getState().values['ref']).toBe('R-copy');
  });

  it('a form disposed while it saves: the late answer lays nothing', async () => {
    const ds = heldSource();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    ds.hold('save');
    const saving = form.save();
    await ds.held('save');
    const seen: unknown[] = [];
    form.subscribe((state) => seen.push(state));
    form.dispose();
    const before = form.getState();
    ds.release('save');
    expect(await saving).toBe(true);
    // The form as it was disposed: nothing laid over it.
    expect(form.getState()).toBe(before);
    expect(seen).toEqual([]);
  });
});

/** Type the budget while a save of what is shown is on its way. */
async function typedDuring(form: Form, ds: Source, field = 'budget', value: Values[string] = 4300000) {
  ds.hold('save');
  const saving = form.save();
  await ds.held('save');
  form.setValue(field, value);
  ds.release('save');
  expect(await saving).toBe(true);
}

async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 5) await new Promise((resolve) => setTimeout(resolve, 5));
}

describe('work at risk: worked out from the record as the last finished save left it', () => {
  it('a change of the person’s the last save did not send is at risk — typed during it, or since — until a save takes it or it is changed back', async () => {
    const ds = heldSource();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    await typedDuring(form, ds);
    expect(form.getState().unsent).toEqual(['budget']);
    form.setValue('budget', 4000000);
    expect(form.getState().unsent).toEqual([]);
    // Since the save: still not sent by it.
    form.setValue('ref', 'R-1');
    expect(form.getState().unsent).toEqual(['ref']);
    expect(await form.save()).toBe(true);
    expect(form.getState().unsent).toEqual([]);
  });

  it('before the first save of a record, a change not saved is not at risk: as in 0.20', async () => {
    const form = await opened(heldSource());
    form.setValue('budget', 1);
    expect(form.getState()).toMatchObject({ dirty: ['budget'], unsent: [] });
    expect(workAtRisk(form.getState())).toBe(false);
  });

  it('values a step, the app or an afterSave run set are never the person’s; the person’s change taken over by them is no longer at risk', async () => {
    const ds = heldSource();
    const page: Page = { ...lead, on: { afterSave: [{ do: 'set', field: 'ref', value: "'R-1'" }] } };
    const form = await opened(ds, {}, page);
    form.setValue('phone', '+201009998887');
    await typedDuring(form, ds);
    await form.settled();
    expect(form.getState()).toMatchObject({ unsent: ['budget'] });
    expect(form.getState().dirty).toContain('ref');
    form.setValues({ budget: 4100000 });
    expect(form.getState().unsent).toEqual([]);
  });

  it('the next record starts with nothing at risk: an afterSave run of record 1 still going (P9)', async () => {
    const ds = heldSource();
    const page: Page = { ...lead, on: { afterSave: [{ do: 'call', action: 'notify' }] } };
    let notified!: () => void;
    const made = host();
    const form = await opened(ds, { host: made.host, onAction: () => new Promise<undefined>((resolve) => (notified = () => resolve(undefined))) }, page);
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    await tick();
    expect(await form.openRecord(2)).toBe(true);
    form.setValue('budget', 2600000);
    expect(form.getState().unsent).toEqual([]);
    expect((await form.run([{ do: 'reload' }])).done).toBe(true);
    expect(made.asked).toEqual([]);
    notified();
    await form.settled();
  });

  it('a file picked during a save, landing after it: counted, and asked about (round 4 #3)', async () => {
    const ds = heldSource({ upload: true });
    const made = host([false]);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    ds.hold('save');
    const saving = form.save();
    await ds.held('save');
    ds.hold('upload');
    form.upload('doc', [deed]);
    await ds.held('upload');
    ds.release('save');
    expect(await saving).toBe(true);
    ds.release('upload');
    await form.settled();
    expect(form.getState().unsent).toEqual(['doc']);
    expect(await form.run([{ do: 'reload' }])).toMatchObject({ done: false, reason: 'no' });
    expect(made.asked).toEqual([DISCARD]);
    expect(form.getState().values['doc']).toMatchObject({ name: 'deed.pdf' });
  });

  it('a file the store holds that no save sent is at risk before any save too: only where the source has upload', async () => {
    const ds = heldSource({ upload: true });
    const form = await opened(ds);
    form.upload('doc', [deed]);
    await form.settled();
    expect(form.getState().unsent).toEqual(['doc']);
    expect(await form.save()).toBe(true);
    expect(form.getState().unsent).toEqual([]);
  });

  it('Duplicate: a change typed while the copy is made is asked about before the copy shows (P1)', async () => {
    const ds = heldSource();
    const made = host([false]);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    ds.hold('copy');
    const run = form.runAction('m-duplicate');
    await ds.held('copy');
    form.setValue('budget', 4300000);
    ds.release('copy');
    expect(await run).toMatchObject({ done: false, reason: 'no' });
    expect(made.asked).toEqual([DISCARD]);
    expect(form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'] });
    expect(form.getState().values['budget']).toBe(4300000);
  });

  it('Duplicate through the app’s action: a change typed while it goes is asked about before its record shows (P2)', async () => {
    const ds = heldSource();
    const { copy: _copy, ...noCopy } = ds;
    let answer!: (result: ActionResult) => void;
    const made = host([false]);
    const form = await opened(noCopy as DataSource, { host: made.host, onAction: () => new Promise<ActionResult>((resolve) => (answer = resolve)) });
    form.setValue('phone', '+201009998887');
    const run = form.runAction('m-duplicate');
    await until(() => answer);
    form.setValue('budget', 4300000);
    answer({ record: 2 });
    expect(await run).toMatchObject({ done: false, reason: 'no' });
    expect(made.asked).toEqual([DISCARD]);
    expect(form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'] });
  });

  it('the afterSave run: a change typed after save() resolved, while its call goes on, is asked about when the answer names a record (P3)', async () => {
    const ds = heldSource();
    const page: Page = { ...lead, on: { afterSave: [{ do: 'call', action: 'next_lead' }] } };
    let answer!: (result: ActionResult) => void;
    const made = host([false]);
    const form = await opened(ds, { host: made.host, onAction: () => new Promise<ActionResult>((resolve) => (answer = resolve)) }, page);
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    await until(() => answer);
    form.setValue('budget', 4300000);
    answer({ record: 2 });
    await form.settled();
    expect(made.asked).toEqual([DISCARD]);
    expect(form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'] });
  });

  it('Delete refused by the source: the work at risk and the file on its way stay', async () => {
    const ds = heldSource({ upload: true, refuseDelete: true });
    const made = host([true]);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    await typedDuring(form, ds);
    ds.hold('upload');
    form.upload('doc', [deed]);
    await ds.held('upload');
    expect(await form.runAction('m-delete')).toMatchObject({ done: false, reason: 'cannot' });
    expect(form.getState().unsent).toEqual(['budget']);
    expect(form.getState().uploads).toHaveLength(1);
    ds.release('upload');
    await form.settled();
    expect(form.getState().unsent).toEqual(['budget', 'doc']);
  });

  it('Delete: what the person typed while it was on its way goes with the record, unasked', async () => {
    const ds = heldSource();
    const made = host([true]);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    await typedDuring(form, ds);
    ds.hold('delete');
    const run = form.runAction('m-delete');
    await ds.held('delete');
    form.setValue('ref', 'R-1');
    ds.release('delete');
    expect((await run).done).toBe(true);
    await form.settled();
    expect(made.asked).toEqual([{ message: 'Are you sure you want to delete this record?' }]);
    expect(form.getState()).toMatchObject({ recordId: null, unsent: [] });
  });

  it('a saved form placed in the record: its own way out is the record’s check, waiting for the record’s save', async () => {
    const consent: Page = {
      fieldia: '0.1',
      id: 'consent',
      title: 'Consent',
      data: { kind: 'responses' },
      fields: { agree: { type: 'boolean', label: 'I agree' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-agree', field: 'agree' }] },
    };
    const sheet = lead.layout as Extract<Page['layout'], { type: 'sheet' }>;
    const placed: Page = { ...lead, layout: { ...sheet, children: [...sheet.children, { type: 'form', id: 'p-consent', name: 'consent', page: 'consent' }] } };
    const ds = heldSource();
    const made = host([false]);
    const form = await opened(ds, { host: made.host }, placed);
    const inner = form.embed('p-consent', consent);
    form.setValue('phone', '+201009998887');
    ds.hold('save');
    const saving = form.save();
    await ds.held('save');
    inner.setValue('agree', true);
    // Its reset step waits for the record's save, then asks the record's question.
    const reset = inner.run([{ do: 'reset' }]);
    await tick();
    expect(made.asked).toEqual([]);
    ds.release('save');
    await saving;
    expect(await reset).toMatchObject({ done: false, reason: 'no' });
    expect(await inner.run([{ do: 'openUrl', url: "'https://example.com/'", newTab: false }])).toMatchObject({ done: false, reason: 'no' });
    expect(await inner.leave()).toBe(false);
    expect(made.asked).toEqual([DISCARD, DISCARD, DISCARD]);
    expect(made.urls).toEqual([]);
  });
});

describe('as in 0.20: an app with none of the new members', () => {
  it('afterSave steps setting values, then every way out: nothing asked; a change not saved and no save in flight is dropped where a step leaves', async () => {
    const ds = heldSource();
    const page: Page = { ...lead, on: { afterSave: [{ do: 'set', field: 'ref', value: "'R-1'" }, { do: 'set', field: 'name', value: "name + ' ✓'" }] } };
    const made = host();
    const form = await opened(ds, { host: made.host, onAction: () => ({ record: 2 }) }, page);
    for (const way of [[{ do: 'close' }], [{ do: 'reload' }], [{ do: 'reset' }], [{ do: 'openUrl', url: "'https://example.com/'", newTab: false }], [{ do: 'archive' }]] as ActionStep[][]) {
      form.setValue('phone', `+20100${way[0].do.length}`);
      const result = await form.run([{ do: 'save' }, ...way]);
      await form.settled();
      expect(result.done).toBe(true);
      expect(form.getState().values['ref']).toBe('R-1');
    }
    expect((await form.run([{ do: 'save' }, { do: 'call', action: 'next' }])).done).toBe(true);
    expect(form.getState().recordId).toBe(2);
    // No save on record 2: a change not saved is dropped, unasked, as it always was.
    form.setValue('budget', 1);
    expect((await form.run([{ do: 'reload' }])).done).toBe(true);
    expect(form.getState().values['budget']).toBe(2500000);
    expect(made.asked).toEqual([]);
    expect(made.closed).toEqual([1]);
  });

  it('the one deliberate change: with a save on its way, a way out waits for it, so record 1’s save never lands on record 2', async () => {
    const ds = heldSource();
    const made = host();
    const form = await opened(ds, { host: made.host, onAction: () => ({ record: 2 }) });
    const { saving, going } = await wayOutWhileSaving(form, ds, () => form.run([{ do: 'call', action: 'next' }]), false);
    await tick();
    expect(form.getState().recordId).toBe(1);
    ds.release('save');
    await saving;
    expect((await going) as unknown).toMatchObject({ done: true });
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [] });
    expect(form.getState().values).toMatchObject({ name: 'Flat in Maadi', phone: '+201112223334' });
    expect(ds.records[1]).toMatchObject({ name: 'Villa in Sheikh Zayed', phone: '+201009998887' });
    expect(made.asked).toEqual([]);
  });
});
