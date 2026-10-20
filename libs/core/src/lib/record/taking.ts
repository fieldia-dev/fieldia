import type { Field, Option } from '../format/field';
import type { Page } from '../format/page';
import { dayAlone } from '../format/limits';
import type { LimitsResult } from './data-source';
import { fill, type Messages } from './messages';
import type { Value } from './values';
import { instantsAt, isOwnZone, wallOf, zoneOffset } from './zones';

/**
 * When a page takes answers, and each choice's places (`limits` on a page, `seats` on an option): worked out from the
 * page, the form's clock and the data source's last answer to `limits`. The form keeps it in its state
 * (`FormState.limits`); a viewer shows a closed form's words in place of its questions, and each choice's places.
 */

/**
 * Whether the page takes answers now: `open`; `soon`, before it opens; `closed`, after it closed; `full`, its most
 * responses taken; `sent`, this person's one response sent already; `asking`, its counts asked of the data source
 * and not told yet — nothing is typed meanwhile.
 */
export type TakingState = 'open' | 'soon' | 'closed' | 'full' | 'sent' | 'asking';

/** An option's places: how many it takes, how many took it, how many are left (never below 0). */
export interface Seats {
  readonly seats: number;
  readonly taken: number;
  readonly left: number;
}

/** What a form knows of its limits now (`FormState.limits`). */
export interface FormLimits {
  readonly state: TakingState;
  /** When it opens and closes, as instants (ISO, in UTC): a day alone closes at its end. */
  readonly opens?: string;
  readonly closes?: string;
  /** The page's own words for while it takes no answers (`limits.message`). */
  readonly message?: string;
  /** The responses it takes still, where its `maxResponses` and the source's count tell. */
  readonly left?: number;
  /**
   * Each choice field's places, by option value (as written: `String(value)`): those of its options with `seats`,
   * once the source told how many took them. A field the source told nothing of has none: nothing shows.
   */
  readonly seats: Readonly<Record<string, Readonly<Record<string, Seats>>>>;
}

const MINUTE = 60000;

/**
 * The instant a page's `opens` or `closes` names, in ms: an instant written with its offset as it is; a day and a time
 * on the page's clock (`zone`; the browser's without one); a day alone at its first minute — or, to close (`end`), at
 * the next day's first minute, so it takes answers through that day. A time the clocks skip is the first minute after
 * them. Null for words that name no day.
 */
export function limitInstant(written: string, zone: string | undefined, end = false): number | null {
  if (/T.*(Z|[+-]\d{2}:\d{2})$/i.test(written)) {
    const at = Date.parse(written);
    return Number.isFinite(at) ? at : null;
  }
  const wall = wallOf(written);
  if (!wall || wall.month < 1 || wall.month > 12 || wall.day < 1 || wall.day > 31) return null;
  if (end && dayAlone(written)) {
    const next = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + 1));
    Object.assign(wall, { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() });
  }
  const found = instantsAt(wall, zone);
  if (found.length) return found[0];
  // In the hour the clocks skip: the minute they skip to.
  const local = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return local - zoneOffset(local + 86400000, zone) * MINUTE;
}

/** The choice fields of a page whose own options have places (`seats`), by name, in the page's order. */
export function seatedFields(page: Page): string[] {
  return Object.entries(page.fields)
    .filter(([, field]) => field.type === 'selection' && (field.options ?? []).some((option) => option.seats !== undefined))
    .map(([name]) => name);
}

/** Whether a page's limits ask the source for counts: its most responses, one from each person — a page of responses only. */
export function countsAsked(page: Page): boolean {
  const limits = page.data.kind === 'responses' ? page.limits : undefined;
  return !!limits && (limits.maxResponses !== undefined || limits.onePerPerson === true);
}

