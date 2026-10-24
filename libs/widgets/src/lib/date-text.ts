import { instantsAt, isOwnZone, ownZone, readDate, readTime, stripMarks, wallClock, wallDay, wallOf, wallTime, zoneOffset, dayTag, type DateOrder, type DateProblem, type DateRead, type Form, type Locale, type Value, type WallTime, intlFormat } from '@fieldia/core';
import { minuteDigitsWords, quoted, refusalHint } from './input-rules';
import { boxPurpose, fillIn, setAttr, wordsFor } from './kind-parts';
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
const langOf = (locale: Locale) => dayTag(locale);

/**
 * The order a page types its dates in: day/month/year unless its look says otherwise. Every box that reads a date —
 * a field's, a table's cell, a list's custom filter — asks this, so a page's dates are typed one way throughout.
 */
export function dateOrderOf(form: Pick<Form, 'page'>): DateOrder {
  const order: unknown = form.page?.look?.dateOrder;
  return order === 'mdy' || order === 'ymd' ? order : 'dmy';
}

/**
 * The time zone a field's dates and times are on the clock of, by its IANA name: a date and time's own (the page's
 * is written into each that names none), else its page's (`timeZone`); undefined for the browser's own.
 */
export function zoneOf(form: Pick<Form, 'page'>, field?: { type: string; timeZone?: string }): string | undefined {
  return (field?.type === 'datetime' ? field.timeZone : undefined) ?? form.page?.timeZone;
}

const zoneWords = new Map<string, Intl.DateTimeFormat>();
/** A zone's name at an instant, as the page's language writes it: its short one ("CEST", "EEST", "GMT+3"), or its long. */
export function zoneName(at: number, zone: string, locale: Locale = 'en', how: 'short' | 'longGeneric' = 'short'): string {
  const key = `${zone}|${locale}|${how}`;
  let format = zoneWords.get(key);
  if (!format) {
    try {
      format = intlFormat('DateTimeFormat', langOf(locale), { timeZone: zone, timeZoneName: how, numberingSystem: 'latn' });
    } catch {
      // A browser that knows no generic names says the season's: Central European Summer Time.
      format = intlFormat('DateTimeFormat', langOf(locale), { timeZone: zone, timeZoneName: how === 'short' ? 'short' : 'long', numberingSystem: 'latn' });
    }
    zoneWords.set(key, format);
  }
  return format.formatToParts(at).find((part) => part.type === 'timeZoneName')?.value ?? zone;
}

/** Whether an instant's time on its zone's clock comes twice that day: in the hour the clocks go back. */
export const comesTwice = (at: number, zone: string): boolean => instantsAt(wallTime(at, zone), zone).length > 1;

/**
 * Whether a date and time is written with its zone's short name beside it: the zone is not the browser's ("14:30
 * CEST" to a person in Cairo), or the time comes twice that day there, so which of the two it is shows.
 */
export const markedIn = (at: number, zone: string | undefined): zone is string => !!zone && (!isOwnZone(zone) || comesTwice(at, zone));

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

/** A day written the page's way for typing: 13/10/2026, 13.10.2026 on a German or Turkish page, 10/13/2026, 2026-10-13. */
function typedDay(d: Pick<WallTime, 'year' | 'month' | 'day'>, order: DateOrder, locale: Locale): string {
  const [y, m, day] = [String(d.year).padStart(4, '0'), pad(d.month), pad(d.day)];
  if (order === 'ymd') return `${y}-${m}-${day}`;
  const mark = locale === 'de' || locale === 'tr' ? '.' : '/';
  return order === 'mdy' ? `${m}/${day}/${y}` : `${day}${mark}${m}${mark}${y}`;
}

/**
 * A value as its box shows it while it is typed in: 13/10/2026, 13/10/2026 14:30, 14:30 — a date and time on the
 * clock of its zone (the browser's without one), with the zone's short name where the time comes twice that day, so
 * it reads back as the same instant. A value from outside that is no date is shown as its own text.
 */
