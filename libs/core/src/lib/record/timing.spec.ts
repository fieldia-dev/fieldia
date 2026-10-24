import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { ownerOf } from './browser-kept';
import type { Scheduler } from './scheduler';
import { countdownOf, limitsOf } from './timing';

/**
 * A page's time limits, as the form keeps them: a page's clock from Start, a step's from when it is entered; each set to
 * run out on the form's clock — its answers then locked and their checks refusing nothing, a step's that locks giving
 * way to the next — kept in drafts and told with the send.
 */

/** A clock and a scheduler the test moves on. */
function testClock(start: number) {
  let now = start;
  const due: { at: number; run: () => void; id: number }[] = [];
  let next = 1;
  const scheduler = {
    setTimeout: (run: () => void, ms: number) => {
      const id = next++;
      due.push({ at: now + ms, run, id });
      return id;
    },
    clearTimeout: (id: unknown) => {
      const at = due.findIndex((one) => one.id === id);
      if (at !== -1) due.splice(at, 1);
    },
  } as unknown as Scheduler;
  return {
    now: () => new Date(now),
    scheduler,
    advance(ms: number) {
      now += ms;
      for (const one of [...due].sort((a, b) => a.at - b.at)) {
        if (one.at > now || !due.includes(one)) continue;
        due.splice(due.indexOf(one), 1);
        one.run();
      }
    },
  };
}

const timed = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.11',
  id: 'timed',
  data: { kind: 'responses' },
  timeLimit: { minutes: 10, warn: 2 },
  fields: { name: { type: 'char', label: 'Your name', required: true }, answer: { type: 'char', label: 'Answer', required: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'q-name', field: 'name' }, { type: 'field', id: 'q-answer', field: 'answer' }] },
  ...more,
});

