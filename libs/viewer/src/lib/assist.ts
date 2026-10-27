import { formLanguagesPart, isEmpty, labelAt, languagesOf, listComma, plainWords, type DataSource, type Field, type FieldNode, type Form, type FormState, type LineField, type Line, type Locale, type Page, type RecordId, type UploadFile, type Value, type Values } from '@fieldia/core';
import { askFirst, displayValue, drawIcon, keepTabIn, type IconSet } from '@fieldia/widgets';
import { readLines, readProposed, sameValue, type ReadHow } from './assist-read';
import { SPARKLE } from './assist-icon';
import { installAssistStyles } from './assist-styles';
import { setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';

/**
 * AI help on a form (the assist part), through the app's own model — Fieldia ships no model and no keys:
 *
 * - **Fill from text** (a page's `suggest`): words pasted — an e-mail signature, a message — or files, read by the
 *   data source's `suggest` into values for the page's fields, a table's lines to add among them.
 * - **A text field's tools** (`options.rewrite`): Draft writes it from the record, Polish makes the words there
 *   clearer, an app's own tool its own way — each the data source's `rewrite`.
 * - **The app's own proposal** (the viewer's `propose`): values an app's agent worked out, shown the same way.
 *
 * Every value proposed is shown on its field before it is kept: the value it would take the place of and the new one,
 * Accept and Reject — a table's lines to add listed under it — and over the page how many, why, Accept all and Reject
 * all. Nothing is written until it is accepted: a save meanwhile saves what the fields hold. Once kept, Undo puts back
 * what was there. A proposal is for the record it was asked for (`form.recordShown`): another record shown, or the
 * person's Discard, lets it go; one that answers late is laid nowhere. And the person's typing wins: a field typed in
 * while it was asked keeps what was typed (said, "Left as you typed"), and typing in a field with a proposal lets it go.
 */

/** What the assist part needs of the viewer that draws the page. */
export interface AssistContext {
  form: Form;
  /** The page as shown: its words in the reader's language, as the app's model is asked them. */
  page: Page;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  locale: Locale;
  /** The page's language tag. */
  tag?: string;
  icons?: IconSet;
  fill(template: string, values: Record<string, string | number>): string;
  dataSource: DataSource | undefined;
  /** The form's own element: the dialog goes in it. */
  root: HTMLElement;
  /** Whether the person may change the record here now: not a viewer locked to be read. */
  editable(): boolean;
}

/** What the viewer draws with the assist part. */
export interface AssistKit {
  /** Over the page's fields: Fill from text, and the review of a proposal. Hidden while it has nothing to show. */
  readonly bar: HTMLElement;
  /** Fill from text: in the bar, unless the viewer puts it among the record's buttons (a sheet's header). */
  readonly fill: HTMLElement;
  /** A field drawn: its tools (`options.rewrite`) after its box, and the place its proposal is said. */
  field(node: FieldNode, wrapper: HTMLElement, box: HTMLElement): void;
  /** Values the app proposes, each shown on its field to accept or reject: how many were laid. */
  propose(values: Values, how?: { why?: string }): Promise<number>;
  update(state: FormState): void;
  destroy(): void;
}

/** A value proposed for a field, waiting to be accepted or rejected. */
interface Proposal {
  field: string;
  /** The value it would hold; for a table, the lines to add. */
  value?: Value;
  lines?: Values[];
  /** What the field held as it was proposed. */
  was: Value | undefined;
  /** A batch of values (Fill from text, the app's), or one text field's tool's. */
  batch: number;
  why?: string;
  /** A text kept in several languages: the one language it fills, and its text there (`value` is the whole, the rest as it was). */
  language?: string;
  text?: string;
}

/** A proposal kept: what was there, what it wrote, the lines it added — what Undo puts back. */
interface Kept {
  field: string;
  before: Value | undefined;
  after: Value | undefined;
  /** A table's lines added, by key, with the values each was added with. */
  lines?: { key: string; values: Values }[];
  batch: number;
  /** Kept on its own (its field's Accept): said under the field, with its own Undo. */
  alone: boolean;
}

let kits = 0;

/** The kinds a text field's tools rewrite; the rest have no tools. */
const TEXT_KINDS = new Set(['char', 'text', 'html']);
/** The kinds a proposal fills (assist-read.ts): never a file, a picture or a photo set, JSON, properties or a matrix. */
const FILLED = new Set([...TEXT_KINDS, 'integer', 'float', 'monetary', 'boolean', 'selection', 'date', 'datetime', 'many2one', 'many2many', 'one2many']);

/** The tools a field's `options.rewrite` gives: true for Draft and Polish, else those it lists that read. */
function toolsOf(given: unknown): { how: string; label?: string }[] {
  if (given === true) return [{ how: 'draft' }, { how: 'polish' }];
  if (!Array.isArray(given)) return [];
  return given.flatMap((tool): { how: string; label?: string }[] =>
    tool === 'draft' || tool === 'polish' ? [{ how: tool }] : tool && typeof tool === 'object' && typeof tool.how === 'string' && typeof tool.label === 'string' ? [{ how: tool.how, label: tool.label }] : []
  );
}

/** Words of text with nothing in them: a rich text's tags alone. */
const blankText = (value: Value | undefined) => typeof value !== 'string' || !value.replace(/<[^>]*>/g, '').trim();

const primary = (tag: string) => tag.toLowerCase().split('-')[0];
/** A text kept in several languages, in one of them: its text there; a plain text is its first language's. */
function textIn(value: Value | undefined, language: string, languages: readonly string[]): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) return typeof (value as Record<string, unknown>)[language] === 'string' ? ((value as Record<string, string>)[language] as string) : '';
  return typeof value === 'string' && language === languages[0] ? value : '';
}
/** The whole of a text kept in several languages with one language's text given: the others as they were, never touched. */
function withLanguage(value: Value | undefined, language: string, text: string, languages: readonly string[]): Value {
  const all: Record<string, string> = value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, string>) } : typeof value === 'string' && value ? { [languages[0]]: value } : {};
  if (text.replace(/<[^>]*>/g, '').trim()) all[language] = text;
  else delete all[language];
  return Object.keys(all).length ? all : null;
}

