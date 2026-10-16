import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { ConflictError, type DataSource, type OnchangeRequest, type SaveRequest, type UploadFile, type UploadRequest, type UploadedFile } from './data-source';
import { createForm, workAtRisk, type Form, type FormOptions } from './form';
import type { ActionHost, ActionResult } from './run';
import type { Line, RecordId, Values } from './values';

/**
 * The one test every late answer passes (`form.recordShown()`: docs/plans/wave1-contract.md, section 10, part 2),
 * held to for every answer that writes on a form or acts on its record — not only a save's, a call's and an opened
 * page's: an onchange's, Keep mine's read, a record step's, a button's question, a change's steps run again, a check
 * waiting for a name, a save's own waits, a step's own reload. And the person's claims on what they changed, the
 * conflict waiting, Discard and the files, a locked record, and the record as a save left it.
 */

const lead = {
  fieldia: '0.1',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    phone: { type: 'char', label: 'Phone' },
    stage: { type: 'char', label: 'Stage' },
    budget: { type: 'float', label: 'Budget' },
    ref: { type: 'char', label: 'Reference' },
    doc: { type: 'binary', label: 'Deed' },
    lines: { type: 'one2many', label: 'Rooms', relation: 'lead.room', fields: { label: { type: 'char', label: 'Room' }, area: { type: 'float', label: 'Area' } } },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-phone', field: 'phone' },
          { type: 'field', id: 'f-stage', field: 'stage' },
          { type: 'field', id: 'f-budget', field: 'budget' },
          { type: 'field', id: 'f-ref', field: 'ref' },
          { type: 'field', id: 'f-doc', field: 'doc' },
          { type: 'field', id: 'f-lines', field: 'lines' },
          { type: 'button', id: 'b-send', label: 'Send the offer', confirm: 'Send the offer?', steps: [{ do: 'set', field: 'ref', value: "'sent'" }] },
          { type: 'button', id: 'b-room', label: 'Add a room', steps: [{ do: 'addLine', field: 'lines', values: { label: "'Roof'" } }] },
        ],
      },
    ],
  },
} as Page;

type Held = 'load' | 'save' | 'onchange' | 'copy' | 'delete' | 'archive' | 'upload';

/**
 * Two leads — the second with no name, so a check finds a problem on it — and a source a test holds call by call.
 * `versions`: it keeps versions, and refuses a save over another's. `lockOnSave`: a save locks the record.
 */
function source(more: { versions?: boolean; lockOnSave?: boolean; upload?: boolean } = {}) {
  const records: Record<string, Values> = {
    1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', stage: 'new', budget: 4000000, ref: '', doc: null, lines: [{ key: 'r1', id: 11, values: { label: 'Hall', area: 40 } }] as unknown as Values['lines'] },
    2: { name: '', phone: '+201112223334', stage: 'won', budget: 2500000, ref: '', doc: null, lines: [] },
  };
  let version = 1;
  let theirs = false;
  const calls: string[] = [];
  const holds = new Map<Held, number>();
  const waiting = new Map<Held, (() => void)[]>();
  const list = (method: Held) => waiting.get(method) ?? (waiting.set(method, []).get(method) as (() => void)[]);
  async function gate(method: Held) {
    calls.push(method);
    const count = holds.get(method) ?? 0;
    if (!count) return;
    holds.set(method, count - 1);
    await new Promise<void>((go) => list(method).push(go));
  }
  return {
    records,
    calls,
    hold: (method: Held) => void holds.set(method, (holds.get(method) ?? 0) + 1),
    held: (method: Held) => list(method).length > 0,
    release: (method: Held) => list(method).shift()?.(),
    /** Someone else saves lead 1 first: the next save carrying the version before is refused. */
    savedElsewhere() {
      version++;
      theirs = true;
    },
    async load({ id }: { id: RecordId }) {
      await gate('load');
      const values = structuredClone(records[id as number]);
      return more.versions ? { $loaded: true as const, values, version: { token: String(version), by: 'Mona' } } : values;
    },
    async save(request: SaveRequest) {
      await gate('save');
      if (more.versions && theirs && request.version?.token !== String(version)) throw new ConflictError({ version: { token: String(version), by: 'Mona' } });
      const id = (request.id ?? 3) as number;
      records[id] = { ...(records[id] ?? {}), ...structuredClone(request.values) };
      return { id, ...(more.versions ? { version: { token: String(version) } } : {}), ...(more.lockOnSave ? { can: { edit: false, reason: 'Won leads are locked.' } } : {}) };
    },
    async onchange(request: OnchangeRequest) {
      await gate('onchange');
      return request.changed === 'stage' ? { values: { ref: `after ${request.values['stage']}` } } : {};
    },
    async copy({ id }: { id: RecordId }) {
      await gate('copy');
      records[5] = { ...records[id as number], name: 'copy' };
      return { id: 5 };
    },
    async delete({ id }: { id: RecordId }) {
      await gate('delete');
      delete records[id as number];
    },
    ...(more.upload
      ? {
          async upload(file: UploadFile, _request: UploadRequest): Promise<UploadedFile> {
            await gate('upload');
            return { url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type, fileId: 1 };
          },
        }
      : {}),
  } satisfies DataSource & Record<string, unknown>;
}
type Source = ReturnType<typeof source>;

