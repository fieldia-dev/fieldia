import type { OpenRequest, OpenResult, Page, PostedMessage, Tone, Values } from '@fieldia/core';
import { FIRST_FIELD, focusField, openFormDialog, openFormPanel, type FormDialogResult } from './dialog';
import { askDiscard, keptWork, lastSent, workLeft, type DiscardWords } from './discard';
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
  /** "Discard your changes?", Cancel and Discard, in the page's language: asked before a page in this form's place drops work of the person's. */
  discardWords: DiscardWords;
  /** Why a page cannot be opened: the app has none by that id. */
  missing(page: string): string;
  /** Words said as this viewer says them: a page opened over it says its own here, so they show over it and outlive it. */
  say(message: string, tone: Tone): void;
  /** Words posted in this record's conversation: a page opened over it posts its own here. */
  post(message: PostedMessage): Promise<boolean>;
  /** This record's name, for the crumb a page opened in its place goes back by. */
  name(): string;
}

/**
 * Open a page as a step asks, for the viewer's host: the app's own way first
 * (`onOpen`), else found through `pages` and opened in a dialog, a side panel
 * (from the side the step names) or this form's place — with the same data
 * source, pages, words and look.
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
    listFilter: request.filter,
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
    : request.as === 'panel' ? await openFormPanel({ ...over, title, side: request.side })
    : await openFormDialog({ ...over, title, size: found.layout.type === 'sheet' ? 'large' : 'medium' });
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
 * Either way, work of the person's that would go with it is asked about first
 * ("Discard your changes?"), and kept, the page staying, on Cancel: after a
 * save, whatever is still unsaved (a change made while it saved); on the way
 * back, what Reload set aside and files on their way, a change not saved
 * going with it as it always has.
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
    /**
     * One question at a time: another way out while it is asked is the same question. `afterSave`: what is unsaved
     * counts whole, as after a save (a change made while it ran); else only what Reload set aside, files on their way.
     */
    let asking = false;
    const endAsking = (saved: boolean, afterSave = saved) => {
      if (done || asking) return;
      if (!(afterSave ? workLeft(opened.form, sent.values()) : keptWork(opened.form.getState()))) return end(saved);
      asking = true;
      void askDiscard(opened.element, opener.discardWords, () => (asking = false)).then((discarding) => (discarding ? end(saved) : (stayedAt = saves)));
    };
    /**
     * The saves made in it, how many there were as the last run of steps ended (a run that saved, then closed), and
     * as the person last chose to stay: a save they were asked about once does not ask again as it settles.
     */
    let saves = 0;
    let savesBefore = 0;
    let stayedAt = -1;
    root.hidden = true;
    // Where the app keeps a trail, this record joins it as the way back.
    const trail = opener.options.breadcrumbs ? [...opener.options.breadcrumbs, { label: opener.name(), open: () => endAsking(false) }] : undefined;
    // A `close` step returns without, as it always has; after a save in the same run, a change made while it ran is asked about.
    const opened = mountViewer(place, { ...options, breadcrumbs: trail, host: { ...options.host, close: () => endAsking(false, saves > savesBefore) } });
    const sent = lastSent(opened.form);
    opened.on('save', () => saves++);
    opened.on('send', () => saves++);
    opened.on('run', ({ id: run }) => {
      if (!run.startsWith('on.')) savesBefore = saves;
    });
    const back = doc.createElement('button');
    back.type = 'button';
    back.className = 'fd-button fd-button-link fd-back';
    back.textContent = opener.back;
    back.addEventListener('click', () => endAsking(false));
    if (!opened.element.querySelector('.fd-breadcrumbs')) opened.element.prepend(back);
    const leave = () => {
      const at = saves;
      void opened.form.settled().then(() => {
        if (stayedAt < at) endAsking(true);
      });
    };
    opened.on('save', leave);
    opened.on('send', leave);
    (focusField(opened.element) ?? opened.element.querySelector<HTMLElement>(FIRST_FIELD) ?? back).focus();
  });
}
