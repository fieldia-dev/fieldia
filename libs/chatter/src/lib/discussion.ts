import { answerOf, PICTURE_URL, safeUrl, fill, recordSentence, dayTag, wordsComing, wordsReady, intlFormat } from '@fieldia/core';
import { installStyles, sanitizeHtml, showHtml, textPart, WIDGET_LABELS, type TextPart, type TextReference } from '@fieldia/widgets';
import type { ChatterHandle, ChatterOptions } from './chatter';
import { initials } from './chatter';
import { chatterLabels, type ChatterLabels } from './labels';
import type { ChatterMessage, Person } from './source';
import { installDiscussionStyles } from './discussion-styles';
import { drawnLater } from './later';

/**
 * A record's discussion, as a work item draws it: a card to write a comment
 * in — the person's picture, a box that shows what to write — then a card
 * for each comment, newest first: who wrote it, "commented Jun 14", and what.
 * The box is the formatted text's rich editor (`formattedText`): its toolbar
 * and a link to the Markdown editor while it is worked in, Cancel and Save
 * under it. Ctrl+Enter saves; Escape cancels, asking first when words were
 * typed. Save with nothing typed keeps the box open and says why.
 *
 * Only comments: tracked changes belong to the record's history, and there is
 * no bar of messages and notes, no followers and no activities here.
 */

export interface DiscussionOptions extends ChatterOptions {
  /** The words in the empty box: "Add a comment. Use # to link a work item, @ to mention a person, or ! to link a pull request." */
  placeholder?: string;
  /** Records linked by a key as it is typed: "#" for a work item, "!" for a pull request. */
  references?: readonly TextReference[];
  /** How many comments there are, after each load and each one saved. */
  onCount?(count: number): void;
}

export function mountDiscussion(host: HTMLElement, options: DiscussionOptions): ChatterHandle {
  // Its comment box is the formatted text's editor, in the text part: drawn once that has come, when it has not yet.
  // Its language's words, where they come in a chunk of their own (Turkish, Persian, Urdu, Spanish), too: in them from its first paint.
  const text = textPart.loaded;
  if (text && !wordsComing(options.locale)) return drawDiscussion(host, options, text);
  return drawnLater(host, options.record, Promise.all([textPart.load(), wordsReady(options.locale)]).then(([part]) => (record) => drawDiscussion(host, { ...options, record }, part)));
}

