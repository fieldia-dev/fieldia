import { plainWords, recordSentence } from '@fieldia/core';
import { restingText } from '@fieldia/widgets';
import type { PrintContext, PrintLook, PrintParts } from './print';
import { installPrintStyles } from './print-styles';
import { named, valueWords } from './value-words';

/**
 * A page on paper whole, the print part's (print.ts says when it comes): what a stylesheet cannot do, done as printing
 * begins (the window's `beforeprint`, which every engine fires before it lays the page out for paper, and undone at
 * `afterprint`) — each tab not opened yet drawn; each box written as words beside it — what a person reads in it, a
 * choice by its label, a long name or note wrapping rather than cut at the box's edge — for the paper alone; the room
 * each heading keeps under it measured; and over the page the app's logo and words (the page's `print`), the
 * record's title and the day it was printed, on the page's clock, in its language — with its sheet (print-styles.ts),
 * which lays the page out for paper. The printout's head and footer are the main script's, made as the form is drawn
 * (print.ts): this fills them. An engine that told nothing (a print the stylesheet alone lays out) still prints every
 * part drawn, without the words of a tab never opened.
 */

/** The boxes a person reads words in: text of every kind, a number typed, a long text, a choice. */
const BOXES = 'input:not([type]), input:is([type="text"], [type="search"], [type="email"], [type="tel"], [type="url"], [type="number"]), textarea, select';

/**
 * The browser's print of `target` alone: what is round it in the app's page left out on paper (the class
 * `fd-print-one` on the document, `fd-print-this` on it; print-styles.ts). Settled once printing is done — the window's
 * `afterprint`, or at once where the engine printed without telling (no `beforeprint`) — `ended` told first.
 */
