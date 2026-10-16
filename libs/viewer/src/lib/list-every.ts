import type { DataSource, RecordId, ResolvedFilter, SortOrder } from '@fieldia/core';

/**
 * Every record a list's search matches, by id, in the list's order: for
 * "Select all 1,284 that match", and so for the list's buttons, Export and
 * Edit. Asked once with `allIds` (contract section 5). A source that ignores
 * it is paged through instead, its own page size kept, up to PAGE_THROUGH ids:
 * twenty asks of 500, which a person waits for; past it the list says how many
 * of how many it took, as it does when a source stops short itself, rather
 * than take one ask a page for every record.
 */
export const PAGE_THROUGH = 10000;
const PAGE = 500;

export interface EveryAsk {
  model: string;
  filter: ResolvedFilter[];
  sort: SortOrder[];
  /** A field the list shows, the one asked for while paging: never "every field", as an empty list is to some backends. */
  field: string;
  /** How many match, as the list last heard. */
  total: number;
}

/** The ids, and how many matched as the source answered: fewer ids than that means it stopped short, and the list says so. */
export async function everyId(source: DataSource, ask: EveryAsk): Promise<{ ids: RecordId[]; total: number }> {
  const list = source.list?.bind(source);
  if (!list) return { ids: [], total: ask.total };
  const request = { model: ask.model, fields: [ask.field], filter: ask.filter, sort: ask.sort };
  const first = await list({ ...request, offset: 0, limit: 0, allIds: true });
  if (first.allIds) return { ids: first.allIds, total: first.total };
  // A source that read a limit of 0 as no limit at all has given them every one.
  if (first.records.length && first.records.length >= first.total) return { ids: first.records.map((record) => record.id), total: first.total };
  const total = first.total || ask.total;
  const ids: RecordId[] = [];
  while (ids.length < Math.min(total, PAGE_THROUGH)) {
    const page = await list({ ...request, offset: ids.length, limit: Math.min(PAGE, PAGE_THROUGH - ids.length) });
    if (!page.records.length) break;
    ids.push(...page.records.slice(0, PAGE_THROUGH - ids.length).map((record) => record.id));
  }
  return { ids, total };
}
