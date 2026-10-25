import { PICTURE_URL, safeUrl, type Locale, type Page, type Values } from '@fieldia/core';
import { lazyPart, type Part } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';
import type * as PrintModule from './print-part';
import { printWords } from './value-words';

/**
 * A page on paper, whatever prints it — Ctrl+P, a `print` step, the gear menu's built-in Print, a list's Print, the
 * browser's own menu — every tab one after another under its name, every step and folded part open, buttons, bars and
 * hints left out, each box as its words, light colours with the accent kept for headings, nothing cut across two
 * sheets: the print part's (print-look.ts and its sheet, print-styles.ts), loaded as a person shows they mean to print
 * (0.26: until then it was in the main script, for every page).
 *
 * - **Ctrl+P** (⌘P) is Fieldia's: the page laid out whole, then the browser's print asked — at once, in the press, once
 *   the part is in; before it came, held back while it comes.
 * - **Every Print** — the gear's built-in, a `print` step, `viewer.print()`, a list's Print — waits for it.
 * - It is **fetched, not run**, as soon as a person shows they may print: the gear opened with Print in it, a pointer
 *   resting on a Print button (or the keyboard reaching it); and once a page meant for paper is drawn — its own `print`
 *   words, a list's Print — when the browser has nothing else to do.
 * - **The browser's menu** (File › Print) before it came prints a plain look of the page as it is on the screen, by
 *   the main sheet's rules (styles-print.ts in @fieldia/widgets): buttons, bars and hints left out, light colours — and
 *   asks for the part, so the next print is whole.
 *
 * What the main script makes itself, as a form is drawn: the printout's head and footer — hidden on the screen —
 * for the part to fill, each line of the page's words as its record reads.
 */

export interface PrintContext {
  doc: Document;
  el: El;
  /** The form: what is printed, and what its rules for paper are scoped to. */
  root: HTMLElement;
  page: Page;
  labels: ViewerLabels;
  locale: Locale;
  fill: (template: string, values: Record<string, string | number>) => string;
  now: () => Date;
  /** The record's own name (its title field's words); empty where it has none yet. */
  name(): string;
  values(): Readonly<Values>;
  /** Every part drawn and brought up to date for paper: each tab not opened yet. */
  drawAll(): void;
}

/** A printout's own words, a line each (value-words.ts). */
type PrintWords = ReturnType<typeof printWords>;

/** What the main script makes of a form's printout as it is drawn, for the print part to fill. */
export interface PrintParts {
  /** Over the page on paper: the app's logo and words, the record's title and the day. Not shown on screen. */
  head: HTMLElement;
  title: HTMLElement;
  when: HTMLElement;
  header: PrintWords | null;
  footer: PrintWords | null;
  /**
   * Under it on paper, the page's footer words, when it has any: the record's content's last part, which the
   * stylesheet makes its footer group, under every sheet of it.
   */
  foot: HTMLElement | null;
}

/** A form's look on paper, the print part's: laid out as printing begins, back as it ends. */
export interface PrintLook {
  root: HTMLElement;
  ready(): void;
  done(): void;
  /** The browser's print of this form alone (the page round it left out): settled once printing is done. */
  print(): Promise<void>;
  destroy(): void;
}

/** A form's printout, as the viewer draws it. */
export interface Paper {
  head: HTMLElement;
  foot: HTMLElement | null;
  /** The browser's print of this form alone, the print part waited for: settled once printing is done. */
  print(): Promise<void>;
  destroy(): void;
}

/** The print part: a page on paper whole. */
export type PrintPart = typeof PrintModule;

/** Every form drawn, its look made as the part comes. */
const forms = new Set<{ context: PrintContext; parts: PrintParts; look?: PrintLook }>();
/** The print part, once it came. */
let came: PrintPart | undefined;
/** A print the browser began before the part came (its menu's): the plain look's to its end, the part's looks after. */
let plain = false;

/**
 * Each form drawn given its look on paper, and the part's sheet — unless a print the browser began before the part
 * came is under way, which keeps the plain look it began with to its end; `now` for a print asked now.
 */
function giveLooks(now = false): void {
  if (now) plain = false;
  if (!came || plain) return;
  for (const form of forms) form.look ??= came.printLook(form.context, form.parts);
}

/**
 * A page on paper whole — each form's look and its sheet — loaded as a person shows they mean to print: as it comes,
 * every form drawn has its look, as every form drawn after has at once.
 */
export const printPart: Part<PrintPart> = lazyPart('print', () =>
  import('./print-part').then((part) => {
    came = part;
    giveLooks();
    return part;
  })
);

/** The print part, in for a print: null where it could not come (offline), and the plain look prints. */
export function loadPrint(): Promise<PrintPart | null> {
  return printPart.load().then(
    (part) => part,
    () => null
  );
}

/** The print part fetched for a print to come, and nothing printed. */
export function prefetchPrint(): void {
  void loadPrint();
}

/** The print part fetched once the browser has nothing else to do: for a page meant for paper, drawn. */
export function printSoon(doc: Document): void {
  const win = doc.defaultView as (Window & { requestIdleCallback?: (run: () => void, options: { timeout: number }) => number }) | null;
  if (!win || came) return;
  if (win.requestIdleCallback) win.requestIdleCallback(prefetchPrint, { timeout: 3000 });
  else win.setTimeout(prefetchPrint, 1000);
}