export function printAlone(doc: Document, target: HTMLElement, ended: () => void): Promise<void> {
  const win = doc.defaultView;
  installPrintStyles(doc);
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
const UNPRINTED = '.fd-button, .fd-actions, .fd-tabbar, .fd-help, .fd-print-head, .fd-print-end, [data-print="off"]';

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
/** A tab's name on paper, over its first part (print-styles.ts). */
const TAB_NAME = 37;

/**
 * A titled group short enough to be one box on paper (keepRooms): all it holds, a quarter more, within WHOLE_MOST —
 * half the room of a Letter sheet within its margins (965px; A4's is more), less a printout's head. A short group is
 * never broken over two sheets — carried whole to the next, it leaves at most half a sheet blank; a taller one breaks
 * where it may, its title kept with its start (KEEP_MOST). Set apart from KEEP_MOST since 0.31.1: a ticket's group of
 * a third of a sheet, a quarter more just past a heading's room, was broken over two.
 */
const WHOLE_MOST = 480;
function whole(group: Element): boolean {
  if (!group.matches('fieldset.fd-section') || !group.querySelector(':scope > .fd-section-title')) return false;
  const { top, bottom } = group.getBoundingClientRect();
  return bottom > top && (bottom - top) * 1.25 + 8 <= WHOLE_MOST;
}
/** A table a field draws (lines, a grid of lines, a list), and the least room its label, header and first line take on paper. */
const TABLES = 'table, .fd-grid-lines, .fd-lines, .fd-list';
const TABLE_START = 110;

/**
 * Each heading's room measured and given (`--fd-print-keep`): what its start takes with the form as wide as a sheet
 * (print-styles.ts), its columns and labels as paper lays them out, and a quarter more for what paper draws otherwise —
 * but never more than all it heads takes: a short tab goes on as far as it fits. A short titled group (WHOLE_MOST)
 * is one box on paper, kept whole (`--fd-print-whole`): Firefox left a framed one's top edge at a sheet's
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
    // A short group: one box on paper, never broken, its frame never left at a sheet's foot.
    if (whole(box)) box.style.setProperty('--fd-print-whole', 'inline-block');
    given.push(box);
  };
  const own = (box: HTMLElement) => box.closest('.fd-form') === root;
  const panels = [...root.querySelectorAll<HTMLElement>('.fd-tabpanel:not([data-off], [data-print="off"])')].filter(own);
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

/**
 * A formatted text's tables short enough to be whole on a sheet (`data-fd-whole`, which paper does not break), measured
 * as paper lays them out — a sheet's width, every tab shown — as printing begins; a longer one breaks between its rows.
 * Under A4's and Letter's room less a page's head and foot, as KEEP_MOST is under a heading's. The tables marked.
 */
const TABLE_MOST = 800;
function wholeTables(root: HTMLElement): HTMLElement[] {
  const tables = [...root.querySelectorAll<HTMLElement>(':is(.fd-richtext, .fd-text-area, .fd-md-view) table')].filter((table) => table.closest('.fd-form') === root);
  if (!tables.length) return [];
  root.setAttribute('data-fd-measure', '');
  try {
    const short = tables.filter((table) => {
      const { height } = table.getBoundingClientRect();
      return height > 0 && height <= TABLE_MOST;
    });
    for (const table of short) table.setAttribute('data-fd-whole', '');
    return short;
  } finally {
    root.removeAttribute('data-fd-measure');
  }
}

/** The words of nodes made by `valueWords`, as they read now. */
const wordsOf = (nodes: readonly (Node | string)[]) => nodes.map((node) => (typeof node === 'string' ? node : (node.textContent ?? ''))).join('');

/** A box's words as a person reads them: its text, or a choice's label — none for a choice left empty. */
function boxWords(box: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  if (box.tagName !== 'SELECT') return box.value;
  return [...(box as HTMLSelectElement).selectedOptions].filter((option) => option.value !== '').map((option) => option.textContent ?? '').join(', ');
}

/**
 * A form's look on paper, made as the part comes for each form drawn, and for each drawn after: laid out as printing
 * begins and back as it ends — at the window's `beforeprint` and `afterprint`, or as Ctrl+P or a Print asks
 * (`ready`, then the browser's print).
 */
export function printLook(context: PrintContext, parts: PrintParts): PrintLook {
  const { doc, root, page, labels } = context;
  const { header, footer, title, when } = parts;
  const win = doc.defaultView;
  installPrintStyles(doc);
  // A record's stage (its statusbar's field), in words, for a title that has no name to say yet.
  const bar = page.layout.type === 'sheet' ? page.layout.statusbar?.field : undefined;
  const stage = bar && page.fields[bar] ? valueWords(doc, page.fields, `{${bar}}`, context.locale) : null;

  /** The record's title and the day, as they are now: filled as printing begins, the screen's head left as it was drawn. */
  function fillIn() {
    const values = context.values();
    header?.update(values);
    footer?.update(values);
    // A record's own name; with none yet (a draft invoice's "/"), what the page calls its records ("Invoice", else its
    // title) and the stage it is in ("Invoice · Draft"). A page of responses has its title over it already.
    stage?.update(values);
    const name = context.name();
    const what = () => [recordSentence(page.records, '{record}', plainWords(page.title) ?? '', context.locale), stage ? wordsOf(stage.nodes) : ''].filter(named);
    title.textContent = page.data.kind !== 'record' ? '' : named(name) ? name : what().join(' · ');
    when.textContent = context.fill(labels.printedOn, { date: restingText(context.now().toISOString(), 'datetime', context.locale, page.timeZone) });
  }

  /** The boxes given room measured under their headings, to take it away once printed; the tables kept whole. */
  let kept: HTMLElement[] = [];
  let whole: HTMLElement[] = [];
  /** The words written beside each box for paper, to take away once printed. */
  const written: { box: Element; words: HTMLElement }[] = [];
  function writeBoxes() {
    for (const box of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(BOXES)) {
      // A form inside this one (a dialog's) prints its own; a box its field hides (a read-only code's, under its code) none.
      if (box.closest('.fd-form') !== root) continue;
      const off = box.closest('[hidden]');
      if (off && box.closest('.fd-field')?.contains(off)) continue;
      const style = win?.getComputedStyle(box);
      const words = context.el('span', { class: 'fd-print-box', dir: 'auto' }, boxWords(box));
      // Where the box keeps its words — a number at its end, a title large, a section's line bold — its words keep them.
      if (style) words.style.cssText = `text-align:${style.textAlign};font-size:${style.fontSize};font-weight:${style.fontWeight};font-style:${style.fontStyle}`;
      box.setAttribute('data-print-box', '');
      box.after(words);
      written.push({ box, words });
    }
  }

  /** Laid out for paper now. */
  let laidOut = false;
  /** This form printed alone as the one in front of the page (a dialog's), by the browser's own print. */
  let inFront = false;
  const ready = () => {
    if (laidOut) return;
    laidOut = true;
    root.setAttribute('data-fd-print', '');
    context.drawAll();
    // A part drawn just now (in a tab never opened) came after the window said printing begins: told here, so it lays
    // itself out for paper too (`data-fd-paper`, a grid's paper table) before anything is measured or printed.
    for (const late of root.querySelectorAll('[data-fd-paper]')) late.dispatchEvent(new Event('fd-paper'));
    fillIn();
    writeBoxes();
    kept = keepRooms(root);
    whole = wholeTables(root);
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
    if (!laidOut) return;
    laidOut = false;
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
    for (const table of whole) table.removeAttribute('data-fd-whole');
    whole = [];
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

  return {
    root,
    ready,
    done,
    print() {
      // Already printing (a second press while the browser's dialog is open): that print is this one.
      if (!win || laidOut) return Promise.resolve();
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

/**
 * The browser's print of the whole page, as Ctrl+P asks once the part came (print.ts): each form's look laid out first
 * — an engine that says nothing as it prints prints it so all the same — then the browser asked, and each put back as
 * printing is done: at the window's `afterprint`, or as print() returns where the engine told nothing.
 */
export function printPage(doc: Document, looks: readonly PrintLook[]): void {
  const win = doc.defaultView;
  if (!win) return;
  for (const look of looks) look.ready();
  let told = false;
  const heard = () => (told = true);
  win.addEventListener('beforeprint', heard);
  try {
    win.print();
  } finally {
    win.removeEventListener('beforeprint', heard);
    if (!told) for (const look of looks) look.done();
  }
}
