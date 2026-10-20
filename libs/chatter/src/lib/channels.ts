import { fill } from '@fieldia/core';
import { drawIcon } from '@fieldia/widgets';
import type { ChatterContext } from './chatter';
import type { Channel, ChatterChange, ChatterMessage, Delivery, RecordRef, ReplyChannel } from './source';

/**
 * A conversation that knows its channels — the chatter's part loaded the first time one has channels, is live, or
 * shows a message that came by a channel (chatter-parts.ts): each message's channel and how far it got, the reply's
 * choice of channel, and messages arriving while the conversation is shown.
 */

const SVG = 'http://www.w3.org/2000/svg';

/** One tick, or two side by side, drawn in the words' colour: WhatsApp's way of saying sent, delivered and read. */
function ticks(doc: Document, two: boolean): SVGSVGElement {
  const svg = doc.createElementNS(SVG, 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 18 12', width: '18', height: '12', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(key, value);
  svg.innerHTML = two ? '<path d="M1.5 6.5l3 3L11 2.5"/><path d="M7.5 9.5L14.5 2.5"/>' : '<path d="M3.5 6.5l3 3L13 2.5"/>';
  return svg;
}

/** How far a message got, as its ticks say it, in words: what a screen reader says and a pointer resting on them shows. */
export function deliveryWords(context: ChatterContext, delivery: Delivery): string {
  const { labels } = context;
  return { pending: labels.sending, sent: labels.sent, delivered: labels.delivered, read: labels.read, failed: labels.notDelivered }[delivery];
}

/**
 * What a message says of its channel and its delivery, after its time: the channel's icon and name — a note's, where
 * the app has a note channel — and its ticks: a clock while on its way, one tick sent, two delivered, two in the
 * accent read, a warning failed. Null where it says neither.
 */
export function messageMark(context: ChatterContext, message: ChatterMessage, channels: readonly Channel[]): HTMLElement | null {
  const { el, doc, icons } = context;
  const id = message.channel ?? (message.kind === 'note' ? channels.find((one) => one.note)?.id : undefined);
  const channel = id ? channels.find((one) => one.id === id) : undefined;
  const parts: Node[] = [];
  if (id) {
    const icon = drawIcon(doc, channel?.icon, icons);
    parts.push(el('span', { class: 'fd-message-channel', 'data-channel': id }, ...(icon ? [icon] : []), channel?.label ?? id));
  }
  if (message.delivery && message.kind !== 'event') {
    const words = deliveryWords(context, message.delivery);
    const drawn = message.delivery === 'pending' ? drawIcon(doc, 'clock', icons) : message.delivery === 'failed' ? drawIcon(doc, 'warning', icons) : ticks(doc, message.delivery !== 'sent');
    parts.push(el('span', { class: 'fd-delivery', 'data-delivery': message.delivery, role: 'img', 'aria-label': words, title: words }, ...(drawn ? [drawn] : [])));
  }
  return parts.length ? el('span', { class: 'fd-message-mark' }, ...parts) : null;
}

/** Why a message was not delivered, under it: "Not delivered: The number is not on WhatsApp". Null for one that was not refused. */
export function failureLine(context: ChatterContext, message: ChatterMessage): HTMLElement | null {
  const { el, labels, doc, icons } = context;
  if (message.delivery !== 'failed') return null;
  const icon = drawIcon(doc, 'warning', icons);
  return el('p', { class: 'fd-message-failure' }, ...(icon ? [icon] : []), message.failure ? fill(labels.notDeliveredWhy, { reason: message.failure }) : labels.notDelivered);
}

/** A delivery's place on the way: a message never goes back on it (a late answer saying "delivered" of one read). */
const RANK: Record<Delivery, number> = { pending: 0, sent: 1, failed: 2, delivered: 3, read: 4 };
/** The further of two deliveries of one message: what one answer says, unless another already told it got further. */
export function furthest(now: Delivery | null | undefined, told: Delivery | null | undefined): Delivery | null | undefined {
  if (!now || !told) return told ?? now;
  return RANK[told] >= RANK[now] ? told : now;
}

// ---- the reply's channel -------------------------------------------------------------------------------------------

let pickers = 0;

/** What the reply goes by: an outside channel and to whom, or the team's note. */
export interface Chosen {
  /** The channel picked; for a note, the app's note channel, if it has one. */
  channel: Channel | null;
  to: string | null;
  note: boolean;
}

/**
 * The reply's choice of channel, at the head of the composer: the channels this record can be written to by, in the
 * app's order, then the team's note — a radio for each, its icon and name — and who the one picked goes to. A
 * channel the record cannot be written to by is not offered. `changed` is told of each pick.
 */
export function channelPicker(context: ChatterContext, channels: readonly Channel[], changed: (chosen: Chosen) => void) {
  const { el, doc, labels, icons } = context;
  const name = `fd-send-by-${++pickers}`;
  const noteChannel = channels.find((one) => one.note) ?? null;
  const NOTE = '\u0000note';
  const choices = el('div', { class: 'fd-send-by-choices', role: 'radiogroup', 'aria-labelledby': `${name}-label` });
  const to = el('span', { class: 'fd-send-to' });
  const element = el('div', { class: 'fd-send-by' }, el('span', { class: 'fd-send-by-label', id: `${name}-label` }, labels.sendBy), choices, to);
  let offered: ReplyChannel[] = [];
  let value = NOTE;

  const chosen = (): Chosen => {
    if (value === NOTE) return { channel: noteChannel, to: null, note: true };
    const reply = offered.find((one) => one.id === value);
    return { channel: channels.find((one) => one.id === value) ?? null, to: reply?.to ?? null, note: false };
  };
  function option(id: string, label: string, icon: string | undefined) {
    const input = el('input', { type: 'radio', name, value: id });
    input.checked = id === value;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      value = id;
      say();
      changed(chosen());
    });
    const drawn = drawIcon(doc, icon, icons);
    return el('label', { class: 'fd-send-by-option', 'data-channel': id === NOTE ? noteChannel?.id ?? 'note' : id }, input, ...(drawn ? [drawn] : []), el('span', {}, label));
  }
  function say() {
    const now = chosen();
    to.textContent = now.to ? fill(labels.toWhom, { to: now.to }) : '';
    to.hidden = !now.to;
  }
  function draw() {
    choices.replaceChildren(
      ...offered.flatMap((reply) => {
        const channel = channels.find((one) => one.id === reply.id);
        return channel ? [option(channel.id, channel.label, channel.icon)] : [];
      }),
      option(NOTE, noteChannel?.label ?? labels.note, noteChannel?.icon)
    );
    say();
  }
  draw();

  return {
    element,
    /** The channels this record can be written to by: the app's, in its order, that `usable` names. */
    offer(usable: readonly ReplyChannel[]) {
      offered = channels.filter((channel) => !channel.note).flatMap((channel) => usable.filter((reply) => reply.id === channel.id).slice(0, 1));
      if (value !== NOTE && !offered.some((one) => one.id === value)) value = NOTE;
      draw();
    },
    /** Whether any outside channel is offered: none, and there is no message to send — only a note. */
    any: () => offered.length > 0,
    /**
     * The channel a reply goes by unless the person picks another: the first of `wanted` that is offered — the
     * channel of the message answered, the customer's last —, else the first offered; the note where `note` says so,
     * or where none is offered.
     */
    choose(wanted: readonly (string | null | undefined)[], note = false) {
      const id = wanted.find((one) => offered.some((reply) => reply.id === one));
      value = note || !offered.length ? NOTE : id ?? offered[0].id;
      for (const input of choices.querySelectorAll('input')) input.checked = input.value === value;
      say();
      return chosen();
    },
    chosen,
  };
}

