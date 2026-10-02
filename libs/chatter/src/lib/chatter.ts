import { fill, type Locale } from '@fieldia/core';
import { installStyles, sanitizeHtml, type IconSet } from '@fieldia/widgets';
import { attachmentList, composerFiles } from './attachments';
import { CHATTER_LABELS, type ChatterLabels } from './labels';
import { mentions } from './mentions';
import { reactionBar } from './reactions';
import type { ChatterMessage, ChatterSource, Person, RecordRef } from './source';
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
}

export interface ChatterHandle {
  readonly element: HTMLElement;
  /** Fetch the conversation again, after something changed elsewhere. */
  refresh(): Promise<void>;
  /** Follow another record, or none while one is not saved. */
  setRecord(record: RecordRef | null): Promise<void>;
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
  const labels: ChatterLabels = { ...CHATTER_LABELS[locale], ...options.labels };
  let record = options.record;
  let destroyed = false;

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }
  const context: ChatterContext = { doc, labels, locale, source: options.source, icons: options.icons, now: options.now ?? (() => new Date()), record: () => record, el };

  const root = el('section', { class: 'fd-theme fd-chatter', 'aria-label': labels.conversation, dir: options.dir, lang: locale });
  const sendButton = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.sendMessage);
  const noteButton = el('button', { type: 'button', class: 'fd-button' }, labels.logNote);
  const bar = el('div', { class: 'fd-chatter-bar' }, sendButton, noteButton);
  const waiting = el('p', { class: 'fd-chatter-waiting', hidden: '' }, labels.notSaved);
  const empty = el('p', { class: 'fd-chatter-empty', hidden: '' }, labels.empty);
  const list = el('ol', { class: 'fd-chatter-messages' });

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
  const files = composerFiles(context, say);
  const actions = el('div', { class: 'fd-composer-actions' }, post, cancel);
  if (files.element) actions.append(el('span', { class: 'fd-spacer' }), files.element);
  const composer = el('div', { class: 'fd-composer', hidden: '' }, replying, box, mentioning.list, files.chips, problem, actions);
  files.takeDropsOn(composer);

  function openComposer(kind: 'message' | 'note', answering: ChatterMessage | null = null) {
    mode = kind;
    replyTo = answering;
    replying.hidden = !answering;
    replying.textContent = answering ? fill(labels.replyingTo, { name: answering.author?.name ?? '' }) : '';
    composer.hidden = false;
    composer.classList.toggle('fd-composer-note', kind === 'note');
    box.placeholder = kind === 'note' ? labels.forTeam : labels.forFollowers;
    box.setAttribute('aria-label', kind === 'note' ? labels.logNote : labels.sendMessage);
    post.textContent = kind === 'note' ? labels.log : labels.send;
    problem.hidden = true;
    box.focus();
  }
  function closeComposer() {
    composer.hidden = true;
    box.value = '';
    replyTo = null;
    files.clear();
    mentioning.reset();
  }
  async function submit() {
    const current = record;
    // Words, files or both; and never while a file is still on its way.
    const attachments = files.files();
    if (!current || (!box.value.trim() && !attachments.length) || post.disabled || files.busy()) return;
    post.disabled = true;
    try {
      const mentioned = mentioning.picked();
      await options.source.post(current, {
        kind: mode,
        body: box.value.trim() ? textToHtml(box.value) : '',
        attachments,
        ...(replyTo ? { parentId: replyTo.id } : {}),
        ...(mentioned.length ? { mentions: mentioned } : {}),
      });
      closeComposer();
      await load();
    } catch (error) {
      say(fill(labels.couldNotSend, { reason: (error as Error).message }));
    } finally {
      post.disabled = false;
    }
  }
  sendButton.addEventListener('click', () => openComposer('message'));
  noteButton.addEventListener('click', () => openComposer('note'));
  post.addEventListener('click', () => void submit());
  cancel.addEventListener('click', closeComposer);
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

  const when = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : locale, { dateStyle: 'medium', timeStyle: 'short' });

  function avatar(person: Person | null): HTMLElement {
    if (person?.avatar) return el('img', { class: 'fd-avatar-image', src: person.avatar, alt: '' });
    return el('span', { class: 'fd-avatar-initials', 'aria-hidden': 'true' }, initials(person?.name ?? '?'));
  }

  /** The messages on show, by id: an answer names whom it answers. */
  let shown = new Map<ChatterMessage['id'], ChatterMessage>();

  function messageItem(message: ChatterMessage): HTMLElement {
    const head = el(
      'div',
      { class: 'fd-message-head' },
      el('span', { class: 'fd-message-author' }, message.author?.name ?? ''),
      el('time', { datetime: message.date }, when.format(new Date(message.date)))
    );
    if (message.kind === 'note') head.append(el('span', { class: 'fd-message-kind' }, labels.note));
    const body = el('div', { class: 'fd-message-body' });
    body.innerHTML = sanitizeHtml(message.body, doc);
    const content = el('div', { class: 'fd-message-content' }, head);
    const parent = message.parentId != null ? shown.get(message.parentId) : undefined;
    if (parent) content.append(el('p', { class: 'fd-message-parent' }, fill(labels.replyingTo, { name: parent.author?.name ?? '' })));
    if (message.body) content.append(body);
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
    return el('li', { class: `fd-message fd-message-${message.kind}`, 'data-message': String(message.id) }, avatar(message.author), content);
  }

  async function load() {
    const current = record;
    waiting.hidden = current !== null;
    bar.hidden = current === null;
    if (!current) {
      closeComposer();
      list.replaceChildren();
      empty.hidden = true;
      return;
    }
    const messages = await options.source.messages(current);
    if (destroyed || record !== current) return; // another record, or gone, meanwhile
    shown = new Map(messages.map((message) => [message.id, message]));
    list.replaceChildren(...messages.map(messageItem));
    empty.hidden = messages.length > 0;
  }

  root.append(bar, waiting, composer, empty, list);
  host.append(root);
  void load();

  return {
    element: root,
    refresh: load,
    async setRecord(next) {
      record = next;
      await load();
    },
    destroy() {
      destroyed = true;
      root.remove();
    },
  };
}
