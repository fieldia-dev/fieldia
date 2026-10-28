import type { Page } from '@fieldia/core';
import { later } from './later';
import type { ViewerOptions } from './viewer';

/**
 * What a part asks the app's pages for: the page for a model, to show a
 * linked record in a dialog; or a saved page by its id — and the version it
 * keeps to, when it keeps to one — to draw a saved form placed in another.
 */
export type PageRequest = { model: string } | { id: string; version?: number };

/**
 * The app's pages: a record of them by key — a model, a page's id, or
 * `id@version` for a version kept to — or a function asked for each, which
 * may answer at once or with a promise.
 */
export type PageFinder = Record<string, Page> | ((request: PageRequest) => Page | null | undefined | Promise<Page | null | undefined>);

/**
 * The page the app gives for a request: from `pages`, and for a model from `relatedPages` after it. A promise when it
 * answers later, the app's handled as it is made; whoever asks handles a page that cannot come.
 */
export function findPage(options: Pick<ViewerOptions, 'pages' | 'relatedPages'>, request: PageRequest): Page | null | Promise<Page | null> {
  const { pages, relatedPages } = options;
  const key = 'model' in request ? request.model : request.version === undefined ? request.id : `${request.id}@${request.version}`;
  const found = typeof pages === 'function' ? pages(request) : pages && Object.prototype.hasOwnProperty.call(pages, key) ? pages[key] : null;
  if (later(found)) return found.then((page) => page ?? null) as Promise<Page | null>;
  if (found || !('model' in request)) return found ?? null;
  return (typeof relatedPages === 'function' ? relatedPages(request.model) : relatedPages?.[request.model]) ?? null;
}
