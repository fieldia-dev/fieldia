import type { LineField, ListCalendar, ListedRecord, Locale, Page, RecordId, Value, Values } from '@fieldia/core';
import { listComma } from '@fieldia/core';
import { displayValue } from '@fieldia/widgets';
import { addDays, addMinutes, daysBetween, format, fromWall, minutesOf, readWhen, startOfDay, writeWhen, zoneOfCalendar, type WhenKind } from './dates';

/** A record as a calendar draws it. */
export interface CalendarEvent {
  id: RecordId;
  /** The record as the list gave it: its values, its version, what may be done with it. */
  record: ListedRecord;
  title: string;
  /** When it starts, on the calendar's clock (dates.ts). */
  start: Date;
  /** The moment it ends, on that clock: past its last moment, so a day's event ends at the next midnight. */
  end: Date;
  /** Drawn with the days rather than the hours: a date, or a day and time across whole days. */
  allDay: boolean;
  /** Its person or room, as a key (a link's id, a choice's value), and in words. */
  resource: string | null;
  resourceLabel: string;
  /** What colours it: its colour field's value, as a key. */
  colour: string | null;
}

/** A link's id, or a value as it is, as a key. */
export function keyOf(value: Value | undefined): string | null {
  if (value === null || value === undefined || value === '' || value === false) return null;
  if (typeof value === 'object' && !Array.isArray(value) && 'id' in value) return String((value as { id: unknown }).id);
  return String(value);
}

/** The kind of moment a calendar's start keeps: a day, or a day and a time. */
export const kindOf = (page: Page, spec: ListCalendar): WhenKind => (page.fields[spec.start]?.type === 'date' ? 'date' : 'datetime');

/** Each record with a start as an event: an hour long with no end (or an end before its start), a whole day for a date. */
export function eventsOf(records: readonly ListedRecord[], spec: ListCalendar, page: Page, locale: Locale): CalendarEvent[] {
  const kind = kindOf(page, spec);
  const zone = zoneOfCalendar(page, spec);
  const say = (name: string | undefined, values: Values) => (name && page.fields[name] ? displayValue(page.fields[name] as LineField, values[name], values, locale) : '');
  const events: CalendarEvent[] = [];
  for (const record of records) {
    const values = record.values;
    const start = readWhen(values[spec.start], kind, zone);
    if (!start) continue;
    const given = spec.end ? readWhen(values[spec.end], kind, zone) : null;
    let end: Date;
    if (kind === 'date') end = addDays(given && given >= start ? given : start, 1);
    else end = given && given > start ? given : addMinutes(start, 60);
    const allDay = kind === 'date' || (minutesOf(start) === 0 && minutesOf(end) === 0 && daysBetween(start, end) >= 1);
    events.push({
      id: record.id,
      record,
      title: say(spec.title, values) || String(record.id),
      start,
      end,
      allDay,
      resource: spec.resource ? keyOf(values[spec.resource]) : null,
      resourceLabel: say(spec.resource, values),
      colour: spec.colour ? keyOf(values[spec.colour]) : null,
    });
  }
  return events.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}

/**
 * Eight colours that read on a light page and a dark one alike, each drawn as
 * a tint of the surface with a bar of its own: the same value, the same one.
 */
export const PALETTE = ['#2563eb', '#0d9488', '#c2410c', '#be185d', '#7c3aed', '#15803d', '#0e7490', '#a16207'];

/** A value's colour: one it names itself (#rrggbb), else one of the palette's, the same for the same value. */
export function colourOf(key: string | null): string | null {
  if (key === null) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(key)) return key;
  let hash = 0;
  for (const char of key) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Where an event sits among those it meets: its place, of how many, side by side. */
export interface Placed {
  column: number;
  columns: number;
}

/**
 * Events that meet, side by side: each crowd (events joined by meeting one
 * another) shares its width, each event in the first place free when it
 * starts; one that meets none takes the whole width.
 */
export function sideBySide(events: readonly Pick<CalendarEvent, 'id' | 'start' | 'end'>[]): Map<RecordId, Placed> {
  const placed = new Map<RecordId, Placed>();
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  let crowd: { id: RecordId; column: number }[] = [];
  let crowdEnds = 0;
  /** When each place in the crowd is free again. */
  let free: number[] = [];
  const close = () => {
    for (const { id, column } of crowd) placed.set(id, { column, columns: free.length });
    crowd = [];
    free = [];
  };
  for (const event of sorted) {
    const start = event.start.getTime();
    if (crowd.length && start >= crowdEnds) close();
    let column = free.findIndex((until) => until <= start);
    if (column === -1) column = free.push(0) - 1;
    free[column] = event.end.getTime();
    crowd.push({ id: event.id, column });
    crowdEnds = Math.max(crowd.length === 1 ? 0 : crowdEnds, event.end.getTime());
  }
  close();
  return placed;
}

/** A person or room to move to: its value as the field keeps it, and its key. */
export interface Resource {
  value: Value;
  key: string;
}

/**
 * The values a move writes: its start where it lands (its length kept — the time it really lasts, across a change of
 * the clocks too), or its end alone when stretched (`end`), and its person when it lands in another's column. Each
 * moment on the calendar's clock is written as the instant it is there.
 */
export function moved(event: CalendarEvent, start: Date, spec: ListCalendar, page: Page, resource?: Resource, end?: Date): Values {
  const kind = kindOf(page, spec);
  const zone = zoneOfCalendar(page, spec);
  const values: Values = {};
  if (end) {
    if (spec.end) values[spec.end] = writeWhen(kind === 'date' ? addDays(startOfDay(end), -1) : end, kind, zone);
    return values;
  }
  if (start.getTime() !== event.start.getTime()) {
    values[spec.start] = writeWhen(start, kind, zone);
    if (spec.end) {
      if (kind === 'date') values[spec.end] = writeWhen(addDays(start, daysBetween(event.start, event.end) - 1), kind, zone);
      else values[spec.end] = new Date(fromWall(start, zone) + lasts(event, spec, zone)).toISOString();
    }
  }
  if (resource && spec.resource && resource.key !== event.resource) values[spec.resource] = resource.value;
  return values;
}

/** How long a record lasts, in ms: from its own start to its own end as kept, else as the calendar draws it (an hour). */
function lasts(event: CalendarEvent, spec: ListCalendar, zone: string | undefined): number {
  const kept = (name?: string) => {
    const value = name ? event.record.values[name] : undefined;
    const at = typeof value === 'string' && value ? new Date(value).getTime() : NaN;
    return Number.isNaN(at) ? null : at;
  };
  const [from, to] = [kept(spec.start), kept(spec.end)];
  return from !== null && to !== null && to > from ? to - from : fromWall(event.end, zone) - fromWall(event.start, zone);
}

/** Where a move lands, in words: "Wed 14 Oct, 11:15", or the day alone for a whole day's; its year too, when it leaves the record's own. */
export function whereTo(event: Pick<CalendarEvent, 'allDay' | 'start'>, start: Date, locale: Locale): string {
  const day = format(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(start.getUTCFullYear() !== event.start.getUTCFullYear() ? { year: 'numeric' } : {}) }).format(start);
  return event.allDay ? day : `${day}${comma(locale)}${format(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(start)}`;
}

/** What joins the parts of a sentence as the language writes it: ", ", or in Arabic, Persian and Urdu the Arabic comma, "، ". */
export function comma(locale: Locale): string {
  return listComma(locale);
}