function drawDiscussion(host: HTMLElement, options: DiscussionOptions, { decorateLinks, formattedText }: TextPart): ChatterHandle {
  const doc = host.ownerDocument;
  installStyles(doc);
  installDiscussionStyles(doc);
  const locale = options.locale ?? 'en';
  const labels: ChatterLabels = chatterLabels(locale, options.labels);
  let record = options.record;
  let destroyed = false;

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }
  const avatar = (person: Person | null | undefined): HTMLElement =>
    person?.avatar ? el('img', { class: 'fd-discussion-avatar', src: safeUrl(person.avatar, PICTURE_URL), alt: '' }) : el('span', { class: 'fd-discussion-avatar fd-discussion-initials', 'aria-hidden': 'true' }, initials(person?.name ?? '?'));

  const root = el('section', { class: 'fd-theme fd-discussion', 'aria-label': labels.conversation, dir: options.dir, lang: locale });

  // ---- the comment box ------------------------------------------------------------------
  const source = options.source;
  /** The people suggested after an @: the source's answer handled as it is given (`answerOf`); not given, no one. */
  async function mentioned(query: string) {
    try {
      return ((await answerOf(source.people?.(query))) ?? []).map((person) => ({ id: person.id, label: person.name }));
    } catch {
      return [];
    }
  }
  const box = formattedText(doc, {
    label: labels.comment,
    placeholder: options.placeholder,
    labels: WIDGET_LABELS[locale] ?? WIDGET_LABELS.en,
    editor: 'rich',
    toolbar: 'focus',
    toolbarAt: 'bottom',
    switchEditor: 'always',
    icons: options.icons,
    ...(source.people ? { mention: { search: mentioned } } : {}),
    references: options.references ?? [],
    onInput: () => {
      problem.textContent = '';
      card.setAttribute('data-open', '');
      idleSave();
    },
    onKey(event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void save();
        return true;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (box.value()) asking(true);
        else close();
        return true;
      }
      return false;
    },
  });
  const cancel = el('button', { type: 'button', class: 'fd-discussion-button' }, labels.cancel);
  const saveButton = el('button', { type: 'button', class: 'fd-discussion-button' }, labels.saveComment);
  /**
   * Save with nothing typed: drawn idle, its tooltip saying why — still a button, and a press says it too, so it is
   * never greyed out without a reason.
   */
  function idleSave() {
    const empty = !box.value();
    saveButton.toggleAttribute('data-idle', empty);
    if (empty) saveButton.title = labels.writeFirst;
    else saveButton.removeAttribute('title');
  }
  idleSave();
  const problem = el('p', { class: 'fd-discussion-problem', role: 'status', 'aria-live': 'polite' });
  const actions = el('div', { class: 'fd-discussion-actions' }, problem, cancel, saveButton);
  const discardWords = el('span', {}, labels.discardComment);
  const discard = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.discard);
  const keep = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.keepWriting);
  const ask = el('div', { class: 'fd-discussion-ask', role: 'group', 'aria-label': labels.discardComment, hidden: '' }, discardWords, discard, keep);
  const me = el('div', { class: 'fd-discussion-me' }, avatar(options.me));
  const card = el('div', { class: 'fd-comment-card fd-composer-card' }, me, el('div', { class: 'fd-discussion-write' }, box.element, actions, ask));
  const waiting = el('p', { class: 'fd-discussion-waiting', hidden: '' }, recordSentence(options.records, labels.notSavedNoun, labels.notSaved, locale));
  const list = el('ol', { class: 'fd-discussion-comments' });
  root.append(card, waiting, list);
  host.append(root);

  // Open while it is worked in or holds words; closed again when it is left empty.
  card.addEventListener('focusin', () => card.setAttribute('data-open', ''));
  card.addEventListener('focusout', (event) => {
    if (card.contains(event.relatedTarget as Node | null)) return;
    setTimeout(() => {
      if (!card.contains(doc.activeElement) && !box.value() && !doc.querySelector('.fd-text-menu:not([hidden])')) card.removeAttribute('data-open');
    });
  });
  function close() {
    box.setValue(null);
    idleSave();
    problem.textContent = '';
    ask.hidden = true;
    card.removeAttribute('data-open');
    (doc.activeElement as HTMLElement | null)?.blur?.();
  }
  function asking(on: boolean) {
    ask.hidden = !on;
    if (on) keep.focus();
  }
  discard.addEventListener('click', close);
  keep.addEventListener('click', () => {
    asking(false);
    box.focus();
  });
  ask.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    asking(false);
    box.focus();
  });
  cancel.addEventListener('click', close);
  saveButton.addEventListener('click', () => void save());

  async function save() {
    const current = record;
    const body = box.value();
    if (!body) {
      problem.textContent = '';
      problem.textContent = labels.writeFirst;
      box.focus();
      return;
    }
    if (!current || saveButton.hasAttribute('aria-busy')) return;
    saveButton.setAttribute('aria-busy', 'true');
    try {
      // The source's answer handled as it is given (`answerOf`), never a microtask late as this function's own await.
      await answerOf(source.post(current, { kind: 'message', body: sanitizeHtml(body, doc) }));
      close();
      await load();
      (list.querySelector('.fd-comment-card') as HTMLElement | null)?.focus();
    } catch (error) {
      problem.textContent = fill(labels.couldNotSend, { reason: (error as Error).message });
    } finally {
      saveButton.removeAttribute('aria-busy');
    }
  }

  // ---- the comments ---------------------------------------------------------------------
  const now = options.now ?? (() => new Date());
  const tag = locale === 'ar' ? 'ar-EG-u-nu-latn' : locale === 'en' ? locale : `${dayTag(locale)}-nu-latn`;
  const sameYear = intlFormat('DateTimeFormat', tag, { month: 'short', day: 'numeric' });
  const otherYear = intlFormat('DateTimeFormat', tag, { month: 'short', day: 'numeric', year: 'numeric' });
  const full = intlFormat('DateTimeFormat', tag, { dateStyle: 'full', timeStyle: 'short' });

  function comment(message: ChatterMessage): HTMLElement {
    const date = new Date(message.date);
    const day = (date.getFullYear() === now().getFullYear() ? sameYear : otherYear).format(date);
    const when = el('a', { class: 'fd-comment-date', href: `#comment-${message.id}`, title: full.format(date) }, el('time', { datetime: message.date }, fill(labels.commentedOn, { date: day })));
    const body = el('div', { class: 'fd-comment-body' });
    showHtml(body, decorateLinks(sanitizeHtml(message.body, doc), doc));
    return el(
      'li',
      { class: 'fd-comment-card', id: `comment-${message.id}`, tabindex: '-1', 'data-message': String(message.id) },
      avatar(message.author),
      el('div', { class: 'fd-comment-head' }, el('span', { class: 'fd-comment-author' }, message.author?.name ?? ''), when),
      body
    );
  }

  async function load() {
    const current = record;
    waiting.hidden = current !== null;
    card.hidden = current === null;
    if (!current) {
      list.replaceChildren();
      options.onCount?.(0);
      return;
    }
    let messages: ChatterMessage[];
    try {
      messages = (await answerOf(source.messages(current))).filter((message) => message.kind === 'message' && message.body);
    } catch {
      // Not given: the comments as they were, asked again at the next refresh.
      return;
    }
    if (destroyed || record !== current) return;
    list.replaceChildren(...messages.map(comment));
    options.onCount?.(messages.length);
  }
  void load();

  return {
    element: root,
    refresh: load,
    async setRecord(next) {
      record = next;
      close();
      await load();
    },
    destroy() {
      destroyed = true;
      box.destroy();
      root.remove();
    },
  };
}