describe('a time limit', () => {
  it('is kept to in ms, warns a fifth of the way from its end where it says nothing, sends a page’s and locks a step’s unless said', () => {
    expect(limitsOf(timed())).toEqual({ '#form': { scope: '#form', ms: 600_000, warnMs: 120_000, then: 'send' } });
    const steps = limitsOf(
      timed({ timeLimit: undefined, layout: { type: 'wizard', id: 'w', children: [{ type: 'step', id: 's1', label: 'One', timeLimit: { minutes: 2 }, children: [] }] } })
    );
    expect(steps['s1']).toEqual({ scope: 's1', ms: 120_000, warnMs: 24_000, then: 'lock' });
    expect(countdownOf(steps['s1'], 0, 100_000)).toMatchObject({ left: 20_000, stage: 'warning' });
    expect(countdownOf(steps['s1'], 0, 130_000)).toMatchObject({ left: 0, stage: 'up' });
  });

  it('runs from Start, runs out on time, and sends the answers as they stood, telling when it started', async () => {
    const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
    const sent: Record<string, unknown>[] = [];
    const ds = createMemoryDataSource();
    const submit = ds.submit.bind(ds);
    ds.submit = (request) => (sent.push({ ...request }), submit(request));
    const form = createForm({ page: timed(), dataSource: ds, now: clock.now, scheduler: clock.scheduler });
    expect(form.countdown()).toBeNull();
    form.startTimer();
    expect(form.countdown()).toMatchObject({ scope: '#form', left: 600_000, stage: 'running' });
    form.setValues({ name: 'Mona' });
    clock.advance(9 * 60_000);
    expect(form.countdown()?.stage).toBe('warning');
    clock.advance(60_000);
    expect(form.getState().timeUp).toEqual(['#form']);
    expect(form.node('q-answer').readonly).toBe(true);
    // Its checks refuse nothing now: the required answer not given goes empty.
    expect(form.validate()).toBe(true);
    expect(await form.save()).toBe(true);
    expect(sent[0]).toMatchObject({ values: { name: 'Mona', answer: null }, started: '2026-10-20T09:00:00.000Z', timeUp: true });
    // Another response starts with no clock.
    form.reset();
    expect(form.getState().timers).toEqual({});
    expect(form.getState().timeUp).toEqual([]);
  });

  it('counts a step’s from when it is entered, locks it as it runs out and goes on; kept in a draft, it counts on', async () => {
    const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
    const page = timed({
      timeLimit: undefined,
      layout: {
        type: 'wizard',
        id: 'w',
        children: [
          { type: 'step', id: 's1', label: 'One', children: [{ type: 'field', id: 'q-name', field: 'name' }] },
          { type: 'step', id: 's2', label: 'Two', timeLimit: { minutes: 1 }, children: [{ type: 'field', id: 'q-answer', field: 'answer' }] },
        ],
      },
    });
    const kept = new Map<string, string>();
    const store = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value), removeItem: (key: string) => void kept.delete(key) };
    const form = createForm({ page, dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler, drafts: { store, delayMs: 10 } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    form.setValues({ name: 'Mona' });
    expect(form.next()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(form.getState().timers).toEqual({ s2: Date.parse('2026-10-20T09:00:00Z') });
    clock.advance(20);
    expect(JSON.parse([...kept.values()][0]).timers).toEqual({ s2: '2026-10-20T09:00:00.000Z' });
    clock.advance(60_000);
    expect(form.getState().timeUp).toEqual(['s2']);
    expect(form.node('q-answer').readonly).toBe(true);
    expect(form.validate()).toBe(true);
  });

  describe('a reload', () => {
    /** The tab's own store (sessionStorage), as a browser has it: what a reload of the tab finds again. */
    let tab: Map<string, string>;
    const tabStore = () => ({ getItem: (key: string) => tab.get(key) ?? null, setItem: (key: string, value: string) => void tab.set(key, value), removeItem: (key: string) => void tab.delete(key), get length() { return tab.size; } });
    beforeEach(() => {
      tab = new Map();
      (globalThis as { sessionStorage?: unknown }).sessionStorage = tabStore();
    });
    afterEach(() => void delete (globalThis as { sessionStorage?: unknown }).sessionStorage);

    it('goes on with the time left, the answers in place, where the app keeps no drafts: kept in the tab’s store', () => {
      const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
      const first = createForm({ page: timed(), dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler });
      first.startTimer();
      // The clock's start is kept at once: a reload a moment after Start does not start it again.
      expect(JSON.parse(tab.get(`fieldia:draft:${ownerOf(null)}:timed:new`) ?? '{}').timers).toEqual({ '#form': '2026-10-20T09:00:00.000Z' });
      first.setValues({ name: 'Mona Adel' });
      clock.advance(3 * 60_000);
      first.dispose();
      // The tab reloaded: the same page, a new form.
      const again = createForm({ page: timed(), dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler });
      expect(again.getState().values['name']).toBe('Mona Adel');
      expect(again.getState().draft).toBeNull();
      expect(again.countdown()).toMatchObject({ scope: '#form', left: 7 * 60_000, stage: 'running' });
      clock.advance(5 * 60_000);
      expect(again.countdown()?.stage).toBe('warning');
      clock.advance(2 * 60_000);
      expect(again.getState().timeUp).toEqual(['#form']);
    });

    it('keeps each answer the moment it is given: a reload a moment after loses nothing; sent or started again, nothing', async () => {
      const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
      const first = createForm({ page: timed(), dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler });
      first.startTimer();
      first.setValue('name', 'Mona Adel', { by: 'person' });
      first.setValue('answer', 'Hyaluronidase', { by: 'person' });
      // No time at all for a draft to wait: the tab has them.
      expect(JSON.parse(tab.get(`fieldia:draft:${ownerOf(null)}:timed:new`) ?? '{}').values).toMatchObject({ name: 'Mona Adel', answer: 'Hyaluronidase' });
      expect(await first.save()).toBe(true);
      expect(tab.size).toBe(0);
      // Started again: a new response, no clock, nothing kept until it starts.
      first.reset();
      expect(tab.size).toBe(0);
    });

    it('past its end: the time is up at once, the answers locked to go as the page says', async () => {
      const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
      const sent: Record<string, unknown>[] = [];
      const ds = createMemoryDataSource();
      const submit = ds.submit.bind(ds);
      ds.submit = (request) => (sent.push({ ...request }), submit(request));
      const first = createForm({ page: timed(), dataSource: ds, now: clock.now, scheduler: clock.scheduler });
      first.startTimer();
      first.setValues({ name: 'Mona Adel' });
      clock.advance(1000);
      first.dispose();
      clock.advance(20 * 60_000);
      const again = createForm({ page: timed(), dataSource: ds, now: clock.now, scheduler: clock.scheduler });
      clock.advance(0);
      expect(again.getState().timeUp).toEqual(['#form']);
      expect(again.countdown()).toMatchObject({ left: 0, stage: 'up' });
      expect(again.node('q-name').readonly).toBe(true);
      expect(await again.save()).toBe(true);
      expect(sent[0]).toMatchObject({ values: { name: 'Mona Adel', answer: null }, started: '2026-10-20T09:00:00.000Z', timeUp: true });
      // Sent: the draft is let go — the next response is another's, with its own clock.
      expect(tab.size).toBe(0);
    });

    it('lays a draft whose clock started at once, even where the app’s store asks first', () => {
      const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
      const kept = new Map<string, string>();
      const store = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value), removeItem: (key: string) => void kept.delete(key) };
      const first = createForm({ page: timed(), dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler, drafts: { store, restore: 'ask' } });
      first.startTimer();
      first.setValues({ name: 'Mona Adel' });
      clock.advance(60_000);
      first.dispose();
      const again = createForm({ page: timed(), dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler, drafts: { store, restore: 'ask' } });
      // Never offered to be let go: discarding it would start the clock again.
      expect(again.getState().draft).toBeNull();
      expect(again.getState().values['name']).toBe('Mona Adel');
      expect(again.countdown()).toMatchObject({ left: 9 * 60_000 });
      // The app's store, not the tab's.
      expect(tab.size).toBe(0);
    });

    it('a step’s limit too: the step it was on, counting on', async () => {
      const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
      const page = timed({
        timeLimit: undefined,
        layout: {
          type: 'wizard',
          id: 'w',
          children: [
            { type: 'step', id: 's1', label: 'One', children: [{ type: 'field', id: 'q-name', field: 'name' }] },
            { type: 'step', id: 's2', label: 'Two', timeLimit: { minutes: 2 }, children: [{ type: 'field', id: 'q-answer', field: 'answer' }] },
          ],
        },
      });
      const first = createForm({ page, dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler });
      await new Promise((resolve) => setTimeout(resolve, 0));
      first.setValues({ name: 'Mona Adel' });
      expect(first.next()).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(first.getState().timers).toEqual({ s2: Date.parse('2026-10-20T09:00:00Z') });
      clock.advance(60_000);
      first.dispose();
      const again = createForm({ page, dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler });
      expect(again.getState().step).toBe('s2');
      expect(again.getState().values['name']).toBe('Mona Adel');
      expect(again.countdown()).toMatchObject({ scope: 's2', left: 60_000 });
    });

    it('a page with no limit keeps nothing in the tab', () => {
      const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
      const form = createForm({ page: timed({ timeLimit: undefined }), dataSource: createMemoryDataSource(), now: clock.now, scheduler: clock.scheduler });
      form.setValues({ name: 'Mona Adel' });
      clock.advance(60_000);
      expect(tab.size).toBe(0);
    });
  });

  it('is checked: on a page of responses, a warning before its end', () => {
    expect(validatePage(timed()).ok).toBe(true);
    expect(validatePage(timed({ timeLimit: { minutes: 5, warn: 5 } })).ok).toBe(false);
    const issues = (page: Page) => (checkPage(page).ok ? [] : (checkPage(page) as { issues: { path: string; message: string }[] }).issues.map((issue) => `${issue.path}: ${issue.message}`));
    expect(issues(timed({ data: { kind: 'record', model: 'test' } }))).toEqual(['timeLimit: a time limit is for a page of responses: a record is saved as it is changed']);
  });
});
