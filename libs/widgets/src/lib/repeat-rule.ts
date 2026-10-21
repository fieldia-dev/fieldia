import type { Locale } from '@fieldia/core';
import { restingText } from './date-text';
import type { WidgetLabels } from './labels';

/**
 * A repeat rule as iCalendar writes it (RFC 5545's RRULE, the value a repeat field keeps): how often — every day, every
 * week on chosen days, every month on a day or on the first Monday, every year — every how many, and until a day or for
 * a number of times. `FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=6` is "Every 2 weeks on Tuesday and Thursday, 6 times".
 */
export interface RepeatRule {
  freq: RepeatFrequency;
  /** Every how many days, weeks, months or years: 1 and up. */
  interval: number;
  /** A week's days (BYDAY): MO … SU. */
  days?: Weekday[];
  /** A month's day (BYMONTHDAY): 1 to 31, or -1 for its last. */
  monthDay?: number;
  /** A month's nth weekday (BYDAY=1MO, -1FR): which (1 to 4, or -1 for the last) and the day. */
  nth?: { n: number; day: Weekday };
  /** For this many times (COUNT). */
  count?: number;
  /** Until this day, included (UNTIL), as 2026-12-31. */
  until?: string;
}

export type RepeatFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
const FREQUENCIES: readonly RepeatFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

/** What a rule's text says that this box cannot write again: why, in its own words, for the field to keep it as it is. */
export class RuleBeyond extends Error {}

/**
 * A rule's text read: null where it is empty; `RuleBeyond` thrown where it says what this box does not edit (BYHOUR, a
 * month's several days…), so the field keeps it as it is and says so.
 */
export function readRule(text: string | null | undefined): RepeatRule | null {
  const written = (text ?? '').trim().replace(/^RRULE:/i, '');
  if (!written) return null;
  const parts = new Map<string, string>();
  for (const part of written.split(';')) {
    const [key, value] = part.split('=');
    if (!key || value === undefined) throw new RuleBeyond(part);
    parts.set(key.toUpperCase(), value.toUpperCase());
  }
  const freq = parts.get('FREQ') as RepeatFrequency | undefined;
  if (!freq || !FREQUENCIES.includes(freq)) throw new RuleBeyond(`FREQ=${parts.get('FREQ') ?? ''}`);
  const rule: RepeatRule = { freq, interval: 1 };
  for (const [key, value] of parts) {
    if (key === 'FREQ' || key === 'WKST') continue;
    if (key === 'INTERVAL' && /^[1-9]\d*$/.test(value)) rule.interval = Number(value);
    else if (key === 'COUNT' && /^[1-9]\d*$/.test(value)) rule.count = Number(value);
    else if (key === 'UNTIL' && /^\d{8}(T\d{6}Z?)?$/.test(value)) rule.until = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    else if (key === 'BYMONTHDAY' && freq === 'MONTHLY' && /^(-1|[1-9]|[12]\d|3[01])$/.test(value)) rule.monthDay = Number(value);
    else if (key === 'BYDAY' && freq === 'WEEKLY' && value.split(',').every((day) => (WEEKDAYS as readonly string[]).includes(day))) rule.days = WEEKDAYS.filter((day) => value.split(',').includes(day));
    else if (key === 'BYDAY' && freq === 'MONTHLY' && /^(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)$/.test(value)) rule.nth = { n: Number(value.slice(0, -2)), day: value.slice(-2) as Weekday };
    else throw new RuleBeyond(`${key}=${value}`);
  }
  if (rule.count !== undefined && rule.until !== undefined) throw new RuleBeyond('COUNT and UNTIL');
  if (rule.monthDay !== undefined && rule.nth) throw new RuleBeyond('BYMONTHDAY and BYDAY');
  return rule;
}

