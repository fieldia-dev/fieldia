import { createMemoryDataSource, type DraftStore, type Page } from '@fieldia/core';
import { openFormDialog } from './dialog';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * `destroy()` × drafts (0.34: harden-perf's cleanup over harden-data's drafts). A viewer taken away closes what it
 * opened as not saved, nothing asked; what was typed is kept as a draft as data's rules say — the person's own, the
 * changes alone for a record, a secret never — even typed a moment before, its draft's delay not yet passed: closed is
 * not discarded. A page a step opened keeps none (its drafts are the opener's, as ever).
 */

/** A store as localStorage is. */
function storage() {
  const items = new Map<string, string>();
  const store: DraftStore = { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value), removeItem: (key) => void items.delete(key) };
  return { items, store };
}
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const MONA = { id: 'mona', name: 'Mona Adel', roles: [] };

const consent = (): Page =>
  ({
    fieldia: '0.13',
    id: 'clinic-consent',
    title: 'Consent',
    data: { kind: 'responses' },
    fields: { patient: { type: 'char', label: 'Patient' }, pin: { type: 'char', label: 'PIN' }, national_id: { type: 'char', label: 'National ID', secret: true } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-p', field: 'patient' }, { type: 'field', id: 'f-pin', field: 'pin', widget: 'password' }, { type: 'field', id: 'f-id', field: 'national_id' }] },
  }) as Page;
const lead = (): Page =>
  ({
    fieldia: '0.13',
    id: 'lead',
    title: 'Lead',
    data: { kind: 'record', model: 'lead' },
    fields: { notes: { type: 'text', label: 'Notes' }, price: { type: 'float', label: 'Price' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-n', field: 'notes' }, { type: 'field', id: 'f-pr', field: 'price' }] },
  }) as Page;
const records = () => ({ lead: { 7: { notes: 'Call back on Sunday', price: 100 } } });

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});
const host = () => document.body.appendChild(document.createElement('div'));

describe('a viewer taken away, its typing not yet kept as a draft', () => {
  it('keeps the draft, the person’s own and no secret in it; mounted again, it is offered', async () => {
    const { items, store } = storage();
    const handle = mountViewer(host(), { page: consent(), dataSource: createMemoryDataSource(), drafts: { store, delayMs: 10_000 }, user: MONA });
    await handle.form.settled();
    handle.form.setValue('patient', 'Mona Adel');
    handle.form.setValue('pin', '4321');
    handle.form.setValue('national_id', '29001011234567');
    // Its draft's delay not passed: nothing kept yet.
    expect(items.size).toBe(0);
    handle.destroy();
    await tick(20);
    expect([...items.keys()]).toEqual(['fieldia:draft:u:mona:clinic-consent:new']);
    const kept = [...items.values()].join('');
    expect(kept).toContain('Mona Adel');
    expect(kept).not.toContain('4321');
    expect(kept).not.toContain('29001011234567');
    const again = mountViewer(host(), { page: consent(), dataSource: createMemoryDataSource(), drafts: { store, restore: 'auto' }, user: MONA });
    handles.push(again);
    await tick(30);
    expect(again.form.getState().values).toMatchObject({ patient: 'Mona Adel', pin: null, national_id: null });
  });

  it('a dialog it closed as not saved keeps its record’s draft — the changes alone — and a page a step opened keeps none', async () => {
    const { items, store } = storage();
    const dataSource = createMemoryDataSource({ records: records() });
    const opener = mountViewer(host(), { page: consent(), dataSource, pages: { lead: lead() } });
    handles.push(opener);
    // A dialog the app opened with drafts of its own, closed with the viewer as destroy() closes them.
    const closed = new AbortController();
    const ended = openFormDialog({ page: lead(), dataSource, recordId: 7, title: 'Lead', drafts: { store, delayMs: 10_000 }, user: MONA, signal: closed.signal });
    for (let waited = 0; !document.querySelector('.fd-form-dialog [data-node="f-n"] textarea') && waited < 2000; waited += 10) await tick(10);
    for (let waited = 0; (document.querySelector('.fd-form-dialog [data-node="f-n"] textarea') as HTMLTextAreaElement | null)?.value !== 'Call back on Sunday' && waited < 2000; waited += 10) await tick(10);
    const notes = document.querySelector('.fd-form-dialog [data-node="f-n"] textarea') as HTMLTextAreaElement;
    notes.value = 'Call back on Monday';
    notes.dispatchEvent(new Event('input', { bubbles: true }));
    closed.abort();
    await expect(ended).resolves.toMatchObject({ saved: false });
    await tick(20);
    expect(document.querySelector('.fd-form-dialog')).toBeNull();
    const [key, value] = [...items.entries()][0] ?? [];
    expect(key).toBe('fieldia:draft:u:mona:lead:7');
    const draft = JSON.parse(value as string);
    // The person's change alone, with what it was typed over: never the rest of the record as it was.
    expect(draft.values).toEqual({ notes: 'Call back on Monday' });
    expect(draft.from).toEqual({ notes: 'Call back on Sunday' });
    // A page a step opened, closed with its opener: no draft of its own, as ever.
    items.clear();
    void opener.run([{ do: 'open', page: 'lead', as: 'dialog', record: '7' }]);
    for (let waited = 0; !document.querySelector('.fd-form-dialog') && waited < 2000; waited += 10) await tick(10);
    opener.destroy();
    await tick(20);
    expect(document.querySelector('.fd-form-dialog')).toBeNull();
    expect(items.size).toBe(0);
  });
});
