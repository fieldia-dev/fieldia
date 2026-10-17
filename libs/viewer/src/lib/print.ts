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
  /**
   * Under it on paper, the page's footer words, when it has any: the record's content's last part, which the
   * stylesheet makes its footer group, under every sheet of it.
   */
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

/**
 * The form in front: the one in the dialog or panel opened last over the page, while one is open — what a person
 * printing looks at, and so what prints, alone; null with none open. A dialog with no form in it (a file shown) is
 * no record to print: the form under it is the one in front.
 */
function frontForm(doc: Document): Element | null {
  const open = [...doc.querySelectorAll('.fd-form-dialog[aria-modal="true"]')].filter((box) => !box.closest('[hidden]'));
  for (const box of open.reverse()) {
    const form = [...box.querySelectorAll('form.fd-form')].find((one) => one.closest('.fd-form-dialog') === box);
    if (form) return form;
  }
  return null;
}

/**
 * Keeping a heading with the start of what follows it on paper: the stylesheet keeps room under a tab's name, a
 * group's title and a table's header (`--fd-print-keep`), which goes with it to the next sheet where this one's foot
 * has less — Firefox keeps no heading with what follows it otherwise, `break-after: avoid` or not. As tall as that
 * start: groups side by side, which no engine breaks on paper, a field of many lines, or one short line. So a tab's
 * and a titled group's is measured as printing begins, from the heading's place to the end of the first thing after
 * it that a sheet does not break, the form laid out as paper lays it — a sheet's width, words for boxes, every tab
 * shown — for that moment; a table's is its header and first line, as the stylesheet keeps; where nothing was
 * measured, the stylesheet's own. At most KEEP_MOST: past that, what follows starts under the heading, as it may.
 */
const KEEP_MOST = 420;
/** What paper leaves out, passed over as the start of what follows a heading. */
const UNPRINTED = '.fd-button, .fd-actions, .fd-tabbar, .fd-help, .fd-print-head, .fd-print-end';

/** An element's style as its own window computes it. */
const styleOf = (element: Element): CSSStyleDeclaration => (element.ownerDocument.defaultView as Window).getComputedStyle(element);

/** The first part shown in `box`, past its title. */
function firstShown(box: Element): HTMLElement | null {
  for (const child of box.children) {
    if (!(child instanceof HTMLElement) || child.hidden || child.matches(`${UNPRINTED}, .fd-section-title, legend`)) continue;
    const style = styleOf(child);
    if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed') continue;
    return child;
  }
  return null;
}

/** Where the first thing in `box` that a sheet does not break ends, on the screen. */
function startEnd(box: Element): number {
  const first = firstShown(box);
  if (!first) return box.getBoundingClientRect().bottom;
  // A table of lines or records: its label, header and first line, as paper draws them (a grid's table for paper, shown
  // while measured); where no line is laid out, as much as they take.
  if (first.matches('.fd-field, .fd-related') && first.querySelector(TABLES)) {
    const line = [...first.querySelectorAll('tbody tr')].find((row) => row.getClientRects().length);
    const top = first.getBoundingClientRect().top;
    return Math.max(line?.getBoundingClientRect().bottom ?? 0, top + TABLE_START);
  }
  if (first.matches('.fd-grid')) {
    // Parts side by side: the first line of them, as tall as its tallest.
    if ((Number(styleOf(first).getPropertyValue('--fd-cols')) || 1) > 1) {
      const parts = [...first.children].filter((part) => part instanceof HTMLElement && !part.hidden && part.getClientRects().length);
      const top = parts[0]?.getBoundingClientRect().top ?? 0;
      return Math.max(...parts.filter((part) => part.getBoundingClientRect().top - top < 2).map((part) => part.getBoundingClientRect().bottom), first.getBoundingClientRect().top);
    }
    return startEnd(first);
  }
  // A group kept whole on paper is one thing a sheet does not break; any other, its own start.
  if (first.matches('.fd-section, .fd-sections, .fd-tabpanel')) return whole(first) ? first.getBoundingClientRect().bottom : startEnd(first);
  // Tabs: the first one's name over its own start.
  if (first.matches('.fd-tabs')) {
    const panel = first.querySelector(':scope > .fd-tabpanel');
    return panel ? startEnd(panel) + TAB_NAME : first.getBoundingClientRect().bottom;
  }
  return first.getBoundingClientRect().bottom;
}
/** A tab's name on paper, over its first part (styles-print.ts). */
const TAB_NAME = 37;

