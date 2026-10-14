import type { ActionStep } from '../format/actions';
import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import type { DataSource, SaveRequest } from './data-source';
import { createForm, workAtRisk, type Form, type FormOptions } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { ActionHost, ActionResult } from './run';
import type { RecordId, Values } from './values';

/**
 * One check before a form's values go (docs/plans/wave1-contract.md, section
 * 10): every operation that replaces or abandons them — another record, the
 * record loaded again, the form closed by the app's own close — goes through
 * `form.leave()`, inside the form. It asks only about the person's work at
 * risk: their changes a save went through without, files on their way,
 * changes set aside. Nothing at risk: as in 0.20, asking nothing.
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
    // Worked out from the budget: never the person's change.
    thousands: { type: 'float', label: 'In thousands', compute: 'budget / 1000' },
    ref: { type: 'char', label: 'Reference' },
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
          { type: 'field', id: 'f-thousands', field: 'thousands' },
          { type: 'field', id: 'f-ref', field: 'ref' },
        ],
      },
    ],
  },
};

const leads = (): Record<string, Values> => ({
  1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', budget: 4000000, ref: '', active: true },
  2: { name: 'Flat in Maadi', phone: '+201112223334', budget: 2500000, ref: '', active: true },
});

/**
 * A source with none of 0.21's new members — no upload, no versions, no
 * permissions, no totals: load, save, copy, delete and archive, as a 0.20 app
 * gives them. `hold()` keeps the next save on its way until it is let go, so a
 * test can type while it is.
 */
function plainSource() {
  const records = leads();
  let next = 3;
  const calls: { method: string; request: unknown }[] = [];
  const held: (() => void)[] = [];
  let holding = 0;
  let asked: () => void = () => undefined;
  let saveAsked = new Promise<void>((resolve) => (asked = resolve));
  const source = {
    records,
    calls,
    /** The next save waits for `release`; `saveAsked` settles once it is asked. */
    hold() {
      holding++;
      saveAsked = new Promise<void>((resolve) => (asked = resolve));
    },
    get saveAsked() {
      return saveAsked;
    },
    release() {
      held.shift()?.();
    },
    async load({ id }: { id: RecordId }) {
      calls.push({ method: 'load', request: { id } });
      return { ...records[id as number] };
    },
    async save(request: SaveRequest) {
      calls.push({ method: 'save', request });
      if (holding) {
        holding--;
        const waiting = new Promise<void>((resolve) => held.push(resolve));
        asked();
        await waiting;
      }
      const id = (request.id ?? next++) as number;
      records[id] = { ...(records[id] ?? {}), ...request.values };
      return { id };
    },
    async copy({ id }: { id: RecordId }) {
      calls.push({ method: 'copy', request: { id } });
      const copy = next++;
      records[copy] = { ...records[id as number], name: `${records[id as number]['name']} (copy)` };
      return { id: copy };
    },
    async delete({ id }: { id: RecordId }) {
      calls.push({ method: 'delete', request: { id } });
      delete records[id as number];
    },
    async archive({ id, archive }: { id: RecordId; archive: boolean }) {
      calls.push({ method: 'archive', request: { id, archive } });
      records[id as number] = { ...records[id as number], active: !archive };
    },
  } satisfies DataSource & Record<string, unknown>;
  return source;
}
type Plain = ReturnType<typeof plainSource>;

/** A host that answers each question as told, and keeps what it was asked; its own close counted, as an app's modal's. */
function host(answer: boolean | boolean[] = false) {
  const answers = Array.isArray(answer) ? [...answer] : null;
  const asked: { message: string; how?: { discard?: boolean } }[] = [];
  const closed: number[] = [];
  const urls: string[] = [];
  const made: ActionHost = {
    open: async () => ({ saved: false }),
    say: () => undefined,
    ask: async (message, how) => {
      asked.push({ message, ...(how ? { how } : {}) });
      return answers ? (answers.shift() ?? false) : (answer as boolean);
    },
    close: () => void closed.push(closed.length + 1),
    openUrl: (url) => void urls.push(url),
  };
  return { host: made, asked, closed, urls };
}

