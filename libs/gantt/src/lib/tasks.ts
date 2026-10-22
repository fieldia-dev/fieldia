import type { LineField, ListGantt, ListedRecord, Locale, Page, RecordId, Value, Values } from '@fieldia/core';
import { displayValue } from '@fieldia/widgets';
import { addDays, DAY, daysFrom, readWhen, writeWhen, zoneOfGantt, type WhenKind } from './dates';

/** A record as a timeline draws it: a bar from its start to its end, in its group, waiting for others. */
export interface GanttTask {
  id: RecordId;
  /** The record as the list gave it: its values, its version, what may be done with it. */
  record: ListedRecord;
  title: string;
  /** When it starts, on the timeline's clock (dates.ts); null for one with no start yet. */
  start: Date | null;
  /** The moment it ends, on that clock: past its last moment, so a day's ends at the next midnight. */
  end: Date | null;
  /** One that ends as it starts (a duration of none): drawn as a point, never stretched. */
  milestone: boolean;
  /** Its group as a key (a link's id, a choice's value), and in words. */
  group: string | null;
  groupLabel: string;
  /** What colours it: its colour field's value, as a key. */
  colour: string | null;
  /** The records it waits for, by their ids as keys. */
  waitsFor: string[];
}

/** A link's id, or a value as it is, as a key. */
export function keyOf(value: Value | undefined): string | null {
  if (value === null || value === undefined || value === '' || value === false) return null;
  if (typeof value === 'object' && !Array.isArray(value) && 'id' in value) return String((value as { id: unknown }).id);
  return String(value);
}

/** The kind of moment a timeline's start keeps: a day, or a day and a time. */
export const kindOf = (page: Page, spec: ListGantt): WhenKind => (page.fields[spec.start]?.type === 'date' ? 'date' : 'datetime');

/** A number of days as a field holds it: a number, or words that read as one. Null for none. */
function daysIn(value: Value | undefined): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** So many days on, a part of a day as hours and minutes on the clock: 1.5 days from Monday 09:00 is Tuesday 21:00. */
const daysOn = (d: Date, n: number) => new Date(addDays(d, Math.floor(n)).getTime() + Math.round((n - Math.floor(n)) * DAY));

/**
 * Each record as a bar: from its start to its end (its last day's, for a date), or for as many days as its duration
 * says, or a day; one whose duration is none is a milestone; one with no start has a row and no bar.
 */
export function tasksOf(records: readonly ListedRecord[], spec: ListGantt, page: Page, locale: Locale): GanttTask[] {
  const kind = kindOf(page, spec);
  const zone = zoneOfGantt(page, spec);
  const say = (name: string | undefined, values: Values) => (name && page.fields[name] ? displayValue(page.fields[name] as LineField, values[name], values, locale) : '');
  return records.map((record) => {
    const values = record.values;
    const start = readWhen(values[spec.start], kind, zone);
    let end: Date | null = null;
    let milestone = false;
    if (start) {
      const given = spec.end ? readWhen(values[spec.end], kind, zone) : null;
      const days = spec.duration ? daysIn(values[spec.duration]) : null;
      if (given && given >= start) {
        end = kind === 'date' ? addDays(given, 1) : given;
        milestone = kind === 'datetime' && given.getTime() === start.getTime();
      } else if (days !== null && days <= 0) {
        end = start;
        milestone = true;
      } else if (days !== null) end = kind === 'date' ? addDays(start, Math.max(1, Math.ceil(days))) : daysOn(start, days);
      else end = addDays(start, 1);
    }
    const after = spec.dependsOn ? values[spec.dependsOn] : undefined;
    return {
      id: record.id,
      record,
      title: say(spec.title, values) || String(record.id),
      start,
      end,
      milestone,
      group: spec.group ? keyOf(values[spec.group]) : null,
      groupLabel: say(spec.group, values),
      colour: spec.colour ? keyOf(values[spec.colour]) : null,
      waitsFor: Array.isArray(after) ? after.map((one) => keyOf(one as Value)).filter((key): key is string => key !== null) : [],
    };
  });
}

/** Bars in their order: by start (those with none last), then by end, then by their words. */
export const inOrder = (a: GanttTask, b: GanttTask) =>
  (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity) || (a.end?.getTime() ?? Infinity) - (b.end?.getTime() ?? Infinity) || a.title.localeCompare(b.title);

/** A group of bars under its heading, with the span they take together. */
export interface GanttGroup {
  key: string;
  label: string;
  tasks: GanttTask[];
  start: Date | null;
  end: Date | null;
}

/**
 * The bars in their groups: a choice's in the order of its options (a project's phases), others by the first start
 * among them; the records with none last, under `none`. One group of them all, unnamed, where the timeline has no group.
 */
