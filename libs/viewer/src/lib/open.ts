import type { OpenRequest, OpenResult, Page, Values } from '@fieldia/core';
import { openFormDialog, openFormPanel, type FormDialogResult } from './dialog';
import { findPage, nameFieldOf } from './related';
import { mountViewer, type ViewerOptions } from './viewer';

/** What opening a page needs of the viewer that opens it. */
export interface Opener {
  options: ViewerOptions;
  /** The element the viewer is in: a page opened in its place goes there. */
  place: HTMLElement;
  /** The viewer's own form element, which steps aside meanwhile. */
  root: HTMLElement;
  /** The page's title as the viewer shows it: in its language, through the app's translator. */
  title(page: Page): string;
  /** "Back", in the page's language. */
  back: string;
  /** Why a page cannot be opened: the app has none by that id. */
  missing(page: string): string;
}

/** The first box to type or choose in, where a page opened takes the focus. */
const FIRST = 'input:not([type="hidden"]), select, textarea, [contenteditable="true"]';

/**
 * Open a page as a step asks, for the viewer's host: the app's own way first
 * (`onOpen`), else found through `pages` and opened in a dialog, a side panel
 * or this form's place — with the same data source, pages, words and look.
 * Resolves with how it ended; the saved record named by its page's title field.
 */
export async function openPage(opener: Opener, request: OpenRequest): Promise<OpenResult> {
  const { options } = opener;
  const theirs = options.onOpen?.(request);
  if (theirs) return theirs;
  const found = await findPage(options, request.version === undefined ? { id: request.page } : { id: request.page, version: request.version });
  if (!found) throw new Error(opener.missing(request.page));
  // It wears the look of the page that opened it, unless it has one of its own.
  const look = options.page.look;
  const shared: ViewerOptions = {
    ...options,
    page: look && !found.look ? { ...found, look } : found,
    form: undefined,
    recordId: request.recordId ?? null,
    values: request.values,
    // What belongs to the page that opened it alone.
    drafts: undefined,
    autosave: undefined,
    readonly: undefined,
    editSwitch: undefined,
    saveStatus: undefined,
  };
  const title = request.title ?? opener.title(found);
  const result =
    request.as === 'page' ? await inPlace(opener, shared)
    : request.as === 'panel' ? await openFormPanel({ ...shared, title })
    : await openFormDialog({ ...shared, title, size: found.layout.type === 'sheet' ? 'large' : 'medium' });
  const name = nameFieldOf(found);
  const label = name ? result.values[name] : undefined;
  return { ...result, ...(typeof label === 'string' && label ? { label } : {}) };
}

/**
 * A page in this form's place, with Back over it. Saved or sent — once its own
 * after-save steps have run — it gives way back to this form, as it was, and
 * the run goes on; Back, or a `close` step inside it, returns without.
 */
function inPlace(opener: Opener, options: ViewerOptions): Promise<FormDialogResult> {
  const { place, root } = opener;
  const doc = place.ownerDocument;
  const from = doc.activeElement as HTMLElement | null;
  return new Promise((resolve) => {
    let done = false;
    const end = (saved: boolean) => {
      if (done) return;
      done = true;
      const state = opened.form.getState();
      opened.destroy();
      root.hidden = false;
      if (from?.isConnected) from.focus();
      resolve({ saved, recordId: state.recordId ?? null, values: state.values as Values });
    };
    root.hidden = true;
    const opened = mountViewer(place, { ...options, host: { ...options.host, close: () => end(false) } });
    const back = doc.createElement('button');
    back.type = 'button';
    back.className = 'fd-button fd-button-link fd-back';
    back.textContent = opener.back;
    back.addEventListener('click', () => end(false));
    opened.element.prepend(back);
    const leave = () => void opened.form.settled().then(() => end(true));
    opened.on('save', leave);
    opened.on('send', leave);
    (opened.element.querySelector<HTMLElement>(FIRST) ?? back).focus();
  });
}
