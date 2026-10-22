import { fill, recordSentence, type DateOrder, type Locale, type PageRecords } from '@fieldia/core';
import { installStyles, sanitizeHtml, type IconSet, type ShrinkOptions } from '@fieldia/widgets';
import { activitiesPart, momentWords } from './activities';
import { attachmentList, composerFiles } from './attachments';
import type * as ChannelsModule from './channels';
import { channelsPart } from './chatter-parts';
import { followersPart } from './followers';
import { chatterLabels, type ChatterLabels } from './labels';
import { mentions } from './mentions';
import { reactionBar } from './reactions';
import type { Channel, ChatterMessage, ChatterSource, Person, RecordRef, ReplyChannel } from './source';
import { installChatterStyles } from './styles';

export interface ChatterOptions {
  source: ChatterSource;
  /** The record the conversation is about; null for one not saved yet. */
  record: RecordRef | null;
  locale?: Locale;
  labels?: Partial<ChatterLabels>;
  dir?: 'ltr' | 'rtl';
  /** The app's own icons, by name, as the viewer takes them. */
  icons?: IconSet;
  /** The clock for what is due today; the real one unless a test pins it. */
  now?: () => Date;
  /** The person using it: their picture by the comment box of a discussion. */
  me?: Person;
  /** Photos attached made smaller first, as a picture field's are: the longest side and the quality. Kept as they are unless said. */
  shrink?: ShrinkOptions;
  /** What the page calls its records (`Page.records`), for its words that name one: "once the customer is saved". */
  records?: PageRecords;
  /**
   * The app's channels — WhatsApp, e-mail, SMS, the team's notes — each with its icon and words. Each message says the
   * one it came or went by and how far it got, and a reply chooses its own: the customer's last channel by default,
   * those the record cannot be written to by hidden (the source's `replyChannels`). Without them, a message goes to
   * the record's followers, as before.
   */
  channels?: readonly Channel[];
  /**
   * New messages and their delivery while the conversation is shown, laid in place — never the conversation fetched
   * again whole: pushed by the source's `subscribe` where it has one; else asked of `messages` again every `every` ms
   * (15 seconds unless said), less often while nothing changes (up to four times), never while the page is out of
   * sight or offline. On where the chatter has channels or the source subscribes; `false` turns it off, `true` (or
   * `{ every }`) asks again for a chatter without channels.
   */
  live?: boolean | { every?: number };
  /** The page's clock, by its IANA zone (`Page.timeZone`): an activity's hour and the messages' times are on it. The browser's own when left out. */
  timeZone?: string;
  /** The order the page writes a day in (`look.dateOrder`): the day an activity is due, "20 Oct 2026". */
  dateOrder?: DateOrder;
  /**
   * The form's test of the record shown (`form.recordShown`): what the chatter asks of the source — the conversation,
   * its activities, its followers, its channels — is laid only while it holds. The slot gives the form's.
   */
  recordShown?: () => () => boolean;
  /**
   * What happened to the record that the page knows of its own, told among its messages by when it happened, newest
   * first, as events: its approval history (`chatterSlot`). Never posted to the source.
   */
  entries?: readonly ChatterMessage[];
}

export interface ChatterHandle {
  readonly element: HTMLElement;
  /** Fetch the conversation again, after something changed elsewhere: what changed is laid in place. */
  refresh(): Promise<void>;
  /** Follow another record, or none while one is not saved. */
  setRecord(record: RecordRef | null): Promise<void>;
  /** What the page knows of the record shown, told among its messages by when it happened (`entries`), in place of what it told before. A Discussion has none. */
  setEntries?(entries: readonly ChatterMessage[]): void;
  destroy(): void;
}

/** What the parts of a chatter share: the page, its words, its source, and the record. */
export interface ChatterContext {
  doc: Document;
  labels: ChatterLabels;
  locale: Locale;
  source: ChatterSource;
  icons?: IconSet;
  now: () => Date;
  record(): RecordRef | null;
  el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string | undefined>, ...children: (Node | string)[]): HTMLElementTagNameMap[K];
  /** The page's clock (ChatterOptions.timeZone); the browser's own when undefined. */
  zone?: string;
  /** The page's order for days (ChatterOptions.dateOrder). */
  dateOrder?: DateOrder;
  /** Taken as something is asked for the record shown: true while that record is still the one shown, as it was. */
  shown(): () => boolean;
}