/** What a form tells of its limits now: from the page, the clock, the options it shows and the source's last answer. */
export function limitsNow(
  page: Page,
  now: number,
  told: LimitsResult | null,
  asking: boolean,
  optionsOf: (field: string) => readonly Option[]
): FormLimits | null {
  const limits = page.data.kind === 'responses' ? page.limits : undefined;
  const seats: Record<string, Record<string, Seats>> = {};
  for (const [field, counted] of Object.entries(told?.perChoice ?? {})) {
    const places: Record<string, Seats> = {};
    for (const option of optionsOf(field)) {
      if (option.seats === undefined) continue;
      const taken = Math.max(0, Number(counted?.[String(option.value)] ?? 0) || 0);
      places[String(option.value)] = { seats: option.seats, taken, left: Math.max(0, option.seats - taken) };
    }
    if (Object.keys(places).length) seats[field] = places;
  }
  if (!limits && !Object.keys(seats).length) return null;
  const opens = limits?.opens ? limitInstant(limits.opens, page.timeZone) : null;
  const closes = limits?.closes ? limitInstant(limits.closes, page.timeZone, true) : null;
  const max = limits?.maxResponses;
  const responses = told?.responses;
  const left = max !== undefined && typeof responses === 'number' ? Math.max(0, max - responses) : undefined;
  const state: TakingState =
    opens !== null && now < opens ? 'soon'
    : closes !== null && now >= closes ? 'closed'
    : asking ? 'asking'
    : left === 0 ? 'full'
    : limits?.onePerPerson && (told?.mine ?? 0) >= 1 ? 'sent'
    : 'open';
  return {
    state,
    ...(opens !== null ? { opens: new Date(opens).toISOString() } : {}),
    ...(closes !== null ? { closes: new Date(closes).toISOString() } : {}),
    ...(limits?.message ? { message: limits.message } : {}),
    ...(left !== undefined ? { left } : {}),
    seats,
  };
}

/** The values a choice holds: one, several (a choice of many), or none. */
const chosenOf = (value: Value | undefined): unknown[] => (Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]);

/**
 * The options of a choice's value that are full now, in the order they are held: those `before` held too left out
 * when given — a choice made now, not one held already.
 */
export function fullChosen(field: Field | undefined, places: Readonly<Record<string, Seats>> | undefined, value: Value | undefined, before?: Value | undefined): Option[] {
  if (!places || field?.type !== 'selection') return [];
  const held = new Set(chosenOf(before).map(String));
  return chosenOf(value)
    .filter((one) => !(before !== undefined && held.has(String(one))) && places[String(one)]?.left === 0)
    .map((one) => (field.options ?? []).find((option) => String(option.value) === String(one)) ?? { value: String(one), label: String(one) });
}

/**
 * A day or a day and a time in words, in the messages' language, on the page's clock: "20 November 2026", "1 November
 * 2026 at 09:00" — with the zone's short name where it is not the browser's own ("09:00 GMT+2").
 */
export function whenWords(written: string, at: number, messages: Messages, zone?: string): string {
  if (dayAlone(written)) {
    const [y, m, d] = written.split('-').map(Number);
    return new Intl.DateTimeFormat(messages.locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC', numberingSystem: 'latn' }).format(Date.UTC(y, m - 1, d));
  }
  const elsewhere = !!zone && !isOwnZone(zone);
  return new Intl.DateTimeFormat(messages.locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    numberingSystem: 'latn',
    ...(zone ? { timeZone: zone } : {}),
    ...(elsewhere ? { timeZoneName: 'short' as const } : {}),
  }).format(at);
}

/**
 * Why a page takes no answers now, in the messages' words — "This form opens on 1 November 2026 at 09:00.", "This form
 * closed on 20 November 2026.", "This form has all the responses it takes.", "You have sent your answers to this form
 * already." — or null while it takes them (or still asks).
 */
export function takingWords(page: Page, limits: FormLimits | null | undefined, messages: Messages): string | null {
  const written = page.limits;
  switch (limits?.state) {
    case 'soon':
      return written?.opens && limits.opens ? fill(messages.formOpens, { when: whenWords(written.opens, Date.parse(limits.opens), messages, page.timeZone) }) : null;
    case 'closed':
      return written?.closes && limits.closes ? fill(messages.formClosed, { when: whenWords(written.closes, Date.parse(limits.closes), messages, page.timeZone) }) : null;
    case 'full':
      return messages.formFull;
    case 'sent':
      return messages.formSent;
    default:
      return null;
  }
}