/** The customer's last channel among those offered: the newest message from outside's, or null. */
export function lastChannel(messages: readonly ChatterMessage[], offered: readonly ReplyChannel[]): string | null {
  const latest = [...messages].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).find((message) => message.direction === 'in' && message.channel && offered.some((one) => one.id === message.channel));
  return latest?.channel ?? null;
}

// ---- messages arriving while the conversation is shown ---------------------------------------------------------------

export interface LiveOptions {
  /** Pushed by the source (`subscribe`), else asked again now and then. */
  push: boolean;
  /** How often to ask again while something changes, in ms; up to four times less often while nothing does. */
  every: number;
  /** The app's channels: a message arriving is said by its own. */
  channels: readonly Channel[];
  /** Where messages arriving are said, politely. */
  news: HTMLElement;
  /** The record whose conversation is drawn now: what is pushed for the record shown waits until it is. */
  drawn(): RecordRef | null;
  /** Whether the conversation is being fetched, or a message posted: what is pushed meanwhile waits for it. */
  busy(): boolean;
  /** The messages shown, newest first. */
  messages(): readonly ChatterMessage[];
  /** Messages laid over those shown, those new marked as arriving: gives those new (but this chatter's own). */
  lay(messages: ChatterMessage[]): ChatterMessage[];
}

