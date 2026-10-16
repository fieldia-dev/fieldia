import type { DuplicateMatch, Form, JsonValue, Locale, Page, RecordId, Tone, Values } from '@fieldia/core';
import { drawIcon, type IconSet, type PreferenceStore } from '@fieldia/widgets';
import type { El } from './dom';
import { installDuplicateStyles } from './duplicates-styles';
import type { ViewerLabels } from './labels';
import { openMergeScreen } from './merge-screen';
import { nameFieldOf } from './related';

/**
 * Possible duplicates (`duplicates` on a record's page), the duplicates part: while a person types in a field the
 * page names, a moment after they stop — and as a saved record is opened, and as a record is saved — the form asks
 * the data source's `duplicates` for records like this one (`form.findDuplicates`), and each match is said under the
 * field it matched on: "A record with this Phone already exists: Nile Traders", with
 *
 * - **Open it**: the record found, in this form's place, once the one check let what is typed here go
 *   (`form.leave({ changes: true })`: asked about, every change not saved counting);
 * - **It's someone new**: this match let be for the values it matched on, remembered for this record (a new one's
 *   until it is saved, then by its id, in the viewer's preferences);
 * - **Merge…**, on a saved record where the source has `merge`: the two side by side (merge-screen.ts).
 *
 * Typing on in a field named leaves an answer on its way unheard; an answer for a record no longer shown
 * (`form.recordShown`) is laid nowhere. Nothing here is in Save's way: a duplicate is said, and Save saves.
 */

/** What the duplicates part needs of the viewer that draws the page. */
export interface DuplicatesContext {
  form: Form;
  /** The page as shown: its words in the page's language. */
  page: Page;
  /** The form's own element, whose fields the notes go under. */
  root: HTMLElement;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  locale: Locale;
  /** The page's language tag, for the marks a list of words is joined with. */
  tag?: string;
  icons?: IconSet;
  /** Where a match let be is remembered, by record: the viewer's preferences. */
  preferences: PreferenceStore;
  fill(template: string, values: Record<string, string | number>): string;
  /** Words said in a toast: a merge done, a record that could not be read. */
  say(message: string, tone: Tone): void;
  /** Whether the person may change the record here now: not a viewer locked to be read. */
  editable(): boolean;
}

let watches = 0;

/** How long typing in a field named rests before the source is asked. */
export const DUPLICATES_WAIT_MS = 500;
/** The matches said under one field; past them, how many more. */
const SHOWN = 3;
/** The records whose matches let be are remembered, the latest kept. */
const REMEMBERED = 200;

/** A record as the merge's screen shows it: its id, its name and its values. */
export interface MergeSide {
  id: RecordId;
  name: string;
  values: Values;
}

/**
 * Watch the form for possible duplicates, as its page says (`duplicates`): nothing is asked, and nothing shows, unless
 * the page names fields and its source has `duplicates` (`form.canFindDuplicates`).
 */
