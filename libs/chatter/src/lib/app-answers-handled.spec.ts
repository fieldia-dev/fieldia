import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { installZonePromises } from '../../../../testing/zone-promises';
import { mountChatter, type ChatterHandle, type ChatterOptions } from './chatter';
import { mountDiscussion } from './discussion';
import { mountHistory } from './history';
import { createMemoryChatter } from './memory';
import { chatterAttachments, chatterSlot } from './slot';
import type { Channel, ChatterMessage, ChatterSource } from './source';

/**
 * Every promise the chatter is given by the app's source is handled the moment it is given — never when the chatter
 * first awaits it — so one the source refused at once, or had refused already, is never said unhandled by a zone that
 * watches its own promises: Angular's, which tells `NgZone.onError` (0.36.1's FU2, in the chatter's own calls). The zone
 * looks at a promise refused in its drain before any job of the engine's queued after it — a native `await`'s, the
 * chatter's own code, which Angular did not compile — and at one its own `Promise.all` or `then` made of it as soon as
 * that ran (testing/zone-promises.ts). Each kind the source answers: the conversation (`messages`: the chatter's, asked
 * again while it is live, a discussion's, a history's, a sheet's attachments), Send (`post`: the composer's, a
 * discussion's, a step's), Retry (`resend`), the channels a reply goes by (`replyChannels`), a file (`upload`), a
 * reaction (`react`), the people suggested (`people`), the activities, their types, Schedule, Mark done and Cancel,
 * the followers, Add and Stop following. What a person pressed says why, and goes at the next press; what the chatter
 * asked of itself keeps what it drew, and is asked again — none of it left unhandled, the chatter's own promises neither.
 */

const me = { id: 1, name: 'Ramy Fathi' };
const mona = { id: 2, name: 'Mona Adel' };
const order = { model: 'sale.order', id: 7 };
const CHANNELS: Channel[] = [
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
  { id: 'sms', label: 'SMS', icon: 'phone' },
];
const MESSAGES: ChatterMessage[] = [
  { id: 2, kind: 'message', author: me, date: '2026-10-19T14:00:00Z', body: '<p>Your viewing is booked.</p>', channel: 'sms', direction: 'out', delivery: 'failed', failure: 'The number cannot take SMS' },
  { id: 1, kind: 'message', author: mona, date: '2026-10-19T10:00:00Z', body: '<p>Is the garden flat still available?</p>', channel: 'whatsapp', direction: 'in', attachments: [{ id: 9, name: 'plan.pdf', type: 'application/pdf', size: 8, url: 'https://files.example/plan.pdf' }] },
];

function memory() {
  return createMemoryChatter({
    me,
    people: [me, mona],
    now: () => new Date('2026-10-20T10:00:00Z'),
    activityTypes: [{ id: 'call', name: 'Call', daysUntilDue: 2 }],
    records: {
      'sale.order:7': {
        messages: MESSAGES,
        activities: [{ id: 51, type: { id: 'call', name: 'Call' }, summary: 'Confirm the van', due: '2026-10-22', assignee: mona }],
        followers: [{ id: 61, person: mona }],
        replyChannels: [{ id: 'whatsapp', to: '+20 100 123 4567' }],
      },
    },
  });
}

const wait = (ms = 0) => new Promise((done) => setTimeout(done, ms));
/** Long enough for anything left unhandled to be said. */
const settle = async () => {
  for (let i = 0; i < 8; i++) await wait(5);
};
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await wait(10);
  expect(check()).toBeTruthy();
}

let zone: ReturnType<typeof installZonePromises>;
let handle: ChatterHandle | null = null;
let viewer: ViewerHandle | null = null;
beforeEach(() => {
  zone = installZonePromises();
});
afterEach(() => {
  zone.restore();
  handle?.destroy();
  handle = null;
  viewer?.destroy();
  viewer = null;
  document.body.replaceChildren();
});
const said = () => zone.said.map((reason) => (reason as Error)?.message ?? String(reason));

