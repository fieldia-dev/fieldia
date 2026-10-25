import type { Page } from '@fieldia/core';

/**
 * A page the demos show, or how to fetch it. A page kept as JSON is a file of its own, fetched when a demo opens it —
 * as an app fetches a screen's page from its server, or its bundler leaves a route's to the route: the customers'
 * list never fetches the 500 fields of another demo's page, nor the real pages' invoices and legal cases.
 */
export type PageSource = Page | (() => Promise<Page>);

/** A JSON page fetched the first time it is asked for (`import()` of its file: a chunk of its own), then kept. */
export function pageFile(load: () => Promise<{ default: unknown }>): () => Promise<Page> {
  let fetched: Promise<Page> | undefined;
  return () =>
    (fetched ??= load().then(
      (module) => module.default as Page,
      (error: unknown) => {
        fetched = undefined;
        throw error;
      }
    ));
}

/** The page itself: at once where it is one, fetched where it is a file. */
export function pageOf(source: PageSource): Promise<Page>;
export function pageOf(source: PageSource | undefined): Promise<Page | undefined>;
export async function pageOf(source: PageSource | undefined): Promise<Page | undefined> {
  return typeof source === 'function' ? source() : source;
}

/** A page made from another once it has come: the work item's with its header quiet, say. */
export const pageFrom = (source: PageSource, make: (page: Page) => Page): (() => Promise<Page>) => () => pageOf(source).then(make);
