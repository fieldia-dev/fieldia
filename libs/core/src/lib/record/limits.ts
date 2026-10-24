import type { Field, LineField } from '../format/field';
import { localDay } from '../expression/functions';
import { dayIn } from './zones';
import { fillMessage, type Messages } from './messages';
import { dayWords, precisionOf } from './day-words';
import { intlFormat } from '../intl-format';

/**
 * A date's limits: its earliest and latest day (`min`, `max`), each a day
 * ("2026-03-02") or one counted from the day the form is opened ("today",
 * "today+30", "today-7"), and the days of the week it may fall on (`days`,
 * ISO numbers: 1 Monday … 7 Sunday). A date and time keeps them by the day
 * it falls on in its time zone — its own or its page's — else where the person is.
 */

/** The day a limit names, today being `today`: the day itself, or today with days added or taken away. */
export function dayOf(limit: string, today = localDay(new Date())): string {
  const counted = /^today([+-]\d+)?$/.exec(limit);
  if (!counted) return limit;
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + Number(counted[1] ?? 0))).toISOString().slice(0, 10);
}

/** A weekday in words, in the messages' language: "Friday", "الجمعة". */
const written = (options: Intl.DateTimeFormatOptions, messages: Messages, at: number) =>
  intlFormat('DateTimeFormat', messages.locale, { ...options, timeZone: 'UTC', numberingSystem: 'latn' }).format(at);

/** What a day breaks of its field's limits, or undefined: before its earliest, after its latest, on a day of the week it may not fall on. */
export function checkDay(field: Field | LineField, value: string, today: string | undefined, messages: Messages): string | undefined {
  if (field.type !== 'date' && field.type !== 'datetime') return undefined;
  // A date and time by the day it falls on in its zone (the page's, written into it), else where the person is.
  const day = field.type === 'date' ? value : dayIn(Date.parse(value), field.timeZone);
  const say = (key: 'before' | 'after' | 'weekday', limit: string) => fillMessage(messages, messages[key], { label: field.label, min: limit, max: limit, days: limit });
  // A month's or a year's limits by its month or its year: this month is within "today" as its first day is not.
  const precision = precisionOf(field);
  const cut = (one: string) => (precision === 'month' ? one.slice(0, 7) : precision === 'year' ? one.slice(0, 4) : one);
  // As the page's date boxes write a day — its order, its language — or a month or a year (`dayWords`).
  const words = (limit: string) => dayWords(limit, messages, undefined, precision);
  const min = field.min && dayOf(field.min, today);
  const max = field.max && dayOf(field.max, today);
  if (min && cut(day) < cut(min)) return say('before', words(min));
  if (max && cut(day) > cut(max)) return say('after', words(max));
  const days = field.days;
  // 1 January 2024 was a Monday: the day of the week n is the nth of that January.
  if (days && !days.includes(new Date(Date.parse(day)).getUTCDay() || 7)) {
    const not = [1, 2, 3, 4, 5, 6, 7].filter((n) => !days.includes(n)).map((n) => written({ weekday: 'long' }, messages, Date.UTC(2024, 0, n)));
    return say('weekday', not.length > 1 ? `${not.slice(0, -1).join(', ')} ${messages.or} ${not[not.length - 1]}` : not[0]);
  }
  return undefined;
}
