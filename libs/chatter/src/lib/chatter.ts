import { fill, type Locale } from '@fieldia/core';
import { installStyles, sanitizeHtml, type IconSet } from '@fieldia/widgets';
import { CHATTER_LABELS, type ChatterLabels } from './labels';
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
  const box = el('textarea', { class: 'fd-input', rows: '3' });
  const post = el('button', { type: 'button', class: 'fd-button fd-button-primary' });
  const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
  const problem = el('p', { class: 'fd-chatter-problem', role: 'alert', hidden: '' });
  const composer = el('div', { class: 'fd-composer', hidden: '' }, box, problem, el('div', { class: 'fd-composer-actions' }, post, cancel));

  function openComposer(kind: 'message' | 'note') {
    mode = kind;
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
  }
  async function submit() {
    const current = record;
    if (!current || !box.value.trim() || post.disabled) return;
    post.disabled = true;
    try {
      await options.source.post(current, { kind: mode, body: textToHtml(box.value) });
      closeComposer();
      await load();
    } catch (error) {
      problem.textContent = fill(labels.couldNotSend, { reason: (error as Error).message });
      problem.hidden = false;
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
    list.replaceChildren(...messages.map(messageItem));
    empty.hidden = messages.length > 0;
  }

  root.append(bar, waiting, composer, empty, list);
  host.append(root);
  void load();
  void context;

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
