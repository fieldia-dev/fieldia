import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm, type Form, type FormEvents } from './form';
import { createMemoryDataSource, type MemoryDataSourceOptions } from './memory-data-source';
import type { ActionHost } from './run';
import type { RecordChange } from './data-source';

/**
 * Presence and live updates (the data source's `subscribe` and `presence`): a change made elsewhere laid on the record
 * where the person changed nothing, else the conflict a save would meet; who else has the record open, and whether
 * they are editing it; nothing of another record's laid on the one shown.
 */

const checked = validatePage({
  fieldia: '0.11',
  id: 'course',
  title: 'Course',
  data: { kind: 'record', model: 'course' },
  fields: { name: { type: 'char', label: 'Patient' }, price: { type: 'float', label: 'Price' }, notes: { type: 'text', label: 'Notes' } },
  layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-price', field: 'price' }, { type: 'field', id: 'f-notes', field: 'notes' }] }] },
});
if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
const page = checked.page as Page;
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

function source(more: Partial<MemoryDataSourceOptions> = {}) {
  return createMemoryDataSource({ live: true, versions: { by: 'Sara' }, records: { course: { 1: { name: 'Mona Adel', price: 4500, notes: '' }, 2: { name: 'Hana Fouad', price: 3000, notes: '' } } }, ...more });
}

async function open(dataSource: ReturnType<typeof source>, user = { id: 7, name: 'Sara Hassan' }, id = 1) {
  const said: string[] = [];
  const host: ActionHost = { open: async () => ({ saved: false }), say: (message) => void said.push(message), ask: async () => true };
  const form: Form = createForm({ page, dataSource, recordId: id, user, host });
  const arrived: FormEvents['arrived'][] = [];
  form.on('arrived', (event) => void arrived.push(event));
  await form.load();
  return { form, said, arrived };
}

describe('changes made elsewhere, live', () => {
  it('lays a change made elsewhere on the record where the person changed nothing, and says who changed what', async () => {
    const ds = source();
    const { form, said, arrived } = await open(ds);
    ds.changeElsewhere('course', 1, { price: 5000 }, { by: 'Mona Adel', at: '2026-10-21T10:42:00Z' });
    await settle();
    expect(form.getState().values['price']).toBe(5000);
    expect(form.getState().dirty).toEqual([]);
    expect(arrived).toEqual([{ recordId: 1, by: 'Mona Adel', at: '2026-10-21T10:42:00Z', fields: ['price'], conflict: false }]);
    expect(said).toEqual(['Mona Adel changed Price.']);
    // Their version is the record's now: a save of the person's next change is no conflict.
    form.setValue('notes', 'Allergic to lidocaine');
    expect(await form.save()).toBe(true);
    expect(ds.records['course']['1']).toMatchObject({ price: 5000, notes: 'Allergic to lidocaine' });
  });

  it('after a change of the person’s, waits as a conflict — who, when, what both changed — their typing untouched', async () => {
    const ds = source();
    const { form, arrived } = await open(ds);
    form.setValue('price', 4800);
    ds.changeElsewhere('course', 1, { price: 5000, notes: 'Moved to Thursday' }, { by: 'Mona Adel' });
    await settle();
    expect(form.getState().values['price']).toBe(4800);
    expect(form.getState().conflict).toMatchObject({ version: { by: 'Mona Adel' }, changed: ['price', 'notes'], both: ['price'] });
    expect(arrived[0]).toMatchObject({ conflict: true, fields: ['price', 'notes'] });
    // Keep mine: theirs kept where the person changed nothing.
    expect(await form.keepMine()).toBe(true);
    expect(ds.records['course']['1']).toMatchObject({ price: 4800, notes: 'Moved to Thursday' });
  });

  it("takes nothing of its own save back as someone else's, and nothing of another record's", async () => {
    const ds = source();
    const { form, arrived } = await open(ds);
    form.setValue('price', 4600);
    await form.save();
    await settle();
    expect(arrived).toEqual([]);
    await form.openRecord(2);
    ds.changeElsewhere('course', 1, { price: 1 }, { by: 'Mona Adel' });
    await settle();
    expect(form.getState().values['price']).toBe(3000);
    expect(arrived).toEqual([]);
  });

  it('says a record deleted elsewhere', async () => {
    const ds = source();
    const said: string[] = [];
    const pushed: ((change: RecordChange) => void)[] = [];
    const form = createForm({ page, dataSource: { ...ds, subscribe: (_record, push) => (pushed.push(push), () => undefined) }, recordId: 1, host: { open: async () => ({ saved: false }), say: (m) => void said.push(m), ask: async () => true } });
    await form.load();
    pushed[0]({ type: 'deleted', by: 'Mona Adel' });
    expect(said).toEqual(['Mona Adel deleted this record.']);
  });

  it('pushes nothing from a memory source that is not live: a change elsewhere is found as a save meets it', async () => {
    const ds = source({ live: false });
    const { form, arrived } = await open(ds);
    ds.changeElsewhere('course', 1, { price: 5000 }, { by: 'Mona Adel' });
    await settle();
    expect(form.getState().values['price']).toBe(4500);
    expect(arrived).toEqual([]);
    expect(form.getState().present).toBeUndefined();
  });
});

describe('who else has the record open', () => {
  it('tells each person the others with the record open — never themselves — and who is editing', async () => {
    const ds = source();
    const sara = await open(ds, { id: 7, name: 'Sara Hassan' });
    const mona = await open(ds, { id: 9, name: 'Mona Adel' });
    expect(sara.form.getState().present).toEqual([{ id: 9, name: 'Mona Adel', editing: false }]);
    expect(mona.form.getState().present).toEqual([{ id: 7, name: 'Sara Hassan', editing: false }]);
    sara.form.setValue('notes', 'Typing');
    expect(mona.form.getState().present).toEqual([{ id: 7, name: 'Sara Hassan', editing: true }]);
    // Mona goes to another record: Sara sees no one.
    await mona.form.openRecord(2);
    expect(sara.form.getState().present).toEqual([]);
    ds.arrive?.('course', 1, { id: 11, name: 'Karim Nabil' });
    expect(sara.form.getState().present).toEqual([{ id: 11, name: 'Karim Nabil' }]);
    sara.form.dispose();
    expect(mona.form.getState().present).toEqual([]);
  });
});

describe("the one-tag script's memory source, live", () => {
  it('takes a push asked for before its members came, its stop given once they have', async () => {
    const { createMemoryDataSource: later, memoryPart } = await import('./memory-later');
    expect(memoryPart.loaded).toBeUndefined();
    const ds = later({ live: true, records: { course: { 1: { name: 'Mona Adel', price: 1 } } } });
    const pushed: unknown[] = [];
    const subscribe = ds.subscribe as NonNullable<typeof ds.subscribe>;
    // Asked before the members came, as a form never asks (it reads the record through them first): answered once they
    // have, its stop then (the live part takes either, live.ts).
    const given = subscribe({ model: 'course', id: 1, fields: {} }, (change) => void pushed.push(change)) as unknown as Promise<() => void>;
    await memoryPart.load();
    await settle();
    ds.changeElsewhere('course', 1, { price: 2 }, { by: 'Mona Adel' });
    expect(pushed).toEqual([expect.objectContaining({ type: 'record', by: 'Mona Adel', values: { name: 'Mona Adel', price: 2 } })]);
    (await given)();
    ds.changeElsewhere('course', 1, { price: 3 }, { by: 'Mona Adel' });
    expect(pushed).toHaveLength(1);
  });
});
