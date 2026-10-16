import { checkValue, couldBeMonth, foldTyped, MESSAGES, stripMarks, type Field, type Form, type Locale, type Value } from '@fieldia/core';
import { withCalendar } from './calendar';
import { dateExample, dateOrderOf, dateShape, localOf, readDateText, restingText, typingText, type DateKind, type DateReader } from './date-text';
import { guard, quoted, refusalHint, type InputRules } from './input-rules';
import { boxPurpose, fillIn, maker, setAttr, typeInto, wordsFor } from './kind-parts';
import type { WidgetLabels } from './labels';
import { bounds, markBounds, type DayLimits } from './limits';
import type { TypedText, Widget, WidgetContext, WidgetFactory, WidgetState } from './widgets';

/**
 * Fieldia's own box for a date, a date and time, and a time of day: a text
 * box (with its calendar button, for a date) in place of the browser's,
 * which follows the browser's language rather than the page's, ignores a
 * paste and Arabic digits, and fixes a year segment when the limits share a
 * year — so 20/10/2026 typed in full became the 26th.
 *
 * It comes in the date part (date-part.ts), with its calendar and a range of
 * dates, the first time a page shows one; the reader it types with
 * (date-text.ts) is the main script's, shared with every box that reads a
 * date — a table's cell, a pasted block, a list's custom filter.
 *
 * - Typed in the page's order: day/month/year on English, Arabic, French and
 *   German pages, as Fieldia writes dates at rest; `look.dateOrder` may say
 *   month first or year first. The order is the placeholder, in the page's
 *   words. A date written year first, 2026-10-13, is always read.
 * - Separators / . - and a space; Arabic-Indic and Persian digits; a year
 *   of four digits — one of two could be either century, so it is never
 *   given one: it is said, naming both. A time is 24-hour, or with am/pm
 *   (ص/م).
 * - A date as Fieldia writes it at rest reads back, its month in words — 15
 *   Oct 2026, 15 أكتوبر 2026, 15 oct. 2026, 15. Okt. 2026, Oct 15, 2026, with
 *   its time after a comma — as does an instant a server writes
 *   (2026-10-15T14:30:00Z): copied from a list, a read-only view or another
 *   box, it pastes, and it can be typed so.
 * - Nothing is rewritten while the box has focus. The field takes the date
 *   once it reads whole — a four-digit year typed, the minutes of a time —
 *   and once the box is left, where the box shows it in words (13 Oct
 *   2026), so how it was read can be seen.
 * - Text that does not read when the box is left — 31/02, month 13, a
 *   five-digit year, a half-typed time — stays in the box, marked, with why
 *   (`FormState.unread`), and the field keeps what it held: Save refuses
 *   until it is put right. Its earliest, latest, days and steps are said as
 *   the box is left (form.leave) and at Save.
 * - A paste is read as typing is: a whole date or time takes the box's place,
 *   anything else is refused with words.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The Arabic letters a time's am and pm are written with, ص and م, made from their code points: the one-tag script
 * carries no Arabic words (tools/script-bundle.mjs checks that none got past the languages' add-ons), and these are none.
 */
const letters = (...codes: number[]) => String.fromCharCode(...codes);
const AM_PM = letters(0x635, 0x645);

/**
 * What may be typed in a box at all: digits in any script and separators, and the comma a date written in words has
 * (Oct 15, 2026); a time's colon, its h, am and pm; a T between a date and its time.
 */
const MAY_TYPE: Record<DateKind, RegExp> = {
  date: /[^\d\s/.,\u060c-]/g,
  datetime: new RegExp(`[^\\d\\s/.,\\u060c\\-:hHtTaApPmM${AM_PM}]`, 'g'),
  time: new RegExp(`[^\\d\\s:.hHaApPmM${AM_PM}]`, 'g'),
};
/** How many characters a text has that no date or time is written with: a word on its way to a month's name is none. */
function strangers(text: string, kind: DateKind, locale?: Locale): number {
  // A full-width keyboard's slash and colon ("１５／１０", "１４：３０") are a date's and a time's, as the readers read them.
  let t = foldTyped(text);
  if (kind !== 'time') t = t.replace(/\p{L}+/gu, (word) => (couldBeMonth(word, locale) ? ' ' : word));
  return (t.match(MAY_TYPE[kind]) ?? []).length;
}

