/**
 * Time zones, by their IANA names ("Africa/Cairo", "Europe/Berlin"): a page's
 * `timeZone`, or a date and time field's own. A date and time is kept as an
 * instant (written in UTC, 2026-10-15T12:30:00.000Z, as Fieldia always kept
 * one; an instant written with its offset is read the same) and shown, typed
 * and counted by its day in its zone — the browser's own where none is named.
 * Made from Intl alone, so no zone's rules are carried in the code.
 *
 * On a day the clocks change, a time on the clock may not exist (the hour they
 * skip) or exist twice (the hour they repeat): `instantsAt` gives none, or
 * both, and what reads a typed time says so — it is never moved in silence.
 */
import { intlFormat } from '../intl-format';

/** A day and a time on the clock in some zone, to the minute. */
export interface WallTime {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const MINUTE = 60000;
const clocks = new Map<string, Intl.DateTimeFormat>();
/** The clock of a zone, read in parts: Intl's, the Gregorian calendar, 24 hours, Latin digits. */
function clockOf(zone: string): Intl.DateTimeFormat {
  let clock = clocks.get(zone);
  if (!clock) {
    clock = intlFormat('DateTimeFormat', 'en-US', { timeZone: zone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    clocks.set(zone, clock);
  }
  return clock;
}

/** Whether a name is a time zone the browser knows, by its IANA name: "Africa/Cairo", "UTC". Never an offset. */
export function isTimeZone(name: unknown): name is string {
  if (typeof name !== 'string' || !/^[A-Za-z][\w+-]*(\/[\w+-]+)*$/.test(name)) return false;
  try {
    clockOf(name);
    return true;
  } catch {
    return false;
  }
}

/** The browser's own time zone, by its IANA name. */
export function ownZone(): string {
  return intlFormat('DateTimeFormat').resolvedOptions().timeZone;
}

const own = new Map<string, boolean>();
/**
 * Whether a zone keeps the browser's own clock: the same time through the year, in winter and summer — the browser's
 * zone by any of its names ("Asia/Calcutta", "Asia/Kolkata"), or a neighbour on the same clock. Asked once a zone.
 */
export function isOwnZone(zone: string): boolean {
  let same = own.get(zone);
  if (same === undefined) {
    const year = new Date().getFullYear();
    same = [0, 3, 6, 9].every((month) => zoneOffset(Date.UTC(year, month, 15), zone) === zoneOffset(Date.UTC(year, month, 15)));
    own.set(zone, same);
  }
  return same;
}

/** The clock in `zone` at an instant (in ms), to the minute: the browser's own clock without one. */
export function wallTime(at: number, zone?: string): WallTime {
  if (!zone) {
    const d = new Date(at);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() };
  }
  const read: Record<string, number> = {};
  for (const part of clockOf(zone).formatToParts(at)) read[part.type] = Number(part.value);
  return { year: read['year'], month: read['month'], day: read['day'], hour: read['hour'] % 24, minute: read['minute'] };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
/** A day as a date field keeps it: 2026-10-15. */
export const wallDay = (wall: WallTime): string => `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`;
/** A clock's time: 14:30. */
export const wallClock = (wall: WallTime): string => `${pad(wall.hour)}:${pad(wall.minute)}`;
/** A wall time as the date readers write one: 2026-10-15T14:30. */
export const wallText = (wall: WallTime): string => `${wallDay(wall)}T${wallClock(wall)}`;
/** A wall time read back from yyyy-mm-dd and, after a T, HH:MM (midnight without). */
export function wallOf(text: string): WallTime | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(text);
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: Number(m[4] ?? 0), minute: Number(m[5] ?? 0) } : null;
}

/** A wall time as if it were UTC, in ms: what the zone's offset is added to. */
const asUtc = (wall: WallTime) => Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
/** The minute an instant falls in. */
const floorMinute = (at: number) => Math.floor(at / MINUTE) * MINUTE;

/** Minutes the zone's clock is ahead of UTC at an instant: 180 in Cairo's summer, -240 in New York's. */
export function zoneOffset(at: number, zone?: string): number {
  return Math.round((asUtc(wallTime(at, zone)) - floorMinute(at)) / MINUTE);
}

/**
 * The instants a time on the clock is in a zone, earliest first: one; none in the hour the clocks skip as they go
 * forward; two in the hour they repeat as they go back. The browser's own zone without one.
 */
export function instantsAt(wall: WallTime, zone?: string): number[] {
  const local = asUtc(wall);
  const found = new Set<number>();
  // The zone's offsets a day either side: what the clock is ahead by before a change near it and after.
  for (const probe of [local - 86400000, local, local + 86400000]) {
    const at = local - zoneOffset(probe, zone) * MINUTE;
    if (asUtc(wallTime(at, zone)) === local) found.add(at);
  }
  return [...found].sort((a, b) => a - b);
}

/** The day an instant falls on in a zone, 2026-10-15: the browser's own without one. */
export function dayIn(at: number | Date, zone?: string): string {
  return wallDay(wallTime(typeof at === 'number' ? at : at.getTime(), zone));
}

/**
 * The clocks' change that skips a time on the clock, which `instantsAt` found none of: the time they went forward
 * from and the time they went to (02:00 → 03:00), or null where nothing was skipped.
 */
export function clocksSkip(wall: WallTime, zone?: string): { from: WallTime; to: WallTime } | null {
  const local = asUtc(wall);
  const before = zoneOffset(local - 86400000, zone);
  const after = zoneOffset(local + 86400000, zone);
  if (after <= before || instantsAt(wall, zone).length) return null;
  // The change is between the instant the time would be at the later offset and at the earlier: its first minute.
  let low = local - after * MINUTE;
  let high = local - before * MINUTE;
  while (high - low > MINUTE) {
    const middle = floorMinute((low + high) / 2);
    if (zoneOffset(middle, zone) === after) high = middle;
    else low = middle;
  }
  // Its first minute at the later offset: the clock read it at the earlier one just before, and reads it at the later.
  return { from: utcWall(high + before * MINUTE), to: utcWall(high + after * MINUTE) };
}

/** A number of ms read as a UTC clock's parts: the inverse of asUtc. */
function utcWall(ms: number): WallTime {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}
