import { createForm, createMemoryDataSource, type Page } from '@fieldia/core';
import { mountChatter, type ChatterHandle, type ChatterOptions } from './chatter';
import { channelsPart } from './chatter-parts';
import { createMemoryChatter, type MemoryChatterOptions } from './memory';
import { chatterSlot } from './slot';
import type { Channel, ChatterMessage, ChatterSource, RecordRef } from './source';

/**
 * A conversation that knows its channels: each message's channel and ticks, a reply by the customer's channel,
 * messages arriving live — pushed, or asked for again politely — and follow-ups at an hour on the page's clock.
 */

const me = { id: 1, name: 'Salma Nabil' };
const mona = { id: 2, name: 'Mona Adel' };
const karim = { id: 3, name: 'Karim Fathy' };
const enquiry = { model: 'enquiry', id: 1 };
const CHANNELS: Channel[] = [
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' },
  { id: 'email', label: 'E-mail', icon: 'mail' },
  { id: 'sms', label: 'SMS', icon: 'phone' },
  { id: 'note', label: 'Team note', icon: 'users', note: true },
];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(check()).toBeTruthy();
}

const conversation = (): ChatterMessage[] => [
  { id: 6, kind: 'message', author: me, date: '2026-10-20T09:40:00Z', body: '<p>Shall we say Thursday at 11?</p>', channel: 'whatsapp', direction: 'out', delivery: 'delivered' },
  { id: 5, kind: 'note', author: karim, date: '2026-10-20T09:00:00Z', body: '<p>She is serious: pre-approved for a mortgage.</p>' },
  { id: 4, kind: 'message', author: mona, date: '2026-10-20T08:30:00Z', body: '<p>Can I see the flat this week?</p>', channel: 'whatsapp', direction: 'in' },
  { id: 3, kind: 'message', author: me, date: '2026-10-19T15:00:00Z', body: '<p>The floor plan, attached.</p>', channel: 'email', direction: 'out', delivery: 'read' },
  { id: 2, kind: 'message', author: me, date: '2026-10-19T14:00:00Z', body: '<p>Your viewing is booked.</p>', channel: 'sms', direction: 'out', delivery: 'failed', failure: 'The number cannot take SMS' },
  { id: 1, kind: 'message', author: mona, date: '2026-10-19T10:00:00Z', body: '<p>Is the garden flat still available?</p>', channel: 'email', direction: 'in' },
];

function source(more: Partial<MemoryChatterOptions> = {}) {
  return createMemoryChatter({
    me,
    people: [me, mona, karim],
    now: () => new Date('2026-10-20T10:00:00Z'),
    records: {
      'enquiry:1': { messages: conversation(), replyChannels: [{ id: 'whatsapp', to: '+20 100 123 4567' }, { id: 'email', to: 'mona@example.com' }] },
      // No e-mail on this customer: a reply goes by WhatsApp or not at all.
      'enquiry:2': { messages: [], replyChannels: [{ id: 'whatsapp', to: '+20 122 765 4321' }] },
      'enquiry:3': { messages: [], replyChannels: [] },
    },
    ...more,
  });
}

let handle: ChatterHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.useRealTimers();
});

