import type { DataSource, Group, Page, RecordId, ResolvedFilter, SortOrder, Value } from '@fieldia/core';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

export type Row = { id: RecordId; values: Record<string, Value> };

export interface GroupContext {
  page: Page;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  dataSource: DataSource;
  model: string;
  fields: string[];
  columns: number;
  pageSize: number;
  sort: () => SortOrder[];
  /** A record's row, at a depth under its groups. */
  recordRow: (record: Row, level: number) => HTMLTableRowElement;
  /** Rows came or went. */
  changed: () => void;
}

/** A group's name as a person reads it: the choice's label, yes or no, the linked record's name, or None. */
function groupName(context: GroupContext, field: string, group: Group): string {
  const def = context.page.fields[field];
  if (group.value === null) return context.labels.none;
  if (def.type === 'selection') return def.options.find((o) => o.value === group.value)?.label ?? group.label;
  if (def.type === 'boolean') return group.value ? context.labels.yes : context.labels.no;
  return group.label || String(group.value);
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
 * A group's row: its name and how many records it holds. Opened, it shows
 * the next field's groups under it, or at the last field its records, a page
 * at a time; closed, everything under it goes.
 */
export function groupRow(context: GroupContext, group: Group, level: number, within: ResolvedFilter[], grouping: string[]): HTMLTableRowElement {
  const { el, labels } = context;
  const field = grouping[level];
  const filter: ResolvedFilter[] = [...within, group.value === null ? { field, op: 'notset', value: null } : { field, op: '=', value: group.value }];
  const toggle = el(
    'button',
    { type: 'button', class: 'fd-group-toggle', 'aria-expanded': 'false' },
    el('span', { class: 'fd-group-label' }, groupName(context, field, group)),
    ' ',
    el('span', { class: 'fd-group-count' }, `(${group.count})`)
  );
  const tr = el('tr', { class: 'fd-list-group', 'data-level': String(level), 'aria-level': String(level + 1) }, el('td', { colspan: String(context.columns) }, toggle));
  tr.style.setProperty('--fd-level', String(level));
  let opening = false;

  async function open() {
    opening = true;
    try {
      const rows =
        level + 1 < grouping.length
          ? (await context.dataSource.groups?.({ model: context.model, field: grouping[level + 1], filter }))?.map((inner) => groupRow(context, inner, level + 1, filter, grouping)) ?? []
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
