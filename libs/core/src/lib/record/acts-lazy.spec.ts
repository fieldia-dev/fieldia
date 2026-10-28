import type { Part } from '../parts';
import type { FormActsPart } from './acts-later';

/**
 * The engine that runs a page's steps comes in a part of its own (the acts part: acts-later.ts), which no page draws
 * from: asked for right after the whole check, or by the first run that needs it. A run that comes first — a press, a
 * moment, the app's own — waits for it and then runs, on the record it was set off on; one whose part cannot come does
 * nothing, says so (`guardNotDone`), and the next asks for it anew. A page with no steps never asks for it. This file
 * starts with no part loaded, and every case with fresh modules and a part the test lets come, or fail.
 */

/** The acts part as each case holds it: its load waits for `release`, then comes — or fails, for every ask then waiting, `failing` times. */
const mockHeld: { release?: () => void; failing: number; asked: number; askedAt: string[] } = { failing: 0, asked: 0, askedAt: [] };
jest.mock('./acts-later', () => {
  const real = jest.requireActual<typeof import('./acts-later')>('./acts-later');
  let gate: Promise<void> | null = null;
  const held: Part<FormActsPart> = {
    name: 'acts',
    get loaded() {
      return gate === null ? real.formActsPart.loaded : undefined;
    },
    get coming() {
      return gate !== null;
    },
    asksAgain: true,
    load() {
      mockHeld.asked++;
      const { pageCheckPart } = jest.requireActual<typeof import('../format/page-check')>('../format/page-check');
      mockHeld.askedAt.push(pageCheckPart.coming ? 'beside the check' : pageCheckPart.loaded ? 'after the check' : 'with no check come');
      // One answer for every ask waiting as it is let go: it comes, or it fails.
      gate ??= new Promise<boolean>((resolve) => (mockHeld.release = () => resolve(mockHeld.failing > 0 && mockHeld.failing-- > 0))).then((fails) => {
        gate = null;
        if (fails) throw new Error('fieldia.acts.js could not be loaded');
      });
      return gate.then(() => real.formActsPart.load());
    },
  };
  return { ...real, formActsPart: held };
});

beforeEach(() => {
  jest.resetModules();
  Object.assign(mockHeld, { release: undefined, failing: 0, asked: 0, askedAt: [] });
});