/** What was typed, as HTML: a paragraph for each block, a line break for each line, every character escaped. */
export function textToHtml(text: string): string {
  const escape = (line: string) => line.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => `<p>${block.split('\n').map(escape).join('<br>')}</p>`)
    .join('');
}

/** A person's initials, for when there is no picture. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Whether a chatter needs its channels part before it is drawn: it has channels, or it is live. */
export function wantsChannels(options: Pick<ChatterOptions, 'channels' | 'live' | 'source'>): boolean {
  return !!options.channels?.length || (options.live !== false && !!options.source.subscribe) || (!!options.live && !options.source.subscribe);
}

const key = (id: ChatterMessage['id']) => String(id);

/**
 * A record's conversation beside its form: messages to its followers, notes
 * for the team, and its tracked changes. Plain DOM, so it works in every
 * framework; it talks to the server only through the app's `source`.
 */
export function mountChatter(host: HTMLElement, options: ChatterOptions): ChatterHandle {
  const doc = host.ownerDocument;
  installStyles(doc);
  installChatterStyles(doc);
  const locale = options.locale ?? 'en';
  const labels: ChatterLabels = chatterLabels(locale, options.labels);
  const channels = options.channels ?? [];
  let record = options.record;
  let destroyed = false;

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }
  const shown = () => {
    const asked = record;
    const form = options.recordShown?.();
    return () => !destroyed && record === asked && (!form || form());
  };
  const context: ChatterContext = {
    doc,
    labels,
    locale,
    source: options.source,
    icons: options.icons,
    now: options.now ?? (() => new Date()),
    record: () => record,
    el,
    zone: options.timeZone,
    dateOrder: options.dateOrder,
    shown,
  };

  const root = el('section', { class: 'fd-theme fd-chatter', 'aria-label': labels.conversation, dir: options.dir, lang: locale });
  const sendButton = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.sendMessage);
  const noteButton = el('button', { type: 'button', class: 'fd-button' }, labels.logNote);
  const bar = el('div', { class: 'fd-chatter-bar' }, sendButton, noteButton);
  const waiting = el('p', { class: 'fd-chatter-waiting', hidden: '' }, recordSentence(options.records, labels.notSavedNoun, labels.notSaved, locale));
  const empty = el('p', { class: 'fd-chatter-empty', hidden: '' }, labels.empty);
  const list = el('ol', { class: 'fd-chatter-messages' });
  // Messages arriving while the conversation is shown, said politely (the channels part says them).
  const news = el('p', { class: 'fd-sr-only', role: 'status' });

  // ---- its channels, and messages arriving live: a part of their own -------------------------------------------------

  const pushes = !!options.source.subscribe && options.live !== false;
  const polls = !options.source.subscribe && (options.live === undefined ? channels.length > 0 : !!options.live);
  const every = typeof options.live === 'object' ? options.live.every ?? 15000 : 15000;
  let part: typeof ChannelsModule | null = null;
  let picker: ReturnType<typeof ChannelsModule.channelPicker> | null = null;
  let live: ReturnType<typeof ChannelsModule.liveConversation> | null = null;
  /** The channels this record can be written to by, once known. */
  let usable: ReplyChannel[] | null = options.source.replyChannels ? null : channels.filter((channel) => !channel.note).map((channel) => ({ id: channel.id }));

  /** The part in: the channels' look, the reply's choice of channel, and the conversation kept up to date. */
  function withPart(module: typeof ChannelsModule) {
    if (destroyed) return;
    part = module;
    module.installChannelStyles(doc);
    if (channels.length && !picker) {
      picker = module.channelPicker(context, channels, (chosen) => {
        mode = chosen.note ? 'note' : 'message';
        look();
      });
      if (usable) picker.offer(usable);
      composer.prepend(picker.element);
      showBar();
    }
    if ((pushes || polls) && !live) {
      live = module.liveConversation(context, {
        push: pushes,
        every,
        channels,
        news,
        drawn: () => drawnFor,
        busy: () => fetching > 0 || posting,
        messages: () => current,
        lay: (messages) => lay(messages, true),
      });
      live.follow(record);
    }
  }
  /** The part on its way, where the chatter needs it: the messages are drawn once it is in (or could not come). */
  let partReady: Promise<unknown> = Promise.resolve();

  // ---- composing ----------------------------------------------------------------

  let mode: 'message' | 'note' = 'message';
  let replyTo: ChatterMessage | null = null;
  const box = el('textarea', { class: 'fd-input', rows: '3' });
  // The mention list takes its keys first: Enter picks a person, Escape closes the list, not the composer.
  const mentioning = mentions(context, box);
  const replying = el('p', { class: 'fd-replying', hidden: '' });
  const post = el('button', { type: 'button', class: 'fd-button fd-button-primary' });
  const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
  const problem = el('p', { class: 'fd-chatter-problem', role: 'alert', hidden: '' });
  const say = (message: string) => {
    problem.textContent = message;
    problem.hidden = false;
  };
  // Send pressed while files are still on their way: it waits, and says so here, the count kept as they arrive.
  const uploading = el('p', { class: 'fd-help fd-chatter-uploading', role: 'status', hidden: '' });
  let waitingToSend = false;
  const tellWaiting = () => {
    const n = files.busy();
    uploading.textContent = n === 1 ? labels.sendingAfterFile : fill(labels.sendingAfterFiles, { n });
    uploading.hidden = !waitingToSend || !n;
  };
  const files = composerFiles(context, say, { ...(options.shrink ? { shrink: options.shrink } : {}), changed: () => waitingToSend && tellWaiting() });
  const actions = el('div', { class: 'fd-composer-actions' }, post, cancel);
  if (files.element) actions.append(el('span', { class: 'fd-spacer' }), files.element);
  const composer = el('div', { class: 'fd-composer', hidden: '' }, replying, box, mentioning.list, files.chips, problem, uploading, actions);
  files.takeDropsOn(composer);

  /** The bar's Send message: hidden where the chatter has channels and the record can be written to by none of them. */
  function showBar() {
    sendButton.hidden = channels.length > 0 && !picker?.any();
  }
  /** The composer's words, by what it sends: a note, a message by the channel picked, or a message to the followers. */
  function look() {
    const note = mode === 'note';
    const channel = picker?.chosen().channel;
    const by = !note && channel ? channel.label : null;
    composer.classList.toggle('fd-composer-note', note);
    box.placeholder = note ? labels.forTeam : by ? fill(labels.writeBy, { channel: by }) : labels.forFollowers;
    box.setAttribute('aria-label', note ? labels.logNote : by ? fill(labels.sendByChannel, { channel: by }) : labels.sendMessage);
    post.textContent = note ? labels.log : by ? fill(labels.sendByChannel, { channel: by }) : labels.send;
  }
  function openComposer(kind: 'message' | 'note', answering: ChatterMessage | null = null) {
    mode = kind;
    replyTo = answering;
    replying.hidden = !answering;
    replying.textContent = answering ? fill(labels.replyingTo, { name: answering.author?.name ?? '' }) : '';
    if (picker && part) {
      // The channels as they are now, unless the composer is open: what was picked stays while it is.
      if (composer.hidden && usable) picker.offer(usable);
      // An answer goes by the channel its message came by, else the customer's last; a note is the team's.
      const chosen = picker.choose([answering?.channel ?? null, part.lastChannel(current, usable ?? [])], kind === 'note');
      mode = chosen.note ? 'note' : 'message';
    }
    composer.hidden = false;
    look();
    problem.hidden = true;
    box.focus();
  }
  function closeComposer() {
    composer.hidden = true;
    box.value = '';
    replyTo = null;
    files.clear();
    mentioning.reset();
    if (picker && usable) picker.offer(usable);
    showBar();
  }
  /** The ids of the messages this chatter posted: never said as arriving. */
  const own = new Set<string>();
  async function submit() {
    const current = record;
    // Words, files or both — those still on their way waited for, saying so; one that did not get there stops it.
    if (!current || post.disabled || waitingToSend) return;
    // Nothing typed and no file: said beside it, the box to type in — never a press that does nothing.
    if (!box.value.trim() && !files.files().length && !files.busy()) {
      say(mode === 'note' ? labels.typeNoteFirst : labels.typeMessageFirst);
      box.focus();
      return;
    }
    if (files.busy()) {
      waitingToSend = true;
      tellWaiting();
      await files.settled();
      waitingToSend = false;
      uploading.hidden = true;
    }
    const failed = files.failed();
    if (failed.length) return say(fill(labels.notSentFile, { name: failed[0] }));
    const attachments = files.files();
    if (!box.value.trim() && !attachments.length) return;
    post.disabled = true;
    posting = true;
    try {
      const mentioned = mentioning.picked();
      const by = picker?.chosen();
      const made = await options.source.post(current, {
        kind: mode,
        body: box.value.trim() ? textToHtml(box.value) : '',
        attachments,
        ...(replyTo ? { parentId: replyTo.id } : {}),
        ...(mentioned.length ? { mentions: mentioned } : {}),
        ...(by?.channel ? { channel: by.channel.id } : {}),
        ...(by?.to ? { to: by.to } : {}),
      });
      if (made?.id != null) own.add(key(made.id));
      posting = false;
      closeComposer();
      await load();
      // An answer may come soon.
      live?.sooner();
    } catch (error) {
      say(fill(labels.couldNotSend, { reason: (error as Error).message }));
    } finally {
      // Posted, or not: what was pushed meanwhile is laid.
      posting = false;
      post.disabled = false;
      live?.replay();
    }
  }
  sendButton.addEventListener('click', () => openComposer('message'));
  noteButton.addEventListener('click', () => openComposer('note'));
  post.addEventListener('click', () => void submit());
  cancel.addEventListener('click', closeComposer);
  // Typed in once it said there was nothing to send: that goes.
  box.addEventListener('input', () => {
    if (!problem.hidden && (problem.textContent === labels.typeMessageFirst || problem.textContent === labels.typeNoteFirst)) problem.hidden = true;
  });
  box.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeComposer();
    }
  });

  // ---- the messages ---------------------------------------------------------------

  /** When a message was posted, as the page's date boxes write a moment, on its clock: "20 Oct 2026, 09:20". */
  const when = (date: string) => (Number.isFinite(Date.parse(date)) ? momentWords(context, Date.parse(date)) : date);

  function avatar(person: Person | null): HTMLElement {
    if (person?.avatar) return el('img', { class: 'fd-avatar-image', src: person.avatar, alt: '' });
    return el('span', { class: 'fd-avatar-initials', 'aria-hidden': 'true' }, initials(person?.name ?? '?'));
  }

  /** The messages on show, newest first, and by id: an answer names whom it answers. */
  let current: ChatterMessage[] = [];
  let byId = new Map<ChatterMessage['id'], ChatterMessage>();
  /** Each message drawn, by its id: as it was drawn, and its item. */
  let drawn = new Map<string, { message: ChatterMessage; item: HTMLElement }>();
  /** The record whose conversation is drawn: changes pushed for it are laid once it is. */
  let drawnFor: RecordRef | null = null;
  /** The page's own entries (`entries`: its approval history), told among the source's messages by when each happened. */
  let entries: readonly ChatterMessage[] = options.entries ?? [];
  const withEntries = (messages: ChatterMessage[]) => (entries.length ? [...messages, ...entries].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)) : messages);

  function messageItem(message: ChatterMessage): HTMLElement {
    const mark = part?.messageMark(context, message, channels) ?? null;
    const head = el(
      'div',
      { class: 'fd-message-head' },
      el('span', { class: 'fd-message-author' }, message.author?.name ?? ''),
      el('time', { datetime: message.date }, when(message.date))
    );
    // A note says so, unless the app's note channel says it with its own name.
    if (message.kind === 'note' && !mark?.querySelector('.fd-message-channel')) head.append(el('span', { class: 'fd-message-kind' }, labels.note));
    if (mark) head.append(mark);
    const body = el('div', { class: 'fd-message-body' });
    body.innerHTML = sanitizeHtml(message.body, doc);
    const content = el('div', { class: 'fd-message-content' }, head);
    const parent = message.parentId != null ? byId.get(message.parentId) : undefined;
    if (parent) content.append(el('p', { class: 'fd-message-parent' }, fill(labels.replyingTo, { name: parent.author?.name ?? '' })));
    if (message.body) content.append(body);
    const failure = part?.failureLine(context, message, retry);
    if (failure) content.append(failure);
    if (message.tracking?.length) {
      content.append(
        el(
          'ul',
          { class: 'fd-tracking' },
          ...message.tracking.map((change) => el('li', {}, `${change.label}: ${change.from ?? '—'} → ${change.to ?? '—'}`))
        )
      );
    }
    if (message.attachments?.length) content.append(attachmentList(context, message.attachments));
    // An event is history, not something to answer or react to.
    if (message.kind !== 'event') {
      const reply = el('button', { type: 'button', class: 'fd-message-reply', 'aria-label': labels.reply }, '↩');
      reply.addEventListener('click', () => openComposer('message', message));
      const reactions = reactionBar(context, message.id, message.reactions ?? []);
      content.append(el('div', { class: 'fd-message-actions' }, ...(reactions ? [reactions] : []), reply));
    }
    return el(
      'li',
      { class: `fd-message fd-message-${message.kind}`, 'data-message': String(message.id), 'data-direction': message.direction ?? undefined },
      avatar(message.author),
      content
    );
  }

  /** A message changed where it holds the focus: its channel, ticks and failure drawn again, the rest left, so the focus stays. */
  function patch(item: HTMLElement, message: ChatterMessage) {
    const head = item.querySelector('.fd-message-head');
    item.querySelector('.fd-message-mark')?.remove();
    item.querySelector('.fd-message-failure')?.remove();
    const mark = part?.messageMark(context, message, channels);
    if (mark) head?.append(mark);
    const failure = part?.failureLine(context, message, retry);
    if (failure) (item.querySelector('.fd-message-body') ?? head)?.after(failure);
  }

  /**
   * The conversation laid: each message as it was drawn kept where it is unchanged — never moved, so what holds the
   * focus keeps it —, a changed one drawn again in its place, a new one put where it belongs. Those `arriving` while
   * it is shown (pushed, or found asking again) are marked a moment, and given back to be said — but this chatter's own.
   */
  function lay(messages: ChatterMessage[], arriving = false): ChatterMessage[] {
    current = messages;
    // The page's own entries among them, by when each happened: events, never said as arriving.
    const all = record ? withEntries(messages) : messages;
    byId = new Map(all.map((message) => [message.id, message]));
    const next = new Map<string, { message: ChatterMessage; item: HTMLElement }>();
    const arrived: ChatterMessage[] = [];
    const items = all.map((message) => {
      const was = drawn.get(key(message.id));
      let item: HTMLElement;
      if (was && JSON.stringify(was.message) === JSON.stringify(message)) item = was.item;
      else if (was && was.item.contains(doc.activeElement)) {
        patch(was.item, message);
        item = was.item;
      } else {
        item = messageItem(message);
        if (!was && arriving && !own.has(key(message.id)) && message.kind !== 'event') {
          item.classList.add('fd-message-new');
          arrived.push(message);
        }
      }
      next.set(key(message.id), { message, item });
      return item;
    });
    drawn = next;
    items.forEach((item, i) => {
      const at = list.children[i];
      if (at !== item) list.insertBefore(item, at ?? null);
    });
    while (list.children.length > items.length) list.lastElementChild?.remove();
    empty.hidden = all.length > 0;
    return arrived;
  }

  /** Being fetched, or a message being posted: what is pushed meanwhile waits for it (the source's echo of a post never said as arriving). */
  let fetching = 0;
  let posting = false;

  /** A message's delivery laid as told here: on its way again, or failed again with why. */
  function deliveryOf(id: ChatterMessage['id'], delivery: ChatterMessage['delivery'], failure: string | null) {
    lay(current.map((one) => (key(one.id) === key(id) ? { ...one, delivery, failure } : one)));
  }
  /**
   * A failed message sent again (Retry): on its way at once, the focus kept in the message (on its ↩); how far it
   * gets is told as any delivery is. Refused, the failure is said again, with why — on the record still shown only.
   */
  async function retry(message: ChatterMessage) {
    const asked = record;
    if (!asked || !options.source.resend) return;
    const still = shown();
    const item = drawn.get(key(message.id))?.item;
    const focused = !!item?.contains(doc.activeElement);
    deliveryOf(message.id, 'pending', null);
    if (focused) drawn.get(key(message.id))?.item.querySelector<HTMLElement>('.fd-message-reply')?.focus();
    try {
      await options.source.resend(asked, message.id);
    } catch (error) {
      if (still()) deliveryOf(message.id, 'failed', (error as Error).message || message.failure || null);
    }
  }

  /** The channels this record can be written to by: the source's answer, or every one of the app's. */
  async function loadChannels(asked: RecordRef) {
    if (!channels.length || !options.source.replyChannels) return;
    const still = shown();
    let found: ReplyChannel[];
    try {
      found = await options.source.replyChannels(asked);
    } catch {
      found = [];
    }
    if (!still()) return;
    usable = found;
    if (picker && composer.hidden) picker.offer(found);
    showBar();
  }

  async function load() {
    const asked = record;
    waiting.hidden = asked !== null;
    bar.hidden = asked === null;
    if (!asked) {
      closeComposer();
      lay([]);
      drawnFor = null;
      empty.hidden = true;
      if (activities.element) activities.element.hidden = true;
      return;
    }
    if (drawnFor !== asked) {
      // Another record: none of its channels are known yet.
      if (options.source.replyChannels) {
        usable = null;
        if (picker && composer.hidden) picker.offer([]);
        showBar();
      }
    }
    void activities.load();
    void followers.load();
    void loadChannels(asked);
    const still = shown();
    fetching++;
    let messages: ChatterMessage[];
    try {
      [messages] = await Promise.all([options.source.messages(asked), partReady]);
      // A message that came by a channel, or says how far it got, is drawn with the channels part.
      if (!part && messages.some((message) => message.channel || message.delivery)) await channelsPart.load().then(withPart, () => undefined);
    } finally {
      fetching--;
    }
    if (!still()) return; // another record, or gone, meanwhile
    // Another record's items are nothing to this one. Live, an answer is laid over what was pushed (a delivery never
    // going back), and what was pushed meanwhile after it.
    if (drawnFor !== asked) drawn = new Map();
    lay(drawnFor === asked && live ? live.merge(messages) : messages);
    drawnFor = asked;
    live?.replay();
  }

  // Marking an activity done posts what came of it: the conversation is fetched again.
  const activities = activitiesPart(context, () => load());
  if (activities.button) bar.append(activities.button);
  // Who follows sits at the far end of the bar, its list just under it.
  const followers = followersPart(context);
  if (followers.button) bar.append(el('span', { class: 'fd-spacer' }), followers.button);
  root.append(bar, ...(followers.element ? [followers.element] : []), waiting, composer, ...(activities.element ? [activities.element] : []), empty, list, news);
  host.append(root);
  // The part in at once where it came before, else asked for; a chatter with channels sends nothing before it knows
  // them: Send message shows once the part has come.
  if (channelsPart.loaded) withPart(channelsPart.loaded);
  else if (wantsChannels(options)) partReady = channelsPart.load().then(withPart, () => undefined);
  showBar();
  void load();

  return {
    element: root,
    refresh: load,
    async setRecord(next) {
      record = next;
      live?.follow(next);
      await load();
    },
    setEntries(next) {
      entries = next;
      // Laid in place on the conversation drawn; one still being fetched lays them as it comes.
      if (record && !destroyed && drawnFor === record) lay(current);
    },
    destroy() {
      destroyed = true;
      live?.stop();
      root.remove();
    },
  };
}
