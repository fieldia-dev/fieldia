import type { ListRequest, ListResult, Page, ResolvedFilter } from '@fieldia/core';
import { moneyReads } from '@fieldia/widgets';
import type { ViewerOptions } from './viewer';

/** A list's first page of records, asked for before the list's part has come: what was asked, and its answer. */
export interface EarlyList {
  request: ListRequest;
  answer: Promise<ListResult>;
}

/**
 * A list page's first page of records asked for at once, beside its part, not after it has come and run (the
 * performance audit's M2: a list's records waited for its code, +290 ms on 4G, +680 ms on 3G). Only where the page
 * alone says what the list asks first: its columns and what their amounts read, its order, its first page, the app's
 * own filter. The list takes the answer where its own first request is the same, and asks as ever where it is not — a
 * person's starred search, a card's lines, a row's rules read more — the early one let go. Never for a list a person
 * searched (View all's), nor one whose source keeps its views (it opens on the default one).
 */
export function earlyList(page: Page, options: Pick<ViewerOptions, 'dataSource' | 'listFilter' | 'listSearch'>): EarlyList | undefined {
  const node = page.layout;
  const source = options.dataSource;
  if (node.type !== 'list' || page.data.kind !== 'record' || !source?.list || source.views || options.listSearch) return undefined;
  if (node.card || node.gallery || node.parentField || node.defaultFilters?.length || node.rowTones?.length || node.rowBold !== undefined || node.rowButtons?.length || Object.values(node.cells ?? {}).some((cell) => cell.lead)) return undefined;
  const filter: ResolvedFilter[] = [...(options.listFilter ?? [])];
  const request: ListRequest = { model: page.data.model, fields: [...new Set(node.columns.flatMap((name) => [name, ...moneyReads(page.fields[name])]))], filter, sort: node.sort ?? [], offset: 0, limit: node.pageSize ?? 40 };
  const answer = source.list(request);
  // Taken by the list, or let go: a failure is the list's to say, when it takes it.
  answer.catch(() => undefined);
  return { request, answer };
}

