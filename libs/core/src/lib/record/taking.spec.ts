import type { Option } from '../format/field';
import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import type { DataSource, LimitsResult } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { MESSAGES } from './messages';
import type { Scheduler } from './scheduler';
import { limitsNow, takingWords } from './form-limits';
import { limitInstant } from './taking';

/**
 * Opening, closing and limiting a page of responses (`limits`), and a choice's places (`seats` on an option): the page
 * settings and their checks, the data source's `limits` (docs/plans/wave1-contract.md's style: optional), and the form's
 * state — said before anything is typed, kept to as the answers go, a full option refused when picked.
 */

const signup = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.11',
    id: 'event-signup',
    timeZone: 'Africa/Cairo',
    data: { kind: 'responses' },
    fields: {
      name: { type: 'char', label: 'Name', required: true },
      session: {
        type: 'selection',
        label: 'Session',
        required: true,
        options: [
          { value: 'am', label: 'Morning workshop', seats: 30 },
          { value: 'pm', label: 'Afternoon workshop', seats: 20 },
          { value: 'eve', label: 'Evening talk' },
        ],
      },
      extras: { type: 'selection', label: 'Extras', multiple: true, options: [{ value: 'lunch', label: 'Lunch', seats: 2 }, { value: 'parking', label: 'Parking' }] },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'section', id: 'g', children: ['name', 'session', 'extras'].map((field) => ({ type: 'field', id: `f-${field}`, field })) }] },
    limits: { opens: '2026-11-01T09:00', closes: '2026-11-20', maxResponses: 100, onePerPerson: true, message: 'See you in December.' },
    ...more,
  }) as Page;

/** A clock the test moves: the form's `now` and its timers alike. */
function manualTime(start: string): Scheduler & { now: () => Date; advance(ms: number): void; to(at: string): void } {
  let now = Date.parse(start);
  let next = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const advance = (ms: number) => {
    now += ms;
    for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at > now) continue;
      timers.delete(id);
      timer.run();
    }
  };
  return {
    setTimeout(run, ms) {
      timers.set(++next, { at: now + ms, run });
      return next;
    },
    clearTimeout: (handle) => void timers.delete(handle as number),
    now: () => new Date(now),
    advance,
    to: (at) => advance(Date.parse(at) - now),
  };
}

const counted = (told: Record<string, LimitsResult>) => createMemoryDataSource({ limits: told });
const issues = (page: Page) => {
  const found = [validatePage(page), checkPage(page)].map((check) => (check.ok ? [] : check.issues));
  expect(found[0]).toEqual(found[1]);
  return found[0];
};

describe('the page settings: limits, and an option’s seats', () => {
  it('are read by both checks on a page of responses', () => {
    expect(issues(signup())).toEqual([]);
    expect(issues(signup({ limits: { closes: '2026-11-20T18:30:00Z' } }))).toEqual([]);
  });

  it('refuse limits on a record’s page, limits saying nothing, a day that is none, and a close before the open', () => {
    expect(issues(signup({ data: { kind: 'record', model: 'event' } }))).toEqual([{ path: 'limits', message: expect.stringContaining('for a page of responses') }]);
    expect(issues(signup({ limits: { message: 'Closed.' } }))).toEqual([{ path: 'limits', message: 'say when it opens or closes, the most responses it takes, or that it takes one from each person' }]);
    expect(issues(signup({ limits: { opens: '2026-02-30T09:00' } }))).toEqual([{ path: 'limits.opens', message: '2026-02-30 is no day of the calendar' }]);
    expect(issues(signup({ limits: { opens: '2026-11-20T09:00', closes: '2026-11-19' } }))).toEqual([{ path: 'limits.closes', message: 'it closes before it opens: closes comes after opens' }]);
  });

  it('refuse words where a day goes, places on a table’s line, and Continue later on a list', () => {
    expect(validatePage(signup({ limits: { opens: 'next Monday' } })).ok).toBe(false);
    const lines = signup({
      fields: { ...signup().fields, guests: { type: 'one2many', label: 'Guests', relation: 'guest', fields: { meal: { type: 'selection', label: 'Meal', options: [{ value: 'fish', label: 'Fish', seats: 10 }] } } } },
    });
    expect(issues(lines)).toEqual([{ path: 'fields.guests.fields.meal.options[0].seats', message: expect.stringContaining('page’s own choices') }]);
    const list = { ...signup({ limits: undefined }), data: { kind: 'record', model: 'event' }, layout: { type: 'list', id: 'l', columns: ['name'] }, continueLater: true } as Page;
    expect(issues(list)).toEqual([{ path: 'continueLater', message: expect.stringContaining('a list of records has none to keep') }]);
  });
});