/** A rule written as its field keeps it: FREQ first, then INTERVAL past 1, the days, and the end. */
export function writeRule(rule: RepeatRule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === 'WEEKLY' && rule.days?.length) parts.push(`BYDAY=${WEEKDAYS.filter((day) => rule.days?.includes(day)).join(',')}`);
  if (rule.freq === 'MONTHLY' && rule.nth) parts.push(`BYDAY=${rule.nth.n}${rule.nth.day}`);
  else if (rule.freq === 'MONTHLY' && rule.monthDay !== undefined) parts.push(`BYMONTHDAY=${rule.monthDay}`);
  if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
  else if (rule.until) parts.push(`UNTIL=${rule.until.replace(/-/g, '')}`);
  return parts.join(';');
}

/** A weekday as the person's language names it: long ("Monday"), or short ("Mon") for a day's button. */
export function weekdayName(day: Weekday, locale: Locale, width: 'long' | 'short' = 'long'): string {
  // 1 January 2024 was a Monday.
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + WEEKDAYS.indexOf(day)));
}

/** The weekday of a day, as 2026-11-03. */
export function weekdayOf(day: string): Weekday {
  return WEEKDAYS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7];
}

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** A month's day as its language writes it in a sentence: "15th" (its ordinal ending, by the language's own rules), "15.", "1er". */
function monthDayWord(n: number, locale: Locale, labels: WidgetLabels): string {
  const endings = labels.repeatOrdinals.split(' ').map((ending) => (ending === '-' ? '' : ending));
  const kind = new Intl.PluralRules(locale, { type: 'ordinal' }).select(n);
  const ending = { one: endings[0], two: endings[1], few: endings[2] }[kind as 'one' | 'two' | 'few'] ?? endings[3] ?? '';
  return `${new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).format(n)}${ending}`;
}

/** Every how often, in words: "Every week", "Every 2 weeks". */
function everyWords(rule: RepeatRule, locale: Locale, labels: WidgetLabels): string {
  const at = FREQUENCIES.indexOf(rule.freq);
  if (rule.interval === 1) return labels.repeatKinds.split('|')[at] ?? '';
  return fill(labels.repeatSaidEveryN, { n: new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).format(rule.interval), units: labels.repeatUnitsMany.split('|')[at] ?? '' });
}

/**
 * A rule in words, as people say it: "Every 2 weeks on Tuesday and Thursday, 6 times", "Every month on the 15th, until
 * 31 Dec 2026", "Every month on the last Friday". Its end day as a date box shows one at rest.
 */
export function ruleWords(rule: RepeatRule, locale: Locale, labels: WidgetLabels): string {
  const every = everyWords(rule, locale, labels);
  const list = (items: string[]) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(items);
  let said = every;
  if (rule.freq === 'WEEKLY' && rule.days?.length) said = fill(labels.repeatSaidDays, { every, days: list(rule.days.map((day) => weekdayName(day, locale))) });
  else if (rule.freq === 'MONTHLY' && rule.nth) said = fill(labels.repeatSaidNth, { every, nth: labels.repeatNth.split('|')[rule.nth.n === -1 ? 4 : rule.nth.n - 1] ?? '', day: weekdayName(rule.nth.day, locale) });
  else if (rule.freq === 'MONTHLY' && rule.monthDay === -1) said = fill(labels.repeatSaidLastDay, { every });
  else if (rule.freq === 'MONTHLY' && rule.monthDay !== undefined) said = fill(labels.repeatSaidMonthDay, { every, day: monthDayWord(rule.monthDay, locale, labels) });
  if (rule.count === 1) return fill(labels.repeatSaidOnce, { rule: said });
  if (rule.count !== undefined) return fill(labels.repeatSaidTimes, { rule: said, n: new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).format(rule.count) });
  if (rule.until) return fill(labels.repeatSaidUntil, { rule: said, date: restingText(rule.until, 'date', locale) });
  return said;
}

/** A repeat field's value in words, for a list's cell or a value at rest: "Does not repeat" for none; a rule it cannot read, as it is written. */
export function repeatWords(value: unknown, locale: Locale, labels: WidgetLabels): string {
  try {
    const rule = readRule(typeof value === 'string' ? value : '');
    return rule ? ruleWords(rule, locale, labels) : '';
  } catch {
    return String(value);
  }
}
