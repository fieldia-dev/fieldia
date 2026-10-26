import type { Page } from '../format/page';
import type { DataSource, SaveRequest } from './data-source';
import { createForm, type Form } from './form';
import { createMemoryDataSource, type MemoryDataSource } from './memory-data-source';

/**
 * A save of a stored record with nothing changed since its last load or its last save answered sends nothing: it is
 * saved as it is, at once — "Saved" — and its version stays, so another person's tab sees no change that is none.
 * Everything else still goes: a save while one is on its way joins it, a new record is made though nothing was typed,
 * a save after one refused asks again, and changes typed, set by the app, answered by `onchange` or set aside by Reload
 * are sent.
 */

const page: Page = {
  fieldia: '0.13',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' }, budget: { type: 'float', label: 'Budget' } },
  layout: { type: 'sections', id: 's', children: ['name', 'phone', 'budget'].map((field) => ({ type: 'field', id: `f-${field}`, field })) },
} as Page;

const source = () => createMemoryDataSource({ records: { lead: { 1: { name: 'Villa', phone: '+201001234567', budget: 4000000 } } }, versions: { by: 'Sara' } });
const saves = (ds: MemoryDataSource) => ds.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);

async function opened(ds: DataSource, more: Partial<Parameters<typeof createForm>[0]> = {}): Promise<Form> {
  const form = createForm({ page, dataSource: ds, recordId: 1, ...more });
  await form.load();
  await form.settled();
  return form;
}

describe('a save with nothing changed', () => {
  it('of a stored record just loaded sends nothing: saved, at once, its version as it was', async () => {
    const ds = source();
    const form = await opened(ds);
    const version = form.getState().version;
    expect(await form.save()).toBe(true);
    expect(saves(ds)).toEqual([]);
    expect(form.getState()).toMatchObject({ status: 'saved', dirty: [], saveProblem: null, version });
  });

  it('after a save answered — Ctrl+Enter pressed again once it went — sends nothing, its version as the save left it', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(true);
    const version = form.getState().version;
    expect(await form.save()).toBe(true);
    expect(await form.save()).toBe(true);
    expect(saves(ds)).toHaveLength(1);
    expect(form.getState()).toMatchObject({ status: 'saved', version });
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887' });
    // The next change is a save of its own, with a key of its own.
    form.setValue('budget', 4100000);
    expect(await form.save()).toBe(true);
    const [first, second] = saves(ds);
    expect(second.key).not.toBe(first.key);
    expect(second.changes.values).toEqual({ budget: 4100000 });
  });

  it('while one is on its way joins it: one save', async () => {
    const ds = source();
    let answer!: () => void;
    const held: DataSource = { ...ds, save: (request) => new Promise((resolve) => (answer = () => resolve(ds.save(request)))) };
    const form = await opened(held);
    form.setValue('phone', '+201009998887');
    const first = form.save();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(form.getState().status).toBe('saving');
    const second = form.save();
    answer();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(saves(ds)).toHaveLength(1);
  });

  it('of a new record makes it, though nothing was typed', async () => {
    const ds = source();
    const form = createForm({ page, dataSource: ds });
    expect(await form.save()).toBe(true);
    expect(saves(ds)).toHaveLength(1);
    expect(form.getState().recordId).not.toBeNull();
  });

  it('after a save refused asks again', async () => {
    const ds = source();
    let refuse = true;
    const once: DataSource = {
      ...ds,
      save: async (request) => {
        if (refuse) {
          refuse = false;
          throw new TypeError('Failed to fetch');
        }
        return ds.save(request);
      },
    };
    const form = await opened(once);
    form.setValue('phone', '+201009998887');
    expect(await form.save()).toBe(false);
    expect(await form.save()).toBe(true);
    expect(saves(ds)).toHaveLength(1);
    expect(ds.records['lead'][1]).toMatchObject({ phone: '+201009998887' });
  });

  it('sends what the app set, and what an onchange answered — never what it answered as it was', async () => {
    const ds = source();
    const onchange: DataSource['onchange'] = async (request) => (request.changed === 'phone' ? { values: { budget: 5000000 } } : {});
    const form = await opened({ ...ds, onchange });
    form.setValue('phone', '+201009998887');
    await form.settled();
    expect(form.getState().dirty).toEqual(['phone', 'budget']);
    expect(await form.save()).toBe(true);
    expect(saves(ds)[0].changes.values).toEqual({ phone: '+201009998887', budget: 5000000 });
    // Set to what it holds already: no change, nothing to send.
    form.setValue('name', 'Villa');
    expect(await form.save()).toBe(true);
    expect(saves(ds)).toHaveLength(1);
  });

  it('with changes Reload set aside after a conflict, still goes', async () => {
    const ds = source();
    const form = await opened(ds);
    form.setValue('phone', '+201009998887');
    ds.changeElsewhere('lead', 1, { budget: 4500000 }, { by: 'Mona' });
    expect(await form.save()).toBe(false);
    expect(await form.reloadTheirs()).toBe(true);
    expect(form.getState()).toMatchObject({ dirty: [], setAside: { phone: '+201009998887' } });
    const before = saves(ds).length;
    await form.save();
    expect(saves(ds)).toHaveLength(before + 1);
  });
});

describe('a save with nothing changed, of a record its own checks refuse', () => {
  it('is checked as any save is: its problems said, nothing sent', async () => {
    const strict: Page = { ...page, fields: { ...page.fields, budget: { type: 'float', label: 'Budget', required: true } } } as Page;
    const ds = createMemoryDataSource({ records: { lead: { 1: { name: 'Villa', phone: '+201001234567', budget: null } } } });
    const form = createForm({ page: strict, dataSource: ds, recordId: 1 });
    await form.load();
    await form.settled();
    expect(await form.save()).toBe(false);
    expect(form.getState().errors['budget']).toBeTruthy();
    expect(saves(ds)).toEqual([]);
  });
});
