import type { Page } from '../format/page';
import type { SubmitRequest } from './data-source';
import { drafts, outbox, ownerOf } from './browser-kept';
import { createForm, type DraftStore } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { memoryOutbox } from './outbox-form';

/**
 * Drafts and the outbox belong to a person (audit R-H5, R-M9, S-M4, S-M5): kept by whose they are — the signed-in
 * person's id, else the tab's — a record's draft holding only the fields changed with the version they were typed
 * against, said as a conflict where the record moved since; a secret field never kept; a field the page no longer has
 * never brought back; `drafts.clear()` and `outbox.clear()` for sign-out. The proofs are the audit's (A/draft-proof.ts;
 * security trust/drafts-proof, trust/outbox-proof).
 */

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** A store as localStorage is: its keys listed too. */
function storage() {
  const items = new Map<string, string>();
  const store: DraftStore & { readonly length: number; key(index: number): string | null } = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
  };
  return { items, store };
}

const lead = (): Page =>
  ({
    fieldia: '0.11',
    id: 'lead',
    data: { kind: 'record', model: 'lead' },
    fields: { notes: { type: 'text', label: 'Notes' }, price: { type: 'float', label: 'Price' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-n', field: 'notes' }, { type: 'field', id: 'f-p', field: 'price' }] },
  }) as Page;

const MONA = { id: 'mona', name: 'Mona Adel', roles: [] };
const KARIM = { id: 'karim', name: 'Karim', roles: [] };

describe('a record’s draft (A/draft-proof)', () => {
  it('keeps only what the person changed: laid again, a colleague’s save since is never reverted', async () => {
    for (const versions of [false, true]) {
      const { store } = storage();
      const ds = createMemoryDataSource({ versions, records: { lead: { 5: { notes: 'a', price: 10 } } } });
      // Monday: Mona types a note and closes the tab without saving.
      const mona = createForm({ page: lead(), dataSource: ds, recordId: 5, user: MONA, drafts: { store, restore: 'auto', delayMs: 0 } });
      await mona.load();
      mona.setValue('notes', 'call back Tuesday');
      await tick(30);
      // Tuesday: Karim changes the price and saves.
      const karim = createForm({ page: lead(), dataSource: ds, recordId: 5, user: KARIM });
      await karim.load();
      karim.setValue('price', 99);
      await karim.save();
      // Wednesday: Mona opens the record again; her draft is laid.
      const again = createForm({ page: lead(), dataSource: ds, recordId: 5, user: MONA, drafts: { store, restore: 'auto', delayMs: 0 } });
      await again.load();
      await tick(30);
      expect(again.getState()).toMatchObject({ values: { notes: 'call back Tuesday', price: 99 }, dirty: ['notes'] });
      if (versions) {
        // Typed against a version the record has moved from: said as a conflict, Keep mine saving it over theirs.
        expect(again.getState().conflict).toMatchObject({ version: { token: expect.any(String) }, changed: [], both: [] });
        expect(await again.keepMine()).toBe(true);
      } else {
        expect(again.getState().conflict).toBeNull();
        expect(await again.save()).toBe(true);
      }
      expect(ds.records['lead']['5']).toMatchObject({ notes: 'call back Tuesday', price: 99 });
    }
  });

  it('a field changed by both is said as a conflict naming it', async () => {
    const { store } = storage();
    const ds = createMemoryDataSource({ versions: true, records: { lead: { 5: { notes: 'a', price: 10 } } } });
    const mona = createForm({ page: lead(), dataSource: ds, recordId: 5, user: MONA, drafts: { store, restore: 'auto', delayMs: 0 } });
    await mona.load();
    mona.setValue('price', 12);
    await tick(30);
    const karim = createForm({ page: lead(), dataSource: ds, recordId: 5, user: KARIM });
    await karim.load();
    karim.setValue('price', 99);
    await karim.save();
    const again = createForm({ page: lead(), dataSource: ds, recordId: 5, user: MONA, drafts: { store, restore: 'auto', delayMs: 0 } });
    await again.load();
    await tick(30);
    expect(again.getState().conflict).toMatchObject({ changed: ['price'], both: ['price'], theirs: { price: 99 } });
    expect(again.getState().values['price']).toBe(12);
  });

  it('R-M9: a draft never brings back a field the page no longer has', async () => {
    const { store } = storage();
    store.setItem(`fieldia:draft:${ownerOf(null)}:lead:new`, JSON.stringify({ values: { notes: 'x', discount: 50 }, savedAt: new Date().toISOString() }));
    const ds = createMemoryDataSource();
    const form = createForm({ page: lead(), dataSource: ds, drafts: { store, restore: 'auto' } });
    await form.load();
    await tick(10);
    expect(form.getState().values).toEqual({ notes: 'x', price: null });
    await form.save();
    expect(Object.values(ds.records['lead'])[0]).not.toHaveProperty('discount');
  });
});

describe('kept by whose it is (S-M4, S-M5)', () => {
  const consent = (): Page =>
    ({
      fieldia: '0.11',
      id: 'clinic-consent',
      data: { kind: 'responses' },
      fields: { patient: { type: 'char', label: 'Patient' }, pin: { type: 'char', label: 'PIN' }, national_id: { type: 'char', label: 'National ID', secret: true } },
      layout: {
        type: 'sections',
        id: 'root',
        children: [{ type: 'field', id: 'f-p', field: 'patient' }, { type: 'field', id: 'f-pin', field: 'pin', widget: 'password' }, { type: 'field', id: 'f-id', field: 'national_id' }],
      },
    }) as Page;

  it('trust/drafts-proof: a password box’s and a secret field’s values are never kept; the next person is never offered the last one’s', async () => {
    const { items, store } = storage();
    const a = createForm({ page: consent(), drafts: { store, delayMs: 1 }, user: MONA });
    a.setValue('patient', 'Mona Adel');
    a.setValue('pin', '4321');
    a.setValue('national_id', '29001011234567');
    await tick(30);
    const kept = [...items.values()].join('');
    expect(kept).toContain('Mona Adel');
    expect(kept).not.toContain('4321');
    expect(kept).not.toContain('29001011234567');
    expect([...items.keys()]).toEqual(['fieldia:draft:u:mona:clinic-consent:new']);
    const b = createForm({ page: consent(), drafts: { store, restore: 'auto' }, user: KARIM });
    await tick(30);
    expect(b.getState().values).toEqual({ patient: null, pin: null, national_id: null });
    expect(b.getState().draft).toBeNull();
    // Mona, again: hers.
    const c = createForm({ page: consent(), drafts: { store, restore: 'auto' }, user: MONA });
    await tick(30);
    expect(c.getState().values).toMatchObject({ patient: 'Mona Adel', pin: null });
  });

  it('with no one signed in, a draft is the tab’s: keyed by its own id, never another person’s', () => {
    expect(ownerOf(null)).toMatch(/^t:/);
    expect(ownerOf(undefined)).toBe(ownerOf(null));
    expect(ownerOf({ id: 7 })).toBe('u:7');
  });

  it('drafts.clear() lets go every draft, or a person’s alone', async () => {
    const { items, store } = storage();
    for (const user of [MONA, KARIM]) {
      const form = createForm({ page: consent(), drafts: { store, delayMs: 1 }, user });
      form.setValue('patient', user.name);
      await tick(20);
    }
    store.setItem('fieldia:draft:clinic-consent:new', '{"savedAt":"2026-10-01T00:00:00Z","values":{}}');
    store.setItem('fieldia:something-else', 'kept');
    drafts.clear({ user: 'mona', store });
    expect([...items.keys()].sort()).toEqual(['fieldia:draft:clinic-consent:new', 'fieldia:draft:u:karim:clinic-consent:new', 'fieldia:something-else']);
    drafts.clear({ store });
    expect([...items.keys()]).toEqual(['fieldia:something-else']);
  });
});

describe('the outbox belongs to a person (trust/outbox-proof)', () => {
  const visit = (): Page =>
    ({
      fieldia: '0.11',
      id: 'site-visit',
      data: { kind: 'responses' },
      outbox: true,
      fields: { unit: { type: 'char', label: 'Unit' }, notes: { type: 'text', label: 'Notes' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-unit', field: 'unit' }, { type: 'field', id: 'f-notes', field: 'notes' }] },
    }) as Page;

  it('Mona’s send kept without signal never goes under Karim’s session: hers alone send it; outbox.clear() lets a person’s go', async () => {
    const device = memoryOutbox();
    const server: { session: string; values: SubmitRequest['values'] }[] = [];
    const source = (who: string, offline: boolean) => ({
      async submit(request: SubmitRequest) {
        if (offline) throw new TypeError('Failed to fetch');
        server.push({ session: who, values: request.values });
        return { id: server.length };
      },
    });
    const mona = createForm({ page: visit(), dataSource: source('mona', true), outbox: device, user: MONA });
    mona.setValues({ unit: 'B-12', notes: 'tenant phone 0100 123 4567' });
    await mona.save();
    await tick();
    expect(device.items.map((item) => item.owner)).toEqual(['u:mona']);
    expect(mona.getState().outbox).toMatchObject({ waiting: 1, lasting: true });
    const karim = createForm({ page: visit(), dataSource: source('karim', false), outbox: device, user: KARIM });
    await karim.joined('outbox')?.send();
    await tick();
    expect(server).toEqual([]);
    expect(karim.getState().outbox).toMatchObject({ waiting: 0, refused: [] });
    // Mona, back on the same device: hers go, under her session.
    const back = createForm({ page: visit(), dataSource: source('mona', false), outbox: device, user: MONA });
    await back.joined('outbox')?.send();
    expect(server).toEqual([{ session: 'mona', values: { unit: 'B-12', notes: 'tenant phone 0100 123 4567' } }]);
    // Sign-out: a person's let go, unsent.
    const again = createForm({ page: visit(), dataSource: source('karim', true), outbox: device, user: KARIM });
    again.setValues({ unit: 'C-3' });
    await again.save();
    await outbox.clear({ user: 'karim', store: device });
    expect(device.items).toEqual([]);
  });
});
