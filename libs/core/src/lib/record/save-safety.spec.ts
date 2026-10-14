import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { ConflictError, type DataSource, type SaveRequest } from './data-source';
import { createForm, unsavedWork, type Form } from './form';
import { createMemoryDataSource, type MemoryDataSourceOptions } from './memory-data-source';
import { MESSAGES } from './messages';
import type { Scheduler } from './scheduler';
import type { Values } from './values';

/**
 * Save safety: a save over someone else's is refused as a conflict, with who
 * and when, and the person chooses Reload (theirs, with their own changes set
 * aside to put back) or Keep mine (theirs where they changed nothing, theirs
 * over that). And what the source says the person may do with the record —
 * edit it, delete, archive or duplicate it, change or see each field — the
 * form keeps to, before any source is asked.
 */

const lead: Page = {
  fieldia: '0.1',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    phone: { type: 'char', label: 'Phone' },
    stage: { type: 'selection', label: 'Stage', options: [{ value: 'new', label: 'New' }, { value: 'visit', label: 'Visit' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }] },
    agent: { type: 'many2one', label: 'Agent', relation: 'res.users' },
    budget: { type: 'float', label: 'Budget' },
    commission: { type: 'float', label: 'Commission', required: true },
    active: { type: 'boolean', label: 'Active', default: true },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    statusbar: { field: 'stage', clickable: true },
    toolbar: {
      menu: [
        { id: 'm-archive', builtin: 'archive' },
        { id: 'm-unarchive', builtin: 'unarchive' },
        { id: 'm-duplicate', builtin: 'duplicate' },
        { id: 'm-delete', builtin: 'delete' },
        { id: 'm-print', label: 'Brochure', group: 'print', action: 'print_brochure' },
      ],
    },
    buttons: [
      { type: 'button', id: 'win', label: 'Mark won', steps: [{ do: 'set', field: 'stage', value: "'won'" }, { do: 'save' }] },
      { type: 'button', id: 'drop', label: 'Drop it', steps: [{ do: 'ask', message: 'Drop this lead?' }, { do: 'delete' }] },
      { type: 'button', id: 'call', label: 'Call', action: 'call_owner' },
    ],
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-phone', field: 'phone' },
          { type: 'field', id: 'f-agent', field: 'agent' },
          { type: 'field', id: 'f-budget', field: 'budget' },
          { type: 'field', id: 'f-commission', field: 'commission' },
        ],
      },
    ],
  },
};

const leads = (): Record<string, Values> => ({
  1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', stage: 'new', agent: { id: 7, label: 'Mona' }, budget: 4000000, commission: 0.025, active: true },
  2: { name: 'Flat in Maadi', phone: '+201112223334', stage: 'won', agent: { id: 8, label: 'Omar' }, budget: 2500000, commission: 0.02, active: true },
});

/** Timers run by hand: every one due runs at `flush`. */
function manualScheduler(): Scheduler & { flush(): void } {
  const timers = new Map<number, () => void>();
  let next = 0;
  return {
    setTimeout: (run) => (timers.set(++next, run), next),
    clearTimeout: (handle) => void timers.delete(handle as number),
    flush() {
      for (const [id, run] of [...timers]) {
        timers.delete(id);
        run();
      }
    },
  };
}

const source = (more: MemoryDataSourceOptions = {}) => createMemoryDataSource({ records: { lead: leads() }, versions: { by: 'Sara' }, ...more });

async function opened(ds: DataSource, id = 1, more: Partial<Parameters<typeof createForm>[0]> = {}): Promise<Form> {
  const form = createForm({ page: lead, dataSource: ds, recordId: id, ...more });
  await form.load();
  await form.settled();
  return form;
}

const saves = (ds: ReturnType<typeof source>) => ds.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);

// The page these tests use is one a person could have made.
beforeAll(() => expect(validatePage(lead).ok).toBe(true));

