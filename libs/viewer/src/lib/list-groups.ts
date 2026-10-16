import { addDays, fill, spanStart, DATE_INTERVALS, type DataSource, type DateInterval, type DayCount, type Group, type Locale, type Page, type RecordId, type RecordPermissions, type RecordVersion, type ResolvedFilter, type SortOrder, type Value } from '@fieldia/core';
import type { El } from './dom';
import { daysFilter, spanEnd } from './list-days';
import type { ViewerLabels } from './labels';

/** A record's row: its values, and the version it was listed at and what the person may do with it, where the source told. */
export type Row = { id: RecordId; values: Record<string, Value>; version?: RecordVersion; can?: RecordPermissions };

/** What a list is grouped by: a field, and for a date the span it is grouped in — the Group By facet's `field:interval`. */
export interface GroupKey {
  field: string;
  interval?: DateInterval;
}

/** A group as its heading shows it: its records' count, and its totals in words ("EGP 4.3M") where the list has them. */
export type Heading = Group & { sums?: string };

export interface GroupContext {
  page: Page;
  el: El;
  labels: ViewerLabels;
  locale: Locale;
  fill: (template: string, values: Record<string, string | number>) => string;
  dataSource: DataSource;
  model: string;
  fields: string[];
  columns: number;
  pageSize: number;
  /** How the list counts days: a week's first day, and the time zone a date and time's day is told in. */
  count: DayCount;
  sort: () => SortOrder[];
  /** The groups under `key` of the records `filter` keeps, each with its sums in words. */
  groups: (key: GroupKey, filter: ResolvedFilter[]) => Promise<Heading[]>;
  /** A record's row, at a depth under its groups. */
  recordRow: (record: Row, level: number) => HTMLTableRowElement;
  /** Rows came or went. */
  changed: () => void;
}

/** A Group By facet's field as a key: `date:month`, a date grouped by month; a field alone as it is. */
export function groupKey(page: Page, text: string): GroupKey {
  const [field, interval] = text.split(':');
  const type = page.fields[field]?.type;
  return (type === 'date' || type === 'datetime') && (DATE_INTERVALS as readonly string[]).includes(interval) ? { field, interval: interval as DateInterval } : { field: text };
}

/** Whether a group's value is the first day of a span, as a source that groups by `interval` gives it: else it grouped by the value itself. */
const startsSpan = (value: unknown, key: GroupKey, count: DayCount) =>
  !!key.interval && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && spanStart(value, key.interval, count) === value;