/** A few turns of the event loop: what is not held settles. */
const settle = async () => {
  for (let turn = 0; turn < 5; turn++) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function fresh() {
  const { createForm } = await import('./form');
  const { orderPage, orderSource, recordingHost } = await import('./test-steps');
  return { createForm, orderPage, orderSource, recordingHost };
}

describe("a page's steps, their engine in a part of its own", () => {
  it('a page with no steps never asks for it: changed, saved, reset', async () => {
    const { createForm, orderPage, orderSource } = await fresh();
    const form = createForm({ page: orderPage(), dataSource: orderSource(), recordId: 7 });
    await form.load();
    form.setValue('name', 'SO007 B');
    expect(await form.save()).toBe(true);
    form.reset();
    expect(await form.run([])).toEqual({ done: true });
    expect(mockHeld.asked).toBe(0);
  });

  it('a press that comes first waits for it, then runs on the record it was pressed on', async () => {
    const { createForm, orderPage, orderSource, recordingHost } = await fresh();
    const host = recordingHost();
    const form = createForm({ page: orderPage({ buttons: [{ type: 'button', id: 'b-fill', label: 'Fill', steps: [{ do: 'set', field: 'note', value: "'filled'" }, { do: 'say', message: 'Filled' }] }] }), dataSource: orderSource(), recordId: 7, host });
    await form.load();
    const pressed = form.runAction('b-fill');
    await settle();
    // Held: nothing done yet, nothing said.
    expect(mockHeld.asked).toBe(1);
    expect(form.getState().values['note']).toBeNull();
    expect(host.calls).toEqual([]);
    mockHeld.release?.();
    expect(await pressed).toEqual({ done: true });
    expect(form.getState().values['note']).toBe('filled');
    expect(host.calls).toEqual([['say', 'Filled', 'info']]);
  });

  it('a press whose record was replaced while it waited does nothing to the one shown now', async () => {
    const { createForm, orderPage, orderSource, recordingHost } = await fresh();
    const form = createForm({ page: orderPage({ buttons: [{ type: 'button', id: 'b-fill', label: 'Fill', steps: [{ do: 'set', field: 'note', value: "'filled'" }] }] }), dataSource: orderSource(), recordId: 7, host: recordingHost() });
    await form.load();
    const pressed = form.runAction('b-fill');
    await settle();
    await form.openRecord(null);
    mockHeld.release?.();
    expect(await pressed).toMatchObject({ done: false, reason: 'cannot' });
    expect(form.getState().values['note']).toBeNull();
  });

  it('a moment set off first (on.open) runs once it came', async () => {
    const { createForm, orderPage, orderSource } = await fresh();
    const form = createForm({ page: orderPage({ on: { open: [{ do: 'set', field: 'note', value: "'opened'" }] } }), dataSource: orderSource(), recordId: 7 });
    const loading = form.load();
    await settle();
    expect(mockHeld.asked).toBe(1);
    mockHeld.release?.();
    await loading;
    await form.settled();
    expect(form.getState().values['note']).toBe('opened');
  });

  it('where it cannot come, a run does nothing and says so — and the next asks for it anew, and runs', async () => {
    const { createForm, orderPage, orderSource, recordingHost } = await fresh();
    const host = recordingHost();
    const form = createForm({ page: orderPage({ buttons: [{ type: 'button', id: 'b-fill', label: 'Fill', steps: [{ do: 'set', field: 'note', value: "'filled'" }] }] }), dataSource: orderSource(), recordId: 7, host });
    await form.load();
    mockHeld.failing = 1;
    const runs: unknown[] = [];
    form.on('run', ({ result }) => runs.push(result));
    const pressed = form.runAction('b-fill');
    await settle();
    mockHeld.release?.();
    const result = await pressed;
    expect(result).toMatchObject({ done: false, reason: 'cannot', message: 'This action could not load, so nothing was done. Try again.' });
    expect(runs).toEqual([result]);
    expect(form.getState().values['note']).toBeNull();
    // Asked anew by the next press, which runs.
    const again = form.runAction('b-fill');
    await settle();
    expect(mockHeld.asked).toBe(2);
    mockHeld.release?.();
    expect(await again).toEqual({ done: true });
    expect(form.getState().values['note']).toBe('filled');
  });

  it('a save whose beforeSave steps cannot get their engine is stopped, said, nothing saved', async () => {
    const { createForm, orderPage, orderSource } = await fresh();
    const source = orderSource();
    const form = createForm({ page: orderPage({ on: { beforeSave: [{ do: 'set', field: 'ref', value: "'R-1'" }] } }), dataSource: source, recordId: 7 });
    await form.load();
    form.setValue('name', 'SO007 B');
    mockHeld.failing = 1;
    const saving = form.save();
    await settle();
    mockHeld.release?.();
    expect(await saving).toBe(false);
    expect(form.getState().saveProblem).toMatchObject({ kind: 'stopped', message: 'This action could not load, so nothing was done. Try again.' });
    expect(source.records['sale.order'][7]['name']).toBe('SO007');
  });

  it("a save over someone else's answered before it came — Keep mine — waits for it, then saves; where it cannot come, nothing", async () => {
    const { createForm, orderPage } = await fresh();
    const { createMemoryDataSource } = await import('./memory-data-source');
    const source = createMemoryDataSource({ records: { 'sale.order': { 7: { name: 'SO007', quantity: 2 } } }, versions: { by: 'Mona' } });
    const form = createForm({ page: orderPage(), dataSource: source, recordId: 7 });
    await form.load();
    form.setValue('name', 'SO007 B');
    source.changeElsewhere('sale.order', 7, { quantity: 3 }, { by: 'Mona' });
    expect(await form.save()).toBe(false);
    expect(form.getState().conflict).not.toBeNull();
    mockHeld.failing = 1;
    const refused = form.keepMine();
    await settle();
    mockHeld.release?.();
    expect(await refused).toBe(false);
    expect(source.records['sale.order'][7]['name']).toBe('SO007');
    const kept = form.keepMine();
    await settle();
    mockHeld.release?.();
    expect(await kept).toBe(true);
    expect(source.records['sale.order'][7]).toMatchObject({ name: 'SO007 B', quantity: 3 });
  });

  it('asked for right after the whole check came, never beside it', async () => {
    const { askForCheck } = await import('../format/page-check');
    askForCheck();
    await settle();
    expect(mockHeld.askedAt).toEqual(['after the check']);
  });

  it('asked for once the whole check could not come too, never beside it', async () => {
    jest.doMock('../format/check-part', () => {
      throw new Error('Loading chunk fieldia.check.js failed');
    });
    const { askForCheck } = await import('../format/page-check');
    askForCheck();
    await settle();
    expect(mockHeld.askedAt).toEqual(['with no check come']);
  });
});
