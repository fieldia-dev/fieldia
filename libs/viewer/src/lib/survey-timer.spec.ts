import { createMemoryDataSource, type DataSource, type Page, type Scheduler } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { clockWords, timeWords } from './flow-timer';

/**
 * A time limit, as a person meets it: a page's said before its questions with Start, its countdown over them once
 * started, a warning said once, and as it runs out the answers sent as they stood — or locked for the person to send;
 * a step's limit counting from when it is entered, locking its answers and going on. The form's clock is the test's.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.useRealTimers();
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');
const words = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** A clock and a scheduler the test moves on: what is due runs as the clock passes it. */
function testClock(start: number) {
  let now = start;
  const due: { at: number; run: () => void; id: number }[] = [];
  let next = 1;
  const scheduler: Scheduler = {
    setTimeout: (run: () => void, ms: number) => {
      const id = next++;
      due.push({ at: now + ms, run, id });
      return id;
    },
    clearTimeout: (id: unknown) => {
      const at = due.findIndex((one) => one.id === id);
      if (at !== -1) due.splice(at, 1);
    },
  } as Scheduler;
  return {
    now: () => new Date(now),
    scheduler,
    advance(ms: number) {
      now += ms;
      for (const one of [...due].sort((a, b) => a.at - b.at)) {
        if (one.at > now) continue;
        due.splice(due.indexOf(one), 1);
        one.run();
      }
    },
  };
}

const test = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.7',
  id: 'timed',
  data: { kind: 'responses' },
  timeLimit: { minutes: 10, warn: 2 },
  fields: { name: { type: 'char', label: 'Your name', required: true }, answer: { type: 'char', label: 'Answer', required: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'q-name', field: 'name' }, { type: 'field', id: 'q-answer', field: 'answer' }] },
  ...more,
});

async function mount(page: Page, clock: ReturnType<typeof testClock>, dataSource: DataSource = createMemoryDataSource()) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource, now: clock.now, scheduler: clock.scheduler });
  await handle.drawn;
  await flush();
  return host;
}

describe('a time limit', () => {
  it('says a span of time in words, and what is left as a clock reads it', () => {
    expect(timeWords(20 * 60_000, 'en')).toBe('20 minutes');
    expect(timeWords(90_000, 'en')).toBe('1 minute 30 seconds');
    expect(clockWords(125_000)).toBe('2:05');
    expect(clockWords(3_725_000)).toBe('1:02:05');
  });

  it('is said before the questions with Start; once started, counts down, warns once, and sends the answers as they stood', async () => {
    const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
    const sent: Record<string, unknown>[] = [];
    const ds = createMemoryDataSource();
    const submit = ds.submit.bind(ds);
    ds.submit = (request) => (sent.push({ ...request }), submit(request));
    const host = await mount(test(), clock, ds);
    const start = host.querySelector('.fd-time-start') as HTMLElement;
    expect(visible(start)).toBe(true);
    expect(words(start)).toContain('You have 10 minutes to answer, from when you press Start.');
    expect(visible(host.querySelector('[data-node="q-name"]'))).toBe(false);
    (start.querySelector('button') as HTMLButtonElement).click();
    await flush();
    expect(visible(host.querySelector('[data-node="q-name"]'))).toBe(true);
    const bar = host.querySelector('.fd-time-bar') as HTMLElement;
    expect(bar.getAttribute('role')).toBe('timer');
    expect(words(bar)).toBe('Time left: 10:00');
    const input = host.querySelector('[data-node="q-name"] input') as HTMLInputElement;
    input.value = 'Mona';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    clock.advance(8 * 60_000 + 1000);
    // Drawn again as the form changes (and each second, on the browser's own clock).
    handle?.form.setValues({ name: 'Mona Adel' });
    await flush();
    expect(bar.dataset['stage']).toBe('warning');
    clock.advance(2 * 60_000);
    for (let turn = 0; turn < 20 && !sent.length; turn++) await flush();
    // Sent as it stood: the answer not given goes empty, the required check refusing nothing.
    expect(sent).toHaveLength(1);
    expect(sent[0]['values']).toEqual({ name: 'Mona Adel', answer: null });
    expect(sent[0]['timeUp']).toBe(true);
    expect(sent[0]['started']).toBe('2026-10-20T09:00:00.000Z');
    await flush();
    expect(visible(host.querySelector('.fd-done'))).toBe(true);
    expect(words(host.querySelector('.fd-time-done'))).toBe('Time is up: your answers were sent as they were.');
  });

  it('locks the answers for the person to send, where the page says so', async () => {
    const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
    const host = await mount(test({ timeLimit: { minutes: 1, then: 'lock' } }), clock);
    (host.querySelector('.fd-time-start button') as HTMLButtonElement).click();
    await flush();
    clock.advance(60_000);
    await flush();
    expect(handle?.form.getState().timeUp).toEqual(['#form']);
    expect(handle?.form.node('q-name').readonly).toBe(true);
    expect(words(host.querySelector('.fd-time-said'))).toBe('Time is up: your answers are locked. Press Submit to send them.');
  });

  it('counts a step’s own limit from when it is entered, then locks it and goes on', async () => {
    const clock = testClock(Date.parse('2026-10-20T09:00:00Z'));
    const page = test({
      timeLimit: undefined,
      layout: {
        type: 'wizard',
        id: 'w',
        children: [
          { type: 'step', id: 's1', label: 'First', timeLimit: { minutes: 1 }, children: [{ type: 'field', id: 'q-name', field: 'name' }] },
          { type: 'step', id: 's2', label: 'Second', children: [{ type: 'field', id: 'q-answer', field: 'answer' }] },
        ],
      },
    });
    const host = await mount(page, clock);
    expect(visible(host.querySelector('.fd-time-start'))).toBe(false);
    expect(words(host.querySelector('.fd-time-bar'))).toBe('Time left for this step: 1:00');
    clock.advance(60_000);
    await flush();
    expect(handle?.form.getState().step).toBe('s2');
    expect(words(host.querySelector('.fd-time-said'))).toBe('Time is up for this step: its answers are kept as they are.');
    expect(handle?.form.node('q-name').readonly).toBe(true);
  });
});