/** am or pm after a time, in English or Arabic. */
const HALF = `(?:[aApP]\\.?\\s*[mM]\\.?|[${AM_PM}])`;
const WHOLE_TIME = new RegExp(`(?:[:.hH]\\s*\\d{2}|^\\d{4}|\\d\\s*${HALF})$`);
/** A date and time whole: a time after its date (a space or a T between them), its minutes or its am or pm typed. */
const WHOLE_DATETIME = new RegExp(`[\\sT]\\d{1,2}\\s*[:.hH]\\s*\\d{2}$|\\s\\d{1,2}(?:\\s*[:.hH]\\s*\\d{2})?\\s*${HALF}$`);

/** A typed date or time whole enough to take while it is still typed: its year of four digits (its day, written year first), its minutes. */
function whole(text: string, kind: DateKind): boolean {
  const t = foldTyped(text).trim();
  if (kind === 'time') return WHOLE_TIME.test(t);
  if (kind === 'datetime') return WHOLE_DATETIME.test(t);
  return /^\d{4}/.test(t) ? /\d{2}$/.test(t) : /\d{4}$/.test(t);
}

/** What a date box needs: its form and field, the path its unread text is kept by, its kind, its words. */
export interface DateBoxOptions {
  form: Form;
  /** The field it writes. */
  name: string;
  field: Field;
  kind: DateKind;
  label: string;
  document: Document;
  locale: Locale;
  labels?: WidgetLabels;
  /** Its id, for its label to point at. */
  id?: string;
  /** What it keeps to: its earliest, latest, days and steps. */
  limits: DayLimits;
  placeholder?: string;
  className?: string;
  /** What the hint under the box goes after: the box, unless its widget wraps it in something (with its calendar button). */
  anchor?: HTMLElement;
  /**
   * What the box is drawn in with its neighbours — its calendar button, a range's other box: the focus moving to one
   * of them leaves the box all the same, and the page round it hears so (a focusout of its own), to say what it found.
   */
  within?: HTMLElement;
  /** What the browser fills it in with and the keyboard a phone shows (`boxPurpose`): nothing unless said. */
  purpose?: { autocomplete?: string; inputmode?: string };
}

/** A date box: its text box, which its widget draws where it wants, and what keeps it current. */
export interface DateBox {
  input: HTMLInputElement;
  update(state: Pick<WidgetState, 'value' | 'readonly' | 'invalid' | 'describedBy'>): void;
  /** Text typed and not yet read is read now, as if the box were left: Enter, a cell closed. */
  settle(): void;
  /** Text typed in a plain box before this one came, taken as typed: focused, read as this box is left. */
  take(typed: TypedText): void;
  /** Why a value (as its field would hold it) breaks its limits, in the page's words: what the calendar refuses. */
  refuse(value: string): string | undefined;
  destroy(): void;
}

/**
 * The input rules of a box a date, a date and time or a time of day is typed in, read by `reader` (its label and order
 * as they stand at each edit): a key no date or time is written with is refused, with words (a word on its way to a
 * month's name is not one);
 * a paste is read as typing is, a whole date taking the box's place written the page's way, a piece of one put where
 * the caret is, anything else refused whole with words. The keys typed after a refused one wait with it (`hold`), so
 * "1x5/10/2026" is never 15 October: left so, all that was typed is the box's, read as it is. A field's box keeps to
 * them, and so does every other box a date is typed into — a designer's setting.
 */
export function dateRules(input: HTMLInputElement, reader: DateReader): InputRules {
  const { kind, locale } = reader;
  const words = wordsFor(reader.labels, locale);
  return {
    hold: true,
    judge(next, before) {
      if (strangers(next, kind, locale) <= strangers(before, kind, locale)) return null;
      const label = reader.label;
      return kind === 'time' ? fillIn(words.timeUnfinished, { label, text: quoted(next) }) : fillIn(words.dateUnfinished, { label, text: quoted(next), example: dateExample(reader) });
    },
    paste(text) {
      const plain = stripMarks(text).replace(/(\r\n|[\r\n])$/, '').trim();
      if (/[\t\n\r]/.test(plain)) return { refuse: fillIn(words.severalValues, { label: reader.label }) };
      let read = readDateText(plain, reader);
      // A date and time pasted in a date's box: its day, and the time left out is said.
      if (kind === 'date' && !read.ok) {
        const timed = readDateText(plain, { ...reader, kind: 'datetime' });
        if (timed.ok && timed.value) {
          const at = new Date(timed.value);
          read = { ok: true, value: typingDate(at), timeLeftOut: `${pad(at.getHours())}:${pad(at.getMinutes())}` };
        }
      }
      const replacing = (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) >= input.value.length;
      if (read.ok && read.value) {
        // A whole date takes the box's place, written the page's way (`whole`: where keys wait after a refused one, it
        // joins them as it was pasted instead, the hold's rule).
        const taken = typingText(read.value, kind, reader.order, locale);
        return read.timeLeftOut ? { text: taken, whole: true, say: fillIn(words.timeLeftOut, { label: reader.label, time: read.timeLeftOut }) } : { text: taken, whole: true };
      }
      // A piece of one, put where the caret is; never a text no date is written with, nor a whole one that does not read.
      if (plain && !replacing && !strangers(plain, kind, locale)) return { text: plain };
      // A whole date or time that does not read is refused saying why, as its reader says it — 31/02 "February 2026 has
      // 28 days", a time with seconds "is not a time" — never only "not a date"; a time's box never calls it a date.
      if (!read.ok && (kind === 'time' || read.problem !== 'unfinished')) return { refuse: read.words };
      return { refuse: fillIn(words.notPastedDate, { text: quoted(text) }) };
    },
  };
}

