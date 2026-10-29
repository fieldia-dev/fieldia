import type { PageIssue } from '@fieldia/core';
import { installStyles, useStyleNonce, type ErrorHandler } from '@fieldia/widgets';
import { ownLocale, viewerWords, type ViewerLabels } from './labels';

/** The error a viewer refusing its page throws (and tells `onError`): each problem its check found, by its path. */
export type PageRefused = Error & { issues: PageIssue[] };

/** The most problems listed where the form would be: the rest are in the error, and in `validatePage`'s answer. */
const LISTED = 20;

/** Why a page cannot be shown, as the viewer throws it: each problem its check found, by its path. */
export function refusal(issues: readonly PageIssue[]): PageRefused {
  return Object.assign(new Error(`This page cannot be shown:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`), { issues: [...issues] });
}

/**
 * A page the viewer's checks refused (the audit's R-M6): said where the form would be — never a blank area — to whoever
 * opened it, a business's visitor, in plain words with a way on: the form is not available now, try again later or ask
 * whoever sent it (the 0.37 walk: a visitor read "validatePage" and a schema's words). What is wrong goes to whoever made
 * the page: the console, the app's `onError` and the error handed back for the viewer to throw (its `issues`) — and on
 * the page itself only where the app is being made (`development`), under "What is wrong". In the page's language where
 * Fieldia has its words, its look Fieldia's. `stage`: `"draw"` for what the check before the draw refuses (`checkPage`,
 * what 0.35's viewer refused), `"check"` for what only the whole check finds (`validatePage`'s verdict, run once the page
 * is drawn: from 0.37 the page taken down) — one way of saying both.
 */
export function showRefused(
  host: HTMLElement,
  options: { page?: unknown; locale?: string; labels?: Partial<ViewerLabels>; nonce?: string; onError?: ErrorHandler; development?: boolean },
  issues: readonly PageIssue[],
  stage: 'draw' | 'check' = 'draw'
): PageRefused {
  const error = refusal(issues);
  const doc = host.ownerDocument;
  useStyleNonce(doc, options.nonce);
  installStyles(doc);
  const language = (options.page as { language?: unknown } | null | undefined)?.language;
  const words = viewerWords(ownLocale(options.locale ?? (typeof language === 'string' ? language : undefined)), options.labels);
  const box = doc.createElement('div');
  box.className = 'fd-form fd-unshown';
  const said = doc.createElement('p');
  said.className = 'fd-form-part-note fd-form-part-problem';
  said.setAttribute('role', 'alert');
  said.textContent = words.formUnavailable;
  box.append(said);
  if (options.development) {
    const why = doc.createElement('details');
    why.className = 'fd-unshown-why';
    const summary = doc.createElement('summary');
    summary.textContent = words.pageUnshownWhy;
    const note = doc.createElement('p');
    note.textContent = words.pageUnshown;
    const list = doc.createElement('ul');
    for (const issue of issues.slice(0, LISTED)) {
      const item = doc.createElement('li');
      const path = doc.createElement('code');
      path.textContent = issue.path;
      item.append(path, ` ${issue.message}`);
      list.append(item);
    }
    if (issues.length > LISTED) {
      const more = doc.createElement('li');
      more.textContent = `… ${issues.length - LISTED}`;
      list.append(more);
    }
    why.append(summary, note, list);
    box.append(why);
  }
  host.append(box);
  console.error(`[Fieldia] ${error.message}`);
  try {
    options.onError?.(error, { stage, part: 'page' });
  } catch (thrown) {
    // The app's handler may not throw the page's words down either.
    console.error('[Fieldia] onError threw', thrown);
  }
  return error;
}