/** The ISO week a week is numbered by — the one holding most of its days, its middle's — and that week's year. */
function weekNumber(start: string): { week: number; year: number } {
  const day = new Date(`${addDays(start, 3)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear();
  return { week: Math.ceil(((day.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7), year };
}

/** A span in words, in the page's language and Latin digits: "14 October 2026", "Week 42, 2026", "October 2026", "Q4 2026", "2026". */
function spanWords(context: Pick<GroupContext, 'labels' | 'locale'>, start: string, interval: DateInterval): string {
  const [year, month] = start.split('-').map(Number);
  const write = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(context.locale === 'en' ? 'en-GB' : context.locale, { ...options, timeZone: 'UTC', numberingSystem: 'latn' }).format(Date.parse(`${start}T00:00:00Z`));
  switch (interval) {
    case 'day':
      return write({ day: 'numeric', month: 'long', year: 'numeric' });
    case 'week':
      return fill(context.labels.groupWeek, weekNumber(start));
    case 'month':
      return write({ month: 'long', year: 'numeric' });
    case 'quarter':
      return fill(context.labels.groupQuarter, { quarter: Math.floor((month - 1) / 3) + 1, year });
    case 'year':
      return String(year);
  }
}

/** A group's name as a person reads it: a span of time in words, the choice's label, yes or no, the linked record's name, or None. */
export function groupName(context: Pick<GroupContext, 'page' | 'labels' | 'locale' | 'count'>, key: GroupKey, group: Group): string {
  const def = context.page.fields[key.field];
  if (group.value === null) return context.labels.none;
  if (key.interval && startsSpan(group.value, key, context.count)) return spanWords(context, group.value as string, key.interval);
  if (def.type === 'selection') return def.options.find((o) => o.value === group.value)?.label ?? group.label;
  if (def.type === 'boolean') return group.value ? context.labels.yes : context.labels.no;
  return group.label || String(group.value);
}

/** The records of one group: those holding its value, those with none, or those whose date falls in its span. */
export function groupFilter(context: Pick<GroupContext, 'page' | 'count'>, key: GroupKey, group: Group): ResolvedFilter[] {
  const { field } = key;
  if (group.value === null) return [{ field, op: 'notset', value: null }];
  if (!key.interval || !startsSpan(group.value, key, context.count)) return [{ field, op: '=', value: group.value }];
  const def = context.page.fields[field];
  // A date and time's days in its own zone where it names one, else the list's.
  const zone = (def.type === 'datetime' && def.timeZone) || context.count.timeZone;
  return daysFilter(field, group.value as string, spanEnd(group.value as string, key.interval), def.type === 'datetime' ? 'datetime' : 'date', zone);
}

/** Take away every row under a group: its records, its groups and theirs. */
function closeUnder(tr: HTMLElement) {
  const level = Number(tr.dataset['level']);
  let next = tr.nextElementSibling as HTMLElement | null;
  while (next && Number(next.dataset['level'] ?? 0) > level) {
    const after = next.nextElementSibling as HTMLElement | null;
    next.remove();
    next = after;
  }
}

/**
 * A group's row: its name, how many records it holds and their sums. Opened,
 * it shows the next field's groups under it, or at the last field its
 * records, a page at a time; closed, everything under it goes.
 */
export function groupRow(context: GroupContext, group: Heading, level: number, within: ResolvedFilter[], grouping: GroupKey[]): HTMLTableRowElement {
  const { el, labels } = context;
  const key = grouping[level];
  const filter: ResolvedFilter[] = [...within, ...groupFilter(context, key, group)];
  const toggle = el(
    'button',
    { type: 'button', class: 'fd-group-toggle', 'aria-expanded': 'false' },
    el('span', { class: 'fd-group-label' }, groupName(context, key, group)),
    ' ',
    el('span', { class: 'fd-group-count' }, `(${group.count})`),
    ...(group.sums ? [' ', el('span', { class: 'fd-group-sums' }, group.sums)] : [])
  );
  const tr = el('tr', { class: 'fd-list-group', 'data-level': String(level), 'aria-level': String(level + 1) }, el('td', { colspan: String(context.columns) }, toggle));
  tr.style.setProperty('--fd-level', String(level));
  let opening = false;

  async function open() {
    opening = true;
    try {
      const rows =
        level + 1 < grouping.length
          ? (await context.groups(grouping[level + 1], filter)).map((inner) => groupRow(context, inner, level + 1, filter, grouping))
          : await recordsFrom(0);
      // Closed, or the list drawn again, while the answer was on its way.
      if (!tr.isConnected || toggle.getAttribute('aria-expanded') !== 'true') return;
      tr.after(...rows);
      context.changed();
    } finally {
      opening = false;
    }
  }

  /** A page of the group's records, from `offset`, and a row for the rest when there are more. */
  async function recordsFrom(offset: number): Promise<HTMLTableRowElement[]> {
    const answer = await context.dataSource.list!({ model: context.model, fields: context.fields, filter, sort: context.sort(), offset, limit: context.pageSize });
    const rows = answer.records.map((record) => context.recordRow(record, level + 1));
    const left = answer.total - offset - answer.records.length;
    if (left <= 0) return rows;
    const more = el('button', { type: 'button', class: 'fd-button fd-button-link' }, context.fill(labels.loadMore, { n: left }));
    const moreRow = el('tr', { class: 'fd-list-more', 'data-level': String(level + 1) }, el('td', { colspan: String(context.columns) }, more));
    moreRow.style.setProperty('--fd-level', String(level));
    more.addEventListener('click', async () => {
      more.disabled = true;
      const next = await recordsFrom(offset + answer.records.length);
      if (!moreRow.isConnected) return;
      moreRow.replaceWith(...next);
      context.changed();
    });
    return [...rows, moreRow];
  }

  toggle.addEventListener('click', () => {
    const opened = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!opened));
    if (opened) {
      closeUnder(tr);
      context.changed();
    } else if (!opening) void open();
  });
  return tr;
}
