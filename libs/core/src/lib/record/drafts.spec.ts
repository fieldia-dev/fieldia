import { ownerOf } from './browser-kept';
import type { Page } from '../format/page';
import type { DataSource, SaveDraftRequest } from './data-source';
import { createForm, type DraftStore } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { Scheduler } from './scheduler';

/**
 * Save and resume on another device: drafts kept on the app's server (the data source's `saveDraft` and `loadDraft`,
 * docs/plans/wave1-contract.md's style: optional), the browser's store keeping only their key — or, without them,
 * the draft itself, as before — with the wizard's step and text typed that does not read; "Continue later"; a draft
 * opened by its key (`resume`), laid only on the form it was asked for and never over what was typed meanwhile.
 */

const intake = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.12',
    id: 'patient-intake',
    data: { kind: 'responses' },
    continueLater: true,
    fields: {
      name: { type: 'char', label: 'Full name', required: true },
      weight: { type: 'float', label: 'Weight' },
      allergies: { type: 'text', label: 'Allergies' },
      smoker: { type: 'boolean', label: 'Smoker' },
      consent: { type: 'boolean', label: 'I agree', required: true },
    },
    layout: {
      type: 'wizard',
      id: 'w',
      children: [
        { type: 'step', id: 'about', label: 'About you', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-weight', field: 'weight' }] },
        { type: 'step', id: 'health', label: 'Health', optional: true, children: [{ type: 'field', id: 'f-allergies', field: 'allergies' }, { type: 'field', id: 'f-smoker', field: 'smoker' }] },
        { type: 'step', id: 'consent', label: 'Consent', children: [{ type: 'field', id: 'f-consent', field: 'consent' }] },
      ],
    },
    ...more,
  }) as Page;

function manualClock(): Scheduler & { advance(ms: number): void } {
  let now = 0;
  let next = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    setTimeout(run, ms) {
      timers.set(++next, { at: now + ms, run });
      return next;
    },
    clearTimeout: (handle) => void timers.delete(handle as number),
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at > now) continue;
        timers.delete(id);
        timer.run();
      }
    },
  };
}

function memoryStore(): DraftStore & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value), removeItem: (key) => void items.delete(key) };
}

const link = (key: string) => `https://clinic.example/intake?resume=${key}`;
const asked = (source: { calls: { method: string; request: unknown }[] }, method: string) => source.calls.filter((call) => call.method === method).map((call) => call.request);

