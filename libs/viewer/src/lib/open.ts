import { LINK_URL, safeUrl, type OpenRequest, type OpenResult, type Page, type PostedMessage, type SayUndo, type Tone, type Values } from '@fieldia/core';
import type { FormDialogResult } from './dialog';
import { FIRST_FIELD, focusField } from './focus-field';
import { openFormDialog, openFormPanel, type Mount } from './dialog-box';
import { stayed } from './discard';
import type { Breadcrumb } from './record-bar';
import { findPage } from './find-page';
import { nameFieldOf } from './name-field';
import type { ViewerOptions } from './viewer';

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
  /** Words said as this viewer says them: a page opened over it says its own here, so they show over it and outlive it. */
  say(message: string, tone: Tone, undo?: SayUndo): void;
  /** Words posted in this record's conversation: a page opened over it posts its own here. */
  post(message: PostedMessage): Promise<boolean>;
  /** This record's name, for the crumb a page opened in its place goes back by. */
  name(): string;
  /** This record's one check (`form.leave()`): the app's own breadcrumbs inside a page opened in its place leave this record too. */
  leave(): Promise<boolean>;
  /** Whether that check lets this record go at once (`form.leaveNow()`). */
  leaveNow(): boolean;
  /** Aborts as the viewer is taken away (`destroy()`): what it opened — a dialog, a panel, a page in its place — goes too. */
  signal?: AbortSignal;
  /** What draws the page opened: the viewer's `mountViewer` (a part never imports the viewer's module: dialog-box.ts). */
  mount: Mount;
}

/**
 * Open a page as a step asks, for the viewer's host: the app's own way first
 * (`onOpen`), else found through `pages` and opened in a dialog, a side panel
 * (from the side the step names) or this form's place — with the same data
 * source, pages, words and look.
 * Resolves with how it ended; the saved record named by its page's title field. The acts part's: no page draws from it.
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
    // A search the person sees as chips and may take away (View all's), or else conditions kept whatever is searched.
    ...(request.search ? { listSearch: request.search, listFilter: undefined } : { listFilter: request.filter, listSearch: undefined }),
    // What belongs to the page that opened it alone.
    drafts: undefined,
    autosave: undefined,
    readonly: undefined,
    editSwitch: undefined,
    saveStatus: undefined,
    // The pager and the trail are this record's: a dialog has neither, and a page in its place a trail of its own.
    records: undefined,
    breadcrumbs: undefined,
  };
  const title = request.title ?? opener.title(found);
  // Over this form, its words are this form's: a page in its place has this form's place, and its own. Either posts in this record's conversation.
  const over: ViewerOptions = { ...shared, host: { ...options.host, say: opener.say, post: opener.post } };
  const result =
    request.as === 'page' ? await inPlace(opener, { ...shared, host: { ...options.host, post: opener.post } })
    : request.as === 'panel' ? await openFormPanel({ ...over, title, side: request.side, signal: opener.signal }, opener.mount)
    : await openFormDialog({ ...over, title, size: found.layout.type === 'sheet' ? 'large' : 'medium', signal: opener.signal }, opener.mount);
  const name = nameFieldOf(found);
  const label = name ? result.values[name] : undefined;
  return { ...result, ...(typeof label === 'string' && label ? { label } : {}) };
}

/**
 * A page in this form's place, with the way back over it: where the app
 * gives this record breadcrumbs, the trail with this record last; else, or
 * where its page draws none (a list), Back. Saved or sent — once its own
 * after-save steps have run — it gives way back to this form, as it was, and
 * the run goes on; the way back, or a `close` step inside it, returns without.
 * Each way back goes through its form's one check (`form.leave()`): the
 * person's work at risk is asked about first, and kept, the page staying, on
 * Cancel. Once a save or a send in it went through, it returns saved, however
 * it was left.
 */
function inPlace(opener: Opener, options: ViewerOptions): Promise<FormDialogResult> {
  const { place, root } = opener;
  const doc = place.ownerDocument;
  const from = doc.activeElement as HTMLElement | null;
  return new Promise((resolve) => {
    let done = false;
    /** Once a save or a send in it went through: returned saved, whichever way it is left. */
    let savedAny = false;
    const end = (saved: boolean) => {
      if (done) return;
      done = true;
      opener.signal?.removeEventListener('abort', gone);
      const state = opened.form.getState();
      opened.destroy();
      root.hidden = false;
      if (from?.isConnected) from.focus();
      resolve({ saved: saved || savedAny, recordId: state.recordId ?? null, values: state.values as Values });
    };
    // Its form's one check first: it waits for a save on its way and files on theirs, then asks about what is at risk —
    // every change not saved, going back, as a dialog's Escape asks: nothing else saves what was typed in it.
    const endChecked = async (saved: boolean) => {
      if (done) return;
      const how = saved ? undefined : { changes: true };
      // Nothing to wait for and nothing at risk: back at once, as it always was.
      if (opened.form.leaveNow(how)) return end(saved);
      if ((await opened.form.leave(how)) && !done) end(saved);
    };
    /** The saves made in it, and as many as there were when the person last chose to stay: a save they were asked about does not ask again as it settles. */
    let saves = 0;
    let stayedAt = -1;
    root.hidden = true;
    // Where the app keeps a trail, this record joins it as the way back. The app's own crumbs leave this record too: each
    // goes through its check as well, once this page's own let go (the bar over it asks that first).
    const trail = opener.options.breadcrumbs ? [...opener.options.breadcrumbs.map((crumb) => throughOpener(opener, crumb, doc)), { label: opener.name(), open: () => void endChecked(false) }] : undefined;
    // Its form takes this close once, its one check before it: a `close` step returns once nothing is at risk, or let go.
    const opened = opener.mount(place, { ...options, breadcrumbs: trail, host: { ...options.host, close: () => end(false) } });
    // The viewer under it taken away: this page goes with it.
    const gone = () => end(false);
    opener.signal?.addEventListener('abort', gone, { once: true });
    opened.on('run', ({ result }) => {
      if (stayed(result)) stayedAt = saves;
    });
    const back = doc.createElement('button');
    back.type = 'button';
    back.className = 'fd-button fd-button-link fd-back';
    back.textContent = opener.back;
    back.addEventListener('click', () => void endChecked(false));
    if (!opened.element.querySelector('.fd-breadcrumbs')) opened.element.prepend(back);
    const leave = () => {
      savedAny = true;
      const at = ++saves;
      void opened.form.settled().then(() => {
        if (stayedAt < at) void endChecked(true);
      });
    };
    opened.on('save', leave);
    opened.on('send', leave);
    (focusField(opened.element) ?? opened.element.querySelector<HTMLElement>(FIRST_FIELD) ?? back).focus();
  });
}

/**
 * One of the app's breadcrumbs, inside a page opened in a record's place: it leaves that record as well, so it goes
 * through the record's one check too, once the page's own let go. An address goes as it would have; another tab or a
 * click with a key held leaves both pages as they are.
 */
function throughOpener(opener: Opener, crumb: Breadcrumb, doc: Document): Breadcrumb {
  const go = () => {
    if (crumb.open) crumb.open();
    else if (safeUrl(crumb.href, LINK_URL)) doc.defaultView?.location.assign(safeUrl(crumb.href, LINK_URL) as string);
  };
  return { ...crumb, open: () => (opener.leaveNow() ? go() : void opener.leave().then((yes) => yes && go())) };
}