/** The source's refusals: made at once, as it is asked; or made before it was asked, in an earlier turn, and kept. */
const FAILED = 'The server did not answer';
const atOnce = <T>() => Promise.reject(new Error(FAILED)) as Promise<T>;
async function already<T>(): Promise<() => Promise<T>> {
  const kept = Promise.reject(new Error(FAILED)) as Promise<T>;
  // Its first asker handled it, as the app's cache had it handled.
  kept.then(undefined, () => undefined);
  await settle();
  return () => kept;
}
type Refuse = <T>() => Promise<T>;
const KINDS: [string, () => Promise<Refuse>][] = [
  ['refused as it is asked', async () => atOnce],
  ['refused already, before it was asked', async () => (await already()) as Refuse],
];

/**
 * A source whose `member` the test refuses while `fails.now` holds, else answers as the memory source does. The rest as
 * the memory source.
 */
function refusing<K extends keyof ChatterSource>(member: K, refuse: Refuse, base: ChatterSource = memory()) {
  const fails = { now: true };
  const own = base[member] as unknown as (...args: unknown[]) => unknown;
  const source = { ...base, [member]: (...args: unknown[]) => (fails.now ? refuse() : own.apply(base, args)) } as ChatterSource;
  return { source, fails, base };
}

async function mount(source: ChatterSource, more: Partial<ChatterOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountChatter(host, { source, record: order, now: () => new Date('2026-10-20T10:00:00Z'), ...more });
  await settle();
  return host;
}
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => (b.textContent?.trim() === name || b.getAttribute('aria-label') === name) && !b.closest('[hidden]')) as HTMLButtonElement | undefined;
const messages = (root: Element) => [...root.querySelectorAll('.fd-message')].map((item) => item.getAttribute('data-message'));
const failedLine = (root: Element) => root.querySelector('.fd-chatter-failed') as HTMLElement | null;
const shownFailure = (root: Element) => (failedLine(root)?.hidden === false ? failedLine(root)?.textContent : null);
function type(box: HTMLTextAreaElement | HTMLInputElement, text: string) {
  box.focus();
  box.value = text;
  if (box instanceof HTMLTextAreaElement) box.setSelectionRange(text.length, text.length);
  box.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('what the chatter asks by itself: what it drew kept, asked again, nothing left unhandled', () => {
  it.each(KINDS)('%s: the conversation (`messages`), drawn once it is asked again', async (_, made) => {
    const { source, fails } = refusing('messages', await made());
    const host = await mount(source);
    expect(messages(host)).toEqual([]);
    expect(said()).toEqual([]);
    fails.now = false;
    await handle?.refresh();
    expect(messages(host)).toEqual(['2', '1']);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: the conversation asked again while it is live, kept as drawn', async (_, made) => {
    const refuse = await made();
    const base = memory();
    let asked = 0;
    const source: ChatterSource = { ...base, messages: (record) => (++asked > 1 ? refuse() : base.messages(record)) };
    const host = await mount(source, { channels: CHANNELS, live: { every: 20 } });
    await until(() => asked > 2);
    await settle();
    expect(messages(host)).toEqual(['2', '1']);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: the channels a reply goes by (`replyChannels`): none offered, Send message hidden', async (_, made) => {
    const { source } = refusing('replyChannels', await made());
    const host = await mount(source, { channels: CHANNELS, live: false });
    expect(button(host, 'Send message')).toBeUndefined();
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: its activities (`activities`), listed once asked again', async (_, made) => {
    const { source, fails } = refusing('activities', await made());
    const host = await mount(source);
    expect(host.querySelectorAll('.fd-activity')).toHaveLength(0);
    expect(said()).toEqual([]);
    fails.now = false;
    await handle?.refresh();
    await until(() => host.querySelectorAll('.fd-activity').length === 1);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: its followers (`followers`), counted once asked again', async (_, made) => {
    const { source, fails } = refusing('followers', await made());
    const host = await mount(source);
    const toggle = host.querySelector('.fd-followers-toggle') as HTMLElement;
    expect(toggle.getAttribute('aria-label')).toBe('Followers: 0');
    expect(said()).toEqual([]);
    fails.now = false;
    await handle?.refresh();
    await until(() => toggle.getAttribute('aria-label') === 'Followers: 1');
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: the people suggested after an @ (`people`): none, nothing left unhandled', async (_, made) => {
    const { source } = refusing('people', await made());
    const host = await mount(source);
    button(host, 'Send message')!.click();
    type(host.querySelector('.fd-composer textarea') as HTMLTextAreaElement, 'Over to you @mo');
    await settle();
    expect(host.querySelector('.fd-mentions [role=option]')).toBeNull();
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: the people found to follow (`people`): none, nothing left unhandled', async (_, made) => {
    const { source } = refusing('people', await made());
    const host = await mount(source);
    (host.querySelector('.fd-followers-toggle') as HTMLButtonElement).click();
    type(host.querySelector('.fd-followers input[type=search]') as HTMLInputElement, 'mo');
    await settle();
    expect(host.querySelector('.fd-follower-candidates [role=option]')).toBeNull();
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: a discussion’s comments (`messages`), drawn once asked again', async (_, made) => {
    const { source, fails } = refusing('messages', await made());
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountDiscussion(host, { source, record: order, me });
    await settle();
    expect(host.querySelectorAll('.fd-discussion-comments .fd-comment-card')).toHaveLength(0);
    expect(said()).toEqual([]);
    fails.now = false;
    await handle.refresh();
    expect(host.querySelectorAll('.fd-discussion-comments .fd-comment-card')).toHaveLength(2);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: the people suggested in a discussion after an @ (`people`): none, nothing left unhandled', async (_, made) => {
    const { source } = refusing('people', await made());
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountDiscussion(host, { source, record: order, me });
    await settle();
    const area = host.querySelector('.fd-text-area') as HTMLElement;
    area.focus();
    area.innerHTML = '<p>ask @mo</p>';
    const text = (area.querySelector('p') as HTMLElement).firstChild as Text;
    const range = document.createRange();
    range.setStart(text, text.length);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    area.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(host.querySelector('.fd-text-suggest [role=option]')).toBeNull();
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: a history (`messages`), drawn once asked again', async (_, made) => {
    const { source, fails } = refusing('messages', await made());
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountHistory(host, { source, record: order, now: () => new Date('2026-10-20T10:00:00Z') });
    await settle();
    expect(said()).toEqual([]);
    fails.now = false;
    await handle.refresh();
    expect(host.querySelectorAll('[role=option]').length).toBeGreaterThan(0);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: a sheet’s attachments from the conversation (`chatterAttachments`): refused to its asker', async (_, made) => {
    const { source, fails } = refusing('messages', await made());
    const attachments = chatterAttachments(source);
    await expect(attachments({ model: 'sale.order', id: 7 } as never)).rejects.toThrow(FAILED);
    await settle();
    expect(said()).toEqual([]);
    fails.now = false;
    expect((await attachments({ model: 'sale.order', id: 7 } as never)).map((file) => file.name)).toEqual(['plan.pdf']);
  });
});

describe('what a person asks: said why, done at the next press, nothing left unhandled', () => {
  it.each(KINDS)('%s: Send (`post`)', async (_, made) => {
    const { source, fails, base } = refusing('post', await made());
    const host = await mount(source);
    button(host, 'Send message')!.click();
    type(host.querySelector('.fd-composer textarea') as HTMLTextAreaElement, 'Thursday at 11?');
    button(host, 'Send')!.click();
    await settle();
    expect(host.querySelector('.fd-chatter-problem')?.textContent).toBe(`Not sent: ${FAILED}`);
    expect(said()).toEqual([]);
    fails.now = false;
    button(host, 'Send')!.click();
    await until(() => (base as ReturnType<typeof memory>).posted.length === 1);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: a discussion’s Save (`post`)', async (_, made) => {
    const { source } = refusing('post', await made());
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountDiscussion(host, { source, record: order, me });
    await settle();
    const area = host.querySelector('.fd-text-area') as HTMLElement;
    area.innerHTML = '<p>Checked the plan.</p>';
    area.dispatchEvent(new Event('input', { bubbles: true }));
    button(host, 'Save')!.click();
    await settle();
    expect(host.querySelector('.fd-discussion-problem')?.textContent).toBe(`Not sent: ${FAILED}`);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: a step’s post in the sheet’s conversation (`post`, `chatterSlot`)', async (_, made) => {
    const { source, fails, base } = refusing('post', await made());
    const page = {
      fieldia: '0.13',
      id: 'order',
      data: { kind: 'record', model: 'sale.order' },
      fields: { name: { type: 'char', label: 'Order' } },
      layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'slot', id: 'chat', name: 'chatter' }] },
    } as unknown as Page;
    const host = document.createElement('div');
    document.body.append(host);
    viewer = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { 'sale.order': { 7: { name: 'S00007' } } } }), recordId: 7, slots: { chatter: chatterSlot({ source }) } });
    await viewer.drawn;
    await settle();
    await viewer.run([{ do: 'post', message: 'Priced at 4,200' }]);
    await settle();
    expect(said()).toEqual([]);
    fails.now = false;
    await viewer.run([{ do: 'post', message: 'Priced at 4,200' }]);
    await until(() => (base as ReturnType<typeof memory>).posted.length === 1);
    await settle();
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: Retry of a message not delivered (`resend`): not delivered, with why', async (_, made) => {
    const { source } = refusing('resend', await made());
    const host = await mount(source, { channels: CHANNELS, live: false });
    (host.querySelector('.fd-message[data-message="2"] .fd-message-retry') as HTMLButtonElement).click();
    await settle();
    expect(host.querySelector('.fd-message[data-message="2"] .fd-message-failure span')?.textContent).toBe(`Not delivered: ${FAILED}`);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: a file attached (`upload`): not uploaded, with Retry', async (_, made) => {
    const refuse = await made();
    const base = memory();
    let fails = true;
    const source: ChatterSource = { ...base, upload: (record, file, how) => (fails ? refuse() : base.upload!(record, file, how)) };
    const host = await mount(source);
    button(host, 'Send message')!.click();
    const input = host.querySelector('.fd-composer input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['%PDF-1.4'], 'Quote.pdf', { type: 'application/pdf' })], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => host.querySelector('.fd-composer .fd-file-going[data-status="failed"]'));
    expect(host.querySelector('.fd-chatter-problem')?.textContent).toBe('Quote.pdf was not uploaded');
    expect(said()).toEqual([]);
    fails = false;
    (host.querySelector('.fd-composer .fd-file-retry') as HTMLButtonElement).click();
    await until(() => host.querySelector('.fd-composer .fd-attachment'));
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: a reaction (`react`)', async (_, made) => {
    const { source, fails } = refusing('react', await made());
    const host = await mount(source);
    const first = () => host.querySelector('.fd-message') as HTMLElement;
    button(first(), 'Add a reaction')!.click();
    (first().querySelector('.fd-reaction-picker button[data-emoji="🎉"]') as HTMLButtonElement).click();
    await settle();
    expect(shownFailure(host)).toBe(`Not done: ${FAILED}`);
    expect(first().querySelector('.fd-reaction')).toBeNull();
    expect(said()).toEqual([]);
    fails.now = false;
    button(first(), 'Add a reaction')!.click();
    (first().querySelector('.fd-reaction-picker button[data-emoji="🎉"]') as HTMLButtonElement).click();
    await until(() => first().querySelector('.fd-reaction'));
    expect(shownFailure(host)).toBeNull();
  });

  it.each(KINDS)('%s: Schedule activity, its types (`activityTypes`): the form not opened', async (_, made) => {
    const { source, fails } = refusing('activityTypes', await made());
    const host = await mount(source);
    button(host, 'Schedule activity')!.click();
    await settle();
    expect(shownFailure(host)).toBe(`Not done: ${FAILED}`);
    expect((host.querySelector('.fd-activity-form') as HTMLElement).hidden).toBe(true);
    expect(said()).toEqual([]);
    fails.now = false;
    button(host, 'Schedule activity')!.click();
    await until(() => !(host.querySelector('.fd-activity-form') as HTMLElement).hidden);
    expect(shownFailure(host)).toBeNull();
  });

  it.each(KINDS)('%s: Schedule activity, who can do it (`people`): the form not opened', async (_, made) => {
    const { source } = refusing('people', await made());
    const host = await mount(source);
    button(host, 'Schedule activity')!.click();
    await settle();
    expect(shownFailure(host)).toBe(`Not done: ${FAILED}`);
    expect((host.querySelector('.fd-activity-form') as HTMLElement).hidden).toBe(true);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: Schedule (`schedule`): the form kept open', async (_, made) => {
    const { source } = refusing('schedule', await made());
    const host = await mount(source);
    button(host, 'Schedule activity')!.click();
    const form = host.querySelector('.fd-activity-form') as HTMLElement;
    await until(() => !form.hidden);
    (form.querySelector('input[name="summary"]') as HTMLInputElement).value = 'Book the electrician';
    button(form, 'Schedule')!.click();
    await settle();
    expect(shownFailure(host)).toBe(`Not done: ${FAILED}`);
    expect(form.hidden).toBe(false);
    expect(host.querySelectorAll('.fd-activity')).toHaveLength(1);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: Mark done (`markDone`): the activity still listed', async (_, made) => {
    const { source, fails } = refusing('markDone', await made());
    const host = await mount(source);
    await until(() => host.querySelector('.fd-activity'));
    const activity = host.querySelector('.fd-activity') as HTMLElement;
    button(activity, 'Mark done')!.click();
    button(activity, 'Done')!.click();
    await settle();
    expect(shownFailure(host)).toBe(`Not done: ${FAILED}`);
    expect(host.querySelectorAll('.fd-activity')).toHaveLength(1);
    expect(said()).toEqual([]);
    fails.now = false;
    button(activity, 'Done')!.click();
    await until(() => host.querySelectorAll('.fd-activity').length === 0);
    expect(shownFailure(host)).toBeNull();
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: Cancel activity (`cancel`): the activity still listed', async (_, made) => {
    const { source } = refusing('cancel', await made());
    const host = await mount(source);
    await until(() => host.querySelector('.fd-activity'));
    button(host.querySelector('.fd-activity') as HTMLElement, 'Cancel activity')!.click();
    await settle();
    expect(shownFailure(host)).toBe(`Not done: ${FAILED}`);
    expect(host.querySelectorAll('.fd-activity')).toHaveLength(1);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: Add follower (`follow`)', async (_, made) => {
    const { source } = refusing('follow', await made());
    const host = await mount(source);
    (host.querySelector('.fd-followers-toggle') as HTMLButtonElement).click();
    type(host.querySelector('.fd-followers input[type=search]') as HTMLInputElement, 'ram');
    await until(() => host.querySelector('.fd-follower-candidates [role=option]'));
    (host.querySelector('.fd-follower-candidates [role=option]') as HTMLElement).click();
    await settle();
    expect(shownFailure(host)).toBe(`Not done: ${FAILED}`);
    expect((host.querySelector('.fd-followers-toggle') as HTMLElement).getAttribute('aria-label')).toBe('Followers: 1');
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: Stop following (`unfollow`)', async (_, made) => {
    const { source } = refusing('unfollow', await made());
    const host = await mount(source);
    (host.querySelector('.fd-followers-toggle') as HTMLButtonElement).click();
    await until(() => host.querySelector('button[aria-label="Stop Mona Adel following"]'));
    (host.querySelector('button[aria-label="Stop Mona Adel following"]') as HTMLButtonElement).click();
    await settle();
    expect(shownFailure(host)).toBe(`Not done: ${FAILED}`);
    expect((host.querySelector('.fd-followers-toggle') as HTMLElement).getAttribute('aria-label')).toBe('Followers: 1');
    expect(said()).toEqual([]);
  });
});