const DISCARD = { message: 'Discard your changes?', how: { discard: true } };

async function opened(ds: DataSource, more: Partial<FormOptions> = {}, id: RecordId = 1): Promise<Form> {
  const form = createForm({ page: lead, dataSource: ds, recordId: id, ...more });
  await form.load();
  await form.settled();
  return form;
}

/** Start `go` — a save, or a run that saves — and type the budget while its save is on its way. */
async function typedWhileSaving<T>(form: Form, ds: Plain, go: () => Promise<T>, field = 'budget', value: Values[string] = 4300000): Promise<T> {
  ds.hold();
  const running = go();
  await ds.saveAsked;
  form.setValue(field, value);
  ds.release();
  return running;
}

const count = (ds: Plain, method: string) => ds.calls.filter((call) => call.method === method).length;

beforeAll(() => expect(validatePage(lead).ok).toBe(true));

describe('the person’s work at risk: their changes a save went through without, told by origin', () => {
  it('a change the person made while the save was on its way is unsent; one the save took, or changed back, is not', async () => {
    const ds = plainSource();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    expect(await typedWhileSaving(form, ds, () => form.save())).toBe(true);
    // The thousands follow the budget, worked out: never the person's change, never at risk.
    expect(form.getState()).toMatchObject({ dirty: ['budget', 'thousands'], unsent: ['budget'] });
    expect(workAtRisk(form.getState())).toBe(true);
    // Changed back to the value stored: nothing at risk.
    form.setValue('budget', 4000000);
    expect(form.getState().unsent).toEqual([]);
    form.setValue('budget', 4300000);
    expect(form.getState().unsent).toEqual([]);
    // A change not saved that no save was asked for is not at risk: as in 0.20, the way out decides.
    expect(workAtRisk(form.getState())).toBe(false);
  });

  it('values the page’s own steps, the app, a rule or an afterSave run set while it saves are never the person’s', async () => {
    const ds = plainSource();
    const page: Page = { ...lead, on: { afterSave: [{ do: 'set', field: 'ref', value: "'R-1'" }] } };
    const form = createForm({ page, dataSource: ds, recordId: 1, onAction: () => ({ values: { phone: '+201000000000' } }) });
    await form.load();
    form.setValue('phone', '+201009998887');
    ds.hold();
    const saving = form.save();
    await ds.saveAsked;
    // The app's change, and a step's, while it saves.
    form.setValues({ name: 'Villa, Sheikh Zayed' });
    await form.run([{ do: 'set', field: 'budget', value: '4100000' }]);
    ds.release();
    expect(await saving).toBe(true);
    await form.settled();
    expect(form.getState().values['ref']).toBe('R-1');
    expect(form.getState().dirty.length).toBeGreaterThan(0);
    expect(form.getState().unsent).toEqual([]);
    expect(workAtRisk(form.getState())).toBe(false);
  });

  it('a change the person made while a run that saved goes on — its afterSave run among them — is at risk too', async () => {
    const ds = plainSource();
    let answer!: (result: ActionResult) => void;
    const form = await opened(ds, { onAction: () => new Promise<ActionResult>((resolve) => (answer = resolve)) });
    const run = form.run([{ do: 'save' }, { do: 'call', action: 'slow' }]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    form.setValue('budget', 4300000);
    expect(form.getState().unsent).toEqual(['budget']);
    answer({});
    expect((await run).done).toBe(true);
  });
});

describe('form.leave(): the one check', () => {
  async function atRisk(more: Partial<FormOptions> = {}) {
    const ds = plainSource();
    const form = await opened(ds, more);
    await typedWhileSaving(form, ds, () => form.save());
    return { ds, form };
  }

  it('nothing at risk: true at once, nothing asked', async () => {
    const { host: made, asked } = host();
    const form = await opened(plainSource(), { host: made });
    form.setValue('phone', '+201009998887');
    expect(await form.leave()).toBe(true);
    expect(asked).toEqual([]);
  });

  it('work at risk: “Discard your changes?” through the host, as a discard; Cancel keeps it, Discard lets it go', async () => {
    const { host: made, asked } = host([false, true]);
    const { form } = await atRisk({ host: made });
    expect(await form.leave()).toBe(false);
    expect(asked).toEqual([DISCARD]);
    expect(form.getState()).toMatchObject({ unsent: ['budget'] });
    expect(form.getState().values['budget']).toBe(4300000);
    expect(await form.leave()).toBe(true);
    expect(form.getState().unsent).toEqual([]);
    // Let go once: not asked again.
    expect(await form.leave()).toBe(true);
    expect(asked).toHaveLength(2);
  });

  it('`changes`: every change not saved counts, as a panel’s Escape has always asked', async () => {
    const { host: made, asked } = host(false);
    const form = await opened(plainSource(), { host: made });
    form.setValues({ ref: 'R-1' });
    expect(await form.leave()).toBe(true);
    expect(await form.leave({ changes: true })).toBe(false);
    expect(asked).toEqual([DISCARD]);
  });

  it('asks `confirm` without a host; with neither, the work is kept', async () => {
    const asked: string[] = [];
    const { form } = await atRisk({ confirm: (message) => (asked.push(message), true) });
    expect(await form.leave()).toBe(true);
    expect(asked).toEqual(['Discard your changes?']);
    const alone = await atRisk();
    expect(await alone.form.leave()).toBe(false);
    expect(alone.form.getState().unsent).toEqual(['budget']);
  });
});

describe('every way the values go passes the check (each fails without it)', () => {
  /** Record 1, the budget typed while a save was on its way: at risk. */
  async function atRisk(answer: boolean | boolean[] = false, more: Partial<FormOptions> = {}) {
    const ds = plainSource();
    const asking = host(answer);
    const form = await opened(ds, { host: asking.host, ...more });
    form.setValue('phone', '+201009998887');
    await typedWhileSaving(form, ds, () => form.save());
    expect(form.getState().unsent).toEqual(['budget']);
    return { ds, form, ...asking };
  }
  const kept = (form: Form) => {
    expect(form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'] });
    expect(form.getState().values['budget']).toBe(4300000);
  };

  it('1. form.openRecord(id), and openRecord(null): asked; Cancel stays, Discard shows it', async () => {
    const { form, asked } = await atRisk([false, false, true]);
    expect(await form.openRecord(2)).toBe(false);
    expect(await form.openRecord(null)).toBe(false);
    kept(form);
    expect(asked).toEqual([DISCARD, DISCARD]);
    expect(await form.openRecord(2)).toBe(true);
    expect(form.getState()).toMatchObject({ recordId: 2, unsent: [], dirty: [] });
  });

  it('2. an action’s answer naming a record: asked', async () => {
    const { form, asked } = await atRisk(false, { onAction: () => ({ record: 2 }) });
    expect(await form.run([{ do: 'call', action: 'next_lead' }])).toMatchObject({ done: false, reason: 'no', message: 'Discard your changes?' });
    expect(asked).toEqual([DISCARD]);
    kept(form);
  });

  it('3. Duplicate through the source: saves first, as always; a change typed during that save is asked about before any copy is made', async () => {
    const ds = plainSource();
    const asking = host(false);
    const form = await opened(ds, { host: asking.host });
    form.setValue('phone', '+201009998887');
    expect(await typedWhileSaving(form, ds, () => form.runAction('m-duplicate'))).toMatchObject({ done: false, reason: 'no' });
    expect(asking.asked).toEqual([DISCARD]);
    expect(count(ds, 'copy')).toBe(0);
    kept(form);
  });

  it('4. Duplicate through the app’s action, no copy in the source: asked once, then the record its answer names shows', async () => {
    const ds = plainSource();
    const { copy: _copy, ...noCopy } = ds;
    const asking = host(true);
    const form = await opened(noCopy as DataSource, { host: asking.host, onAction: ({ action }) => (action === 'duplicate' ? { record: 2 } : undefined) });
    form.setValue('phone', '+201009998887');
    expect(await typedWhileSaving(form, ds, () => form.runAction('m-duplicate'))).toMatchObject({ done: true });
    expect(asking.asked).toEqual([DISCARD]);
    expect(form.getState()).toMatchObject({ recordId: 2, unsent: [] });
  });

  it('5. Delete: the person chose it, and their work goes with the record: nothing asked, a new record shows', async () => {
    const { ds, form, asked } = await atRisk();
    expect(await form.runAction('m-delete')).toMatchObject({ done: false, reason: 'no' });
    // The delete's own question was answered No: nothing deleted.
    expect(count(ds, 'delete')).toBe(0);
    const yes = await atRisk([true]);
    expect((await yes.form.runAction('m-delete')).done).toBe(true);
    await yes.form.settled();
    expect(yes.asked).toEqual([{ message: 'Are you sure you want to delete this record?' }]);
    expect(yes.form.getState()).toMatchObject({ recordId: null, unsent: [] });
    expect(asked).toEqual([{ message: 'Are you sure you want to delete this record?' }]);
  });

  it('6. Archive: asked before anything is archived', async () => {
    const { ds, form, asked } = await atRisk([true, false]);
    expect(await form.runAction('m-archive')).toMatchObject({ done: false, reason: 'no' });
    expect(asked).toEqual([{ message: 'Are you sure that you want to archive this record?' }, DISCARD]);
    expect(count(ds, 'archive')).toBe(0);
    kept(form);
  });

  it('7. a `reload` step: asked', async () => {
    const { ds, form, asked } = await atRisk();
    const loads = count(ds, 'load');
    expect(await form.run([{ do: 'reload' }])).toMatchObject({ done: false, reason: 'no' });
    expect(asked).toEqual([DISCARD]);
    expect(count(ds, 'load')).toBe(loads);
    kept(form);
  });

  it('8. an action’s answer { reload: true }: asked', async () => {
    const { form, asked } = await atRisk(false, { onAction: () => ({ reload: true }) });
    expect(await form.run([{ do: 'call', action: 'confirm' }])).toMatchObject({ done: false, reason: 'no' });
    expect(asked).toEqual([DISCARD]);
    kept(form);
  });

  it('9. form.load() called again by the app: asked', async () => {
    const { form, asked } = await atRisk();
    await form.load();
    expect(asked).toEqual([DISCARD]);
    kept(form);
  });

  it('10. a `reset` step: asked; Discard resets', async () => {
    const { form, asked } = await atRisk([false, true]);
    expect(await form.run([{ do: 'reset' }])).toMatchObject({ done: false, reason: 'no' });
    kept(form);
    expect((await form.run([{ do: 'reset' }])).done).toBe(true);
    expect(asked).toEqual([DISCARD, DISCARD]);
    expect(form.getState()).toMatchObject({ dirty: [], unsent: [] });
  });

  it('11. a `close` step through the app’s own host.close: asked first; closed once, on Discard', async () => {
    const { form, asked, closed } = await atRisk([false, true]);
    expect(await form.run([{ do: 'close' }])).toMatchObject({ done: false, reason: 'no' });
    expect(closed).toEqual([]);
    kept(form);
    expect((await form.run([{ do: 'close' }])).done).toBe(true);
    expect(closed).toEqual([1]);
    expect(asked).toEqual([DISCARD, DISCARD]);
  });

  it('12. an `openUrl` step in this tab: asked; a new tab leaves the form as it is, asking nothing', async () => {
    const { form, asked, urls } = await atRisk();
    expect((await form.run([{ do: 'openUrl', url: "'https://example.com/a'" }])).done).toBe(true);
    expect(asked).toEqual([]);
    expect(await form.run([{ do: 'openUrl', url: "'https://example.com/b'", newTab: false }])).toMatchObject({ done: false, reason: 'no' });
    expect(asked).toEqual([DISCARD]);
    expect(urls).toEqual(['https://example.com/a']);
  });

  it('a saved form placed in the record: its own steps’ ways out are the record’s, asked once', async () => {
    const consent: Page = {
      fieldia: '0.1',
      id: 'consent',
      title: 'Consent',
      data: { kind: 'responses' },
      fields: { agree: { type: 'boolean', label: 'I agree' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-agree', field: 'agree' }] },
    };
    const placed: Page = { ...lead, fields: { ...lead.fields }, layout: { ...(lead.layout as Extract<Page['layout'], { type: 'sheet' }>), children: [...(lead.layout as Extract<Page['layout'], { type: 'sheet' }>).children, { type: 'form', id: 'p-consent', name: 'consent', page: 'consent' }] } };
    const ds = plainSource();
    const asking = host(false);
    const form = createForm({ page: placed, dataSource: ds, recordId: 1, host: asking.host });
    await form.load();
    const inner = form.embed('p-consent', consent);
    await typedWhileSaving(form, ds, () => form.save());
    expect(await inner.run([{ do: 'close' }])).toMatchObject({ done: false, reason: 'no' });
    expect(asking.asked).toEqual([DISCARD]);
    expect(asking.closed).toEqual([]);
  });
});

describe('the six blocking probes of round 3', () => {
  it('1. the page’s own afterSave steps: a call answering { record } after a change typed during the save asks first', async () => {
    const ds = plainSource();
    const page: Page = { ...lead, on: { afterSave: [{ do: 'call', action: 'next_lead' }] } };
    const asking = host(false);
    const form = createForm({ page, dataSource: ds, recordId: 1, host: asking.host, onAction: ({ action }) => (action === 'next_lead' ? { record: 2 } : undefined) });
    await form.load();
    form.setValue('phone', '+201009998887');
    expect(await typedWhileSaving(form, ds, () => form.save())).toBe(true);
    await form.settled();
    expect(asking.asked).toEqual([DISCARD]);
    expect(form.getState()).toMatchObject({ recordId: 1, unsent: ['budget'] });
    expect(form.getState().values['budget']).toBe(4300000);
    expect(ds.records[1]).toMatchObject({ phone: '+201009998887', budget: 4000000 });
  });

  it('2. a reload after a save — the step, and an answer { reload: true } — asks about a change typed during it', async () => {
    for (const steps of [[{ do: 'save' }, { do: 'reload' }], [{ do: 'save' }, { do: 'call', action: 'confirm' }]] as ActionStep[][]) {
      const ds = plainSource();
      const asking = host(false);
      const form = await opened(ds, { host: asking.host, onAction: () => ({ reload: true }) });
      form.setValue('phone', '+201009998887');
      expect(await typedWhileSaving(form, ds, () => form.run(steps))).toMatchObject({ done: false, reason: 'no' });
      expect(asking.asked).toEqual([DISCARD]);
      expect(form.getState().values['budget']).toBe(4300000);
    }
  });

  it('3. [save, close] with the app’s own host.close: asked, not closed on Cancel', async () => {
    const ds = plainSource();
    const asking = host(false);
    const form = await opened(ds, { host: asking.host });
    form.setValue('phone', '+201009998887');
    expect(await typedWhileSaving(form, ds, () => form.run([{ do: 'save' }, { do: 'close' }]))).toMatchObject({ done: false, reason: 'no' });
    expect(asking.asked).toEqual([DISCARD]);
    expect(asking.closed).toEqual([]);
    expect(form.getState().values['budget']).toBe(4300000);
  });

  it('6. values set by the page’s own afterSave steps are not the person’s work: nothing asked at any way out', async () => {
    const ds = plainSource();
    const page: Page = { ...lead, on: { afterSave: [{ do: 'set', field: 'ref', value: "'R-1'" }] } };
    const asking = host(false);
    const form = createForm({ page, dataSource: ds, recordId: 1, host: asking.host, onAction: () => ({ record: 2 }) });
    await form.load();
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    await form.settled();
    expect(form.getState()).toMatchObject({ dirty: ['ref'], unsent: [] });
    expect(workAtRisk(form.getState())).toBe(false);
    expect((await form.run([{ do: 'close' }])).done).toBe(true);
    expect(await form.leave()).toBe(true);
    expect((await form.run([{ do: 'call', action: 'next' }])).done).toBe(true);
    expect(form.getState().recordId).toBe(2);
    expect(asking.asked).toEqual([]);
  });

  it('6. a page of answers whose afterSave resets or sets a value: nothing at risk once sent', async () => {
    for (const afterSave of [[{ do: 'reset' }], [{ do: 'set', field: 'ref', value: "'R-1'" }]] as ActionStep[][]) {
      const survey: Page = {
        fieldia: '0.1',
        id: 'survey',
        title: 'Survey',
        data: { kind: 'responses' },
        fields: { name: { type: 'char', label: 'Name' }, ref: { type: 'char', label: 'Reference' } },
        layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
        on: { afterSave: afterSave },
      };
      const ds = createMemoryDataSource({});
      const form = createForm({ page: survey, dataSource: ds });
      form.setValue('name', 'Sara');
      expect(await form.save()).toBe(true);
      await form.settled();
      expect(workAtRisk(form.getState())).toBe(false);
    }
  });
});

describe('as in 0.20: an app with none of the new members, afterSave steps setting values', () => {
  it('asks nothing on any way out, saves and copies as before, and drops a change not saved where a step leaves', async () => {
    const ds = plainSource();
    const page: Page = { ...lead, on: { afterSave: [{ do: 'set', field: 'ref', value: "'R-1'" }, { do: 'set', field: 'name', value: "name + ' ✓'" }] } };
    const asking = host(false);
    const make = async (onAction?: FormOptions['onAction']) => {
      const form = createForm({ page, dataSource: ds, recordId: 1, host: asking.host, ...(onAction ? { onAction } : {}) });
      await form.load();
      await form.settled();
      return form;
    };
    // Save, its afterSave setting values, then every way out.
    const form = await make(() => ({ record: 2 }));
    form.setValue('phone', '+201009998887');
    expect((await form.run([{ do: 'save' }, { do: 'close' }])).done).toBe(true);
    await form.settled();
    expect(asking.closed).toEqual([1]);
    expect(form.getState().values['ref']).toBe('R-1');
    expect((await form.run([{ do: 'save' }, { do: 'reload' }])).done).toBe(true);
    expect((await form.run([{ do: 'save' }, { do: 'call', action: 'next' }])).done).toBe(true);
    expect(form.getState().recordId).toBe(2);
    expect(await form.openRecord(1)).toBe(true);
    await form.settled();
    form.setValue('phone', '+201007776665');
    expect((await form.runAction('m-duplicate')).done).toBe(true);
    await form.settled();
    expect(form.getState().recordId).toBe(3);
    expect(ds.records[3]).toMatchObject({ phone: '+201007776665' });
    // A change not saved, and a step that leaves: dropped, as it always was.
    const other = await make(() => ({ record: 2 }));
    other.setValue('budget', 1);
    expect((await other.run([{ do: 'reload' }])).done).toBe(true);
    expect(other.getState().values['budget']).toBe(ds.records[1]['budget']);
    other.setValue('budget', 1);
    expect((await other.run([{ do: 'call', action: 'next' }])).done).toBe(true);
    expect(other.getState().recordId).toBe(2);
    other.setValue('budget', 1);
    expect((await other.run([{ do: 'reset' }, { do: 'close' }])).done).toBe(true);
    expect(asking.asked).toEqual([]);
  });
});