describe('a record’s version: kept from its load, carried by each save', () => {
  it('keeps the version its load gives, sends it with the save, and keeps the one the save gives back', async () => {
    const ds = source();
    const form = await opened(ds);
    const first = form.getState().version;
    expect(first).toEqual({ token: expect.any(String) });
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    expect(saves(ds)[0].version).toEqual(first);
    const now = form.getState().version;
    expect(now).toEqual({ token: expect.any(String), by: 'Sara', at: expect.any(String) });
    expect(now?.token).not.toBe(first?.token);
    // The next save carries the new one, and is not refused as someone else's.
    form.setValue('phone', '+201000000001');
    expect(await form.save()).toBe(true);
    expect(saves(ds)[1].version).toEqual(now);
  });

  it('sends none for a new record, nor from a source that tells none', async () => {
    const ds = source();
    const fresh = createForm({ page: lead, dataSource: ds, values: { name: 'Chalet in Sahel', commission: 0.01 } });
    expect(fresh.getState().version).toBeNull();
    expect(await fresh.save()).toBe(true);
    expect(saves(ds)[0]).not.toHaveProperty('version');
    const plain = createMemoryDataSource({ records: { lead: leads() } });
    const form = await opened(plain);
    expect(form.getState()).toMatchObject({ version: null, can: null, conflict: null, setAside: null });
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    expect(saves(plain)[0]).not.toHaveProperty('version');
  });

  it('forgets the version and what was allowed when it shows another record or a new one', async () => {
    const ds = source({ can: { lead: () => ({ delete: false }) } });
    const form = await opened(ds);
    expect(form.getState().can).toEqual({ delete: false });
    await form.openRecord(null);
    expect(form.getState()).toMatchObject({ version: null, can: null });
    await form.openRecord(2);
    expect(form.getState().version).toEqual({ token: expect.any(String) });
  });
});

describe('a save over someone else’s: a conflict, with Reload and Keep mine', () => {
  it('is refused, naming who changed the record and when, what they changed, and keeping every change of mine', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    form.setValue('budget', 4200000);
    ds.changeElsewhere('lead', 1, { stage: 'visit', budget: 4500000 }, { by: 'Mona', at: '2026-10-13T10:42:00Z' });
    expect(await form.save()).toBe(false);
    const state = form.getState();
    expect(state.status).toBe('error');
    expect(state.saveProblem?.kind).toBe('conflict');
    expect(state.conflict).toMatchObject({ version: { by: 'Mona', at: '2026-10-13T10:42:00Z' }, changed: ['stage', 'budget'], both: ['budget'] });
    expect(state.conflict?.theirs).toMatchObject({ stage: 'visit', budget: 4500000 });
    // Nothing of mine is lost: the form holds my changes, still to save.
    expect(state.values).toMatchObject({ phone: '+201009998887', budget: 4200000, stage: 'new' });
    expect(state.dirty).toEqual(['phone', 'budget']);
    // And the record holds theirs alone.
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201001234567', budget: 4500000, stage: 'visit' });
  });

  it('reads a link as the same record by its id, so a name shown differently is no change of theirs', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { agent: { id: 7, label: 'Mona Adel' }, budget: 4100000 }, { by: 'Mona' });
    await form.save();
    expect(form.getState().conflict?.changed).toEqual(['budget']);
    expect(form.getState().conflict?.both).toEqual([]);
  });

  it('Reload shows the record as they left it, and sets my changes aside to put back, one by one', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    form.setValue('budget', 4200000);
    ds.changeElsewhere('lead', 1, { stage: 'visit', budget: 4500000 }, { by: 'Mona' });
    await form.save();
    expect(await form.reloadTheirs()).toBe(true);
    const state = form.getState();
    expect(state).toMatchObject({ status: 'ready', saveProblem: null, conflict: null, dirty: [] });
    expect(state.values).toMatchObject({ phone: '+201001234567', budget: 4500000, stage: 'visit' });
    expect(state.version).toMatchObject({ by: 'Mona' });
    expect(state.setAside).toEqual({ phone: '+201009998887', budget: 4200000 });
    // Put back, it is my change again, to save over theirs.
    form.putBack('phone');
    expect(form.getState().values['phone']).toBe('+201009998887');
    expect(form.getState().dirty).toEqual(['phone']);
    expect(form.getState().setAside).toEqual({ budget: 4200000 });
    expect(await form.save()).toBe(true);
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887', budget: 4500000, stage: 'visit' });
    // What is left can be let go.
    form.discardSetAside();
    expect(form.getState().setAside).toBeNull();
  });

  it('Reload sets nothing aside that they changed the same way, and puts all back at once', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    form.setValue('budget', 4500000);
    ds.changeElsewhere('lead', 1, { budget: 4500000 }, { by: 'Mona' });
    await form.save();
    await form.reloadTheirs();
    expect(form.getState().setAside).toEqual({ phone: '+201009998887' });
    form.putBack();
    expect(form.getState()).toMatchObject({ setAside: null, dirty: ['phone'] });
  });

  it('Keep mine saves my changes over the record as it is now: theirs stay wherever I changed nothing', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    await form.save();
    const theirs = form.getState().conflict?.version;
    expect(await form.keepMine()).toBe(true);
    const sent = saves(ds)[1];
    expect(sent.version).toEqual(theirs);
    expect(sent.changes.values).toEqual({ phone: '+201009998887' });
    // A source that saves whole records gets theirs with mine over it.
    expect(sent.values).toMatchObject({ phone: '+201009998887', stage: 'visit' });
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887', stage: 'visit' });
    expect(form.getState()).toMatchObject({ status: 'saved', conflict: null, saveProblem: null, dirty: [] });
    expect(form.getState().values['stage']).toBe('visit');
  });

  it('Keep mine, told no record as they left it, reads it first: a source that saves whole records keeps their changes', async () => {
    const ds = source();
    // A source whose conflict names who and when, but not the record.
    const whole: DataSource = {
      ...ds,
      async save(request) {
        try {
          return await ds.save(request);
        } catch (error) {
          throw error instanceof ConflictError ? new ConflictError({ version: error.conflict.version }) : error;
        }
      },
    };
    const form = await opened(whole);
    form.setValue('phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    await form.save();
    expect(form.getState().conflict?.theirs).toBeUndefined();
    expect(await form.keepMine()).toBe(true);
    const sent = saves(ds)[1];
    expect(sent.changes.values).toEqual({ phone: '+201009998887' });
    expect(sent.values).toMatchObject({ phone: '+201009998887', stage: 'visit' });
    expect(form.getState().values['stage']).toBe('visit');
  });

  it('Keep mine meets another conflict when a third person saved in between', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    await form.save();
    ds.changeElsewhere('lead', 1, { stage: 'lost' }, { by: 'Omar' });
    expect(await form.keepMine()).toBe(false);
    expect(form.getState().conflict?.version.by).toBe('Omar');
    expect(ds.records['lead'][1]['phone']).toBe('+201001234567');
  });

  it('a conflict, and what was set aside, go with Discard and with another record', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' });
    await form.save();
    form.reset();
    expect(form.getState()).toMatchObject({ conflict: null, saveProblem: null });
    form.setValue('phone', '+201009998887');
    await form.save();
    await form.reloadTheirs();
    expect(form.getState().setAside).not.toBeNull();
    await form.openRecord(2);
    expect(form.getState()).toMatchObject({ conflict: null, setAside: null });
  });
});