describe('drafts on the app’s server', () => {
  it('keeps the answers as they are typed, one key for the draft, the browser’s store holding only that key', async () => {
    const clock = manualClock();
    const store = memoryStore();
    const source = createMemoryDataSource();
    const form = createForm({ page: intake(), dataSource: source, drafts: { store }, scheduler: clock });
    const told: string[] = [];
    form.on('draft', ({ key, later }) => told.push(`${key}${later ? ' later' : ''}`));
    form.setValue('name', 'Mona Adel');
    clock.advance(1500);
    await form.settled();
    form.setValue('weight', 64.5);
    clock.advance(1500);
    await form.settled();
    const saves = asked(source, 'saveDraft') as SaveDraftRequest[];
    expect(saves.map((save) => save.key)).toEqual([null, 'draft-1']);
    expect(saves[1]).toMatchObject({ pageId: 'patient-intake', model: '', recordId: null, draft: { values: { name: 'Mona Adel', weight: 64.5 }, step: 'about', skipped: [], answered: ['name', 'weight'] } });
    expect(Object.keys(source.drafts)).toEqual(['draft-1']);
    expect(JSON.parse(store.items.get(`fieldia:draft:${ownerOf(null)}:patient-intake:new`) as string)).toEqual({ savedAt: expect.any(String), key: 'draft-1' });
    expect(form.getState().resume).toEqual({ key: 'draft-1' });
    expect(told).toEqual(['draft-1', 'draft-1']);
  });

  it('keeps the step a wizard is on as it is entered, and Continue later answers with the app’s link', async () => {
    const clock = manualClock();
    const source = createMemoryDataSource({ draftLink: link });
    const form = createForm({ page: intake(), dataSource: source, scheduler: clock });
    expect(form.canContinueLater()).toBe(true);
    form.setValue('name', 'Mona Adel');
    expect(form.next()).toBe(true);
    clock.advance(1500);
    await form.settled();
    expect(source.drafts['draft-1']).toMatchObject({ step: 'health' });
    const saved = await form.continueLater();
    expect(saved).toEqual({ key: 'draft-1', link: 'https://clinic.example/intake?resume=draft-1' });
    expect(source.drafts['draft-1']).toMatchObject({ later: true, step: 'health' });
  });

  it('reads what is typed first on Continue later: text that does not read kept as typed, said again as it opens', async () => {
    const source = createMemoryDataSource({ draftLink: link });
    const form = createForm({ page: intake(), dataSource: source });
    form.setValue('name', 'Mona Adel');
    // A weight box left with "64,5kg" in it: kept unread, with why, as a box keeps it.
    form.settling(() => form.setUnread('weight', { text: '64,5kg', message: 'Weight must be a number' }));
    await form.continueLater();
    expect(source.drafts['draft-1'].unread).toEqual({ weight: { text: '64,5kg', message: 'Weight must be a number' } });

    // On another device: a new browser, nothing in its store, the link's key.
    const there = createForm({ page: intake(), dataSource: source, resume: 'draft-1' });
    expect(there.getState().status).toBe('loading');
    await there.settled();
    expect(there.getState().status).toBe('ready');
    expect(there.getState().values).toMatchObject({ name: 'Mona Adel', weight: null });
    expect(there.getState().unread).toEqual({ weight: { text: '64,5kg', message: 'Weight must be a number' } });
    // Said at once, as where it was typed and left.
    expect(there.getState().errors['weight']).toBe('Weight must be a number');
    expect(there.validate()).toBe(false);
    expect(there.getState().errors['weight']).toBe('Weight must be a number');
    expect(there.getState().resume).toEqual({ key: 'draft-1' });
  });

  it('opens a draft by its key on another device at the same step, the steps passed over kept', async () => {
    const source = createMemoryDataSource({
      drafts: { abc: { pageId: 'patient-intake', values: { name: 'Mona Adel', allergies: null }, step: 'consent', skipped: ['health'], savedAt: '2026-10-19T10:42:00Z' } },
    });
    const steps: string[] = [];
    const form = createForm({ page: intake(), dataSource: source, resume: 'abc' });
    form.on('step', ({ step }) => steps.push(step));
    await form.settled();
    expect(form.getState()).toMatchObject({ step: 'consent', skipped: ['health'], values: { name: 'Mona Adel' }, draft: null });
    expect(steps).toEqual(['consent']);
    // Its answers go with the draft's key: the server lets the draft go.
    form.setValue('consent', true);
    expect(await form.save()).toBe(true);
    expect(asked(source, 'submit')).toEqual([expect.objectContaining({ draft: 'abc' })]);
    expect(source.drafts).toEqual({});
    expect(form.getState().resume).toBeNull();
  });

  it('opens at the nearest step before the draft’s that still applies, and starts empty where the key names none', async () => {
    const hidden = intake();
    (hidden.layout as { children: { invisible?: string }[] }).children[2].invisible = 'name == "Mona Adel"';
    const source = createMemoryDataSource({ drafts: { abc: { pageId: 'patient-intake', values: { name: 'Mona Adel' }, step: 'consent', savedAt: '2026-10-19T10:42:00Z' } } });
    const form = createForm({ page: hidden, dataSource: source, resume: 'abc' });
    await form.settled();
    expect(form.getState().step).toBe('health');

    const gone = createForm({ page: intake(), dataSource: source, resume: 'sent-long-ago' });
    await gone.settled();
    expect(gone.getState()).toMatchObject({ status: 'ready', resume: { key: 'sent-long-ago', missing: true }, step: 'about' });
    expect(gone.getState().values['name']).toBeNull();
  });

  it('offers a draft that comes after the person started typing, never laying it over what they typed', async () => {
    const source = createMemoryDataSource({ delayMs: 50, drafts: { abc: { pageId: 'patient-intake', values: { name: 'Mona Adel' }, savedAt: '2026-10-19T10:42:00Z' } } });
    const form = createForm({ page: intake(), dataSource: source, resume: 'abc' });
    form.setValue('name', 'Mona A.');
    await form.settled();
    expect(form.getState().values['name']).toBe('Mona A.');
    expect(form.getState().draft).toEqual({ savedAt: '2026-10-19T10:42:00Z' });
    form.restoreDraft();
    expect(form.getState().values['name']).toBe('Mona Adel');
  });

  it('finds the draft this browser kept on the server by its key, and offers it', async () => {
    const clock = manualClock();
    const store = memoryStore();
    const source = createMemoryDataSource();
    const first = createForm({ page: intake(), dataSource: source, drafts: { store }, scheduler: clock });
    first.setValue('name', 'Mona Adel');
    first.next();
    clock.advance(1500);
    await first.settled();
    first.dispose();
    const again = createForm({ page: intake(), dataSource: source, drafts: { store }, scheduler: clock });
    await again.settled();
    expect(again.getState().draft).toEqual({ savedAt: expect.any(String) });
    again.restoreDraft();
    expect(again.getState()).toMatchObject({ step: 'health', values: { name: 'Mona Adel' } });
  });

  it('keeps the draft in the browser’s store where the server fails, and drops a draft’s answer once the answers went', async () => {
    const clock = manualClock();
    const store = memoryStore();
    const source = createMemoryDataSource();
    source.saveDraft = () => Promise.reject(new Error('offline'));
    const form = createForm({ page: intake(), dataSource: source, drafts: { store }, scheduler: clock });
    form.setValue('name', 'Mona Adel');
    clock.advance(1500);
    await form.settled();
    expect(JSON.parse(store.items.get(`fieldia:draft:${ownerOf(null)}:patient-intake:new`) as string)).toMatchObject({ values: { name: 'Mona Adel' } });
  });

  it('lets a draft on its way go first, so the send names the draft it ends', async () => {
    const clock = manualClock();
    const source = createMemoryDataSource({ delayMs: 20, scheduler: undefined });
    const form = createForm({ page: intake({ layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-consent', field: 'consent' }] } }), dataSource: source, scheduler: clock });
    form.setValue('name', 'Mona Adel');
    form.setValue('consent', true);
    clock.advance(1500);
    expect(await form.save()).toBe(true);
    await form.settled();
    expect(asked(source, 'submit')).toEqual([expect.objectContaining({ draft: 'draft-1' })]);
    expect(source.drafts).toEqual({});
    expect(form.getState().resume).toBeNull();
  });
});

describe('without the server’s drafts', () => {
  it('offers no Continue later, and keeps drafts in the browser’s store with their step, as before but for the step', () => {
    const clock = manualClock();
    const store = memoryStore();
    const { saveDraft: _save, loadDraft: _load, ...rest } = createMemoryDataSource();
    const source = rest as DataSource;
    const form = createForm({ page: intake(), dataSource: source, drafts: { store, delayMs: 300 }, scheduler: clock });
    expect(form.canContinueLater()).toBe(false);
    form.setValue('name', 'Mona Adel');
    form.next();
    clock.advance(300);
    expect(JSON.parse(store.items.get(`fieldia:draft:${ownerOf(null)}:patient-intake:new`) as string)).toMatchObject({ values: { name: 'Mona Adel' }, step: 'health' });
    const again = createForm({ page: intake(), dataSource: source, drafts: { store, restore: 'auto' }, scheduler: clock });
    expect(again.getState()).toMatchObject({ step: 'health', values: { name: 'Mona Adel' } });
  });

  it('keeps nothing on a page with Continue later and no drafts of the app’s, nor asks to', async () => {
    const clock = manualClock();
    const { saveDraft: _save, loadDraft: _load, ...rest } = createMemoryDataSource();
    const form = createForm({ page: intake(), dataSource: rest as DataSource, scheduler: clock, resume: 'abc' });
    form.setValue('name', 'Mona Adel');
    clock.advance(5000);
    await form.settled();
    expect(form.getState()).toMatchObject({ status: 'ready', resume: null });
    await expect(form.continueLater()).rejects.toThrow('no saveDraft');
  });
});