/** A titled group short enough to be one box on paper (keepRooms): all it holds, a quarter more, within KEEP_MOST. */
function whole(group: Element): boolean {
  if (!group.matches('fieldset.fd-section') || !group.querySelector(':scope > .fd-section-title')) return false;
  const { top, bottom } = group.getBoundingClientRect();
  return bottom > top && (bottom - top) * 1.25 + 8 <= KEEP_MOST;
}
/** A table a field draws (lines, a grid of lines, a list), and the least room its label, header and first line take on paper. */
const TABLES = 'table, .fd-grid-lines, .fd-lines, .fd-list';
const TABLE_START = 110;

/**
 * Each heading's room measured and given (`--fd-print-keep`): what its start takes with the form as wide as a sheet
 * (styles-print.ts), its columns and labels as paper lays them out, and a quarter more for what paper draws otherwise —
 * but never more than all it heads takes: a short tab goes on as far as it fits. A titled group no taller than
 * KEEP_MOST so is one box on paper, kept whole (`--fd-print-whole`): Firefox left a framed one's top edge at a sheet's
 * foot, its title on the next — and printed nothing in one it may not break, but the frame. The boxes given them, to
 * take them back once printed.
 */
function keepRooms(root: HTMLElement): HTMLElement[] {
  const given: HTMLElement[] = [];
  const keep = (box: HTMLElement, from: number) => {
    const end = startEnd(box);
    const start = end - from;
    // Not laid out on the screen (a part drawn only once shown): the stylesheet's own room.
    if (start < 1) return;
    // All it holds: to its end, or its start's where that is paper's (a table's) and the screen draws less.
    const all = Math.max(box.getBoundingClientRect().bottom, end) - from;
    const room = Math.ceil(Math.min(KEEP_MOST, start * 1.25 + 8, all + 8));
    box.style.setProperty('--fd-print-keep', `${room}px`);
    // A group that fits in that much: one box on paper, never broken, its frame never left at a sheet's foot.
    if (whole(box)) box.style.setProperty('--fd-print-whole', 'inline-block');
    given.push(box);
  };
  const own = (box: HTMLElement) => box.closest('.fd-form') === root;
  const panels = [...root.querySelectorAll<HTMLElement>('.fd-tabpanel:not([data-off])')].filter(own);
  const groups = [...root.querySelectorAll<HTMLElement>('fieldset.fd-section')].filter((group) => own(group) && group.querySelector(':scope > .fd-section-title'));
  // Nothing headed: nothing laid out again.
  if (!panels.length && !groups.length) return given;
  root.setAttribute('data-fd-measure', '');
  try {
    for (const panel of panels) keep(panel, panel.getBoundingClientRect().top + (Number.parseFloat(styleOf(panel).paddingTop) || 0));
    for (const group of groups) keep(group, group.getBoundingClientRect().top);
  } finally {
    root.removeAttribute('data-fd-measure');
  }
  return given;
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
  // The words in a box of their own, inside what repeats: a table's footer group draws no padding or rule of its own.
  const foot = footer ? el('div', { class: 'fd-print-end', 'aria-hidden': 'true' }, el('div', { class: 'fd-print-foot', dir: 'auto' }, ...footer.nodes)) : null;

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

  /** The boxes given room measured under their headings, to take it away once printed. */
  let kept: HTMLElement[] = [];
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
  /** This form printed alone as the one in front of the page (a dialog's), by the browser's own print. */
  let inFront = false;
  const ready = () => {
    if (printing) return;
    printing = true;
    root.setAttribute('data-fd-print', '');
    context.drawAll();
    fillIn();
    writeBoxes();
    kept = keepRooms(root);
    // With a dialog's form in front, it alone prints: never the page behind with the dialog over it. Unless a Print
    // of one part alone is on its way already.
    const page = doc.documentElement;
    if (!page.classList.contains('fd-print-one') && frontForm(doc) === root) {
      inFront = true;
      page.classList.add('fd-print-one');
      root.classList.add('fd-print-this');
    }
  };
  const done = () => {
    if (!printing) return;
    printing = false;
    for (const { box, words } of written) {
      words.remove();
      box.removeAttribute('data-print-box');
    }
    written.length = 0;
    for (const box of kept) {
      box.style.removeProperty('--fd-print-keep');
      box.style.removeProperty('--fd-print-whole');
    }
    kept = [];
    root.removeAttribute('data-fd-print');
    if (inFront) {
      inFront = false;
      doc.documentElement.classList.remove('fd-print-one');
      root.classList.remove('fd-print-this');
    }
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