export function watchDuplicates(context: DuplicatesContext): { destroy(): void } {
  const { form, page, root, doc, el, labels, fill } = context;
  const setting = page.duplicates;
  if (!setting || page.data.kind !== 'record' || !form.canFindDuplicates()) return { destroy: () => undefined };
  installDuplicateStyles(doc);
  const model = page.data.model;
  const named = new Set(setting.fields);
  const asTyped = setting.on !== 'save';
  const nameField = nameFieldOf(page);
  const view = doc.defaultView ?? globalThis;
  const separator = (context.tag ?? context.locale).split('-')[0] === 'ar' ? '، ' : ', ';
  /** Before its notes' ids, so two forms on a page never share one. */
  const prefix = `fd-duplicates-${++watches}`;

  /** Each question's number: a later one, or typing on in a field named, leaves an earlier answer unheard. */
  let asking = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let gone = false;
  /** The matches shown now, and the notes they are in, by the field each is under ('' over the page). */
  let shown: DuplicateMatch[] = [];
  const notes = new Map<string, { note: HTMLElement; keys: string }>();
  /** The new record's matches let be, until it is saved and has an id to remember them by. */
  let fresh = new Set<string>();
  /** A match is said once as it comes, politely: never over what the person is typing. */
  const said = el('div', { class: 'fd-sr-only fd-duplicates-said', role: 'status', 'aria-live': 'polite' });
  root.append(said);
  let saidKeys = new Set<string>();

  const stop = () => {
    if (timer !== null) view.clearTimeout(timer);
    timer = null;
    asking++;
  };
  const ask = () => {
    stop();
    const mine = asking;
    const still = form.recordShown();
    form.findDuplicates().then(
      (matches) => {
        if (!gone && mine === asking && still()) draw(matches);
      },
      // A source that failed says nothing here: the record is typed and saved as ever.
      () => undefined
    );
  };
  const later = () => {
    stop();
    timer = view.setTimeout(ask, DUPLICATES_WAIT_MS);
  };

  // ---- what was let be, by record ---------------------------------------------------------------------
  const KEY = `duplicates.${model}`;
  const kept = (): [string, string[]][] => {
    const all = context.preferences.get(KEY);
    return Array.isArray(all) ? (all.filter((one) => Array.isArray(one) && typeof one[0] === 'string' && Array.isArray(one[1])) as [string, string[]][]) : [];
  };
  const letBeFor = (id: RecordId | null): Set<string> => (id === null ? fresh : new Set(kept().find(([record]) => record === String(id))?.[1] ?? []));
  const remember = (id: RecordId, signatures: Iterable<string>) => {
    const all = kept();
    const own = all.find(([record]) => record === String(id))?.[1] ?? [];
    const next = [...all.filter(([record]) => record !== String(id)), [String(id), [...new Set([...own, ...signatures])]] as [string, string[]]];
    context.preferences.set(KEY, next.slice(-REMEMBERED) as unknown as JsonValue);
  };
  /** A match as it was let be: the record, and the values typed in each field it matched on. */
  const signature = (match: DuplicateMatch, values: Readonly<Values>) => [String(match.id), ...[...match.why].sort().map((field) => `${field}=${JSON.stringify(values[field] ?? null)}`)].join('|');
  const keyOf = (match: DuplicateMatch) => `${match.id}:${[...match.why].sort().join(',')}`;

  // ---- where a note goes, and what it says ------------------------------------------------------------
  /** A field's box on this page, shown: none in a tab out of sight, nor in a dialog or a saved form placed in it. */
  const wrapperOf = (field: string): HTMLElement | undefined =>
    [...root.querySelectorAll<HTMLElement>('.fd-field[data-path]')].find((wrapper) => wrapper.getAttribute('data-path') === field && wrapper.closest('form.fd-form') === root && !wrapper.closest('[hidden]'));
  /**
   * Under the first field it matched on that is in sight — one it holds the same before the name, a likeness being the
   * weaker sign — else the first field named that is, else over the page.
   */
  const placeOf = (match: DuplicateMatch) =>
    [...match.why.filter((field) => field !== nameField), ...match.why.filter((field) => field === nameField), ...setting.fields].find((field) => named.has(field) && wrapperOf(field)) ?? '';
  const fold = (text: string) => text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const joined = (words: string[]) => (words.length < 2 ? (words[0] ?? '') : fill(labels.duplicateAnd, { a: words.slice(0, -1).join(separator), b: words[words.length - 1] }));
  /** Its words, around its name: by the fields it holds the same, by a name like this one, or both. */
  const wordsOf = (match: DuplicateMatch, values: Readonly<Values>): [string, string] => {
    const typedName = nameField ? values[nameField] : null;
    const nameLike = !!nameField && match.why.includes(nameField) && fold(match.name) !== fold(typeof typedName === 'string' ? typedName : '');
    const same = match.why.filter((field) => !(nameLike && field === nameField)).map((field) => page.fields[field]?.label ?? field);
    const template = nameLike ? (same.length ? labels.duplicateNamedWith : labels.duplicateNamed) : labels.duplicateWith;
    const [before, after = ''] = template.split('{name}');
    const fields = joined(same.length || nameLike ? same : setting.fields.filter((field) => page.fields[field]).map((field) => page.fields[field].label));
    return [fill(before, { fields }), fill(after, { fields })];
  };

  /** Merge is offered on two records that are stored, by a source that merges them: never a new record, nor one only to be read. */
  const mergeable = () => form.getState().recordId !== null && form.canMerge() && form.getState().can?.edit !== false && context.editable();

  function row(match: DuplicateMatch, values: Readonly<Values>, at: number): HTMLElement {
    const [before, after] = wordsOf(match, values);
    const id = `${prefix}-${at}-${String(match.id).replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const words = el('span', { class: 'fd-duplicate-words', id }, before, el('strong', {}, el('bdi', {}, match.name)), after);
    const button = (text: string, kind: string, act: (button: HTMLElement) => void) => {
      const made = el('button', { type: 'button', class: `fd-button fd-button-link fd-duplicate-${kind}`, 'aria-describedby': id }, text);
      made.addEventListener('click', () => act(made));
      return made;
    };
    const ways = [
      button(labels.openDuplicate, 'open', () => void openIt(match)),
      button(labels.notDuplicate, 'new', (pressed) => letBe(match, pressed)),
      ...(mergeable() ? [button(labels.mergeDuplicate, 'merge', (pressed) => void mergeWith(match, pressed))] : []),
    ];
    const icon = drawIcon(doc, 'warning', context.icons);
    const item = el('li', { class: 'fd-duplicate', 'data-record': String(match.id) }, el('span', { class: 'fd-duplicate-icon', 'aria-hidden': 'true' }, ...(icon ? [icon] : [])), words, el('span', { class: 'fd-duplicate-ways' }, ...ways));
    return item;
  }

  /** The matches, each under its field; those let be for this record left out. Said politely as one comes. */
  function draw(matches: readonly DuplicateMatch[]) {
    const { recordId, values } = form.getState();
    const dismissed = letBeFor(recordId);
    shown = matches.filter((match) => !dismissed.has(signature(match, values)));
    const at = new Map<string, DuplicateMatch[]>();
    for (const match of shown) {
      const place = placeOf(match);
      at.set(place, [...(at.get(place) ?? []), match]);
    }
    for (const [place, { note }] of notes) {
      if (at.has(place)) continue;
      note.remove();
      notes.delete(place);
    }
    for (const [place, group] of at) {
      // What it says and offers: its records and their words, and whether Merge is offered.
      const keys = JSON.stringify([recordId, mergeable(), group.map((match) => [keyOf(match), ...wordsOf(match, values)])]);
      const had = notes.get(place);
      // The same matches: left as they are, a focus on one of their buttons kept.
      if (had?.keys === keys && had.note.isConnected) continue;
      const list = el('ul', { class: 'fd-duplicates-list' }, ...group.slice(0, SHOWN).map((match, i) => row(match, values, i)));
      const more = group.length > SHOWN ? [el('p', { class: 'fd-duplicates-more' }, fill(labels.duplicatesMore, { n: group.length - SHOWN }))] : [];
      const note = el('div', { class: 'fd-duplicates', 'data-duplicates-of': place }, list, ...more);
      if (had) had.note.replaceWith(note);
      else if (place) wrapperOf(place)?.append(note);
      else {
        const content = root.querySelector<HTMLElement>(':scope > .fd-content');
        const body = content?.lastElementChild;
        if (body) body.before(note);
        else root.prepend(note);
      }
      notes.set(place, { note, keys });
    }
    // The first one not said before, said once.
    const first = shown.find((match) => !saidKeys.has(keyOf(match)));
    saidKeys = new Set(shown.map(keyOf));
    if (first) {
      const [before, after] = wordsOf(first, values);
      said.textContent = `${before}${first.name}${after}`;
    }
  }

  function clear() {
    for (const { note } of notes.values()) note.remove();
    notes.clear();
    shown = [];
    saidKeys = new Set();
    said.textContent = '';
  }

  // ---- its ways -----------------------------------------------------------------------------------------
  /** The record found, in this form's place, once the one check let what is typed here go: every change counts. */
  async function openIt(match: DuplicateMatch) {
    const still = form.recordShown();
    if (!(await form.leave({ changes: true })) || !still() || gone) return;
    await form.openRecord(match.id);
  }

  /** "It's someone new": let be for the values it matched on, remembered for this record; the focus to what is next. */
  function letBe(match: DuplicateMatch, pressed: HTMLElement) {
    const { recordId, values } = form.getState();
    const mark = signature(match, values);
    if (recordId === null) fresh.add(mark);
    else remember(recordId, [mark]);
    const item = pressed.closest('.fd-duplicate');
    const next = (item?.nextElementSibling ?? item?.previousElementSibling)?.getAttribute('data-record');
    const field = item?.closest<HTMLElement>('.fd-duplicates')?.getAttribute('data-duplicates-of') ?? '';
    draw(shown);
    // Drawn again: the focus to the next match's first way where one is left, else to the field's box.
    const target = next ? [...(notes.get(field)?.note.querySelectorAll<HTMLElement>('.fd-duplicate') ?? [])].find((one) => one.getAttribute('data-record') === next)?.querySelector<HTMLElement>('button') : null;
    (target ?? (field ? wrapperOf(field)?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select, [contenteditable="true"]') : null))?.focus();
  }

  /**
   * Merge…: what is typed saved first, as Duplicate saves it; the record found read; the two side by side. Once
   * merged, the record kept is shown — loaded again when it is this one — and the merge said.
   */
  async function mergeWith(match: DuplicateMatch, pressed: HTMLElement) {
    if (pressed.hasAttribute('aria-busy')) return;
    pressed.setAttribute('aria-busy', 'true');
    try {
      const before = form.getState();
      if ((before.dirty.length || Object.keys(before.unread).length) && !(await form.save())) return;
      const still = form.recordShown();
      const { recordId, values } = form.getState();
      if (recordId === null || gone) return;
      let other: Values;
      try {
        other = await form.readRecord(match.id);
      } catch (error) {
        if (still()) context.say(fill(labels.mergeUnread, { name: match.name, why: error instanceof Error ? error.message : String(error) }), 'danger');
        return;
      }
      if (!still() || gone) return;
      const typedName = nameField ? values[nameField] : null;
      const here: MergeSide = { id: recordId, name: typeof typedName === 'string' && typedName.trim() ? typedName : labels.newRecord, values: { ...values } };
      const done = await openMergeScreen(context, here, { id: match.id, name: match.name, values: other }, pressed);
      if (!done) return;
      if (still() && !gone) {
        if (String(done.id) === String(recordId)) await form.load();
        else await form.openRecord(done.id);
      }
      context.say([fill(labels.merged, { name: done.name }), done.message ?? ''].filter(Boolean).join(' '), 'success');
    } finally {
      pressed.removeAttribute('aria-busy');
    }
  }

  // ---- when it asks -----------------------------------------------------------------------------------
  /** Typing on in a field named: an answer on its way is for what was there; the change it makes asks again. */
  const typing = (event: Event) => {
    const wrapper = (event.target as Element | null)?.closest?.('.fd-field');
    const field = wrapper?.getAttribute('data-path');
    if (field && named.has(field) && wrapper?.closest('form.fd-form') === root) stop();
  };
  root.addEventListener('input', typing, true);
  const offs = [
    form.on('change', ({ field, by }) => {
      if (asTyped && by === 'person' && named.has(field)) later();
    }),
    // Another record, or a new one: what was said of the last goes; a record opened with values is asked of at once.
    form.on('open', () => {
      stop();
      clear();
      fresh = new Set();
      if (asTyped) ask();
    }),
    // Saved: what was let be while it was new is remembered by its id; and it is asked of again.
    form.on('save', ({ recordId }) => {
      if (recordId !== null && fresh.size) remember(recordId, fresh);
      fresh = new Set();
      ask();
    }),
  ];
  // The record opened before this part came: asked of now.
  const status = form.getState().status;
  if (asTyped && status !== 'idle' && status !== 'loading' && status !== 'error') ask();

  return {
    destroy() {
      gone = true;
      stop();
      for (const off of offs) off();
      root.removeEventListener('input', typing, true);
      clear();
      said.remove();
    },
  };
}
