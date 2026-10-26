import { foldTyped, stripMarks, type Field, type Form, type Locale, type Value } from '@fieldia/core';
import type { DateReader } from './date-text';
import { dateOrderOf } from './date-text';
import type { CalendarKind } from './calendar';
import { hijriCalendar } from './months-calendar';
import { hijriExample, hijriResting, hijriTyping, readHijriText } from './hijri';
import { guard, quoted, refusalHint, type InputRules } from './input-rules';
import { fillIn, maker, setAttr, wordsFor } from './kind-parts';
import type { WidgetLabels } from './labels';
import type { Widget, WidgetContext, WidgetState } from './widgets';

/**
 * A date's Hijri box (`hijri` on a date field): beside its Gregorian box, the same day in the Hijri calendar by Umm
 * al-Qura's reckoning (hijri.ts) — "2 Jumada I 1448 AH" at rest, 02/05/1448 while typed in, in the page's order. What
 * is typed here is read as the Gregorian box's text is: taken once it reads whole (its year of four digits), read as
 * the box is left, and kept unread with why when it does not read — a month of 29 days said so — the field holding
 * what it held. Its keys are judged as a date's: digits, separators, and a month's or the era's letters on their way.
 * The field keeps the Gregorian day; each box shows what the other wrote. In the months part, beside the date part's box.
 */

/** What a Hijri box needs: its form and field, its words, and what it tells the Gregorian box beside it. */
export interface HijriBoxOptions {
  form: Form;
  name: string;
  field: Field;
  label: string;
  document: Document;
  locale: Locale;
  labels?: WidgetLabels;
  /** Its id, as the Gregorian box's with `-hijri`. */
  id: string;
  reader: DateReader;
  /** Whether the text the form keeps unread is this box's, and saying it is now. */
  owner: { mine(): boolean; take(): void };
}

export interface HijriBox {
  input: HTMLInputElement;
  /** Its hint, under the field's boxes: why a key or a paste was refused. */
  hint: HTMLElement;
  update(state: Pick<WidgetState, 'value' | 'readonly' | 'invalid' | 'describedBy'> & Partial<Pick<WidgetState, 'required'>>): void;
  /** Text typed and not yet read, read now: Enter, a save made from inside it. */
  settle(): void;
  destroy(): void;
}

/** A Hijri date whole enough to take while it is typed: its four-digit year last, or first with a day after it. */
const whole = (text: string) => {
  const t = foldTyped(stripMarks(text)).trim();
  return /\D\d{4}(\s*\D*)?$/.test(t) || /^\d{4}\D+\d{1,2}\D+\d{1,2}$/.test(t);
};
/** The characters no Hijri date is written with: neither digits nor separators nor letters (a month's name, the era's mark). */
const strangers = (text: string) => (foldTyped(text).match(/[^\d\s/.,\u060c\-\p{L}]/gu) ?? []).length;

/** The input rules of a Hijri box: a key no Hijri date is written with refused, a paste read whole or refused, keys held after a refused one. */
function hijriRules(reader: DateReader): InputRules {
  const words = wordsFor(reader.labels, reader.locale);
  return {
    hold: true,
    judge: (next, before) => (strangers(next) <= strangers(before) ? null : fillIn(words.hijriUnfinished, { label: reader.label, text: quoted(next), example: hijriExample(reader.order, reader.locale) })),
    paste(text) {
      const read = readHijriText(stripMarks(text).trim(), reader);
      if (read.ok && read.value) return { text: hijriTyping(read.value, reader.order, reader.locale), whole: true };
      if (!read.ok && read.problem !== 'unfinished') return { refuse: read.words };
      return { refuse: fillIn(words.notPastedDate, { text: quoted(text) }) };
    },
  };
}