export function typingText(value: Value | undefined, kind: DateKind, order: DateOrder, locale: Locale, zone?: string): string {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'time') return String(value);
  const d = localOf(value, kind);
  if (!d) return String(value);
  if (kind === 'date') return typedDay({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }, order, locale);
  const at = d.getTime();
  const wall = wallTime(at, zone);
  const text = `${typedDay(wall, order, locale)} ${wallClock(wall)}`;
  return zone && comesTwice(at, zone) ? `${text} ${zoneName(at, zone, locale)}` : text;
}

const restingFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * A value in words, as its box shows it once left: 13 Oct 2026, 13 Oct 2026, 14:30, 14:30 — a date and time on the
 * clock of its zone (the browser's without one), its short name after it where the zone is not the browser's or the
 * time comes twice that day (13 Oct 2026, 14:30 CEST), unless what shows it says the zone itself (`mark` false).
 */
export function restingText(value: Value | undefined, kind: DateKind, locale: Locale, zone?: string, mark = true): string {
  if (value === null || value === undefined || value === '') return '';
  if (kind === 'time') return String(value);
  const d = localOf(value, kind);
  if (!d) return String(value);
  const key = `${locale}:${kind}:${zone ?? ''}`;
  let format = restingFormats.get(key);
  if (!format) {
    format = intlFormat('DateTimeFormat', langOf(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      numberingSystem: 'latn',
      ...(kind === 'datetime' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(zone ? { timeZone: zone } : {}) } : {}),
    });
    restingFormats.set(key, format);
  }
  const text = format.format(d);
  return kind === 'datetime' && mark && markedIn(d.getTime(), zone) ? `${text} ${zoneName(d.getTime(), zone, locale)}` : text;
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
export type DateReading =
  | { ok: true; value: string | null; timeLeftOut?: string }
  | { ok: false; words: string; problem: DateProblem | 'noSuchDay' | 'shortYear' | 'minuteDigits' | 'skippedTime' | 'repeatedTime' | 'notThisZone' };

/**
 * What a box reads text with: its kind, its page's order and language, its label and words — and the time zone a date
 * and time is typed in (`zone`, a time zone's name, "Africa/Cairo"), where the computer is when left out. A date and
 * time the clocks skip or pass twice there is said by the reader, whatever zone it is given.
 */
export interface DateReader {
  kind: DateKind;
  order: DateOrder;
  locale: Locale;
  label: string;
  labels?: WidgetLabels;
  /**
   * The zone it reads in, by its IANA name: a date and time is typed on its clock, and a time the clocks skip there,
   * or repeat, is said; a date pasted as an instant is its day there. The browser's own, as before, without one.
   */
  zone?: string;
  /** A date's month alone or year alone (its field's `precision`): how the months part reads and writes one; a day without it. */
  grain?: GrainBox;
}

/**
 * A month alone or a year alone, as a date's box reads and writes it (the months part's, date-grain.ts): typed text
 * read — a whole day's month, what it leaves out said — the value written while typed in and at rest, the
 * placeholder, an example, whether what is typed is whole enough to take, and why it is not a month yet.
 */
export interface GrainBox {
  read(text: string): DateReading & { leftOut?: string };
  typing(value: Value | undefined): string;
  resting(value: Value | undefined): string;
  shape: string;
  example: string;
  whole(text: string): boolean;
  unfinished(text: string): string;
}

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
  if (kind === 'datetime') return readClock(t, reader);
  // A date: an instant pasted is its day where it is read (`zone`), the time it leaves out said.
  const read = readDate(t, { order: reader.order, locale: reader.locale, ...(reader.zone ? { zone: reader.zone } : {}) });
  if (!read.ok) return readProblem(read, t, reader);
  if (read.value === null) return { ok: true, value: null };
  return read.timeLeftOut ? { ok: true, value: read.value, timeLeftOut: read.timeLeftOut } : { ok: true, value: read.value };
}

