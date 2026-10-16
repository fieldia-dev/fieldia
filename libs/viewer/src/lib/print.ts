import type { Locale, Page, Values } from '@fieldia/core';
import { restingText } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';
import { valueWords } from './value-words';

/**
 * A page on paper, whatever prints it — the browser's Ctrl+P or its menu, a
 * `print` step, the gear menu's built-in Print — as the stylesheet's `@media
 * print` rules lay it out (styles-print.ts in @fieldia/widgets): every tab one
 * after another under its name, every step and folded part open, buttons, bars
 * and hints left out, light colours with the accent kept for headings, nothing
 * cut across two sheets.
 *
 * What a stylesheet cannot do is done as printing begins (the window's
 * `beforeprint`, which every engine fires before it lays the page out for
 * paper, and undone at `afterprint`): each tab not opened yet drawn; each box
 * written as words beside it — what a person reads in it, a choice by its
 * label, a long name or note wrapping rather than cut at the box's edge — for
 * the paper alone; and over the page the app's logo and words (the page's
 * `print`), the record's title and the day it was printed, on the page's
 * clock, in its language. An engine that told nothing (a print the stylesheet
 * alone lays out) still prints every part drawn, without the words of a tab
 * never opened.
 */

/** The boxes a person reads words in: text of every kind, a number typed, a long text, a choice. */
const BOXES = 'input:not([type]), input:is([type="text"], [type="search"], [type="email"], [type="tel"], [type="url"], [type="number"]), textarea, select';

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
  /** The record's name, as its crumb says it; empty for a new one. */
  name(): string;
  values(): Readonly<Values>;
  /** Every part drawn and brought up to date for paper: each tab not opened yet. */
  drawAll(): void;
}

export interface PrintLook {
  /** Over the page on paper: the app's logo and words, the record's title and the day. Not shown on screen. */
  head: HTMLElement;
  /** Under it on paper: the page's footer words, when it has any. */
  foot: HTMLElement | null;
  /** The browser's print of this form alone (the page round it left out): settled once printing is done. */
  print(): Promise<void>;
  destroy(): void;
}

/**
 * The browser's print of `target` alone: what is round it in the app's page left out on paper (the class
 * `fd-print-one` on the document, `fd-print-this` on it; styles-print.ts). Settled once printing is done — the window's
 * `afterprint`, or at once where the engine printed without telling (no `beforeprint`) — `ended` told first.
 */
export function printAlone(doc: Document, target: HTMLElement, ended: () => void): Promise<void> {
  const win = doc.defaultView;
  return new Promise((resolve) => {
    let over = false;
    let told = false;
    const heard = () => (told = true);
    const finish = () => {
      if (over) return;
      over = true;
      win?.removeEventListener('afterprint', finish);
      doc.documentElement.classList.remove('fd-print-one');
      target.classList.remove('fd-print-this');
      ended();
      resolve();
    };
    if (!win) return finish();
    doc.documentElement.classList.add('fd-print-one');
    target.classList.add('fd-print-this');
    win.addEventListener('beforeprint', heard);
    win.addEventListener('afterprint', finish);
    try {
      win.print();
    } finally {
      win.removeEventListener('beforeprint', heard);
      // Printed without a word (the browser told no one); done already where print() waited for the browser's dialog.
      if (!told) finish();
    }
  });
}

/** A box's words as a person reads them: its text, or a choice's label — none for a choice left empty. */
function boxWords(box: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  if (box.tagName !== 'SELECT') return box.value;
  return [...(box as HTMLSelectElement).selectedOptions].filter((option) => option.value !== '').map((option) => option.textContent ?? '').join(', ');
}

export function printLook(context: PrintContext): PrintLook {
  const { doc, el, root, page, labels } = context;
  const win = doc.defaultView;
  const own = page.print ?? {};
  // The page's words over and under the printout, with each {field} showing its value.
  const header = own.header ? valueWords(doc, page.fields, own.header, context.locale) : null;
  const footer = own.footer ? valueWords(doc, page.fields, own.footer, context.locale) : null;
  const title = el('div', { class: 'fd-print-title' });
  const when = el('div', { class: 'fd-print-when' });
  // The logo is asked for with the page, so it is there to print however soon printing starts.
  const head = el(
    'div',
    { class: 'fd-print-head', 'aria-hidden': 'true' },
    ...(own.logo ? [el('img', { class: 'fd-print-logo', src: own.logo, alt: '' })] : []),
    ...(header ? [el('div', { class: 'fd-print-words', dir: 'auto' }, ...header.nodes)] : []),
    el('div', { class: 'fd-print-what' }, title, when)
  );
  const foot = footer ? el('div', { class: 'fd-print-foot', 'aria-hidden': 'true', dir: 'auto' }, ...footer.nodes) : null;

  /** The record's title and the day, as they are now. */
  function fillIn() {
    const values = context.values();
    header?.update(values);
    footer?.update(values);
    // A record's page and its name, once each; a page of responses has its title over it already.
    const names = page.data.kind === 'record' ? [page.title ?? '', context.name()].filter((name, at, all) => name && all.indexOf(name) === at) : [];
    title.textContent = names.join(' · ');
    when.textContent = context.fill(labels.printedOn, { date: restingText(context.now().toISOString(), 'datetime', context.locale, page.timeZone) });
  }

  /** The words written beside each box for paper, to take away once printed. */
  const written: { box: Element; words: HTMLElement }[] = [];
  function writeBoxes() {
    for (const box of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(BOXES)) {
      // A form inside this one (a dialog's) prints its own.
      if (box.closest('.fd-form') !== root) continue;
      const style = win?.getComputedStyle(box);
      const words = el('span', { class: 'fd-print-box', dir: 'auto' }, boxWords(box));
      // Where the box keeps its words — a number at its end, a title large, a section's line bold — its words keep them.
      if (style) words.style.cssText = `text-align:${style.textAlign};font-size:${style.fontSize};font-weight:${style.fontWeight};font-style:${style.fontStyle}`;
      box.setAttribute('data-print-box', '');
      box.after(words);
      written.push({ box, words });
    }
  }

  let printing = false;
  const ready = () => {
    if (printing) return;
    printing = true;
    root.setAttribute('data-fd-print', '');
    context.drawAll();
    fillIn();
    writeBoxes();
  };
  const done = () => {
    if (!printing) return;
    printing = false;
    for (const { box, words } of written) {
      words.remove();
      box.removeAttribute('data-print-box');
    }
    written.length = 0;
    root.removeAttribute('data-fd-print');
  };
  win?.addEventListener('beforeprint', ready);
  win?.addEventListener('afterprint', done);
  // An engine with no beforeprint says it prints by the media it lays the page out for.
  const media = win && !('onbeforeprint' in (win as object)) ? (win as Window).matchMedia?.('print') : undefined;
  const onMedia = (event: { matches: boolean }) => (event.matches ? ready() : done());
  media?.addEventListener?.('change', onMedia);
  fillIn();

  return {
    head,
    foot,
    print() {
      // Already printing (a second press while the browser's dialog is open): that print is this one.
      if (!win || printing) return Promise.resolve();
      // Ready before the browser is asked: an engine that says nothing as it prints prints it so all the same.
      ready();
      return printAlone(doc, root, done);
    },
    destroy() {
      done();
      win?.removeEventListener('beforeprint', ready);
      win?.removeEventListener('afterprint', done);
      media?.removeEventListener?.('change', onMedia);
    },
  };
}