export function hijriBox(options: HijriBoxOptions): HijriBox {
  const { form, name, document, locale, labels, reader, owner } = options;
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const input = make('input', { type: 'text', id: options.id, class: 'fd-input fd-date fd-hijri', 'data-kind': 'hijri', autocomplete: 'off', spellcheck: 'false', 'aria-label': fillIn(words.hijriLabel, { label: options.label }) });
  input.placeholder = fillIn(words.hijriShape, { shape: reader.order === 'ymd' ? words.dateShapeYmd : reader.order === 'mdy' ? words.dateShapeMdy : words.dateShape });
  const hint = refusalHint(input);
  const checks = guard(input, hijriRules(reader), hint);
  let entered: { value: Value | undefined; text: string } | null = null;
  let readonly = false;
  const typing = () => document.activeElement === input;
  const unread = () => (owner.mine() ? form.getState().unread?.[name] : undefined);
  const write = (value: string | null) => {
    if ((form.getState().values[name] ?? null) !== value) form.setValue(name, value);
    if (form.getState().unread?.[name]) form.setUnread(name, null);
  };
  input.addEventListener('focus', () => {
    const value = form.getState().values[name];
    if (!readonly && !unread()) {
      const text = hijriTyping(value, reader.order, locale);
      if (input.value !== text) {
        input.value = text;
        input.setSelectionRange(0, text.length);
      }
      checks.accept();
    }
    entered = { value, text: input.value };
  });
  input.addEventListener('input', () => {
    const text = input.value;
    if (entered && text === entered.text) return write((entered.value ?? null) as string | null);
    if (!stripMarks(text).trim()) return write(null);
    if (!whole(text)) return;
    const read = readHijriText(text, reader);
    if (read.ok) write(read.value);
  });
  function settle() {
    if (readonly || !entered) return;
    const waiting = checks.held();
    if (waiting) {
      hint.hide();
      input.value = waiting.text;
      checks.accept();
    }
    const text = input.value;
    if (text === entered.text && !unread()) return;
    const read = readHijriText(text, reader);
    if (read.ok) return write(read.value);
    const back = (entered.value ?? null) as string | null;
    if ((form.getState().values[name] ?? null) !== back) form.setValue(name, back);
    owner.take();
    form.setUnread(name, { text, message: read.words });
  }
  const leave = () => {
    settle();
    entered = null;
    const kept = unread();
    const text = kept ? kept.text : hijriResting(form.getState().values[name], locale);
    if (input.value !== text) input.value = text;
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) settle();
  });
  input.addEventListener('change', () => (typing() ? settle() : entered && leave()));
  input.addEventListener('blur', leave);
  return {
    input,
    hint: hint.element,
    settle,
    update(state) {
      readonly = state.readonly;
      const kept = unread();
      if (!typing()) {
        const text = kept ? kept.text : hijriResting(state.value, locale);
        if (input.value !== text) input.value = text;
      }
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      input.classList.toggle('fd-blank', !input.value);
      setAttr(input, 'aria-invalid', String(state.invalid || (!!kept && !typing())));
      // Required, as the date box beside it says.
      if (state.required !== undefined) setAttr(input, 'aria-required', String(state.required));
      setAttr(input, 'aria-describedby', hint.describedBy(state.describedBy) ?? null);
    },
    destroy() {
      if (typing()) settle();
      checks.destroy();
    },
  };
}

/**
 * A date's Hijri box beside its own, as the date part's widget draws it (`hijriPair`): who keeps the text the form keeps
 * unread — the box that kept it last, the other leaving it be (`owner`, the date box's side) — the Hijri calendar its
 * button opens, and its widget wrapped with the Hijri box beside it.
 */
export function hijriPair(context: WidgetContext): { owner: { elsewhere(): boolean; mine(): void }; calendar: CalendarKind; wrap(calendar: Widget): Widget } {
  const { form, name, field, node, id, document, labels, locale = 'en' } = context;
  const label = node.label ?? field.label;
  let kept = false;
  const keeps = () => kept && !!form.getState().unread?.[name];
  return {
    owner: { elsewhere: keeps, mine: () => (kept = false) },
    calendar: hijriCalendar(document, labels, locale),
    wrap(calendar) {
      const second = hijriBox({ form, name, field, label, document, locale, labels, id: `${id}-hijri`, reader: { kind: 'date', order: dateOrderOf(form), locale, label, labels }, owner: { mine: keeps, take: () => (kept = true) } });
      return {
        element: maker(document)('span', { class: 'fd-date-hijri' }, calendar.element, second.input),
        focus: () => calendar.focus(),
        ...(calendar.takeTyped ? { takeTyped: calendar.takeTyped } : {}),
        update(state) {
          calendar.update(state);
          second.update(state);
        },
        destroy() {
          calendar.destroy?.();
          second.destroy();
          second.hint.remove();
        },
      };
    },
  };
}