export function groupsOf(tasks: readonly GanttTask[], spec: ListGantt, page: Page, none: string): GanttGroup[] {
  const sorted = [...tasks].sort(inOrder);
  const span = (some: GanttTask[]) => {
    const planned = some.filter((t) => t.start && t.end);
    return planned.length
      ? { start: new Date(Math.min(...planned.map((t) => (t.start as Date).getTime()))), end: new Date(Math.max(...planned.map((t) => (t.end as Date).getTime()))) }
      : { start: null, end: null };
  };
  if (!spec.group) return [{ key: '', label: '', tasks: sorted, ...span(sorted) }];
  const groups = new Map<string, GanttGroup>();
  for (const task of sorted) {
    const key = task.group ?? '';
    const group = groups.get(key) ?? { key, label: task.group === null ? none : task.groupLabel || key, tasks: [], start: null, end: null };
    group.tasks.push(task);
    groups.set(key, group);
  }
  const field = page.fields[spec.group];
  const order = field?.type === 'selection' ? field.options.map((o) => String(o.value)) : null;
  const rank = (g: GanttGroup) => (g.key === '' ? Infinity : order ? order.indexOf(g.key) : (g.tasks[0]?.start?.getTime() ?? Infinity));
  return [...groups.values()].map((g) => ({ ...g, ...span(g.tasks) })).sort((a, b) => (a.key === '') !== (b.key === '') ? (a.key === '' ? 1 : -1) : rank(a) - rank(b) || a.label.localeCompare(b.label));
}

/** One record waiting for another: an arrow from the end of the one it waits for to its start; late where it starts before that one ends. */
export interface GanttLink {
  from: GanttTask;
  to: GanttTask;
  late: boolean;
}

/** Each record's waits, among those shown: a record waiting for itself, or for one not shown, draws no arrow. */
export function linksOf(tasks: readonly GanttTask[]): GanttLink[] {
  const byId = new Map(tasks.map((task) => [String(task.id), task]));
  const links: GanttLink[] = [];
  for (const to of tasks) {
    for (const key of new Set(to.waitsFor)) {
      const from = byId.get(key);
      if (!from || from === to) continue;
      links.push({ from, to, late: !!(from.end && to.start && from.end > to.start) });
    }
  }
  return links;
}

/** What a move takes hold of: the whole bar, its start alone, or its end alone. */
export type Edge = 'both' | 'start' | 'end';

/** Whether a bar's end can be moved: it has an end or a duration to write, and lasts. */
export const stretches = (task: GanttTask, spec: ListGantt) => !task.milestone && !!(spec.end || spec.duration);

/**
 * How far a bar may go, in whole days: as far as it likes moved whole; its start or its end, so long as it lasts part
 * of a day at least (its last day, for a date).
 */
export function clampBy(task: GanttTask, by: number, edge: Edge): number {
  if (edge === 'both' || !task.start || !task.end) return by;
  const room = Math.max(0, Math.ceil(daysFrom(task.start, task.end) - 1e-9) - 1);
  return edge === 'end' ? Math.max(by, -room) : Math.min(by, room);
}

/** Where a bar is after a move by whole days, the time of day kept: its start and its end. */
export function shifted(task: GanttTask, by: number, edge: Edge): { start: Date; end: Date } | null {
  if (!task.start || !task.end) return null;
  return { start: edge === 'end' ? task.start : addDays(task.start, by), end: edge === 'start' ? task.end : addDays(task.end, by) };
}

/**
 * The values a move by whole days writes, the time of day kept: its start, its end where the record has one (its last
 * day, for a date), or its duration where it lasts a number of days — and nothing where it goes nowhere.
 */
export function movedBy(task: GanttTask, by: number, edge: Edge, spec: ListGantt, page: Page): Values {
  const at = shifted(task, by, edge);
  if (!at || by === 0) return {};
  const kind = kindOf(page, spec);
  const zone = zoneOfGantt(page, spec);
  const values: Values = {};
  if (edge !== 'end') values[spec.start] = writeWhen(at.start, kind, zone);
  // Its end where it moves with the bar, or where the record had none and the bar's drawn end is now its own.
  const hasEnd = !!spec.end && readWhen(task.record.values[spec.end], kind, zone) !== null;
  if (spec.end && (edge === 'end' || (edge === 'start' ? !hasEnd : hasEnd))) values[spec.end] = kind === 'date' ? writeWhen(addDays(at.end, -1), 'date') : writeWhen(at.end, kind, zone);
  if (edge !== 'both' && spec.duration && !spec.end) {
    const days = daysIn(task.record.values[spec.duration]) ?? daysFrom(task.start as Date, task.end as Date);
    values[spec.duration] = days + (edge === 'end' ? by : -by);
  }
  return values;
}
