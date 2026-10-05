import type { Field, LineField } from '../format/field';
import { localDay } from '../expression/functions';
import { fill, type Messages } from './messages';

/**
 * A date's limits: its earliest and latest day (`min`, `max`), each a day
 * ("2026-03-02") or one counted from the day the form is opened ("today",
 * "today+30", "today-7"), and the days of the week it may fall on (`days`,
 * ISO numbers: 1 Monday … 7 Sunday). A date and time keeps them by the day
 * it falls on, where the person is.
 */

/** The day a limit names, today being `today`: the day itself, or today with days added or taken away. */
export function dayOf(limit: string, today = localDay(new Date())): string {
  const counted = /^today([+-]\d+)?$/.exec(limit);
  if (!counted) return limit;
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + Number(counted[1] ?? 0))).toISOString().slice(0, 10);
}

/** A day in words, in the messages' language: "March 2, 2026", "2 مارس 2026". */
const written = (options: Intl.DateTimeFormatOptions, messages: Messages, at: number) =>
  new Intl.DateTimeFormat(messages.locale, { ...options, timeZone: 'UTC', numberingSystem: 'latn' }).format(at);

/** What a day breaks of its field's limits, or undefined: before its earliest, after its latest, on a day of the week it may not fall on. */
export function checkDay(field: Field | LineField, value: string, today: string | undefined, messages: Messages): string | undefined {
  if (field.type !== 'date' && field.type !== 'datetime') return undefined;
  const day = field.type === 'date' ? value : localDay(new Date(value));
  const say = (key: 'before' | 'after' | 'weekday', limit: string) => fill(messages[key], { label: field.label, min: limit, max: limit, days: limit });
  const words = (limit: string) => written({ day: 'numeric', month: 'long', year: 'numeric' }, messages, Date.parse(limit));
  const min = field.min && dayOf(field.min, today);
  const max = field.max && dayOf(field.max, today);
  if (min && day < min) return say('before', words(min));
  if (max && day > max) return say('after', words(max));
  const days = field.days;
  // 1 January 2024 was a Monday: the day of the week n is the nth of that January.
  if (days && !days.includes(new Date(Date.parse(day)).getUTCDay() || 7)) {
    const not = [1, 2, 3, 4, 5, 6, 7].filter((n) => !days.includes(n)).map((n) => written({ weekday: 'long' }, messages, Date.UTC(2024, 0, n)));
    return say('weekday', not.length > 1 ? `${not.slice(0, -1).join(', ')} ${messages.or} ${not[not.length - 1]}` : not[0]);
  }
  return undefined;
}