describe('what the person may do with a record, as its source says', () => {
  const guarded = (can: NonNullable<MemoryDataSourceOptions['can']>['lead']) => source({ can: { lead: can } });

  it('everything is allowed when the source says nothing, as before', async () => {
    const form = await opened(source());
    expect(form.getState().can).toBeNull();
    for (const id of ['m-archive', 'm-duplicate', 'm-delete', 'win', 'drop', 'f-phone']) expect(form.node(id).invisible).toBe(false);
    expect(form.node('f-phone').readonly).toBe(false);
  });

  it('may not edit: every field and the statusbar read-only, and a save refused before the source is asked, saying why', async () => {
    const ds = guarded(() => ({ edit: false, reason: 'Only Mona, the lead’s agent, can change it.' }));
    const form = await opened(ds);
    expect(form.getState().can).toEqual({ edit: false, reason: 'Only Mona, the lead’s agent, can change it.' });
    for (const id of ['#title', '#statusbar', 'f-phone', 'f-budget']) expect(form.node(id).readonly).toBe(true);
    expect(form.fieldReadonly('phone')).toBe(true);
    // A button that would save is not offered; one that only asks the app still is.
    expect(form.node('win').invisible).toBe(true);
    expect(form.node('call').invisible).toBe(false);
    form.setValues({ phone: '+201009998887' });
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem).toEqual({ kind: 'rule', message: 'Only Mona, the lead’s agent, can change it.' });
    expect(saves(ds)).toEqual([]);
  });

  it('may not edit: conditions read the record as not being edited, so parts for editing only go', async () => {
    const editingOnly: Page = { ...lead, layout: { ...(lead.layout as Extract<Page['layout'], { type: 'sheet' }>), buttons: [{ type: 'button', id: 'note', label: 'Add a note', action: 'note', invisible: 'not editing' }] } };
    const form = createForm({ page: editingOnly, dataSource: guarded(() => ({ edit: false })), recordId: 1 });
    await form.load();
    expect(form.node('note').invisible).toBe(true);
    await form.openRecord(null);
    expect(form.node('note').invisible).toBe(false);
  });

  it('may not edit, with no reason given: the form says so in its own words, in the page’s language', async () => {
    const form = await opened(guarded(() => ({ edit: false })), 1, { messages: MESSAGES.fr });
    form.setValues({ phone: '+201009998887' });
    await form.save();
    expect(form.getState().saveProblem).toEqual({ kind: 'rule', message: MESSAGES.fr.mayNotEdit });
    expect(MESSAGES.fr.mayNotEdit).not.toBe(MESSAGES.en.mayNotEdit);
  });

  it('may not edit: autosave does not try, so no refusal pops up unasked', async () => {
    const scheduler = manualScheduler();
    const ds = guarded(() => ({ edit: false }));
    const form = await opened(ds, 1, { autosave: { delayMs: 500 }, scheduler });
    form.setValues({ phone: '+201009998887' });
    scheduler.flush();
    await form.settled();
    expect(saves(ds)).toEqual([]);
    expect(form.getState()).toMatchObject({ status: 'ready', saveProblem: null });
  });

  it('may not delete, archive or duplicate: those items and the buttons that would do it are hidden, and refused if run', async () => {
    const ds = guarded(() => ({ delete: false, archive: false, duplicate: false, reason: 'Only a manager can.' }));
    const form = await opened(ds);
    for (const id of ['m-archive', 'm-unarchive', 'm-duplicate', 'm-delete', 'drop']) expect(form.node(id).invisible).toBe(true);
    // The rest stay: printing, the app's own action, and editing.
    for (const id of ['m-print', 'call', 'win']) expect(form.node(id).invisible).toBe(false);
    expect(form.node('f-phone').readonly).toBe(false);
    for (const step of ['delete', 'archive', 'duplicate'] as const) {
      const result = await form.run([{ do: step }]);
      expect(result).toMatchObject({ done: false, reason: 'cannot', message: 'Only a manager can.' });
    }
    expect(ds.calls.filter((call) => ['delete', 'archive', 'copy'].includes(call.method))).toEqual([]);
    const plain = await opened(guarded(() => ({ delete: false })));
    expect((await plain.run([{ do: 'delete' }])).message).toBe(MESSAGES.en.mayNotDelete);
  });

  it('may archive while the record is active and bring it back after, unless it may not archive at all', async () => {
    const ds = guarded((values) => (values['stage'] === 'won' ? { archive: false } : undefined));
    const form = await opened(ds, 1);
    expect(form.node('m-archive').invisible).toBe(false);
    await form.openRecord(2);
    expect(form.node('m-archive').invisible).toBe(true);
  });

  it('read-only fields lock alone; hidden fields are hidden, never asked for, and not sent', async () => {
    const ds = guarded(() => ({ readonlyFields: ['budget'], hiddenFields: ['commission'] }));
    const form = await opened(ds);
    expect(form.node('f-budget').readonly).toBe(true);
    expect(form.fieldReadonly('budget')).toBe(true);
    expect(form.node('f-phone').readonly).toBe(false);
    expect(form.node('f-commission').invisible).toBe(true);
    // Commission is required, and its value was left out: hidden, it is not asked for.
    expect(form.validate()).toBe(true);
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    expect(saves(ds)[0].values).not.toHaveProperty('commission');
    expect(ds.records['lead'][1]['commission']).toBe(0.025);
  });

  it('follows what a save says the person may do now: a stage that locks the record', async () => {
    const ds = guarded((values) => (values['stage'] === 'won' ? { edit: false, reason: 'A won lead is closed.' } : undefined));
    const form = await opened(ds);
    expect(form.node('f-phone').readonly).toBe(false);
    expect((await form.runAction('win')).done).toBe(true);
    expect(form.getState().can).toEqual({ edit: false, reason: 'A won lead is closed.' });
    expect(form.node('f-phone').readonly).toBe(true);
  });
});

