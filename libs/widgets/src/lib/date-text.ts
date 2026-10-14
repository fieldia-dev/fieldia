import { readDate, readTime, stripMarks, type DateOrder, type DateProblem, type Form, type Locale, type Value } from '@fieldia/core';
import { minuteDigitsWords, quoted } from './input-rules';
import { fillIn, setAttr, wordsFor } from './kind-parts';
import type { WidgetLabels } from './labels';
import type { WidgetFactory } from './widgets';

/**
 * A date, a date and time and a time of day as text, in the page's order: read
 * from what is typed or pasted (`readDateText`), written for typing and at
 * rest, the placeholder and the example the words point to. Every box that
 * reads a date uses these — a field's own box (date-box.ts, in the date part),
 * a table's cell, a pasted block, a list's custom filter — so they stay in the
 * main script; the box itself, its calendar and a range of dates come in the
 * date part, the first time a page shows one (widget-parts.ts).
 */

export type DateKind = 'date' | 'datetime' | 'time';

const pad = (n: number) => String(n).padStart(2, '0');
/** A language as Intl writes its dates: English as in Britain, day first, as Fieldia writes dates at rest. */
const langOf = (locale: Locale) => (locale === 'en' ? 'en-GB' : locale);

/**
 * The order a page types its dates in: day/month/year unless its look says otherwise. Every box that reads a date —
 * a field's, a table's cell, a list's custom filter — asks this, so a page's dates are typed one way throughout.
 */
export function dateOrderOf(form: Pick<Form, 'page'>): DateOrder {
  const order: unknown = form.page?.look?.dateOrder;
  return order === 'mdy' || order === 'ymd' ? order : 'dmy';
}