const key = (id: ChatterMessage['id']) => String(id);
/** Newest first, as the source gives them: messages of the same moment kept in the order they came. */
const newestFirst = (messages: ChatterMessage[]) => messages.map((message, i) => [message, i] as const).sort(([a, i], [b, j]) => Date.parse(b.date) - Date.parse(a.date) || i - j).map(([message]) => message);

/**
 * The conversation kept up to date while it is shown: through the source's `subscribe` where it has one — what it
 * pushes for a record no longer shown laid nowhere, what it pushes while the conversation is fetched laid once it has
 * come —, else by asking its `messages` again politely: never while an answer is on its way, never while the page is
 * out of sight or offline (asked again as it comes back), and less often while nothing changes. Nothing is fetched
 * again whole: what changed is laid in place (the chatter's `lay`), a delivery never going back (`furthest`), and
 * what arrives is said.
 */
export function liveConversation(context: ChatterContext, options: LiveOptions) {
  const { doc, source, labels } = context;
  const view = doc.defaultView;
  let stopPush: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let delay = options.every;
  let stopped = false;
  let waiting: (() => void) | null = null;
  /** Changes pushed while the conversation is fetched, or before it is first drawn: laid once it is. */
  let early: ChatterChange[] = [];

  /** What an answer says of the messages, laid over those shown: a delivery never goes back. */
  function merge(answer: readonly ChatterMessage[]): ChatterMessage[] {
    const shown = new Map(options.messages().map((message) => [key(message.id), message]));
    return answer.map((message) => {
      const was = shown.get(key(message.id));
      if (!was || furthest(was.delivery, message.delivery) === message.delivery) return message;
      return { ...message, delivery: was.delivery, failure: was.failure ?? null };
    });
  }
  /** Messages laid as arriving, and said: one by whom and by which channel, several by how many. */
  function arrived(messages: ChatterMessage[]) {
    const fresh = options.lay(messages);
    const [one] = fresh;
    const channel = one && options.channels.find((each) => each.id === one.channel);
    if (fresh.length === 1) options.news.textContent = fill(channel ? labels.newMessageBy : labels.newMessage, { name: one.author?.name ?? '', channel: channel?.label ?? '' });
    else if (fresh.length) options.news.textContent = fill(labels.newMessages, { n: fresh.length });
  }
  /** A change pushed for the record shown. */
  function arrive(change: ChatterChange) {
    const record = context.record();
    if (options.busy() || !record || options.drawn() !== record) {
      early.push(change);
      return;
    }
    const shown = options.messages();
    if (change.type === 'message') {
      const known = shown.some((one) => key(one.id) === key(change.message.id));
      const [message] = merge([change.message]);
      arrived(newestFirst(known ? shown.map((one) => (key(one.id) === key(message.id) ? message : one)) : [message, ...shown]));
    } else if (change.type === 'delivery') {
      arrived(
        shown.map((one) => {
          if (key(one.id) !== key(change.id)) return one;
          const delivery = furthest(one.delivery, change.delivery);
          return { ...one, delivery, failure: delivery === 'failed' ? change.failure ?? one.failure ?? null : null };
        })
      );
    }
  }
  /** The conversation asked for again: whether anything changed. */
  async function ask(): Promise<boolean> {
    const record = context.record();
    if (!record || options.busy() || options.drawn() !== record) return false;
    const still = context.shown();
    const answer = await source.messages(record);
    if (!still() || options.busy()) return false;
    const before = JSON.stringify(options.messages());
    arrived(merge(answer));
    return JSON.stringify(options.messages()) !== before;
  }

  function clear() {
    if (timer) clearTimeout(timer);
    timer = null;
    waiting?.();
    waiting = null;
  }
  function schedule() {
    clear();
    if (!stopped && context.record()) timer = setTimeout(() => void tick(), delay);
  }
  /** Asked again as soon as `ready` holds once `on` is told on `target`: the page in sight again, back online. */
  function until(target: EventTarget | null, on: string, ready: () => boolean) {
    if (!target) return;
    const go = () => {
      if (!ready()) return;
      clear();
      void tick();
    };
    target.addEventListener(on, go);
    waiting = () => target.removeEventListener(on, go);
  }
  async function tick() {
    timer = null;
    if (stopped || !context.record()) return;
    if (doc.hidden) return until(doc, 'visibilitychange', () => !doc.hidden);
    if (view?.navigator && view.navigator.onLine === false) return until(view, 'online', () => true);
    // An answer that failed changed nothing: asked again later, less often.
    const changed = await ask().catch(() => false);
    if (stopped) return;
    delay = changed ? options.every : Math.min(delay * 2, options.every * 4);
    schedule();
  }

  return {
    /** The record shown now: pushed for, or asked about, from now; the last one's pushes stopped, and those waiting dropped. */
    follow(record: RecordRef | null) {
      stopPush?.();
      stopPush = null;
      early = [];
      clear();
      if (stopped || !record) return;
      if (options.push && source.subscribe) {
        let open = true;
        const stop = source.subscribe(record, (change) => {
          if (open && !stopped && context.record() === record) arrive(change);
        });
        stopPush = () => {
          open = false;
          stop?.();
        };
      } else {
        delay = options.every;
        schedule();
      }
    },
    merge,
    /** What was pushed while the conversation was fetched or a message posted, laid now it is not. */
    replay() {
      if (options.busy()) return;
      const pushed = early;
      early = [];
      for (const change of pushed) arrive(change);
    },
    /** Something happened here — the person sent a message —: an answer may come soon, so ask at the usual pace again. */
    sooner() {
      if (options.push || stopped) return;
      delay = options.every;
      schedule();
    },
    stop() {
      stopped = true;
      stopPush?.();
      stopPush = null;
      clear();
    },
  };
}

