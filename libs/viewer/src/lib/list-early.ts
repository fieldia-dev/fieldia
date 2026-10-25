import type { ListRequest, ListResult, Page, ResolvedFilter } from '@fieldia/core';
import { moneyReads } from '@fieldia/widgets';
import type { ViewerOptions } from './viewer';

/** A list's first page of records, asked for before the list's part has come: what was asked, and its answer. */
export interface EarlyList {
  request: ListRequest;
  answer: Promise<ListResult>;
  /** Told to stop, as a list's own request is: its wait ended past its timeout, or the list asked for another. */
  stop(): void;
}

/**
 * A list page's first page of records asked for at once, beside its part, not after it has come and run (the
 * performance audit's M2: a list's records waited for its code, +290 ms on 4G, +680 ms on 3G). Only where the page
 * alone says what the list asks first: its order, its first page, the app's own filter, and every field it can show —
 * its columns and what their amounts read, what its cards and its cells' icons name. The list takes the answer where
 * its own first request is the same, those fields among these (`earlyFor`, list.ts), and asks as ever where it is not — a
 * person's starred search, a row's rules read more — the early one let go. Never for a list a person searched (View
 * all's), nor one whose source keeps its views (it opens on the default one), nor a tree (it asks for its top).
 */
export function earlyList(page: Page, options: Pick<ViewerOptions, 'dataSource' | 'listFilter' | 'listSearch'>): EarlyList | undefined {
  const node = page.layout;
  const source = options.dataSource;
  if (node.type !== 'list' || page.data.kind !== 'record' || !source?.list || source.views || options.listSearch) return undefined;
  if (node.parentField || node.defaultFilters?.length || node.rowTones?.length || node.rowBold !== undefined || node.rowButtons?.length) return undefined;
  // What its cards and its cells' icons name, read as words: every field named there, and more is no harm.
  const named = JSON.stringify([node.card ?? null, node.gallery ?? null, Object.values(node.cells ?? {}).map((cell) => cell.lead ?? null)]).match(/\w+/g) ?? [];
  const fields = [...new Set([...node.columns.flatMap((name) => [name, ...moneyReads(page.fields[name])]), ...named.filter((name) => Object.hasOwn(page.fields, name))])];
  const filter: ResolvedFilter[] = [...(options.listFilter ?? [])];
  const request: ListRequest = { model: page.data.model, fields, filter, sort: node.sort ?? [], offset: 0, limit: node.pageSize ?? 40 };
  // Its own signal, kept off what is compared (not enumerable), as the deadline's is (deadline.ts): the source's
  // deadline ends it as any list request, and the list's wait may tell it to stop.
  const stopper = new AbortController();
  const answer = source.list(Object.defineProperty({ ...request }, 'signal', { value: stopper.signal, enumerable: false, configurable: true }));
  // Taken by the list, or let go: a failure is the list's to say, when it takes it.
  answer.catch(() => undefined);
  return { request, answer, stop: () => stopper.abort() };
}