describe('saving twice in a row is never a conflict with yourself', () => {
  it('a second save waits for the first and carries the version it got back: both go through, and no conflict is said', async () => {
    const ds = source({ delayMs: 20 });
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    // Ctrl+Enter, twice, quickly.
    const first = form.save();
    const second = form.save();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(form.getState()).toMatchObject({ status: 'saved', conflict: null, saveProblem: null, dirty: [] });
    const [a, b] = saves(ds);
    expect(b.version?.token).not.toBe(a.version?.token);
    expect(b.version).toEqual(expect.objectContaining({ by: 'Sara' }));
    expect(ds.records['lead'][1]['phone']).toBe('+201009998887');
  });

  it('a new record saved twice at once is made once: the second save is of the record the first made', async () => {
    const ds = source({ delayMs: 20 });
    const form = createForm({ page: lead, dataSource: ds, values: { name: 'Chalet in Sahel', commission: 0.01 } });
    const first = form.save();
    const second = form.save();
    expect([await first, await second]).toEqual([true, true]);
    expect(Object.keys(ds.records['lead'])).toHaveLength(3);
    const [a, b] = saves(ds);
    expect(a.id).toBeNull();
    expect(b.id).toBe(form.getState().recordId);
  });

  it('a save asked for while the first waits for its beforeSave steps runs after it, and a save those steps ask for runs inside it', async () => {
    const ds = source({ delayMs: 5 });
    const page: Page = { ...lead, on: { beforeSave: [{ do: 'set', field: 'budget', value: '4100000' }, { do: 'save' }] } };
    const form = createForm({ page, dataSource: ds, recordId: 1 });
    await form.load();
    form.setValue('phone', '+201009998887');
    const first = form.save();
    const second = form.save();
    const both = Promise.all([first, second]);
    // Never waiting on itself: both end.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ended = await Promise.race([both, new Promise((resolve) => (timer = setTimeout(() => resolve('stuck'), 2000)))]);
    clearTimeout(timer);
    expect(ended).toEqual([true, true]);
    expect(form.getState().conflict).toBeNull();
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887', budget: 4100000 });
  });
});

