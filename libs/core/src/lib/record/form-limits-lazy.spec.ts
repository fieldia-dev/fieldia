import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { formLimitsPart, hasLimits } from './taking';

/**
 * Before the limits part has come (taking.ts, `formLimitsPart`): a form's limits — when its page takes answers, each
 * choice's places, a full choice refused — come in a part a page with `limits` or options with `seats` asks for. A form
 * made before it came takes them as it comes, and a save waits for it: never a response sent to a closed page. This
 * file starts with no part loaded.
 */

const signup = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.11',
    id: 'event-signup',
    data: { kind: 'responses' },
    fields: {
      name: { type: 'char', label: 'Name' },
      session: { type: 'selection', label: 'Session', options: [{ value: 'am', label: 'Morning workshop', seats: 2 }, { value: 'pm', label: 'Afternoon talk' }] },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-session', field: 'session' }] },
    limits: { closes: '2026-11-20' },
    ...more,
  }) as Page;

const plain = (): Page => {
  const page = signup({ limits: undefined });
  return { ...page, fields: { ...page.fields, session: { type: 'selection', label: 'Session', options: [{ value: 'am', label: 'Morning workshop' }] } } } as Page;
};

describe("a form's limits part", () => {
  it('is asked for by a page with limits or a choice’s places, never by another', () => {
    expect(hasLimits(signup())).toBe(true);
    expect(hasLimits(signup({ limits: undefined }))).toBe(true);
    expect(hasLimits(plain())).toBe(false);
  });

  it('a page with neither never loads it, and keeps no limits', () => {
    const form = createForm({ page: plain(), dataSource: createMemoryDataSource() });
    expect(form.getState().limits).toBeNull();
    expect(formLimitsPart.loaded).toBeUndefined();
  });

  it('a form made before it came shows its limits as it comes, and a save waits for it', async () => {
    const dataSource = createMemoryDataSource({ limits: { 'event-signup': { perChoice: { session: { am: 2 } } } } });
    const form = createForm({ page: signup(), dataSource, now: () => new Date('2026-11-25T10:00:00Z') });
    // Not come yet: none shown, nothing refused — the person cannot type before the viewer draws it.
    expect(formLimitsPart.loaded).toBeUndefined();
    expect(form.getState().limits).toBeNull();
    form.setValue('name', 'Mona');
    // A save waits for it, and is refused: the page closed.
    expect(await form.save()).toBe(false);
    expect(formLimitsPart.loaded).toBeDefined();
    expect(form.getState().limits?.state).toBe('closed');
    expect(form.getState().saveProblem?.message).toBe('This form closed on 20 Nov 2026.');
    expect(dataSource.responses).toEqual([]);
  });

  it('once it has come, a form has its limits at once, and refuses a full choice when picked', async () => {
    const dataSource = createMemoryDataSource({ limits: { 'event-signup': { perChoice: { session: { am: 2 } } } } });
    const form = createForm({ page: signup({ limits: undefined }), dataSource });
    // Its counts asked at once, as the form is made.
    expect(dataSource.calls.map((call) => call.method)).toEqual(['limits']);
    await form.refreshLimits();
    expect(form.getState().limits?.seats['session']).toEqual({ am: { seats: 2, taken: 2, left: 0 } });
    form.setValue('session', 'am');
    expect(form.getState().values['session']).toBeNull();
    expect(form.getState().errors['session']).toBe('Morning workshop is full');
  });
});