async function mount(chatter: ChatterSource = source(), more: Partial<ChatterOptions> = {}, record: RecordRef | null = enquiry) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountChatter(host, { source: chatter, record, channels: CHANNELS, live: false, ...more });
  await until(() => host.querySelector('.fd-message') || host.querySelector('.fd-chatter-empty:not([hidden])'));
  await flush();
  return host;
}
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name && !b.closest('[hidden]')) as HTMLButtonElement | undefined;
const messages = (root: Element) => [...root.querySelectorAll('.fd-message')] as HTMLElement[];
const item = (root: Element, id: number) => root.querySelector(`.fd-message[data-message="${id}"]`) as HTMLElement;
const offered = (root: Element) => [...root.querySelectorAll('.fd-send-by-option')].map((option) => option.textContent);
const picked = (root: Element) => (root.querySelector('.fd-send-by input:checked') as HTMLInputElement | null)?.closest('label')?.textContent;
function type(box: HTMLTextAreaElement, text: string) {
  box.focus();
  box.value = text;
  box.dispatchEvent(new Event('input', { bubbles: true }));
}
function pick(root: Element, name: string) {
  const input = [...root.querySelectorAll<HTMLInputElement>('.fd-send-by input')].find((one) => one.closest('label')?.textContent === name) as HTMLInputElement;
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('each message says its channel and how far it got', () => {
  it('names its channel with its icon, a note by the app’s note channel, and ticks for what was sent', async () => {
    const host = await mount();
    const channelOf = (id: number) => item(host, id).querySelector('.fd-message-channel')?.textContent;
    expect([6, 5, 4, 3, 2, 1].map(channelOf)).toEqual(['WhatsApp', 'Team note', 'WhatsApp', 'E-mail', 'SMS', 'E-mail']);
    expect(item(host, 6).querySelector('.fd-message-channel .fd-icon')?.getAttribute('data-icon')).toBe('chat');
    // The app's note channel says a note in place of the chatter's own "Note".
    expect(item(host, 5).querySelector('.fd-message-kind')).toBeNull();
    const ticks = (id: number) => item(host, id).querySelector('.fd-delivery');
    expect([6, 3, 2].map((id) => ticks(id)?.getAttribute('data-delivery'))).toEqual(['delivered', 'read', 'failed']);
    expect([6, 3, 2].map((id) => ticks(id)?.getAttribute('aria-label'))).toEqual(['Delivered', 'Read', 'Not delivered']);
    // What came in has no ticks: they are for what went out.
    expect(ticks(4)).toBeNull();
    expect(item(host, 4).getAttribute('data-direction')).toBe('in');
    expect(item(host, 2).querySelector('.fd-message-failure span')?.textContent).toBe('Not delivered: The number cannot take SMS');
    // The channel's own words isolated, so they read whole in a right-to-left sentence.
    expect(item(host, 2).querySelector('.fd-message-failure bdi')?.textContent).toBe('The number cannot take SMS');
  });

  it('writes each message’s time as the page’s date boxes write a moment, on the page’s clock', async () => {
    const host = await mount(source(), { timeZone: 'Africa/Cairo' });
    expect(item(host, 6).querySelector('time')?.textContent).toBe('20 Oct 2026, 12:40');
    expect(item(host, 6).querySelector('time')?.getAttribute('datetime')).toBe('2026-10-20T09:40:00Z');
    handle!.destroy();
    const plain = await mount(source(), { dateOrder: 'mdy' });
    expect(item(plain, 6).querySelector('time')?.textContent).toBe('Oct 20, 2026, 09:40');
  });

  it('says a note as the chatter’s own Note where the app has no note channel, and draws a message without a channel as before', async () => {
    const host = await mount(source(), { channels: CHANNELS.filter((channel) => !channel.note) });
    expect(item(host, 5).querySelector('.fd-message-kind')?.textContent).toBe('Note');
    expect(item(host, 5).querySelector('.fd-message-channel')).toBeNull();
  });

  it('draws a message that came by a channel with its ticks even for a chatter told of no channels, by the channel’s id', async () => {
    const host = await mount(source(), { channels: undefined });
    expect(item(host, 6).querySelector('.fd-message-channel')?.textContent).toBe('whatsapp');
    expect(item(host, 6).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('delivered');
    // With no channels, a message goes to the followers, as before.
    button(host, 'Send message')!.click();
    expect(host.querySelector('.fd-send-by')).toBeNull();
    expect((host.querySelector('.fd-composer textarea') as HTMLTextAreaElement).placeholder).toBe('Write to the followers…');
  });
});

describe('a failed message sent again', () => {
  const refuseSms = (message: ChatterMessage) => (message.channel === 'sms' ? 'This number does not take text messages' : null);

  it('offers Retry under the failure: the message on its way at once, the focus kept in it, and a second failure said again', async () => {
    const chatter = source({ live: true, refuse: refuseSms });
    const host = await mount(chatter, { live: undefined });
    const again = item(host, 2).querySelector('.fd-message-retry') as HTMLButtonElement;
    expect(again.textContent).toBe('Retry');
    // A message that came in is no one's to send again; one delivered has nothing to retry.
    expect(host.querySelectorAll('.fd-message-retry')).toHaveLength(1);
    again.focus();
    again.click();
    expect(item(host, 2).querySelector('.fd-delivery')?.getAttribute('aria-label')).toBe('Sending');
    expect(item(host, 2).querySelector('.fd-message-failure')).toBeNull();
    expect(document.activeElement).toBe(item(host, 2).querySelector('.fd-message-reply'));
    // The gateway refuses it once more: said again, with Retry again.
    await until(() => item(host, 2).querySelector('.fd-message-failure'));
    expect(item(host, 2).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('failed');
    expect(item(host, 2).querySelector('.fd-message-failure')?.textContent).toBe('Not delivered: This number does not take text messagesRetry');
  });

  it('follows the ticks of one sent again that gets there', async () => {
    const chatter = source({ live: true });
    const host = await mount(chatter, { live: undefined });
    (item(host, 2).querySelector('.fd-message-retry') as HTMLButtonElement).click();
    await flush();
    expect(item(host, 2).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('pending');
    chatter.deliver(enquiry, 2, 'sent');
    expect(item(host, 2).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('sent');
    chatter.deliver(enquiry, 2, 'delivered');
    expect(item(host, 2).querySelector('.fd-delivery')?.getAttribute('aria-label')).toBe('Delivered');
    expect(item(host, 2).querySelector('.fd-message-failure')).toBeNull();
  });

  it('says why where the source could not send it again', async () => {
    const chatter: ChatterSource = { ...source(), resend: async () => Promise.reject(new Error('The SMS gateway is down')) };
    const host = await mount(chatter);
    (item(host, 2).querySelector('.fd-message-retry') as HTMLButtonElement).click();
    await until(() => item(host, 2).querySelector('.fd-message-failure'));
    expect(item(host, 2).querySelector('.fd-message-failure span')?.textContent).toBe('Not delivered: The SMS gateway is down');
  });

  it('offers no Retry where the source cannot send again (hidden, never disabled)', async () => {
    const host = await mount({ ...source(), resend: undefined });
    expect(item(host, 2).querySelector('.fd-message-failure')?.textContent).toBe('Not delivered: The number cannot take SMS');
    expect(host.querySelector('.fd-message-retry')).toBeNull();
  });
});

describe('a reply chooses its channel', () => {
  it('goes by the customer’s last channel unless another is picked, to whom it says, and posts by it', async () => {
    const chatter = source();
    const host = await mount(chatter);
    button(host, 'Send message')!.click();
    // Mona last wrote on WhatsApp (her e-mail came before): SMS is not this record's.
    expect(offered(host)).toEqual(['WhatsApp', 'E-mail', 'Team note']);
    expect(picked(host)).toBe('WhatsApp');
    expect(host.querySelector('.fd-send-to')?.textContent).toBe('To +20 100 123 4567');
    const box = host.querySelector('.fd-composer textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(box);
    expect(box.placeholder).toBe('Message by WhatsApp…');
    type(box, 'Thursday at 11 it is.');
    button(host, 'Send by WhatsApp')!.click();
    await until(() => chatter.posted.length);
    expect(chatter.posted[0]).toEqual(expect.objectContaining({ kind: 'message', channel: 'whatsapp', direction: 'out', delivery: 'sent' }));
    await until(() => messages(host)[0].textContent?.includes('Thursday at 11 it is.'));
    expect(messages(host)[0].querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('sent');
  });

  it('keeps what was typed as another channel is picked, a note among them, and posts a note by the note channel', async () => {
    const chatter = source();
    const host = await mount(chatter);
    button(host, 'Send message')!.click();
    const box = host.querySelector('.fd-composer textarea') as HTMLTextAreaElement;
    type(box, 'Mortgage letter received.');
    pick(host, 'E-mail');
    expect(host.querySelector('.fd-send-to')?.textContent).toBe('To mona@example.com');
    expect(button(host, 'Send by E-mail')).toBeDefined();
    pick(host, 'Team note');
    expect(box.value).toBe('Mortgage letter received.');
    expect(host.querySelector('.fd-composer')?.classList.contains('fd-composer-note')).toBe(true);
    expect((host.querySelector('.fd-send-to') as HTMLElement).hidden).toBe(true);
    button(host, 'Log')!.click();
    await until(() => chatter.posted.length);
    expect(chatter.posted[0]).toEqual(expect.objectContaining({ kind: 'note', channel: 'note' }));
    expect(chatter.posted[0].delivery).toBeUndefined();
  });

  it('answers a message by the channel it came by, and Log note opens on the note', async () => {
    const host = await mount();
    item(host, 1).querySelector<HTMLButtonElement>('.fd-message-reply')!.click();
    expect(picked(host)).toBe('E-mail');
    button(host, 'Cancel')!.click();
    button(host, 'Log note')!.click();
    expect(picked(host)).toBe('Team note');
  });

  it('hides a channel the record cannot be written to by, and Send message where it can be written to by none', async () => {
    const chatter = source();
    const host = await mount(chatter, {}, { model: 'enquiry', id: 2 });
    button(host, 'Send message')!.click();
    expect(offered(host)).toEqual(['WhatsApp', 'Team note']);
    expect(picked(host)).toBe('WhatsApp');
    button(host, 'Cancel')!.click();
    await handle!.setRecord({ model: 'enquiry', id: 3 });
    await flush();
    expect(button(host, 'Send message')).toBeUndefined();
    expect(button(host, 'Log note')).toBeDefined();
  });

  it('offers every channel of the app’s where the source says nothing of the record’s', async () => {
    const chatter: ChatterSource = { ...source(), replyChannels: undefined };
    const host = await mount(chatter);
    button(host, 'Send message')!.click();
    expect(offered(host)).toEqual(['WhatsApp', 'E-mail', 'SMS', 'Team note']);
  });
});

describe('messages arriving while the conversation is shown, pushed', () => {
  it('lays a new message on top, marked and said politely, and turns delivered into read — the reply being typed left as it is', async () => {
    const chatter = source({ live: true });
    const host = await mount(chatter, { live: undefined });
    button(host, 'Send message')!.click();
    const box = host.querySelector('.fd-composer textarea') as HTMLTextAreaElement;
    type(box, 'Thursday works');
    box.setSelectionRange(3, 3);
    const before = item(host, 4);
    chatter.receive(enquiry, { author: mona, body: '<p>Thursday at 11 is perfect.</p>', channel: 'whatsapp' });
    chatter.deliver(enquiry, 6, 'read');
    expect(messages(host)[0].textContent).toContain('Thursday at 11 is perfect.');
    expect(messages(host)[0].classList.contains('fd-message-new')).toBe(true);
    expect(host.querySelector('.fd-chatter [role="status"].fd-sr-only')?.textContent).toBe('New WhatsApp message from Mona Adel');
    expect(item(host, 6).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('read');
    // Never drawn again whole: the other messages are the same items, and the reply is as it was.
    expect(item(host, 4)).toBe(before);
    expect(document.activeElement).toBe(box);
    expect([box.value, box.selectionStart]).toEqual(['Thursday works', 3]);
    expect(picked(host)).toBe('WhatsApp');
  });

  it('never shows what is pushed for a record no longer shown', async () => {
    const chatter = source({ live: true });
    const host = await mount(chatter, { live: undefined });
    await handle!.setRecord({ model: 'enquiry', id: 2 });
    await flush();
    chatter.receive(enquiry, { author: mona, body: '<p>For the first enquiry.</p>', channel: 'whatsapp' });
    expect(host.textContent).not.toContain('For the first enquiry.');
    chatter.receive({ model: 'enquiry', id: 2 }, { author: mona, body: '<p>For this one.</p>', channel: 'whatsapp' });
    expect(messages(host).map((message) => message.querySelector('.fd-message-body')?.textContent)).toEqual(['For this one.']);
  });

  it('lays what is pushed while the conversation is fetched once it has come, and stops listening when it goes', async () => {
    const base = source({ live: true });
    // The conversation as it stood before what is pushed meanwhile.
    const before = await base.messages(enquiry);
    let answer: (() => void) | null = null;
    const slow: ChatterSource = { ...base, messages: () => new Promise((resolve) => (answer = () => resolve(before))) };
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountChatter(host, { source: slow, record: enquiry, channels: CHANNELS });
    await until(() => answer);
    base.receive(enquiry, { author: mona, body: '<p>Pushed early.</p>', channel: 'whatsapp' });
    base.deliver(enquiry, 6, 'read');
    expect(messages(host)).toHaveLength(0);
    answer!();
    await until(() => messages(host).length === 7);
    expect(messages(host)[0].textContent).toContain('Pushed early.');
    expect(item(host, 6).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('read');
    handle.destroy();
    handle = null;
    base.receive(enquiry, { author: mona, body: '<p>After it went.</p>', channel: 'whatsapp' });
    expect(host.textContent).not.toContain('After it went.');
  });

  it('shares one app function with the record’s own live changes (0.31): each listener takes its own kind of change, lets the rest go', async () => {
    // The app's one socket: whatever comes for a record goes to every listener of that record, the form's and the chatter's.
    const listeners = new Map<string, ((change: unknown) => void)[]>();
    const subscribe = (record: { model: string; id: unknown }, push: (change: never) => void) => {
      const key = `${record.model}:${String(record.id)}`;
      listeners.set(key, [...(listeners.get(key) ?? []), push as (change: unknown) => void]);
      return () => void listeners.set(key, (listeners.get(key) ?? []).filter((one) => one !== push));
    };
    const send = (change: unknown) => (listeners.get('enquiry:1') ?? []).forEach((push) => push(change));
    const host = await mount({ ...source(), subscribe }, { live: undefined });
    const page: Page = { fieldia: '0.13', id: 'enquiry', data: { kind: 'record', model: 'enquiry' }, fields: { name: { type: 'char', label: 'Name' }, stage: { type: 'char', label: 'Stage' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-stage', field: 'stage' }] } };
    const records = createMemoryDataSource({ records: { enquiry: { 1: { name: 'Mona Adel', stage: 'new' } } } });
    const form = createForm({ page, dataSource: { ...records, subscribe }, recordId: 1 });
    const arrived: unknown[] = [];
    form.on('arrived', (event) => void arrived.push(event));
    await form.load();
    await until(() => listeners.get('enquiry:1')?.length === 2);
    // A message: the conversation's alone — laid on top there, the record untouched.
    send({ type: 'message', message: { id: 9, kind: 'message', author: mona, date: '2026-10-20T10:00:00Z', body: '<p>On my way.</p>', channel: 'whatsapp', direction: 'in' } });
    send({ type: 'delivery', id: 6, delivery: 'read' });
    await flush();
    expect(messages(host)[0].textContent).toContain('On my way.');
    expect(item(host, 6).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('read');
    expect([form.getState().values['stage'], arrived]).toEqual(['new', []]);
    // The record's change: the form's alone — laid on the record, the conversation untouched.
    const shown = messages(host).length;
    send({ type: 'record', values: { name: 'Mona Adel', stage: 'viewing' }, by: 'Karim Fathy' });
    await until(() => form.getState().values['stage'] === 'viewing');
    expect(arrived).toHaveLength(1);
    expect(messages(host)).toHaveLength(shown);
    form.dispose();
  });

  it('never takes a delivery back: a late answer saying delivered of a message read', async () => {
    const chatter = source({ live: true });
    let stale: ChatterMessage[] | null = null;
    const late: ChatterSource = { ...chatter, messages: async (record) => stale ?? chatter.messages(record) };
    const host = await mount(late, { live: undefined });
    stale = await chatter.messages(enquiry);
    chatter.deliver(enquiry, 6, 'read');
    expect(item(host, 6).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('read');
    await handle!.refresh();
    expect(item(host, 6).querySelector('.fd-delivery')?.getAttribute('data-delivery')).toBe('read');
  });
});

describe('messages arriving while the conversation is shown, asked for again', () => {
  function counted(chatter = source()) {
    const asked: RecordRef[] = [];
    const polled: ChatterSource = { ...chatter, messages: (record) => (asked.push(record), chatter.messages(record)) };
    return { chatter, polled, asked };
  }

  it('asks again now and then where it has channels, lays only what changed, and less often while nothing does', async () => {
    jest.useFakeTimers();
    const { chatter, polled, asked } = counted();
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountChatter(host, { source: polled, record: enquiry, channels: CHANNELS, live: { every: 1000 } });
    await jest.advanceTimersByTimeAsync(0);
    expect(asked).toHaveLength(1);
    const before = item(host, 4);
    chatter.receive(enquiry, { author: mona, body: '<p>Thursday at 11 is perfect.</p>', channel: 'whatsapp' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(asked).toHaveLength(2);
    expect(messages(host)[0].textContent).toContain('Thursday at 11 is perfect.');
    expect(item(host, 4)).toBe(before);
    // After a change, at the usual pace; then, while nothing changes, twice as long each time, never over four times.
    await jest.advanceTimersByTimeAsync(1000);
    expect(asked).toHaveLength(3);
    await jest.advanceTimersByTimeAsync(1999);
    expect(asked).toHaveLength(3);
    await jest.advanceTimersByTimeAsync(1);
    expect(asked).toHaveLength(4);
    await jest.advanceTimersByTimeAsync(4000);
    expect(asked).toHaveLength(5);
    await jest.advanceTimersByTimeAsync(4000);
    expect(asked).toHaveLength(6);
  });

  it('waits while the page is out of sight, and asks as soon as it is in sight again', async () => {
    jest.useFakeTimers();
    const { polled, asked } = counted();
    const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      const host = document.createElement('div');
      document.body.append(host);
      handle = mountChatter(host, { source: polled, record: enquiry, channels: CHANNELS, live: { every: 1000 } });
      await jest.advanceTimersByTimeAsync(10000);
      expect(asked).toHaveLength(1);
      hidden.mockReturnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      await jest.advanceTimersByTimeAsync(0);
      expect(asked).toHaveLength(2);
    } finally {
      hidden.mockRestore();
    }
  });

  it('never asks again where the app turned it off, nor for a chatter without channels (as before)', async () => {
    jest.useFakeTimers();
    const { polled, asked } = counted();
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountChatter(host, { source: polled, record: enquiry, channels: CHANNELS, live: false });
    await jest.advanceTimersByTimeAsync(60000);
    expect(asked).toHaveLength(1);
    handle.destroy();
    const plain = counted();
    handle = mountChatter(host, { source: plain.polled, record: enquiry });
    await jest.advanceTimersByTimeAsync(60000);
    expect(plain.asked).toHaveLength(1);
  });

  it('lays an answer only on the record the form still shows', async () => {
    jest.useFakeTimers();
    const { chatter, polled } = counted();
    let shown = true;
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountChatter(host, { source: polled, record: enquiry, channels: CHANNELS, live: { every: 1000 }, recordShown: () => () => shown });
    await jest.advanceTimersByTimeAsync(0);
    chatter.receive(enquiry, { author: mona, body: '<p>Not for this form.</p>', channel: 'whatsapp' });
    shown = false;
    await jest.advanceTimersByTimeAsync(1000);
    expect(host.textContent).not.toContain('Not for this form.');
  });
});

describe('a follow-up due at an hour, on the page’s clock', () => {
  const call = { id: 'call', name: 'Call', icon: 'phone', daysUntilDue: 0 };
  function planned() {
    return createMemoryChatter({
      me,
      people: [me, mona],
      activityTypes: [call],
      records: {
        'enquiry:1': {
          activities: [
            { id: 51, type: call, summary: 'Call Mona about the viewing', due: '2026-10-20T12:30:00Z', assignee: me },
            { id: 52, type: call, summary: 'Send the brochure', due: '2026-10-20T11:00', assignee: me },
            { id: 53, type: call, summary: 'Ask the owner about the price', due: '2026-10-19T09:00:00Z', assignee: me },
            { id: 54, type: call, summary: 'Second viewing', due: '2026-10-22T06:00:00Z', assignee: mona },
            { id: 55, type: call, summary: 'Mortgage papers', due: '2026-10-22', assignee: mona },
          ],
        },
      },
    });
  }
  // 13:00 in Cairo (EEST, UTC+3): the call at 15:30 is ahead today, the brochure at 11:00 late.
  const now = () => new Date('2026-10-20T10:00:00Z');
  const rows = (host: Element) => [...host.querySelectorAll('.fd-activity')].map((row) => [row.querySelector('.fd-activity-summary')?.textContent, row.getAttribute('data-when'), row.querySelector('.fd-activity-due')?.textContent]);

  it('says when each is due on the page’s clock, late first, and names the zone where it is not the browser’s', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountChatter(host, { source: planned(), record: enquiry, now, timeZone: 'Africa/Cairo' });
    await until(() => host.querySelectorAll('.fd-activity').length === 5);
    expect(rows(host)).toEqual([
      ['Ask the owner about the price', 'overdue', 'Overdue since 19 Oct 2026, 12:00 EEST'],
      ['Send the brochure', 'overdue', 'Overdue since 11:00 EEST'],
      ['Call Mona about the viewing', 'today', 'Today at 15:30 EEST'],
      ['Mortgage papers', 'planned', 'Due 22 Oct 2026'],
      ['Second viewing', 'planned', 'Due 22 Oct 2026, 09:00 EEST'],
    ]);
  });

  it('writes its days in the page’s order and says no zone on the browser’s own clock', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountChatter(host, { source: planned(), record: enquiry, now, dateOrder: 'mdy' });
    await until(() => host.querySelectorAll('.fd-activity').length === 5);
    // The browser's clock here is UTC: it is 10:00, the brochure at 11:00 is ahead, the call at 12:30.
    expect(rows(host).map((row) => row[2])).toEqual(['Overdue since Oct 19, 2026, 09:00', 'Today at 11:00', 'Today at 12:30', 'Due Oct 22, 2026', 'Due Oct 22, 2026, 06:00']);
  });

  it('schedules one at an hour, kept as the instant it names on the page’s clock; without an hour, on its day', async () => {
    const chatter = planned();
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountChatter(host, { source: chatter, record: enquiry, now, timeZone: 'Africa/Cairo' });
    await until(() => host.querySelectorAll('.fd-activity').length === 5);
    button(host, 'Schedule activity')!.click();
    const form = host.querySelector('.fd-activity-form') as HTMLElement;
    await until(() => !form.hidden);
    const due = form.querySelector('input[name="due"]') as HTMLInputElement;
    const time = form.querySelector('input[name="time"]') as HTMLInputElement;
    expect([due.value, time.value]).toEqual(['2026-10-20', '']);
    expect(time.getAttribute('aria-label')).toBe('Time');
    time.value = '17:45';
    (form.querySelector('input[name="summary"]') as HTMLInputElement).value = 'Confirm the viewing';
    button(form, 'Schedule')!.click();
    await until(() => host.querySelectorAll('.fd-activity').length === 6);
    const made = (await chatter.activities!(enquiry)).find((activity) => activity.summary === 'Confirm the viewing');
    expect(made?.due).toBe('2026-10-20T14:45:00.000Z');
    expect(rows(host).find((row) => row[0] === 'Confirm the viewing')?.[2]).toBe('Today at 17:45 EEST');
  });
});

describe('in a sheet’s chatter slot', () => {
  const page = {
    fieldia: '0.13',
    id: 'enquiry',
    title: 'Enquiry',
    data: { kind: 'record', model: 'enquiry' },
    timeZone: 'Africa/Cairo',
    look: { dateOrder: 'dmy' },
    fields: { name: { type: 'char', label: 'Enquiry' } },
    layout: { type: 'sections', id: 's', children: [] },
  } as unknown as Page;

  it('asks for the channels part with the viewer’s parts, and draws on the page’s clock', async () => {
    const chatter = createMemoryChatter({
      me,
      people: [me],
      records: { 'enquiry:1': { activities: [{ id: 51, type: { id: 'call', name: 'Call' }, summary: 'Call Mona', due: '2026-10-20T12:30:00Z', assignee: me }] } },
    });
    expect(chatterSlot({ source: chatter, channels: CHANNELS }).parts).toEqual([channelsPart]);
    expect(chatterSlot({ source: chatter }).parts).toEqual([]);
    const dataSource = createMemoryDataSource({ records: { enquiry: { 1: { name: 'Mona Adel' } } } });
    const form = createForm({ page, dataSource, recordId: 1, now: () => new Date('2026-10-20T10:00:00Z') });
    await form.load();
    const element = document.createElement('div');
    document.body.append(element);
    const stop = chatterSlot({ source: chatter, channels: CHANNELS })(element, { form });
    await until(() => element.querySelector('.fd-activity'));
    expect(element.querySelector('.fd-activity-due')?.textContent).toBe('Today at 15:30 EEST');
    stop();
  });

  it('lays a pushed message only while the form shows its record', async () => {
    const chatter = source({ live: true });
    const dataSource = createMemoryDataSource({ records: { enquiry: { 1: { name: 'Mona Adel' }, 2: { name: 'Hany Samir' } } } });
    const form = createForm({ page, dataSource, recordId: 1 });
    await form.load();
    const element = document.createElement('div');
    document.body.append(element);
    const stop = chatterSlot({ source: chatter, channels: CHANNELS })(element, { form });
    await until(() => element.querySelector('.fd-message'));
    await form.openRecord(2);
    await until(() => !element.querySelector('.fd-message'));
    chatter.receive(enquiry, { author: mona, body: '<p>Late for one.</p>', channel: 'whatsapp' });
    await flush();
    expect(element.textContent).not.toContain('Late for one.');
    stop();
  });
});