describe('when a page opens and closes, on its own clock', () => {
  it('reads a day and a time on the page’s clock, a day alone through its end, and an instant as written', () => {
    // Cairo is two hours ahead of UTC in November.
    expect(new Date(limitInstant('2026-11-01T09:00', 'Africa/Cairo') as number).toISOString()).toBe('2026-11-01T07:00:00.000Z');
    expect(new Date(limitInstant('2026-11-20', 'Africa/Cairo', true) as number).toISOString()).toBe('2026-11-20T22:00:00.000Z');
    expect(new Date(limitInstant('2026-11-20', 'Africa/Cairo') as number).toISOString()).toBe('2026-11-19T22:00:00.000Z');
    expect(new Date(limitInstant('2026-11-01T09:00+02:00', 'Europe/Berlin') as number).toISOString()).toBe('2026-11-01T07:00:00.000Z');
    expect(limitInstant('2026-13-01', undefined)).toBeNull();
  });

  it('says so before anything is typed — soon, then open as it opens, closed after its last day — without a source', () => {
    const time = manualTime('2026-10-31T12:00:00Z');
    const form = createForm({ page: signup({ limits: { opens: '2026-11-01T09:00', closes: '2026-11-20' } }), now: time.now, scheduler: time });
    expect(form.getState().limits).toEqual({ state: 'soon', opens: '2026-11-01T07:00:00.000Z', closes: '2026-11-20T22:00:00.000Z', seats: {} });
    expect(takingWords(form.page, form.getState().limits, MESSAGES.en)).toMatch(/^This form opens on 1 Nov 2026, 09:00/);
    // The page left open as it opens, listened to as a viewer listens: it opens of itself.
    form.subscribe(() => undefined);
    time.to('2026-11-01T07:00:01Z');
    expect(form.getState().limits?.state).toBe('open');
    time.to('2026-11-20T22:00:01Z');
    expect(form.getState().limits?.state).toBe('closed');
    expect(takingWords(form.page, form.getState().limits, MESSAGES.en)).toBe('This form closed on 20 Nov 2026.');
    expect(takingWords(form.page, form.getState().limits, MESSAGES.de)).toBe('Dieses Formular wurde am 20. Nov. 2026 geschlossen.');
  });

  it('refuses answers sent after it closed, in words, though the page was open when they were typed', async () => {
    const time = manualTime('2026-11-20T21:00:00Z');
    const source = createMemoryDataSource();
    const form = createForm({ page: signup({ limits: { closes: '2026-11-20' } }), dataSource: source, now: time.now, scheduler: time });
    form.setValue('name', 'Mona Adel');
    form.setValue('session', 'eve');
    time.advance(2 * 3600_000);
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem).toEqual({ kind: 'rule', message: 'This form closed on 20 Nov 2026.' });
    expect(source.responses).toEqual([]);
  });

  it('has no limits at all on a page that sets none, as before', () => {
    const form = createForm({ page: signup({ limits: undefined, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f', field: 'name' }] } }) });
    expect(form.getState().limits).toBeNull();
  });
});

describe('the most responses, one per person: counted by the source', () => {
  const open = () => manualTime('2026-11-10T10:00:00Z');

  it('asks as the page opens, nothing typed meanwhile, and says it is full', async () => {
    const time = open();
    const form = createForm({ page: signup(), dataSource: counted({ 'event-signup': { responses: 100 } }), now: time.now, scheduler: time });
    expect(form.getState().limits?.state).toBe('asking');
    await form.settled();
    expect(form.getState().limits).toMatchObject({ state: 'full', left: 0, message: 'See you in December.' });
    expect(takingWords(form.page, form.getState().limits, MESSAGES.en)).toBe('This form has all the responses it takes.');
  });

  it('takes one from each person: sent once, it says so, and another is refused', async () => {
    const time = open();
    const source = counted({});
    const form = createForm({ page: signup(), dataSource: source, now: time.now, scheduler: time });
    await form.settled();
    expect(form.getState().limits).toMatchObject({ state: 'open', left: 100 });
    form.setValue('name', 'Mona Adel');
    form.setValue('session', 'eve');
    expect(await form.save()).toBe(true);
    await form.settled();
    expect(form.getState().limits).toMatchObject({ state: 'sent', left: 99 });
    form.reset();
    await form.settled();
    form.setValue('name', 'Mona again');
    form.setValue('session', 'eve');
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem?.message).toBe('You have sent your answers to this form already.');
    expect(source.responses).toHaveLength(1);
  });

  it('keeps to its dates alone where the source has no limits: the counts are not drawn on', async () => {
    const time = open();
    const { limits: _none, ...source } = createMemoryDataSource();
    const form = createForm({ page: signup(), dataSource: source as DataSource, now: time.now, scheduler: time });
    expect(form.getState().limits).toMatchObject({ state: 'open', seats: {} });
    expect(form.getState().limits?.left).toBeUndefined();
  });

  it('shows its questions after 10 seconds where the source never answers', () => {
    const time = open();
    const source = createMemoryDataSource();
    source.limits = () => new Promise(() => undefined);
    const form = createForm({ page: signup(), dataSource: source, now: time.now, scheduler: time });
    expect(form.getState().limits?.state).toBe('asking');
    time.advance(9000);
    expect(form.getState().limits?.state).toBe('asking');
    time.advance(1000);
    expect(form.getState().limits?.state).toBe('open');
  });

  it('opens where the source fails to say: its submit refuses as it would', async () => {
    const time = open();
    const source = createMemoryDataSource();
    source.limits = () => Promise.reject(new Error('offline'));
    const form = createForm({ page: signup(), dataSource: source, now: time.now, scheduler: time });
    await form.settled();
    expect(form.getState().limits?.state).toBe('open');
  });

  it('asks with the person the app told the form of', async () => {
    const source = counted({});
    createForm({ page: signup(), dataSource: source, now: open().now, user: { id: 7, name: 'Mona Adel', roles: ['x'] } });
    expect(source.calls.find((call) => call.method === 'limits')?.request).toEqual({ pageId: 'event-signup', model: '', recordId: null, fields: ['session', 'extras'], user: { id: 7, name: 'Mona Adel' } });
  });
});

describe('a choice’s places (seats)', () => {
  const time = () => manualTime('2026-11-10T10:00:00Z');
  const filling = () => counted({ 'event-signup': { perChoice: { session: { am: 28, pm: 20 }, extras: { lunch: 1 } } } });

  it('shows each option’s places left, once the source told how many took it', async () => {
    const form = createForm({ page: signup(), dataSource: filling(), now: time().now });
    await form.settled();
    expect(form.getState().limits?.seats).toEqual({
      session: { am: { seats: 30, taken: 28, left: 2 }, pm: { seats: 20, taken: 20, left: 0 } },
      extras: { lunch: { seats: 2, taken: 1, left: 1 } },
    });
  });

  it('refuses a full option the person picks, says why under the field, and keeps what it held', async () => {
    const form = createForm({ page: signup(), dataSource: filling(), now: time().now });
    await form.settled();
    form.setValue('session', 'am');
    form.setValue('session', 'pm');
    expect(form.getState().values['session']).toBe('am');
    expect(form.getState().errors['session']).toBe('Afternoon workshop is full');
    // Said until the field changes.
    form.setValue('name', 'Mona');
    expect(form.getState().errors['session']).toBe('Afternoon workshop is full');
    form.setValue('session', 'eve');
    expect(form.getState().errors['session']).toBeUndefined();
    // The app's own value is the app's: written, and checked as the answers go.
    form.setValues({ session: 'pm' });
    expect(form.getState().values['session']).toBe('pm');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['session']).toBe('Afternoon workshop is full now: choose another');
  });

  it('refuses a choice of several only for the full option it adds', async () => {
    const source = counted({ 'event-signup': { perChoice: { extras: { lunch: 2 } } } });
    const form = createForm({ page: signup(), dataSource: source, now: time().now });
    await form.settled();
    form.setValue('extras', ['parking']);
    form.setValue('extras', ['parking', 'lunch']);
    expect(form.getState().values['extras']).toEqual(['parking']);
    expect(form.getState().errors['extras']).toBe('Lunch is full');
  });

  it('asks again as the answers go: an option someone else took meanwhile is said under its field, nothing sent', async () => {
    const source = filling();
    const form = createForm({ page: signup(), dataSource: source, now: time().now });
    await form.settled();
    form.setValue('name', 'Mona Adel');
    form.setValue('session', 'am');
    source.answeredElsewhere('event-signup', { session: 'am' });
    source.answeredElsewhere('event-signup', { session: 'am' });
    expect(await form.save()).toBe(false);
    expect(form.getState().errors['session']).toBe('Morning workshop is full now: choose another');
    expect(source.responses).toEqual([]);
    expect(source.calls.filter((call) => call.method === 'limits')).toHaveLength(2);
  });

  it('on a record’s page, counts the other records only: the record’s own choice is its own place', async () => {
    const page = { ...signup({ limits: undefined }), id: 'booking', data: { kind: 'record', model: 'booking' } } as Page;
    const source = createMemoryDataSource({ records: { booking: { 1: { name: 'Mona', session: 'pm' }, ...Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i + 2, { name: `Guest ${i}`, session: 'pm' }])) } } });
    const form = createForm({ page, dataSource: source, recordId: 1 });
    await form.load();
    await form.settled();
    expect(form.getState().limits?.seats['session']?.['pm']).toEqual({ seats: 20, taken: 19, left: 1 });
    expect(form.validate()).toBe(true);
  });

  it('counts an app’s list’s options with places once they load', async () => {
    const page = signup({ limits: undefined, fields: { ...signup().fields, session: { type: 'selection', label: 'Session', options: [], optionsFrom: { list: 'sessions' } } } });
    const source = createMemoryDataSource({ lists: { sessions: [{ value: 'am', label: 'Morning', seats: 3 }] }, limits: { 'event-signup': { perChoice: { session: { am: 3 } } } } });
    const form = createForm({ page, dataSource: source });
    form.loadChoices('session');
    await form.settled();
    expect(form.getState().limits?.seats['session']).toEqual({ am: { seats: 3, taken: 3, left: 0 } });
  });

  it('is worked out from the counts told, an option the source told nothing of counted as none taken', () => {
    const limits = limitsNow(signup({ limits: undefined }), 0, { perChoice: { session: { am: 31 } } }, false, (field) => (signup().fields[field] as unknown as { options: Option[] }).options);
    expect(limits?.seats).toEqual({ session: { am: { seats: 30, taken: 31, left: 0 }, pm: { seats: 20, taken: 0, left: 20 } } });
  });
});