export function watchAssist(context: AssistContext): AssistKit {
  const { form, page, doc, el, labels, fill, locale } = context;
  installAssistStyles(doc);
  const source = context.dataSource;
  const tag = context.tag ?? locale;
  const id = `fd-assist-${++kits}`;
  const separator = listComma(tag);
  const icon = () => {
    const drawn = drawIcon(doc, 'sparkle', { ...SPARKLE, ...context.icons });
    return drawn ? [drawn] : [];
  };
  const labelOf = (field: string) => page.fields[field]?.label ?? field;
  /** Labels named inside a sentence, small where the page asks (`lowerLabels`). */
  const named = (template: string, fields: string[]) => fields.map(labelOf).map(labelAt(template, 'fields', page.lowerLabels, tag)).join(separator);

  let gone = false;
  /** Values proposed, by field, in the order they came. */
  const pending = new Map<string, Proposal>();
  /** Proposals kept, by field: what Undo puts back. */
  const kept = new Map<string, Kept>();
  /** The batch shown over the page: its number, why, and what it left out. */
  let review: { batch: number; why?: string; leftTyped: string[]; notUsed: string[]; total: number } | null = null;
  /** For the record the proposals were asked for: another one shown, they go. */
  let shown: (() => boolean) | null = null;
  let batches = 0;
  /** Each ask counts on: a later one, or the dialog closed, leaves an earlier answer unheard. */
  let asking = 0;
  /** True while a proposal is written: its writes are no person's typing over it. */
  let writing = false;
  /** Each field's place on the page, as drawn: its wrapper, its box, its tools. */
  const places = new Map<string, { node: FieldNode; wrapper: HTMLElement; box: HTMLElement; tools: { how: string; button: HTMLButtonElement }[] }[]>();
  /** The notes drawn under fields, by field, with what each says. */
  const notes = new Map<string, { note: HTMLElement; key: string }>();

  // ---- what may be filled -----------------------------------------------------------------------------------------

  /**
   * A text kept in several languages (`translate`): the one language a proposal fills — the one shown in its switch,
   * else the reader's (or the field's first) — never another: each language is typed by a person. Null for any other.
   */
  const languageOf = (field: string): string | null => {
    const tags = languagesOf(page.fields[field]);
    if (!tags) return null;
    const switched = placeOf(field)?.wrapper.querySelector('.fd-lang-tab[aria-selected="true"]')?.getAttribute('lang');
    if (switched && tags.includes(switched)) return switched;
    return tags.find((one) => one.toLowerCase() === tag.toLowerCase()) ?? tags.find((one) => primary(one) === primary(tag)) ?? tags[0];
  };
  const languagesIn = (field: string) => languagesOf(page.fields[field]) ?? [];
  /** A language by its name, in the page's language: "English", "العربية". */
  const languageName = (language: string) => formLanguagesPart.loaded?.languageName(language, tag) ?? language.toUpperCase();

  const editable = () => context.editable() && form.getState().can?.edit !== false;
  /** A field a proposal may fill: on the page, of a kind it fills, one the person can set now. */
  const settable = (name: string) => {
    const def = page.fields[name];
    return !!def && def.readonly !== true && def.compute === undefined && !form.fieldReadonly(name);
  };
  /** The fields Fill from text may fill: the page's `suggest.fields`, else those shown that a person can set, of a kind a proposal fills. */
  const suggestFields = () => (page.suggest?.fields ?? form.shownFields()).filter((name) => !name.includes('.') && settable(name) && FILLED.has(page.fields[name].type));
  const canSuggest = () => !!page.suggest && !!source?.suggest && page.layout.type !== 'list';
  /** The field the person is in now: what a late proposal leaves as they type it. */
  const typingIn = (): string | null => {
    const active = doc.activeElement;
    // A box typed in: never the field's own tools, pressed to ask for its words.
    const typed = active instanceof Element && active.matches('input, textarea, select, [contenteditable="true"]');
    const wrapper = typed ? active.closest<HTMLElement>('.fd-field[data-path]') : null;
    return wrapper && context.root.contains(wrapper) ? wrapper.getAttribute('data-path') : null;
  };
  /** A field the person typed in since `before`: its value moved, or text there does not read yet, or they are in it now. */
  const typedSince = (name: string, before: Readonly<Values>) => {
    const state = form.getState();
    return !sameValue(state.values[name], before[name]) || Object.keys(state.unread).some((path) => path === name || path.startsWith(`${name}.`)) || typingIn() === name;
  };

  // ---- a value as words -------------------------------------------------------------------------------------------

  const words = (def: Field | LineField, value: Value | undefined, values: Readonly<Values>): string => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return labels.assistEmpty;
    if (def.type === 'boolean') return value ? labels.yes : labels.no;
    if (def.type === 'html' && typeof value === 'string') return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return displayValue(def as LineField, value, values as Values, locale);
  };
  const lineWords = (def: Field | LineField, line: Values) => {
    const fields = (def as { fields?: Record<string, LineField> }).fields ?? {};
    return Object.entries(fields)
      .filter(([name]) => line[name] !== undefined && words(fields[name], line[name], line) !== labels.assistEmpty)
      .map(([name, sub]) => words(sub, line[name], line))
      .join(' · ');
  };

  // ---- the bar over the page ----------------------------------------------------------------------------------------

  const fillButton = el('button', { type: 'button', class: 'fd-button fd-assist-fill', ...(page.suggest?.fromField ? {} : { 'aria-haspopup': 'dialog' }) }, ...icon(), el('span', {}, plainWords(page.suggest?.label) ?? labels.assistFill));
  fillButton.addEventListener('click', () => openFill());
  const reviewText = el('p', { class: 'fd-assist-review-text', id: `${id}-review` });
  // The app's words, in their own direction: English on an Arabic page too.
  const reviewWhy = el('p', { class: 'fd-assist-review-why', dir: 'auto' });
  const reviewMore = el('ul', { class: 'fd-assist-review-more' });
  const acceptAll = el('button', { type: 'button', class: 'fd-button fd-button-primary fd-assist-accept-all', 'aria-describedby': `${id}-review` }, labels.assistAcceptAll);
  const rejectAll = el('button', { type: 'button', class: 'fd-button fd-assist-reject-all', 'aria-describedby': `${id}-review` }, labels.assistRejectAll);
  const undoAll = el('button', { type: 'button', class: 'fd-button fd-assist-undo-all', 'aria-describedby': `${id}-review` }, labels.assistUndo);
  const doneButton = el('button', { type: 'button', class: 'fd-button fd-button-link fd-assist-done' }, labels.done);
  acceptAll.addEventListener('click', () => acceptBatch());
  rejectAll.addEventListener('click', () => rejectBatch());
  undoAll.addEventListener('click', () => undo([...kept.values()].filter((one) => !one.alone && one.batch === review?.batch), fillButton));
  doneButton.addEventListener('click', () => endReview(true));
  const reviewBox = el('div', { class: 'fd-assist-review', role: 'group', 'aria-labelledby': `${id}-review`, hidden: '' }, ...icon(), el('div', { class: 'fd-assist-review-words' }, reviewText, reviewWhy, reviewMore), el('div', { class: 'fd-assist-review-ways' }, acceptAll, rejectAll, undoAll, doneButton));
  /** Said once, politely, as proposals come and go: never over what the person is typing. */
  const said = el('div', { class: 'fd-sr-only', role: 'status', 'aria-live': 'polite' });
  const bar = el('div', { class: 'fd-assist-bar', 'data-assist': '' }, reviewBox, el('div', { class: 'fd-assist-start' }, fillButton), said);
  const say = (text: string) => {
    said.textContent = '';
    setTimeout(() => (said.textContent = text), 0);
  };

  function drawBar() {
    const offered = canSuggest() && editable();
    setHidden(fillButton, !offered);
    const batch = review?.batch;
    const waiting = [...pending.values()].filter((one) => one.batch === batch);
    const keptHere = [...kept.values()].filter((one) => !one.alone && one.batch === batch);
    const reviewing = review !== null && (waiting.length > 0 || keptHere.length > 0 || review.leftTyped.length > 0 || review.notUsed.length > 0 || review.total === 0);
    setHidden(reviewBox, !reviewing);
    bar.toggleAttribute('data-reviewing', reviewing);
    // Its button moved among the record's buttons: the bar shows only the review.
    setHidden(bar, !(offered && bar.contains(fillButton)) && !reviewing);
    if (!review || !reviewing) return;
    const count = waiting.length;
    const head = count ? fill(count === 1 ? labels.assistProposedOne : labels.assistProposed, { n: count }) : keptHere.length ? fill(keptHere.length === 1 ? labels.assistKeptAllOne : labels.assistKeptAll, { n: keptHere.length }) : '';
    const said = [head ? `${head}.` : '', count ? labels.assistReview : ''].filter(Boolean).join(' ');
    if (reviewText.textContent !== said) reviewText.replaceChildren(...(head ? [el('strong', {}, `${head}.`), said.slice(head.length + 1)] : [said]));
    // The app's why, under: where nothing was proposed, it is all there is to say.
    setText(reviewWhy, review.why ?? '');
    const out = waiting.filter((one) => !placeOf(one.field)).map((one) => one.field);
    const lines = [
      ...(out.length ? [fill(labels.assistOutOfSight, { fields: named(labels.assistOutOfSight, out) })] : []),
      ...(review.leftTyped.length ? [fill(labels.assistLeftTyped, { fields: named(labels.assistLeftTyped, review.leftTyped) })] : []),
      ...(review.notUsed.length ? [fill(labels.assistNotUsed, { items: review.notUsed.join('; ') })] : []),
    ];
    if (reviewMore.getAttribute('data-said') !== lines.join('\n')) {
      reviewMore.replaceChildren(...lines.map((line) => el('li', {}, line)));
      reviewMore.setAttribute('data-said', lines.join('\n'));
    }
    setHidden(reviewMore, !lines.length);
    setHidden(acceptAll, !count);
    setHidden(rejectAll, !count);
    setHidden(undoAll, count > 0 || !keptHere.length);
    setHidden(doneButton, count > 0);
    reviewBox.toggleAttribute('data-nothing', review.total === 0 && !keptHere.length);
  }

  /** The review over the page ends: what was kept stays kept, Undo is no longer offered. */
  function endReview(focusFill = false) {
    for (const [field, one] of kept) if (!one.alone) kept.delete(field);
    for (const [field, one] of pending) if (one.batch === review?.batch) pending.delete(field);
    review = null;
    draw();
    if (focusFill && !fillButton.hidden) fillButton.focus();
  }

  // ---- notes under fields -------------------------------------------------------------------------------------------

  /** A field's place on this page, in sight: none in a tab out of sight, nor once its part was drawn again. */
  function placeOf(field: string) {
    const drawn = (places.get(field) ?? []).find((place) => place.wrapper.isConnected && !place.wrapper.closest('[hidden]'));
    if (drawn) return drawn;
    // Made once the page was drawn (the app's first proposal): the field's box as it was drawn, after its label.
    const wrapper = [...context.root.querySelectorAll<HTMLElement>('.fd-field[data-path]')].find((one) => one.getAttribute('data-path') === field && one.closest('form.fd-form') === context.root && !one.closest('[hidden]'));
    const box = wrapper?.querySelector<HTMLElement>(':scope > .fd-label')?.nextElementSibling as HTMLElement | null | undefined;
    return wrapper ? { node: { type: 'field', id: wrapper.getAttribute('data-node') ?? field, field } as FieldNode, wrapper, box: box ?? wrapper, tools: [] } : undefined;
  }

  function noteFor(proposal: Proposal): HTMLElement {
    const def = page.fields[proposal.field];
    const values = form.getState().values;
    const wordsId = `${id}-${proposal.field}`;
    const accept = el('button', { type: 'button', class: 'fd-button fd-button-primary fd-proposal-accept', 'aria-describedby': wordsId }, labels.assistAccept);
    const reject = el('button', { type: 'button', class: 'fd-button fd-proposal-reject', 'aria-describedby': wordsId }, labels.assistReject);
    accept.addEventListener('click', () => acceptOne(proposal.field));
    reject.addEventListener('click', () => rejectOne(proposal.field));
    let body: HTMLElement;
    const label = el('span', { class: 'fd-sr-only' }, `${def.label}: `);
    if (proposal.lines) {
      const head = fill(proposal.lines.length === 1 ? labels.assistLinesOne : labels.assistLines, { n: proposal.lines.length });
      body = el('div', { class: 'fd-proposal-words', id: wordsId }, el('strong', {}, `${labels.assistProposal}: `), label, head, el('ul', { class: 'fd-proposal-lines' }, ...proposal.lines.map((line) => el('li', {}, el('bdi', {}, lineWords(def, line))))));
    } else {
      // A text kept in several languages: its one language's text, said by that language's name, written its own way.
      const language = proposal.language;
      const inText = (value: Value | undefined) => (language ? words(def, textIn(value, language, languagesIn(proposal.field)), values) : words(def, value, values));
      const now = language ? inText(proposal.value) : words(def, proposal.value, values);
      const before = inText(proposal.was);
      const nothingBefore = language ? !textIn(proposal.was, language, languagesIn(proposal.field)).replace(/<[^>]*>/g, '').trim() : isEmpty(def, proposal.was ?? null) || (def.type === 'html' && blankText(proposal.was));
      const lang = language ? { lang: language } : {};
      const long = TEXT_KINDS.has(def.type) && (now.length > 60 || /\n/.test(language ? (proposal.text ?? '') : String(proposal.value ?? '')));
      const head = language ? fill(labels.assistProposedIn, { language: languageName(language) }) : null;
      body = long
        ? el('div', { class: 'fd-proposal-words', id: wordsId }, el('strong', {}, head ?? labels.assistProposedText), label, el('div', { class: 'fd-proposal-text', dir: 'auto', ...lang }, now))
        : el(
            'div',
            { class: 'fd-proposal-words', id: wordsId },
            el('strong', {}, `${head ?? labels.assistProposal}: `),
            label,
            ...(nothingBefore ? [] : [el('del', lang, el('bdi', {}, before)), el('span', { class: 'fd-proposal-arrow', 'aria-hidden': 'true' }, ' → '), el('span', { class: 'fd-sr-only' }, ` ${fill(labels.assistInPlaceOf, { value: before })}: `)]),
            // Each value in its own direction: a phone, a tax id, a street keep their order on a right-to-left page.
            el('ins', lang, el('bdi', {}, now))
          );
    }
    const why = proposal.why && proposal.batch !== review?.batch ? [el('p', { class: 'fd-proposal-why', dir: 'auto' }, proposal.why)] : [];
    return el('div', { class: 'fd-proposal', 'data-proposal-of': proposal.field, role: 'group', 'aria-label': `${labels.assistProposal}: ${def.label}` }, el('span', { class: 'fd-proposal-icon', 'aria-hidden': 'true' }, ...icon()), el('div', { class: 'fd-proposal-main' }, body, ...why, el('div', { class: 'fd-proposal-ways' }, accept, reject)));
  }

  function keptNote(one: Kept): HTMLElement {
    const wordsId = `${id}-${one.field}-kept`;
    const back = el('button', { type: 'button', class: 'fd-button fd-button-link fd-proposal-undo', 'aria-describedby': wordsId }, labels.assistUndo);
    back.addEventListener('click', () => undo([one], placeOf(one.field)?.box ?? null));
    return el('div', { class: 'fd-proposal fd-proposal-kept', 'data-proposal-of': one.field }, el('span', { id: wordsId }, `${labels.assistKept}`, el('span', { class: 'fd-sr-only' }, `: ${labelOf(one.field)}`)), back);
  }

  /** Each proposal under its field, each kept one's Undo; notes no longer true go. */
  function draw() {
    const wanted = new Map<string, { key: string; make: () => HTMLElement }>();
    for (const proposal of pending.values()) wanted.set(proposal.field, { key: `p:${proposal.batch}:${JSON.stringify(proposal.value ?? proposal.lines ?? null)}:${JSON.stringify(proposal.was ?? null)}`, make: () => noteFor(proposal) });
    for (const one of kept.values()) if (one.alone && !wanted.has(one.field)) wanted.set(one.field, { key: `k:${one.batch}`, make: () => keptNote(one) });
    for (const [field, { note }] of notes) {
      if (wanted.has(field) && note.isConnected) continue;
      note.remove();
      notes.delete(field);
      placeOf(field)?.wrapper.removeAttribute('data-proposed');
    }
    for (const [field, { key, make }] of wanted) {
      const place = placeOf(field);
      const had = notes.get(field);
      if (had?.key === key && had.note.parentElement === place?.wrapper) continue;
      had?.note.remove();
      if (!place) {
        notes.delete(field);
        continue;
      }
      const note = make();
      // Under its box and its tools, before its help and its error; at its end where its box was drawn anew.
      const tools = place.wrapper.querySelector(':scope > .fd-assist-tools');
      const under = tools ?? (place.box.parentElement === place.wrapper ? place.box : null);
      if (under) under.after(note);
      else place.wrapper.append(note);
      notes.set(field, { note, key });
      place.wrapper.toggleAttribute('data-proposed', pending.has(field));
    }
    drawBar();
    drawTools();
  }

  // ---- accept, reject, undo -----------------------------------------------------------------------------------------

  /** Writes the proposal's value, as the person's own: the page's change steps run for it, as for a value typed. */
  function write(proposal: Proposal, alone: boolean): void {
    pending.delete(proposal.field);
    writing = true;
    try {
      if (proposal.lines) {
        const added = proposal.lines.map((values) => ({ key: form.addLine(proposal.field, values), values }));
        kept.set(proposal.field, { field: proposal.field, before: undefined, after: undefined, lines: added, batch: proposal.batch, alone });
      } else {
        const before = form.getState().values[proposal.field];
        form.setValue(proposal.field, proposal.value as Value);
        kept.set(proposal.field, { field: proposal.field, before, after: form.getState().values[proposal.field], batch: proposal.batch, alone });
      }
    } finally {
      writing = false;
    }
  }

  /** The next proposal's Accept, else the field just kept's box, else the bar: where the keyboard goes on. */
  function focusAfter(field: string) {
    queueMicrotask(() => {
      const next = [...notes.values()].map(({ note }) => note.querySelector<HTMLElement>('.fd-proposal-accept')).find(Boolean);
      const after = next ?? placeOf(field)?.wrapper.querySelector<HTMLElement>('.fd-proposal-undo') ?? (reviewBox.hidden ? null : reviewBox.querySelector<HTMLElement>('button:not([hidden])'));
      after?.focus();
    });
  }

  function acceptOne(field: string) {
    const proposal = pending.get(field);
    if (!proposal || !editable()) return;
    write(proposal, true);
    draw();
    say(`${labels.assistKept}: ${labelOf(field)}`);
    focusAfter(field);
  }

  function rejectOne(field: string) {
    if (!pending.delete(field)) return;
    draw();
    focusAfter(field);
  }

  /** Every proposal of the batch shown, kept in the page's order: Undo puts them all back. */
  function acceptBatch() {
    if (!review || !editable()) return;
    const batch = review.batch;
    for (const proposal of [...pending.values()].filter((one) => one.batch === batch)) write(proposal, false);
    draw();
    say(reviewText.textContent ?? '');
    undoAll.focus();
  }

  /** Every proposal of the batch still waiting let go; those kept from it stay, with their Undo. */
  function rejectBatch() {
    if (!review) return;
    const batch = review.batch;
    if (![...kept.values()].some((one) => !one.alone && one.batch === batch)) return endReview(true);
    for (const [field, one] of pending) if (one.batch === batch) pending.delete(field);
    draw();
    undoAll.focus();
  }

  /**
   * What was kept, put back — but where the person changed it since: their typing wins. Where what it wrote is the change
   * the record's Undo takes back next (Ctrl+Z), it is taken back there, so one Accept is one change to undo, whichever
   * Undo the person presses — never a second change that the record's Undo would then take back again.
   */
  function undo(entries: Kept[], focus: HTMLElement | null) {
    writing = true;
    /** Whether the record's own Undo takes this change back next: then it is the one that does. */
    const next = (field: string, line?: string) => {
      const step = form.history().undo;
      return !!step && step.field === field && step.line === line && !!form.undo();
    };
    try {
      // The last kept first: the record's history holds them in the order they were written.
      for (const one of [...entries].reverse()) {
        kept.delete(one.field);
        if (one.lines) {
          for (const added of [...one.lines].reverse()) {
            const line = ((form.getState().values[one.field] as Line[] | undefined) ?? []).find((each) => each.key === added.key);
            if (line && Object.entries(added.values).every(([name, value]) => sameValue(line.values[name], value)) && !next(one.field, added.key)) form.removeLine(one.field, added.key);
          }
        } else if (sameValue(form.getState().values[one.field], one.after) && !next(one.field)) form.setValue(one.field, (one.before ?? null) as Value);
      }
    } finally {
      writing = false;
    }
    draw();
    say(labels.assistUndone);
    if (focus?.isConnected) focus.focus();
    else if (!fillButton.hidden) fillButton.focus();
  }

  // ---- laying a proposal ------------------------------------------------------------------------------------------

  /** How a proposal's values are read: a link's name looked for exactly, a choice among those offered now. */
  const readHow: ReadHow = {
    locale,
    words: labels,
    look: (path, name) => {
      const [field, sub] = path.split('.');
      return sub ? form.searchLine(field, null, sub, name, 8, { exact: true }) : form.search(field, name, 8, { exact: true });
    },
    offered: (path) => (path.includes('.') ? null : form.offered(path)),
  };

  /**
   * Values proposed for the record the ask was made for (`asked.shown`), each read as its field holds one — those the
   * person typed in since (`asked.before`) left as typed, those that do not read said — and laid as a batch: the last
   * batch's proposals waiting go. How many were laid.
   */
  async function lay(values: Values, allowed: (name: string) => boolean, asked: { shown: () => boolean; before: Readonly<Values>; why?: string; languages?: Record<string, string> }): Promise<number> {
    const read: Proposal[] = [];
    const leftTyped: string[] = [];
    const notUsed: string[] = [];
    const batch = ++batches;
    // A field the page draws, and none other: pasted words may steer a model to a hidden one, which a person reviewing
    // could never see — nor Accept all write.
    const drawn = new Set(form.shownFields());
    for (const [name, given] of Object.entries(values ?? {})) {
      const def = page.fields[name];
      if (!def || !allowed(name) || !settable(name) || !drawn.has(name)) {
        notUsed.push(def ? def.label : name);
        continue;
      }
      if (def.type === 'one2many') {
        const { lines, refused } = await readLines(def, given, name, readHow);
        for (const why of refused) notUsed.push(`${def.label} (${why})`);
        if (lines.length) read.push({ field: name, lines, was: asked.before[name], batch, why: asked.why });
        continue;
      }
      // A text kept in several languages: the one language asked for, never the others (each typed by a person).
      const language = asked.languages?.[name] ?? languageOf(name);
      if (language) {
        const own = given && typeof given === 'object' && !Array.isArray(given) ? (given as Record<string, unknown>)[language] : given;
        if (typeof own === 'string' || typeof own === 'number') read.push({ field: name, language, text: String(own), was: asked.before[name], batch, why: asked.why });
        else notUsed.push(`${def.label} (${labels.assistNotRead})`);
        continue;
      }
      const got = await readProposed(def, given, name, readHow);
      if ('refused' in got) notUsed.push(`${def.label} (${got.refused})`);
      else read.push({ field: name, value: got.value, was: asked.before[name], batch, why: asked.why });
    }
    // Asked for another record, or let go by the person's Discard: laid nowhere.
    if (gone || !asked.shown()) return 0;
    for (const proposal of read) {
      if (typedSince(proposal.field, asked.before) && !proposal.lines) {
        leftTyped.push(proposal.field);
        continue;
      }
      proposal.was = form.getState().values[proposal.field];
      // One language's text laid over the others as they stand now.
      if (proposal.language) proposal.value = withLanguage(proposal.was, proposal.language, proposal.text ?? '', languagesIn(proposal.field));
    }
    const laid = read.filter((proposal) => !leftTyped.includes(proposal.field) && (proposal.lines ? true : !sameValue(proposal.value, proposal.was)));
    // Nothing to show: the last batch's review stays as it was.
    if (!laid.length && !leftTyped.length && !notUsed.length) return 0;
    // The last batch's proposals, and what it kept, give way to this one's.
    endReview();
    shown = asked.shown;
    for (const proposal of laid) {
      pending.delete(proposal.field);
      pending.set(proposal.field, proposal);
    }
    review = { batch, why: asked.why, leftTyped, notUsed, total: laid.length };
    draw();
    const head = laid.length ? fill(laid.length === 1 ? labels.assistProposedOne : labels.assistProposed, { n: laid.length }) : labels.assistNothing;
    say([head, asked.why ?? ''].filter(Boolean).join(' '));
    return laid.length;
  }

  // ---- Fill from text ---------------------------------------------------------------------------------------------

  /**
   * The source's `suggest` asked with what the person gave, over the values as they read (what is typed read first),
   * its answer laid as a batch: null once laid, words saying why nothing was (none found, the source failed), and
   * undefined where the answer was left unheard (another ask, the dialog closed, the viewer gone).
   */
  async function askSuggest(from: { text?: string; files?: UploadFile[] }): Promise<string | null | undefined> {
    const mine = ++asking;
    try {
      await form.settle();
      const state = form.getState();
      const asked = { shown: form.recordShown(), before: { ...state.values } };
      const fields = suggestFields();
      const languages = Object.fromEntries(fields.flatMap((name) => (languageOf(name) ? [[name, languageOf(name) as string]] : [])));
      const answer = await (source as Required<Pick<DataSource, 'suggest'>>).suggest({
        pageId: page.id,
        model: page.data.kind === 'record' ? page.data.model : '',
        recordId: state.recordId as RecordId | null,
        page,
        values: { ...state.values },
        fields,
        from,
        language: tag,
        ...(Object.keys(languages).length ? { languages } : {}),
      });
      if (mine !== asking || gone) return undefined;
      const laid = await lay(answer?.values ?? {}, (name) => fields.includes(name), { ...asked, languages, ...(answer?.why ? { why: answer.why } : {}) });
      if (mine !== asking || gone) return undefined;
      return laid || review?.leftTyped.length ? null : labels.assistNothing;
    } catch (error) {
      return mine === asking && !gone ? fill(labels.assistFailed, { why: error instanceof Error ? error.message : String(error) }) : undefined;
    }
  }

  /** A record's own words read (`suggest.fromField`): asked at once, the button busy, why nothing came said over the page. */
  async function fillFromField(field: string) {
    if (fillButton.hasAttribute('aria-busy')) return;
    const language = languageOf(field);
    const held = language ? textIn(form.getState().values[field], language, languagesIn(field)) : form.getState().values[field];
    const text = typeof held === 'string' ? (page.fields[field]?.type === 'html' ? held.replace(/<[^>]*>/g, ' ') : held).trim() : '';
    if (!text) return say(labels.assistNothing);
    const words = fillButton.lastElementChild as HTMLElement;
    const was = words.textContent ?? '';
    fillButton.setAttribute('aria-busy', 'true');
    words.textContent = labels.assistReading;
    try {
      const said = await askSuggest({ text });
      if (said) {
        review = { batch: ++batches, why: said, leftTyped: [], notUsed: [], total: 0 };
        drawBar();
        say(said);
      } else if (said === null) focusAfter('');
    } finally {
      fillButton.removeAttribute('aria-busy');
      words.textContent = was;
    }
  }

  function openFill() {
    if (!canSuggest() || !editable()) return;
    if (page.suggest?.fromField) return void fillFromField(page.suggest.fromField);
    if (context.root.querySelector('.fd-assist-dialog')) return;
    const from = page.suggest?.from ?? ['text', 'files'];
    const title = el('h2', { id: `${id}-fill-title`, class: 'fd-form-dialog-title' }, plainWords(page.suggest?.label) ?? labels.assistFill);
    const close = el('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': labels.close, title: labels.close }, '×');
    const hint = el('p', { class: 'fd-assist-hint', id: `${id}-fill-hint` }, labels.assistFillHint);
    const text = el('textarea', { class: 'fd-input fd-assist-text', rows: '9', 'aria-label': labels.assistFillBox, 'aria-describedby': `${id}-fill-hint`, placeholder: plainWords(page.suggest?.placeholder) ?? labels.assistFillPlaceholder }) as HTMLTextAreaElement;
    const picker = el('input', { type: 'file', multiple: '', class: 'fd-sr-only', tabindex: '-1', 'aria-hidden': 'true' }) as HTMLInputElement;
    const pick = el('button', { type: 'button', class: 'fd-button fd-assist-pick' }, labels.assistFiles);
    const picked = el('ul', { class: 'fd-assist-files', hidden: '' });
    let files: UploadFile[] = [];
    pick.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => {
      files = [...files, ...Array.from(picker.files ?? [])];
      picked.replaceChildren(...files.map((file) => el('li', {}, file.name)));
      picked.hidden = !files.length;
      picker.value = '';
    });
    const problem = el('p', { class: 'fd-assist-problem', role: 'alert', hidden: '' });
    const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
    const go = el('button', { type: 'button', class: 'fd-button fd-button-primary fd-assist-go' }, labels.assistFillGo);
    const body = el('div', { class: 'fd-form-dialog-body' }, hint, ...(from.includes('text') ? [text] : []), ...(from.includes('files') ? [el('div', { class: 'fd-assist-pick-row' }, pick, picker, picked)] : []), problem);
    const box = el('div', { class: 'fd-form-dialog fd-size-medium fd-assist-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id, tabindex: '-1' }, el('div', { class: 'fd-form-dialog-head' }, title, close), body, el('div', { class: 'fd-actions fd-actions-end fd-form-dialog-foot' }, cancel, go));
    const backdrop = el('div', { class: 'fd-dialog-backdrop fd-form-dialog-backdrop' }, box);
    let open = true;
    const finish = () => {
      if (!open) return;
      open = false;
      // An answer on its way is for a dialog no longer open: laid nowhere.
      asking++;
      backdrop.remove();
      if (fillButton.isConnected && !fillButton.hidden) fillButton.focus();
    };
    // Cancel is the person's own answer; × and Escape, with words pasted or files added, ask first, in place, as a
    // record's dialog asks before it lets them go.
    const letGo = askFirst(el, { yes: labels.discard, no: labels.assistKeepEditing });
    body.append(letGo.element);
    const leave = () => (text.value.trim() || files.length ? letGo.ask(labels.discardChanges, (discard) => (discard ? finish() : (from.includes('text') ? text : pick).focus())) : finish());
    cancel.addEventListener('click', finish);
    close.addEventListener('click', leave);
    const tell = (words: string | null) => {
      problem.textContent = words ?? '';
      problem.hidden = !words;
    };
    // Something pasted or added once it said there was nothing: that goes.
    const filled = () => {
      if ([labels.assistFillEmpty, labels.assistFillEmptyText, labels.assistFillEmptyFiles].includes(problem.textContent ?? '')) tell(null);
    };
    text.addEventListener('input', filled);
    picker.addEventListener('change', filled);
    go.addEventListener('click', async () => {
      if (go.hasAttribute('aria-busy')) return;
      const words = text.value.trim();
      // Nothing pasted or added: said beside it, where to put it focused — never a press that does nothing.
      if (!words && !files.length) {
        tell(from.includes('text') && from.includes('files') ? labels.assistFillEmpty : from.includes('text') ? labels.assistFillEmptyText : labels.assistFillEmptyFiles);
        return (from.includes('text') ? text : pick).focus();
      }
      go.setAttribute('aria-busy', 'true');
      go.textContent = labels.assistReading;
      tell(null);
      try {
        const said = await askSuggest({ ...(words ? { text: words } : {}), ...(files.length ? { files } : {}) });
        if (said === undefined) return;
        if (said) return tell(said);
        finish();
        focusAfter('');
      } finally {
        go.removeAttribute('aria-busy');
        go.textContent = labels.assistFillGo;
      }
    });
    // Its keys are its own: Escape closes it — asking first where something is in it — and no dialog or panel under it;
    // Tab stays in it. The question's own Escape is its Cancel.
    backdrop.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!letGo.element.contains(event.target as Node)) leave();
      } else keepTabIn(box, event);
    });
    context.root.append(backdrop);
    (from.includes('text') ? text : pick).focus();
  }

  // ---- a text field's tools -----------------------------------------------------------------------------------------

  /** Each field's tools shown while the field can be changed; Polish once it holds words. */
  function drawTools() {
    const state = form.getState();
    for (const [field, drawn] of places) {
      const changeable = editable() && settable(field);
      for (const place of drawn) {
        if (!place.tools.length) continue;
        const readonly = !changeable || form.node(place.node.id).readonly;
        const language = languageOf(field);
        const held = language ? textIn(state.values[field], language, languagesIn(field)) : state.values[field];
        for (const { how, button } of place.tools) setHidden(button, readonly || (how === 'polish' && blankText(held)));
        setHidden(place.tools[0].button.parentElement as HTMLElement, place.tools.every(({ button }) => button.hidden));
      }
    }
  }

  async function rewrite(field: string, how: string, button: HTMLButtonElement) {
    if (button.hasAttribute('aria-busy') || !source?.rewrite) return;
    const words = (button.lastElementChild as HTMLElement).textContent ?? '';
    const tools = button.parentElement as HTMLElement;
    // Why the last ask brought no words goes as it is asked again.
    if (tools.nextElementSibling?.classList.contains('fd-assist-failed')) tools.nextElementSibling.remove();
    button.setAttribute('aria-busy', 'true');
    setText(button.lastElementChild as HTMLElement, labels.assistWriting);
    try {
      await form.settle();
      const state = form.getState();
      const asked = { shown: form.recordShown(), before: { ...state.values } };
      // A text kept in several languages: the language shown in its switch, its words alone, filled alone.
      const language = languageOf(field);
      const held = language ? textIn(state.values[field], language, languagesIn(field)) : state.values[field];
      const answer = await source.rewrite({
        pageId: page.id,
        model: page.data.kind === 'record' ? page.data.model : '',
        recordId: state.recordId as RecordId | null,
        page,
        values: { ...state.values },
        field,
        how,
        text: typeof held === 'string' ? held : '',
        language: language ?? tag,
      });
      // Another record, the person's Discard, or typing in the field meanwhile: their words win.
      if (gone || !asked.shown() || typedSince(field, asked.before) || typeof answer?.text !== 'string') return;
      const was = form.getState().values[field];
      const value = language ? withLanguage(was, language, answer.text, languagesIn(field)) : answer.text;
      if (sameValue(value, was)) return;
      const batch = ++batches;
      kept.delete(field);
      shown = asked.shown;
      pending.set(field, { field, value, was, batch, ...(language ? { language, text: answer.text } : {}), ...(answer.why ? { why: answer.why } : {}) });
      draw();
      say(`${labels.assistProposedText}: ${labelOf(field)}`);
      notes.get(field)?.note.querySelector<HTMLElement>('.fd-proposal-accept')?.focus();
    } catch (error) {
      // Said under the tools, and to a screen reader at once; the field holds what it held.
      if (!gone && tools.isConnected) tools.after(el('p', { class: 'fd-assist-failed', role: 'alert' }, fill(labels.assistRewriteFailed, { why: error instanceof Error ? error.message : String(error) })));
    } finally {
      button.removeAttribute('aria-busy');
      setText(button.lastElementChild as HTMLElement, words);
    }
  }

  // ---- what the viewer tells it -------------------------------------------------------------------------------------

  const offs = [
    // The person's typing wins: a proposal on a field typed in goes, and Undo no longer offered over what they typed.
    form.on('change', ({ field, by }) => {
      if (writing || by !== 'person') return;
      let moved = pending.delete(field);
      const one = kept.get(field);
      if (one && !one.lines && !sameValue(form.getState().values[field], one.after)) moved = kept.delete(field) || moved;
      if (moved) draw();
    }),
    // Another record, or a new one: what was proposed for the last goes.
    form.on('open', () => {
      asking++;
      pending.clear();
      kept.clear();
      review = null;
      shown = null;
      draw();
    }),
  ];

  return {
    bar,
    fill: fillButton,
    field(node, wrapper, box) {
      const def = page.fields[node.field];
      const tools = def && TEXT_KINDS.has(def.type) && source?.rewrite ? toolsOf(node.options?.['rewrite']) : [];
      const made = tools.map(({ how, label }) => {
        const text = label ?? (how === 'draft' ? labels.assistDraft : how === 'polish' ? labels.assistPolish : how);
        const labelId = wrapper.querySelector('.fd-label')?.id;
        const button = el('button', { type: 'button', class: 'fd-button fd-button-link fd-assist-tool', 'data-tool': how, ...(labelId ? { 'aria-describedby': labelId } : {}) }, ...icon(), el('span', {}, text)) as HTMLButtonElement;
        button.addEventListener('click', () => void rewrite(node.field, how, button));
        return { how, button };
      });
      if (made.length) box.after(el('div', { class: 'fd-assist-tools' }, ...made.map(({ button }) => button)));
      // A text kept in several languages: Polish follows the language its switch shows.
      if (made.length && languagesOf(def)) for (const type of ['click', 'keyup']) wrapper.addEventListener(type, (event) => (event.target as Element).closest?.('.fd-lang-tab') && queueMicrotask(drawTools));
      places.set(node.field, [...(places.get(node.field) ?? []).filter((place) => place.wrapper.isConnected), { node, wrapper, box, tools: made }]);
      // Drawn again (a tab shown, a record's part drawn anew): its note, if any, goes back under it.
      if (pending.has(node.field) || kept.has(node.field)) queueMicrotask(draw);
    },
    async propose(values, how = {}) {
      if (gone || !editable()) return 0;
      await form.settle();
      const asked = { shown: form.recordShown(), before: { ...form.getState().values }, ...(how.why ? { why: how.why } : {}) };
      return lay(values, () => true, asked);
    },
    update() {
      // Asked for a record no longer shown, or let go by the person's Discard: what was proposed goes.
      if (shown && !shown()) {
        shown = null;
        pending.clear();
        kept.clear();
        review = null;
      }
      draw();
    },
    destroy() {
      gone = true;
      asking++;
      for (const off of offs) off();
      for (const { note } of notes.values()) note.remove();
      context.root.querySelector('.fd-assist-dialog')?.parentElement?.remove();
      bar.remove();
    },
  };
}
