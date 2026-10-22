import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
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
  fieldia: '0.10',
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

  it('is checked: on a page of responses, a warning before its end', () => {
    expect(validatePage(timed()).ok).toBe(true);
    expect(validatePage(timed({ timeLimit: { minutes: 5, warn: 5 } })).ok).toBe(false);
    const issues = (page: Page) => (checkPage(page).ok ? [] : (checkPage(page) as { issues: { path: string; message: string }[] }).issues.map((issue) => `${issue.path}: ${issue.message}`));
    expect(issues(timed({ data: { kind: 'record', model: 'test' } }))).toEqual(['timeLimit: a time limit is for a page of responses: a record is saved as it is changed']);
  });
});
