import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type * as LimitsModule from './limits-part';
import { instantsAt, wallOf, zoneOffset } from './zones';

/**
 * When a page takes answers, and each choice's places (`limits` on a page, `seats` on an option): worked out from the
 * page, the form's clock and the data source's last answer to `limits` (form-limits.ts, the limits part). The form
 * keeps it in its state (`FormState.limits`); a viewer shows a closed form's words in place of its questions, and each
 * choice's places.
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

/** Whether a page's `opens` or `closes` is written as a day alone: it opens at that day's first minute, closes at its end. */
export const dayAlone = (written: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(written);

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

/** The limits part's form code (form-limits.ts). */
export type FormLimitsPart = typeof LimitsModule;

/**
 * A form's limits — what it tells of them, its counts asked of the source, a full choice refused — loaded before a page
 * with `limits` or options with `seats` is drawn (`hasLimits`), and by a form whose app's list gave options with seats:
 * in the one-tag script, one script with the viewer's limits part (fieldia.limits.js).
 */
export const formLimitsPart: Part<FormLimitsPart> = lazyPart('limits', () => import('./limits-part'));

/** Whether a page has limits, or choices of its own with places: its form's limits come in the limits part. */
export const hasLimits = (page: Page): boolean => !!page.limits || seatedFields(page).length > 0;

/** Whether a page's limits ask the source for counts: its most responses, one from each person — a page of responses only. */
export function countsAsked(page: Page): boolean {
  const limits = page.data.kind === 'responses' ? page.limits : undefined;
  return !!limits && (limits.maxResponses !== undefined || limits.onePerPerson === true);
}