describe('Keep mine never saves blind', () => {
  /** A source whose conflict names who and when but not the record, and whose reads can fail. */
  function unreadable() {
    const ds = source();
    let down = false;
    const whole: DataSource = {
      ...ds,
      async load(request) {
        if (down) throw new TypeError('Failed to fetch');
        return ds.load(request);
      },
      async save(request) {
        try {
          return await ds.save(request);
        } catch (error) {
          throw error instanceof ConflictError ? new ConflictError({ version: error.conflict.version }) : error;
        }
      },
    };
    return { ds, whole, down: (is: boolean) => (down = is) };
  }

  it('their version cannot be read: nothing is saved over it, the person is told, and may try again once it can', async () => {
    const { ds, whole, down } = unreadable();
    const form = await opened(whole);
    form.setValue('phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { stage: 'visit', budget: 4500000 }, { by: 'Mona' });
    expect(await form.save()).toBe(false);
    down(true);
    expect(await form.keepMine()).toBe(false);
    // No save went out: Mona's work stands, and mine is still in the form, to save.
    expect(saves(ds)).toHaveLength(1);
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201001234567', stage: 'visit', budget: 4500000 });
    expect(form.getState()).toMatchObject({ status: 'error', error: MESSAGES.en.theirsUnread, conflict: { unread: true, version: { by: 'Mona' } }, dirty: ['phone'] });
    expect(form.getState().saveProblem).toMatchObject({ kind: 'conflict', message: MESSAGES.en.theirsUnread });
    down(false);
    expect(await form.keepMine()).toBe(true);
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887', stage: 'visit', budget: 4500000 });
    expect(form.getState()).toMatchObject({ status: 'saved', conflict: null });
  });

  it('a source with no load cannot tell theirs either: Keep mine saves nothing over it', async () => {
    let tries = 0;
    const blind: DataSource = {
      async save() {
        tries++;
        throw new ConflictError({ version: { token: 'v9', by: 'Mona' } });
      },
    };
    const form = createForm({ page: lead, dataSource: blind, recordId: 1, values: { name: 'Villa in Sheikh Zayed', commission: 0.02 } });
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(false);
    expect(await form.keepMine()).toBe(false);
    expect(tries).toBe(1);
    expect(form.getState().conflict).toMatchObject({ unread: true });
  });

  it('says so in Arabic, French and German too', () => {
    for (const locale of ['ar', 'fr', 'de'] as const) expect(MESSAGES[locale].theirsUnread).not.toBe(MESSAGES.en.theirsUnread);
  });
});

describe('after Reload, the changes set aside are work not saved', () => {
  it('counts as unsaved work until put back or let go, though nothing differs from the record', async () => {
    const ds = source();
    const form = await opened(ds);
    expect(unsavedWork(form.getState())).toBe(false);
    form.setValue('phone', '+201009998887');
    form.setValue('budget', 4200000);
    ds.changeElsewhere('lead', 1, { stage: 'visit', budget: 4500000 }, { by: 'Mona' });
    await form.save();
    await form.reloadTheirs();
    expect(form.getState().dirty).toEqual([]);
    expect(unsavedWork(form.getState())).toBe(true);
    form.putBack('phone');
    expect(unsavedWork(form.getState())).toBe(true);
    expect(await form.save()).toBe(true);
    // Budget is still set aside, unsaved.
    expect(unsavedWork(form.getState())).toBe(true);
    form.discardSetAside();
    expect(unsavedWork(form.getState())).toBe(false);
  });
});
