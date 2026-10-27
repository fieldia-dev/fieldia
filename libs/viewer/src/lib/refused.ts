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
 * A page the viewer's checks refused (the audit's R-M6): why, in words, where the form would be — never a blank area —
 * its problems listed under "What is wrong" for whoever made the page, the app's `onError` told, and the error handed
 * back for the viewer to throw. The words are in the page's language where Fieldia has its words, its look Fieldia's.
 * `stage`: `"draw"` for what the check before the draw refuses (`checkPage`, what 0.35's viewer refused), `"check"`
 * for what only the whole check finds (`validatePage`'s verdict, refused before the draw from 0.37).
 */
export function showRefused(
  host: HTMLElement,
  options: { page?: unknown; locale?: string; labels?: Partial<ViewerLabels>; nonce?: string; onError?: ErrorHandler },
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
  said.textContent = words.pageUnshown;
  const why = doc.createElement('details');
  why.className = 'fd-unshown-why';
  const summary = doc.createElement('summary');
  summary.textContent = words.pageUnshownWhy;
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
  why.append(summary, list);
  box.append(said, why);
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