// ---- its look ------------------------------------------------------------------------------------------------------

/** The channels' look, on the chatter's tokens: a sheet of its own after the chatter's, as the Discussion's and the History's. */
export const CHANNEL_STYLES = `
.fd-message-mark { display: inline-flex; align-items: center; gap: 6px; }
.fd-message-channel { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--fd-muted); }
.fd-message-channel .fd-icon { width: 14px; height: 14px; }
.fd-delivery { display: inline-flex; align-items: center; color: var(--fd-muted); }
.fd-delivery .fd-icon { width: 14px; height: 14px; }
.fd-delivery[data-delivery="read"] { color: var(--fd-accent); }
.fd-delivery[data-delivery="failed"] { color: var(--fd-error); }
.fd-message-failure { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--fd-error); font-size: 13px; }
.fd-message-failure .fd-icon { width: 14px; height: 14px; flex: none; }
/*
 * What came from outside, marked at its start whatever is behind the chatter — the page's grey, a sheet's white — on
 * a shade laid on the surface (never on transparency: a colour an arriving message fades to).
 */
.fd-message[data-direction="in"] {
  background: color-mix(in srgb, var(--fd-accent) 6%, var(--fd-surface));
  border-inline-start: 3px solid color-mix(in srgb, var(--fd-accent) 40%, var(--fd-surface));
  padding-inline-start: 5px;
}
.fd-message-new { animation: fd-message-arrives 2.4s ease-out; }
@keyframes fd-message-arrives { from { background-color: var(--fd-accent-soft); } }
@media (prefers-reduced-motion: reduce) { .fd-message-new { animation: none; } }
.fd-send-by { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
.fd-send-by-label { font-size: 12.5px; color: var(--fd-muted); }
.fd-send-by-choices { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-send-by-option {
  position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--fd-border);
  border-radius: 999px; background: var(--fd-surface); color: var(--fd-text); font-size: 13px; cursor: pointer;
}
.fd-send-by-option .fd-icon { width: 15px; height: 15px; color: var(--fd-muted); }
.fd-send-by-option input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
.fd-send-by-option:has(input:checked) { border-color: var(--fd-accent); background: var(--fd-accent-soft); }
.fd-send-by-option:has(input:checked) .fd-icon { color: var(--fd-accent); }
.fd-send-by-option:has(input:focus-visible) { outline: 2px solid var(--fd-accent); outline-offset: 2px; }
.fd-send-to { font-size: 12.5px; color: var(--fd-muted); overflow-wrap: anywhere; }
`;

/** Puts the channels' look in the document once, after the chatter's own. */
export function installChannelStyles(doc: Document): void {
  if (doc.getElementById('fd-chatter-channels-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-chatter-channels-styles';
  style.textContent = CHANNEL_STYLES;
  (doc.head ?? doc.documentElement).append(style);
}