/** A day as a date field keeps it, 2026-10-13. */
function typingDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A date box, writing its field as typing reads and as it is left. */
export function dateBox(options: DateBoxOptions): DateBox {
  const { form, name, field, kind, label, document, locale, labels, limits } = options;
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const order = dateOrderOf(form);
  const reader: DateReader = { kind, order, locale, label, labels };
  const input = make('input', { type: 'text', class: `fd-input fd-${kind}${options.className ? ` ${options.className}` : ''}`, 'data-kind': kind, autocomplete: 'off', ...options.purpose, spellcheck: 'false', ...(options.id ? { id: options.id } : {}) });
  input.placeholder = options.placeholder || dateShape(kind, order, words);
  markBounds(input, limits);

  const hint = refusalHint(input, options.anchor ?? input);
  const checks = guard(input, dateRules(input, reader), hint);

  /** The value the box last wrote or showed: a value changed by anyone else shows as it comes. */
  let held: Value | undefined = form.getState().values[name];
  /** What the field held as the box was entered — text left that does not read puts it back — and the text it showed then. */
  let entered: { value: Value | undefined; text: string } | null = null;
  let readonly = false;
  const unreadNow = () => form.getState().unread?.[name];
  const typing = () => document.activeElement === input;
  const write = (value: string | null) => {
    held = value;
    if ((form.getState().values[name] ?? null) !== value) form.setValue(name, value);
  };

  input.addEventListener('focus', () => {
    const value = form.getState().values[name];
    if (!readonly && !unreadNow()) {
      // Entered, the box shows the value as it is typed, all of it chosen, so typing replaces it.
      const text = typingText(value, kind, order, locale);
      if (input.value !== text) {
        input.value = text;
        input.setSelectionRange(0, text.length);
      }
      checks.accept();
    }
    entered = { value, text: input.value };
  });
  input.addEventListener('input', () => {
    // Written while the person is elsewhere — the browser's autofill, from a pick in another box: read as the box is
    // left (its change), the field holding what it held as the write came should it not read.
    if (!typing()) entered = { value: form.getState().values[name], text: restingText(form.getState().values[name], kind, locale) };
    const text = input.value;
    // Typed back to what it showed as it was entered: the value it came with, as it came (never rewritten to the
    // reader's own way of keeping it, seconds and all).
    if (entered && text === entered.text) {
      write((entered.value ?? null) as string | null);
      if (unreadNow()) form.setUnread(name, null);
      return;
    }
    if (!stripMarks(text).trim()) {
      write(null);
      if (unreadNow()) form.setUnread(name, null);
      return;
    }
    // Taken once it reads whole: "13/10/20" waits for the rest of its year.
    if (!whole(text, kind)) return;
    const read = readDateText(text, reader);
    if (!read.ok) return;
    write(read.value);
    if (unreadNow()) form.setUnread(name, null);
  });
  /** The text read as the box is left: taken, or kept and marked with why, the field holding what it held. */
  function settle() {
    // Read once for each time the box is entered: a second blur, as a redraw sends, reads nothing again.
    if (readonly || !entered) return;
    // Keys held after a refused one are part of what was typed: "1x5/10/2026" where the box shows "1". All of it is the
    // box's now, and the field's own words take over from the hint.
    const waiting = checks.held();
    if (waiting) {
      hint.hide();
      input.value = waiting.text;
      checks.accept();
    }
    const text = input.value;
    // Not changed since the box was entered: the value stays as it came, seconds and all.
    if (text === entered.text && !unreadNow()) return;
    const read = readDateText(text, reader);
    if (read.ok) {
      write(read.value);
      if (unreadNow()) form.setUnread(name, null);
      return;
    }
    const back = entered.value ?? null;
    if ((form.getState().values[name] ?? null) !== back) write(back as string | null);
    form.setUnread(name, { text, message: read.words });
  }
  input.addEventListener('keydown', (event) => {
    // Enter sends a form: what is typed is read first, so a date that does not read is never sent as the one held.
    if (event.key === 'Enter' && !event.isComposing) settle();
  });
  /** Read as it is left, then shown at rest: the text it kept unread, or its value in words. */
  const leave = () => {
    settle();
    entered = null;
    const unread = unreadNow();
    const text = unread ? unread.text : restingText(form.getState().values[name], kind, locale);
    if (input.value !== text) input.value = text;
  };
  // A save made with the box still entered (Ctrl+Enter, a button's key) reads it first, as leaving it would; written
  // while the person is elsewhere, it is read as left.
  input.addEventListener('change', () => (typing() ? settle() : entered && leave()));
  input.addEventListener('blur', (event) => {
    leave();
    // Left for its own calendar button, or a range's other box: still the box left, and what it found is said now. (Not
    // in a grid's editor, which a focus leaving its cell closes: there the cell's own close reads what was typed.)
    const to = (event as FocusEvent).relatedTarget;
    if (options.within && to instanceof Node && options.within.contains(to) && !input.closest('.fd-grid-editor')) input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
  });

  return {
    input,
    settle,
    take(typed) {
      typeInto(input, typed, () => {
        // Entered as the plain box was: its text then is what was shown for the value it held.
        entered = { value: typed.entered, text: typingText(typed.entered, kind, order, locale) };
        checks.accept();
      });
    },
    refuse(value) {
      // The field's own limits, in the page's words: before its earliest, after its latest, a day it may not fall on.
      return checkValue(field, value, false, MESSAGES[locale] ?? MESSAGES.en);
    },
    update(state) {
      readonly = state.readonly;
      const unread = unreadNow();
      if (typing()) {
        // Changed by someone else while it is typed in (the app, a rule): shown as it is typed.
        if (state.value !== held && !readonly) {
          held = state.value;
          input.value = typingText(state.value, kind, order, locale);
          checks.accept();
        }
      } else {
        held = state.value;
        const text = unread ? unread.text : restingText(state.value, kind, locale);
        if (input.value !== text) input.value = text;
      }
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      // Empty, its placeholder is no answer: read-only, it is not drawn.
      input.classList.toggle('fd-blank', !input.value);
      // A value from outside that is no date, shown as its own text, is marked as text left unread is.
      const strange = typeof state.value === 'string' && state.value !== '' && kind !== 'time' && !localOf(state.value, kind);
      setAttr(input, 'aria-invalid', String(state.invalid || ((!!unread || strange) && !typing())));
      setAttr(input, 'aria-describedby', hint.describedBy(state.describedBy) ?? null);
    },
    destroy() {
      // Closed while typed in (a table's cell): what was typed is read, never dropped.
      if (typing()) settle();
      checks.destroy();
    },
  };
}

/**
 * A date, a date and time, or a time of day (`char.time`) in Fieldia's own box; a date's and a date and time's
 * calendar beside it, with the week numbers when the node asks (`options.weekNumbers`).
 */
export function dateBoxWidget(kind: DateKind): WidgetFactory {
  return (context: WidgetContext): Widget => {
    const { form, name, field, node, id, document, labels, locale = 'en' } = context;
    // A date's box and its calendar button, in one: the hint goes under both.
    const into = kind === 'time' ? undefined : maker(document)('span', { class: 'fd-date-pick' });
    const box = dateBox({ form, name, field, kind, label: node.label ?? field.label, document, locale, labels, id, limits: bounds(null, field, node), placeholder: node.placeholder, anchor: into, within: into, purpose: boxPurpose(node) });
    const inner: Widget = {
      element: box.input,
      focus: () => box.input.focus(),
      update: (state) => box.update(state),
      destroy: () => box.destroy(),
      takeTyped: (typed) => {
        box.take(typed);
        return true;
      },
    };
    if (kind === 'time' || !into) return inner;
    return withCalendar(inner, context, kind, { weekNumbers: node.options?.['weekNumbers'] === true, refuse: (value) => box.refuse(value), into });
  };
}