/** Why typed text does not read as a date or a date and time, in the page's words. */
function readProblem(read: Extract<ReturnType<typeof readDate>, { ok: false }>, t: string, reader: DateReader): DateReading {
  const words = wordsFor(reader.labels, reader.locale);
  const { label } = reader;
  switch (read.problem) {
    case 'order':
      return { ok: false, words: fillIn(words.dateOrder, { label, text: quoted(t), example: dateExample(reader) }), problem: 'order' };
    case 'minuteDigits':
      return { ok: false, words: minuteDigitsWords(label, t, read.times, words, reader.locale), problem: 'minuteDigits' };
    case 'noSuchDay': {
      const month = intlFormat('DateTimeFormat', langOf(reader.locale), { month: 'long', numberingSystem: 'latn' }).format(new Date(2000, read.month - 1, 1));
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

/**
 * The Arabic letters a time's am and pm are written with, ص and م, made from their code points in a call the bundler
 * leaves as it is: the one-tag script carries no Arabic letters (tools/script-bundle.mjs).
 */
const letters = (...codes: number[]) => String.fromCharCode(...codes);
const AM_PM = letters(0x635, 0x645);
/**
 * A zone's mark after a time (or its am or pm): its offset, after its name for UTC or none (+02:00, GMT+2, UTC−5, as
 * Intl writes them in the page's language), or a word that may be its name (CEST, EEST).
 */
const MARK = new RegExp(`^(.*?(?:\\d{1,2}\\s*[:.hH]\\s*\\d{2}|\\d\\s*(?:[aApP]\\.?\\s*[mM]\\.?|[${AM_PM}])))\\s*(\\p{L}{0,8}\\s*[+\\-\u2212]\\s*\\d{1,2}(?::?\\d{2})?|\\p{L}{2,8})$`, 'iu');
/** An offset written as a mark, in minutes ahead of UTC; null for a mark that is a name. */
function offsetOf(mark: string): number | null {
  const m = /([+\-\u2212])\s*(\d{1,2})(?::?(\d{2}))?$/.exec(mark);
  if (!m) return /^(GMT|UTC)$/i.test(mark) ? 0 : null;
  return (m[1] === '+' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}
/** A name folded as marks are compared: its case, its spaces and its minus sign let go. */
const foldMark = (mark: string) => mark.replace(/\s+/g, '').replace(/\u2212/g, '-').toUpperCase();
/** Whether a mark names an instant in a zone: its offset there, or its short name there in the page's language or English. */
function markFits(mark: string, at: number, zone: string, locale: Locale): boolean {
  const offset = offsetOf(mark);
  if (offset !== null) return offset === zoneOffset(at, zone);
  return [zoneName(at, zone, locale), zoneName(at, zone)].some((name) => foldMark(name) === foldMark(mark));
}

/**
 * A date and time typed on its zone's clock (`zone`; the browser's own without one): the instant it is there — one
 * written as an instant, or with its offset from UTC ("02:30 +01:00"), the instant it names — or why not, in one
 * wording wherever it is typed: the clocks skip that time that day (from 02:00 to 03:00); or they pass it twice, and
 * the person says which by writing either offset, both named ("02:30 +02:00" or "02:30 +01:00"), or the zone's short
 * name, as a box writes such a time ("02:30 CEST"). A name the zone does not have that day — another zone's, or its own
 * at another time of year (CEST in January) — is said. The core's reader (`readDate`) finds what the clocks do.
 */
function readClock(t: string, reader: DateReader): DateReading {
  const words = wordsFor(reader.labels, reader.locale);
  const { label, locale, zone } = reader;
  const options = { order: reader.order, time: true, locale, ...(zone ? { zone } : {}) };
  /** A time the clocks skip or pass twice: read, and what they do said by the reader. */
  const moved = (read: DateRead): read is Extract<DateRead, { problem: 'skippedTime' | 'repeatedTime' }> => !read.ok && (read.problem === 'skippedTime' || read.problem === 'repeatedTime');
  let read = readDate(t, options);
  let mark: string | null = null;
  if (!read.ok && !moved(read)) {
    // A zone's mark after the time: read without it, and the instant picked by it.
    const split = MARK.exec(t);
    const unmarked = split ? readDate(split[1], options) : read;
    if (!split || !(unmarked.ok || moved(unmarked))) return readProblem(read, t, reader);
    [read, mark] = [unmarked, split[2]];
  }
  if (read.ok && read.value === null) return { ok: true, value: null };
  if (read.ok && read.at !== undefined) return { ok: true, value: new Date(read.at).toISOString() };
  if (!read.ok && !moved(read)) return readProblem(read, t, reader);
  const local = read.ok ? (read.value as string) : `${read.date}T${read.time}`;
  const wall = wallOf(local) as WallTime;
  const named = zone ?? ownZone();
  const day = restingText(wallDay(wall), 'date', locale);
  const time = wallClock(wall);
  const place = zoneName(Date.now(), named, locale, 'longGeneric');
  const offset = mark === null ? null : offsetOf(mark);
  // An offset is an instant as written, as the reader takes one: the time on the clock less the offset.
  if (offset !== null) return { ok: true, value: new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) - offset * 60000).toISOString() };
  if (!read.ok && read.problem === 'skippedTime') return { ok: false, words: fillIn(words.timeSkipped, { label, time, day, zone: place, from: read.from, to: read.to }), problem: 'skippedTime' };
  const at = instantsAt(wall, zone);
  const picked = mark === null ? at : at.filter((one) => markFits(mark as string, one, named, locale));
  if (picked.length === 1) return { ok: true, value: new Date(picked[0]).toISOString() };
  // A name the zone does not have that day — another zone's, or its own at another time of year — is said.
  if (mark !== null && !picked.length) return { ok: false, words: fillIn(words.notThisZone, { label, mark, zone: place, day, right: at.map((one) => zoneName(one, named, locale)).join(' / ') }), problem: 'notThisZone' };
  // Passed twice: each offset named, as the reader names them, either taking it.
  const offsets = !read.ok && read.problem === 'repeatedTime' ? read.offsets : at.map((one) => offsetWritten(zoneOffset(one, zone)));
  const [first, second] = offsets.map((written) => `${time} ${written}`);
  return { ok: false, words: fillIn(words.timeTwice, { label, time, day, zone: place, first, second }), problem: 'repeatedTime' };
}

/** An offset from UTC as people write it after a time: +02:00, -05:00. */
const offsetWritten = (minutes: number) => `${minutes < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;

/** A date in the page's order, as words point to one: the year's last day, whose 31 shows which part is the day. */
export function dateExample(reader: Pick<DateReader, 'kind' | 'order' | 'locale'>): string {
  const last = { year: new Date().getFullYear(), month: 12, day: 31 };
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
    const zone = zoneOf(form, field);
    const reader: DateReader = { kind, order, locale, label: node.label ?? field.label, labels, ...(zone ? { zone } : {}) };
    const input = document.createElement('input');
    Object.assign(input, { type: 'text', id, className: `fd-input fd-${kind}`, placeholder: node.placeholder || dateShape(kind, order, wordsFor(labels, locale)) });
    for (const [key, value] of Object.entries(boxPurpose(node, { autocomplete: 'off' }))) input.setAttribute(key, value);
    const unread = () => form.getState().unread?.[name];
    const atRest = () => unread()?.text ?? restingText(form.getState().values[name], kind, locale, zone);
    // A day and time where a day goes: the day is taken, and the time it leaves out said under the box, never in silence.
    const hint = refusalHint(input);
    input.addEventListener('focus', () => {
      if (!unread() && !input.readOnly) input.value = typingText(form.getState().values[name], kind, order, locale, zone);
    });
    input.addEventListener('change', () => {
      const read = readDateText(input.value, reader);
      if (read.ok) {
        if ((form.getState().values[name] ?? null) !== read.value) form.setValue(name, read.value);
        if (unread()) form.setUnread(name, null);
        if (read.timeLeftOut) hint.show(fillIn(wordsFor(labels, locale).timeLeftOut, { label: reader.label, time: read.timeLeftOut }));
        else hint.hide();
      } else {
        hint.hide();
        form.setUnread(name, { text: input.value, message: read.words });
      }
    });
    input.addEventListener('blur', () => {
      input.value = atRest();
    });
    return {
      element: input,
      focus: () => input.focus(),
      // Its hint stands beside it, outside its element: it goes with it, as the date part's box takes its place.
      destroy: () => hint.element.remove(),
      update(state) {
        const typing = document.activeElement === input;
        if (!typing) input.value = atRest();
        input.readOnly = state.readonly;
        setAttr(input, 'aria-invalid', String(state.invalid || (!!unread() && !typing)));
        setAttr(input, 'aria-describedby', hint.describedBy(state.describedBy) ?? null);
      },
    };
  };
}