/** A host that answers each question as told (No when it runs out), or leaves it open (`'open'`) for the test. */
function host(answers: (boolean | 'open')[] = []) {
  const asked: string[] = [];
  const open: ((yes: boolean) => void)[] = [];
  const made: ActionHost = {
    open: async () => ({ saved: false }),
    say: () => undefined,
    ask: (message) => {
      asked.push(message);
      const answer = answers.shift() ?? false;
      return answer === 'open' ? new Promise<boolean>((resolve) => open.push(resolve)) : Promise.resolve(answer);
    },
    close: () => undefined,
  };
  return { host: made, asked, answer: (yes: boolean) => open.shift()?.(yes) };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const until = async (holds: () => boolean) => {
  for (let i = 0; i < 50 && !holds(); i++) await tick();
  expect(holds()).toBe(true);
};
const deed: UploadFile = { name: 'deed.pdf', size: 4, type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(4) };

async function opened(ds: Source, more: Partial<FormOptions> = {}, page: Page = lead): Promise<Form> {
  const form = createForm({ page, dataSource: ds, recordId: 1, ...more });
  await form.load();
  await form.settled();
  return form;
}

beforeAll(() => expect(validatePage(lead)).toMatchObject({ ok: true }));

describe('the one test: the record an answer was asked for, still shown', () => {
  it('holds while the record is shown, typed in or saved; not once another is opened, it is loaded again, a new one started, the person’s Discard pressed, or the form closed', async () => {
    const form = await opened(source());
    const shown = form.recordShown();
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    expect(shown()).toBe(true);
    for (const replace of [() => form.openRecord(2), () => form.load(), () => form.openRecord(null), async () => form.reset(), async () => form.dispose()]) {
      const before = form.recordShown();
      await replace();
      expect(before()).toBe(false);
    }
  });

  it('a saved form placed in a record: what is asked inside is laid nowhere once another record is shown round it', async () => {
    const address = { fieldia: '0.1', id: 'address', title: 'Address', data: { kind: 'responses' }, fields: { street: { type: 'char', label: 'Street' } }, layout: { type: 'sections', id: 'a', children: [{ type: 'field', id: 'f-street', field: 'street' }] } } as Page;
    const sheet = lead.layout as Extract<Page['layout'], { type: 'sheet' }>;
    const page = { ...lead, layout: { ...sheet, children: [...sheet.children, { type: 'form', id: 'home', page: 'address', name: 'home', title: 'Home' }] } } as Page;
    const form = await opened(source(), {}, page);
    const inner = form.embed('home', address);
    const shown = inner.recordShown();
    inner.setValue('street', '27 Ramses Street');
    expect(shown()).toBe(true);
    expect(await form.openRecord(2)).toBe(true);
    expect(shown()).toBe(false);
    expect(inner.recordShown()()).toBe(true);
  });

  it('an onchange asked before the person’s Discard is not laid over the values let go', async () => {
    const ds = source();
    const form = await opened(ds);
    ds.hold('onchange');
    form.setValue('stage', 'lost');
    await until(() => ds.held('onchange'));
    form.reset();
    ds.release('onchange');
    await form.settled();
    expect(form.getState()).toMatchObject({ dirty: [], values: { stage: 'new', ref: '' } });
  });

  it('Keep mine reading the record again once another is shown: nothing is laid on that one, nothing saved', async () => {
    const ds = source({ versions: true });
    const made = host([true]);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    ds.savedElsewhere();
    expect(await form.save()).toBe(false);
    expect(form.getState().conflict).not.toBeNull();
    ds.hold('load');
    const keeping = form.keepMine();
    await until(() => ds.held('load'));
    // The conflict's changes are at risk: Discard lets them go, and lead 2 is shown before lead 1 is read.
    expect(await form.openRecord(2)).toBe(true);
    ds.release('load');
    expect(await keeping).toBe(false);
    await form.settled();
    expect(made.asked).toEqual(['Discard your changes?']);
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [], values: { phone: '+201112223334' } });
    expect(ds.calls.filter((call) => call === 'save')).toHaveLength(1);
  });

  it('a button’s question answered once another record is shown runs none of its steps there', async () => {
    const made = host(['open']);
    const form = await opened(source(), { host: made.host });
    const pressed = form.runAction('b-send');
    await until(() => made.asked.length > 0);
    expect(await form.openRecord(2)).toBe(true);
    made.answer(true);
    expect(await pressed).toMatchObject({ done: false, reason: 'cannot' });
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [], values: { ref: '' } });
  });

  it('a change’s steps set off again while its run waits are let go once another record is shown', async () => {
    let answered!: (result: ActionResult) => void;
    const calls: unknown[] = [];
    const page: Page = { ...lead, on: { change: { budget: [{ do: 'call', action: 'price' }, { do: 'set', field: 'ref', value: "'priced'" }] } } };
    const form = await opened(source(), { onAction: (request) => new Promise<ActionResult>((resolve) => (calls.push(request.recordId), (answered = resolve))) }, page);
    const stopped: unknown[] = [];
    form.on('run', ({ result }) => result.reason === 'cannot' && void stopped.push(result.message));
    form.setValue('budget', 4100000);
    await until(() => calls.length === 1);
    // Typed again while its run waits: run once more after it — on lead 1, which is gone by then.
    form.setValue('budget', 4200000);
    expect(await form.openRecord(2)).toBe(true);
    answered({});
    await form.settled();
    expect(calls).toEqual([1]);
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [], values: { ref: '' } });
    // Its run stopped, and said so; the one let go never ran, so says nothing on lead 2.
    expect(stopped).toEqual(['Another record is shown now: the rest of these steps did not run.']);
  });

  it('a check step waiting for a name being looked up shows nothing on the record shown by then', async () => {
    const form = await opened(source());
    let found!: () => void;
    form.settling(() => new Promise<void>((resolve) => (found = resolve)));
    const run = form.run([{ do: 'check' }]);
    await tick();
    expect(await form.openRecord(2)).toBe(true);
    found();
    expect(await run).toMatchObject({ done: false, reason: 'cannot' });
    // Lead 2 has no name: a check made on it would say so. None was.
    expect(form.getState()).toMatchObject({ recordId: 2, errors: {} });
  });

  it('a save waiting for a name being looked up, the form closed meanwhile: nothing is sent', async () => {
    const ds = source();
    const form = await opened(ds);
    let found!: () => void;
    form.settling(() => new Promise<void>((resolve) => (found = resolve)));
    form.setValue('phone', '+201009998887');
    const saving = form.save();
    await tick();
    form.dispose();
    found();
    expect(await saving).toBe(false);
    expect(ds.calls).not.toContain('save');
  });

  it('a step’s own reload, another record shown before it ended: the run stops, and the call’s values land nowhere', async () => {
    const ds = source();
    const form = await opened(ds, { onAction: () => ({ reload: true, values: { ref: 'R-7' } }) });
    ds.hold('load');
    const run = form.run([{ do: 'call', action: 'refresh' }, { do: 'set', field: 'stage', value: "'after'" }]);
    await until(() => ds.held('load'));
    expect(await form.openRecord(2)).toBe(true);
    ds.release('load');
    expect(await run).toMatchObject({ done: false, reason: 'cannot', stoppedAt: 0 });
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [], values: { ref: '', stage: 'won' } });
  });

  it('Delete answering once another record is shown: the run stops there, and that record — and its way out — are asked about as any', async () => {
    const ds = source();
    const made = host([false]);
    const form = await opened(ds, { host: made.host });
    ds.hold('delete');
    const run = form.run([{ do: 'delete' }, { do: 'set', field: 'ref', value: "'after'" }]);
    await until(() => ds.held('delete'));
    // A way out of the record being deleted asks nothing: the person chose to delete it.
    expect(await form.openRecord(2)).toBe(true);
    expect(made.asked).toEqual([]);
    form.setValue('name', 'Flat in Maadi');
    expect(await form.save()).toBe(true);
    form.setValue('phone', '+201110000000');
    // Lead 2 is not being deleted: its work at risk is asked about, though lead 1's delete goes on.
    expect(await form.leave()).toBe(false);
    expect(made.asked).toEqual(['Discard your changes?']);
    ds.release('delete');
    expect(await run).toMatchObject({ done: false, reason: 'cannot', stoppedAt: 0 });
    expect(ds.records[1]).toBeUndefined();
    expect(form.getState()).toMatchObject({ recordId: 2, unsent: ['phone'], values: { ref: '' } });
  });
});