/** The ISO 8601 week a day falls in: weeks start on Monday, week 1 holds the year's first Thursday. */
export function isoWeek(day: Date): number {
  const t = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** A date field's value as a day of the calendar where the person is, a date and time's as its local day and hours; null for what is no date. */
export function localOf(value: Value | undefined, kind: DateKind): Date | null {
  if (typeof value !== 'string' || !value) return null;
  if (kind === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  if (kind === 'time') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A day written the page's way for typing: 13/10/2026, 13.10.2026 on a German page, 10/13/2026, 2026-10-13. */
function typedDay(d: Date, order: DateOrder, locale: Locale): string {
  const [y, m, day] = [String(d.getFullYear()).padStart(4, '0'), pad(d.getMonth() + 1), pad(d.getDate())];
  if (order === 'ymd') return `${y}-${m}-${day}`;
  const mark = locale === 'de' ? '.' : '/';
  return order === 'mdy' ? `${m}/${day}/${y}` : `${day}${mark}${m}${mark}${y}`;
}

/**
 * A value as its box shows it while it is typed in: 13/10/2026, 13/10/2026 14:30, 14:30. A value from outside that
 * is no date is shown as its own text.
 */
export function typingText(value: Value | undefined, kind: DateKind, order: DateOrder, locale: Locale): string {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'time') return String(value);
  const d = localOf(value, kind);
  if (!d) return String(value);
  return kind === 'date' ? typedDay(d, order, locale) : `${typedDay(d, order, locale)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const restingFormats = new Map<string, Intl.DateTimeFormat>();

/** A value in words, as its box shows it once left: 13 Oct 2026, 13 Oct 2026, 14:30, 14:30. */
export function restingText(value: Value | undefined, kind: DateKind, locale: Locale): string {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'time') return String(value);
  const d = localOf(value, kind);
  if (!d) return String(value);
  const key = `${locale}:${kind}`;
  let format = restingFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(langOf(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      numberingSystem: 'latn',
      ...(kind === 'datetime' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
    });
    restingFormats.set(key, format);
  }
  return format.format(d);
}

/** The placeholder: the page's order in its words, "dd/mm/yyyy", "TT.MM.JJJJ hh:mm", "hh:mm". */
export function dateShape(kind: DateKind, order: DateOrder, words: WidgetLabels): string {
  if (kind === 'time') return words.timeShape;
  if (kind === 'datetime' && order === 'dmy') return words.dateTimeShape;
  const day = order === 'mdy' ? words.dateShapeMdy : order === 'ymd' ? words.dateShapeYmd : words.dateShape;
  return kind === 'datetime' ? `${day} ${words.timeShape}` : day;
}

/**
 * Text typed in a box, read: its value (null for nothing) — with `timeLeftOut`, the time a date and time had where a
 * day alone is kept (HH:MM, here) — or why it does not read, in words, and the reader's name for why.
 */
export type DateReading = { ok: true; value: string | null; timeLeftOut?: string } | { ok: false; words: string; problem: DateProblem | 'noSuchDay' | 'shortYear' | 'minuteDigits' };

/** What a box reads text with: its kind, its page's order and language, its label and words. */
export interface DateReader {
  kind: DateKind;
  order: DateOrder;
  locale: Locale;
  label: string;
  labels?: WidgetLabels;
}

/** A local date and time read ("2026-10-13T14:30") as the instant a date and time field keeps. */
const instantOf = (local: string) => {
  const [, y, mo, d, h, mi] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local) as RegExpExecArray;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)).toISOString();
};

/**
 * Typed text as a date, a date and time or a time, in the page's order: the value its field keeps (a day,
 * 2026-10-13; an instant; 14:30), or why not, in the page's words — "Start date: February 2026 has 28 days".
 */
export function readDateText(text: string, reader: DateReader): DateReading {
  const words = wordsFor(reader.labels, reader.locale);
  const { kind, label } = reader;
  const t = text.trim();
  if (!stripMarks(t)) return { ok: true, value: null };
  if (kind === 'time') {
    const time = readTime(t);
    if (time.ok) return { ok: true, value: time.value };
    // "14:3" could be 14:03 or 14:30: both are named, neither taken.
    if (time.problem === 'minuteDigits') return { ok: false, words: minuteDigitsWords(label, t, time.times, words, reader.locale), problem: 'minuteDigits' };
    return { ok: false, words: fillIn(words.timeUnfinished, { label, text: quoted(t) }), problem: time.problem === 'unfinished' ? 'unfinished' : 'time' };
  }
  const read = readDate(t, { order: reader.order, time: kind === 'datetime', locale: reader.locale });
  if (!read.ok) {
    switch (read.problem) {
      case 'minuteDigits':
        return { ok: false, words: minuteDigitsWords(label, t, read.times, words, reader.locale), problem: 'minuteDigits' };
      case 'noSuchDay': {
        const month = new Intl.DateTimeFormat(langOf(reader.locale), { month: 'long', numberingSystem: 'latn' }).format(new Date(2000, read.month - 1, 1));
        return { ok: false, words: fillIn(words.noSuchDay, { label, month, year: read.year, days: read.days }), problem: 'noSuchDay' };
      }
      case 'noSuchMonth':
        return { ok: false, words: fillIn(words.noSuchMonth, { label }), problem: 'noSuchMonth' };
      case 'yearDigits':
        return { ok: false, words: fillIn(words.yearDigits, { label }), problem: 'yearDigits' };
      case 'shortYear':
        return { ok: false, words: fillIn(words.yearInFull, { label, short: quoted(read.short), early: read.early, late: read.late }), problem: 'shortYear' };
      case 'time':
        return { ok: false, words: fillIn(words.timeUnfinished, { label, text: quoted(t) }), problem: 'time' };
      default:
        return { ok: false, words: fillIn(words.dateUnfinished, { label, text: quoted(t), example: dateExample(reader) }), problem: 'unfinished' };
    }
  }
  if (read.value === null) return { ok: true, value: null };
  if (kind !== 'date') return { ok: true, value: instantOf(read.value) };
  return read.timeLeftOut ? { ok: true, value: read.value, timeLeftOut: read.timeLeftOut } : { ok: true, value: read.value };
}

/** A date in the page's order, as words point to one: the year's last day, whose 31 shows which part is the day. */
export function dateExample(reader: Pick<DateReader, 'kind' | 'order' | 'locale'>): string {
  const last = new Date(new Date().getFullYear(), 11, 31, 14, 30);
  return reader.kind === 'datetime' ? `${typedDay(last, reader.order, reader.locale)} 14:30` : typedDay(last, reader.order, reader.locale);
}

/**
 * A date, a date and time or a time of day in a plain text box, read with the same reader: what is drawn while the date
 * part has not come (a widget made by something that did not wait for it, as the viewer does), or when it cannot come.
 * Typed in the page's order and read as the box is left; text that does not read stays in the box, marked, with why
 * (`FormState.unread`), and the field keeps what it held. Shown in words at rest. No guard and no calendar: those are
 * the date part's.
 */
export function plainDateWidget(kind: DateKind): WidgetFactory {
  return ({ form, name, field, node, id, document, labels, locale = 'en' }) => {
    const order = dateOrderOf(form);
    const reader: DateReader = { kind, order, locale, label: node.label ?? field.label, labels };
    const input = document.createElement('input');
    Object.assign(input, { type: 'text', id, className: `fd-input fd-${kind}`, autocomplete: 'off', placeholder: node.placeholder || dateShape(kind, order, wordsFor(labels, locale)) });
    const unread = () => form.getState().unread?.[name];
    const atRest = () => unread()?.text ?? restingText(form.getState().values[name], kind, locale);
    input.addEventListener('focus', () => {
      if (!unread() && !input.readOnly) input.value = typingText(form.getState().values[name], kind, order, locale);
    });
    input.addEventListener('change', () => {
      const read = readDateText(input.value, reader);
      if (read.ok) {
        if ((form.getState().values[name] ?? null) !== read.value) form.setValue(name, read.value);
        if (unread()) form.setUnread(name, null);
      } else form.setUnread(name, { text: input.value, message: read.words });
    });
    input.addEventListener('blur', () => {
      input.value = atRest();
    });
    return {
      element: input,
      focus: () => input.focus(),
      update(state) {
        const typing = document.activeElement === input;
        if (!typing) input.value = atRest();
        input.readOnly = state.readonly;
        setAttr(input, 'aria-invalid', String(state.invalid || (!!unread() && !typing)));
        setAttr(input, 'aria-describedby', state.describedBy || null);
      },
    };
  };
}