/** A Print button: the part fetched as a pointer rests on it a moment, or the keyboard reaches it. */
export function printIntent(button: HTMLElement): void {
  const win = button.ownerDocument.defaultView;
  let rest = 0;
  button.addEventListener('pointerenter', () => (rest = win?.setTimeout(prefetchPrint, 120) ?? 0));
  button.addEventListener('pointerleave', () => win?.clearTimeout(rest));
  button.addEventListener('focus', prefetchPrint);
}

/** Ctrl+P's key in any keyboard's layout: its letter, or where the layout writes none of Latin's, the key that has it. */
const printKey = (event: KeyboardEvent) => (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (/^p$/i.test(event.key) || (!/^[a-z]$/i.test(event.key) && event.code === 'KeyP'));

/** The documents whose printing is watched; those whose Ctrl+P waits for the part. */
const watched = new WeakSet<Document>();
const waiting = new WeakSet<Document>();

/**
 * A document's own ways to print, watched once a form is drawn in it. Ctrl+P — unless the app's own keys took it — is
 * Fieldia's: the page laid out whole, then the browser's print asked; at once, in the press, once the part is in (an
 * engine that says nothing as it prints prints it whole so too), else once it came. The browser's print before it
 * came (its menu) prints the plain look and asks for the part, so the next is whole.
 */
function watchPrinting(doc: Document): void {
  const win = doc.defaultView;
  if (!win || watched.has(doc)) return;
  watched.add(doc);
  const looks = () => [...forms].flatMap((form) => (form.look && form.context.doc === doc && form.context.root.isConnected ? [form.look] : []));
  win.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || !printKey(event) || ![...forms].some((form) => form.context.doc === doc && form.context.root.isConnected)) return;
    event.preventDefault();
    const print = (part: PrintPart) => (giveLooks(true), part.printPage(doc, looks()));
    if (came) return print(came);
    if (waiting.has(doc)) return;
    waiting.add(doc);
    void loadPrint().then((part) => {
      waiting.delete(doc);
      if (part) print(part);
      else win.print();
    });
  });
  // The browser's own print before the part came: the plain look to its end; the part asked for, the next print whole.
  win.addEventListener('beforeprint', () => {
    if (came) return;
    plain = true;
    prefetchPrint();
  });
  win.addEventListener('afterprint', () => {
    if (!plain) return;
    plain = false;
    giveLooks();
  });
}

/**
 * A form's printout: its head over the page and its footer under it on paper, hidden on the screen — made now, each
 * line of the page's words as the record reads now (a line whose value is empty left out) — and its look on paper
 * as the print part comes, or at once where it came already.
 */
export function paperFor(context: PrintContext): Paper {
  const { doc, el, page } = context;
  const own = page.print ?? {};
  // The page's words over and under the printout, with each {field} showing its value: a line whose value is empty left out.
  const header = own.header ? printWords(doc, page.fields, own.header, context.locale) : null;
  const footer = own.footer ? printWords(doc, page.fields, own.footer, context.locale) : null;
  const title = el('div', { class: 'fd-print-title' });
  const when = el('div', { class: 'fd-print-when' });
  // The logo is asked for with the page, so it is there to print however soon printing starts.
  const head = el(
    'div',
    { class: 'fd-print-head', 'aria-hidden': 'true' },
    ...(own.logo ? [el('img', { class: 'fd-print-logo', src: safeUrl(own.logo, PICTURE_URL), alt: '' })] : []),
    ...(header ? [el('div', { class: 'fd-print-words', dir: 'auto' }, ...header.nodes)] : []),
    el('div', { class: 'fd-print-what' }, title, when)
  );
  // The words in a box of their own, inside what repeats: a table's footer group draws no padding or rule of its own.
  const foot = footer ? el('div', { class: 'fd-print-end', 'aria-hidden': 'true' }, el('div', { class: 'fd-print-foot', dir: 'auto' }, ...footer.nodes)) : null;
  const values = context.values();
  header?.update(values);
  footer?.update(values);
  const form: { context: PrintContext; parts: PrintParts; look?: PrintLook } = { context, parts: { head, title, when, header, footer, foot } };
  forms.add(form);
  watchPrinting(doc);
  if (came) giveLooks();
  // A page meant for paper — its own words over and under its printout: the part fetched once it is drawn, so even the
  // browser's own menu prints it whole.
  else if (page.print) printSoon(doc);
  return {
    head,
    foot,
    // At once once the part is in — in the press that asked, as a browser may want a print asked — else once it came.
    print: () =>
      form.look
        ? form.look.print()
        : loadPrint().then((part) => {
            giveLooks(true);
            if (form.look) return form.look.print();
            // The part could not come (offline): the plain look, as the browser prints the page. Gone meanwhile: nothing.
            if (!part && forms.has(form)) doc.defaultView?.print();
            return undefined;
          }),
    destroy() {
      forms.delete(form);
      form.look?.destroy();
      form.look = undefined;
    },
  };
}