describe('the person’s claims on what they changed', () => {
  async function savedOnce(page: Page = lead) {
    const ds = source();
    const form = await opened(ds, {}, page);
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    return { ds, form };
  }

  it('told by the line: a line changed back to as saved is no longer at risk, though a step added another', async () => {
    const { form } = await savedOnce();
    form.updateLine('lines', 'r1', 'area', 45);
    expect((await form.runAction('b-room')).done).toBe(true);
    expect(form.getState().unsent).toEqual(['lines']);
    form.updateLine('lines', 'r1', 'area', 40);
    expect(form.getState()).toMatchObject({ unsent: [], dirty: ['lines'] });
    // A line of the person's own, added and taken away: theirs, and at risk while it is there.
    const key = form.addLine('lines', { label: 'Garden' });
    expect(form.getState().unsent).toEqual(['lines']);
    form.removeLine('lines', key);
    expect(form.getState().unsent).toEqual([]);
    // A line of the record taken away by the person: at risk.
    form.removeLine('lines', 'r1');
    expect(form.getState().unsent).toEqual(['lines']);
  });

  it('a change’s steps keep the person’s claim on what they work out, and make nothing else theirs', async () => {
    const page: Page = { ...lead, on: { change: { budget: [{ do: 'set', field: 'budget', value: 'round(budget, -3)' }, { do: 'set', field: 'ref', value: "'priced'" }] } } };
    const { form } = await savedOnce(page);
    form.setValue('budget', 4321987);
    await form.settled();
    expect(form.getState()).toMatchObject({ values: { budget: 4322000, ref: 'priced' }, unsent: ['budget'] });
    // A step of any other run, or the app, writing the field takes it over, as before.
    form.setValues({ budget: 4100000 });
    expect(form.getState().unsent).toEqual([]);
  });
});

describe('a conflict waiting, Discard and the files, a locked record, the record as saved', () => {
  it('a conflict waiting is the person’s work at risk: asked about, and kept on Cancel; a source with no versions has none', async () => {
    const ds = source({ versions: true });
    const made = host([false, true]);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    expect(workAtRisk(form.getState())).toBe(false);
    ds.savedElsewhere();
    expect(await form.save()).toBe(false);
    expect(workAtRisk(form.getState())).toBe(true);
    expect(await form.openRecord(2)).toBe(false);
    expect(form.getState()).toMatchObject({ recordId: 1, values: { phone: '+201009998887' } });
    expect(form.getState().conflict).not.toBeNull();
    // Let go by the app's own way out: asked once, and nothing is at risk after.
    expect(await form.leave()).toBe(true);
    expect(form.leaveNow()).toBe(true);
    expect(made.asked).toEqual(['Discard your changes?', 'Discard your changes?']);
    // As in 0.20: a change not saved before a record's first save goes unasked.
    const plain = await opened(source(), { host: made.host });
    plain.setValue('phone', '+201009998887');
    expect(await plain.openRecord(2)).toBe(true);
    expect(made.asked).toHaveLength(2);
  });

  it('the person’s Discard stops a file on its way at once, never waiting for it', async () => {
    const ds = source({ upload: true });
    const form = await opened(ds);
    ds.hold('upload');
    form.upload('doc', [deed]);
    await until(() => ds.held('upload'));
    expect(form.leaveNow({ discard: true })).toBe(false);
    expect(await form.leave({ discard: true })).toBe(true);
    expect(form.getState().uploads).toEqual([]);
    ds.release('upload');
    await form.settled();
    expect(form.getState().values['doc']).toBeNull();
  });

  it('Duplicate of a record its own save locked: what was typed is asked about, never saved again and refused', async () => {
    const ds = source({ lockOnSave: true });
    const made = host([false]);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    expect(form.getState().can).toMatchObject({ edit: false });
    form.setValues({ budget: 4100000 });
    form.setValue('ref', 'typed after');
    expect(await form.run([{ do: 'duplicate' }])).toMatchObject({ done: false, reason: 'no' });
    expect(made.asked).toEqual(['Discard your changes?']);
    expect(ds.calls.filter((call) => call === 'save')).toHaveLength(1);
    expect(ds.calls).not.toContain('copy');
  });

  it('Discard lets the person’s changes no save took go back to the record as saved — a table’s lines alone — and keeps what steps wrote', async () => {
    const ds = source();
    const made = host([true]);
    const form = await opened(ds, { host: made.host });
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    form.setValue('budget', 4300000);
    form.updateLine('lines', 'r1', 'area', 45);
    const garden = form.addLine('lines', { label: 'Garden' });
    expect((await form.runAction('b-room')).done).toBe(true);
    form.setValues({ ref: 'by the app' });
    expect(form.getState().unsent).toEqual(['budget', 'lines']);
    expect(await form.leave()).toBe(true);
    const lines = form.getState().values['lines'] as unknown as Line[];
    expect(form.getState()).toMatchObject({ unsent: [], values: { phone: '+201009998887', budget: 4000000, ref: 'by the app' } });
    expect(lines.map((line) => [line.key, line.values['label'], line.values['area']])).toEqual([
      ['r1', 'Hall', 40],
      [expect.stringMatching(/^new-/), 'Roof', null],
    ]);
    expect(lines.some((line) => line.key === garden)).toBe(false);
  });

  it('a save tells the record as it saved it: a change typed while it was on its way is none of it', async () => {
    const ds = source();
    const form = await opened(ds);
    const told: Values[] = [];
    form.on('save', ({ values }) => void told.push(values as Values));
    form.setValue('phone', '+201009998887');
    ds.hold('save');
    const saving = form.save();
    await until(() => ds.held('save'));
    form.setValue('budget', 4300000);
    ds.release('save');
    expect(await saving).toBe(true);
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ phone: '+201009998887', budget: 4000000 });
    expect(form.getState().values['budget']).toBe(4300000);
    expect((told[0]['lines'] as unknown as Line[])[0].values).toMatchObject({ label: 'Hall' });
  });
});
