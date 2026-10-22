import { sanitizeHtml } from './sanitize';
import { givenHtml, heldHtml, HELD_STYLE, styleOf, wearStyles } from './style-attributes';
import { styleNonce } from './style-nonce';

/**
 * What is pasted into a formatted text from Word, Excel, Google Docs or Sheets — or any page — made plain, in the text
 * part: the clipboard's HTML as `sanitizeHtml` keeps any value (no script, no event, no style but a block's alignment),
 * and plainer still, as the field's own words. Bold, italic, underlined and struck words, links, lists, headings,
 * tables and alignment are kept; Office's markup, fonts, sizes, colours, highlights, classes and widths left behind:
 *
 * - Word's lists, written as paragraphs with a bullet or a number before them for other programs (`mso-list`), are
 *   lists again, nested by their level, numbered where their marks are numbers or letters; Google Docs' list nested
 *   beside an item, in it;
 * - Excel's cells bold or aligned by a class of its sheet (`.xl65 { font-weight: 700 }`) are so as they come in;
 * - a cell or a list's item holding one paragraph (Word's, Docs') holds its words, the paragraph's alignment its own;
 * - a link's words are its own colour, never underlined twice;
 * - a span left with nothing to keep is its words; a block round a table alone (Docs') is the table; the lines the
 *   source was written in are spaces, and Word's second line break for other programs, and Safari's newline after
 *   what was copied, go.
 *
 * What a Fieldia editor copied (`copyHtml`: marked `data-fieldia-copy`) keeps what its own tools wrote — a span's
 * colour, highlight and size, a person or a record linked in place — and nothing more: it is kept as any stored value
 * is (`sanitizeHtml`). Whatever else the marker came with is dropped as from anywhere.
 *
 * The result reads the same through `sanitizeHtml` again: what is stored is what was put in.
 *
 * The clipboard's style attributes are held while it is read (`data-fd-style`, style-attributes.ts) and read through
 * a style object, so a strict Content-Security-Policy neither refuses nor reports them.
 */

/** An element's held style written again: `cssText`, or none. */
function holdStyle(element: Element, cssText: string): void {
  if (cssText.trim()) element.setAttribute(HELD_STYLE, cssText);
  else element.removeAttribute(HELD_STYLE);
}

/** The mark on what a Fieldia editor puts on the clipboard. */
const COPIED = 'data-fieldia-copy';
/** Elements a word sits inside that are its look, carried with words copied out of them. */
const INLINE = /^(SPAN|B|STRONG|I|EM|U|S|CODE|A)$/;

/** What stands as a block of its own: a space beside one is nothing. */
const BLOCKS = /^(P|DIV|H[1-4]|UL|OL|LI|BLOCKQUOTE|PRE|BR|TABLE)$/;
/** A paragraph Word writes as an item of a list: its list and level (`mso-list:l0 level2 lfo1`). */
const WORD_ITEM = /mso-list:\s*l(\d+)\s+level(\d+)/i;

/** What Word writes between `<![if !support…]>` and `<![endif]>` for programs other than itself: its words, and gone. */
function forOthers(root: Node, what: RegExp): string[] {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const starts: Comment[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (what.test((node as Comment).data)) starts.push(node as Comment);
  return starts.map((start) => {
    let end: Node | null = start.nextSibling;
    while (end && !(end.nodeType === Node.COMMENT_NODE && /^\[endif\]/i.test((end as Comment).data))) end = end.nextSibling;
    const range = doc.createRange();
    range.setStartAfter(start);
    if (end) range.setEndBefore(end);
    else range.setEndAfter(start.parentNode?.lastChild ?? start);
    const words = range.toString();
    range.deleteContents();
    return words;
  });
}

/** Word's list paragraphs as lists: each run of them one list, nested by level, its kind by the marks before its items. */
function wordLists(root: DocumentFragment, doc: Document) {
  const items = [...root.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, div')].filter((one) => WORD_ITEM.test(one.getAttribute(HELD_STYLE) ?? ''));
  // Runs of items side by side, as the source has them, before any is moved.
  const runs: HTMLElement[][] = [];
  items.forEach((item, i) => (i && item.previousElementSibling === items[i - 1] ? runs[runs.length - 1].push(item) : runs.push([item])));
  for (const run of runs) {
    let open: { level: number; id: string; list: HTMLElement }[] = [];
    for (const paragraph of run) {
      const [, id, level] = WORD_ITEM.exec(paragraph.getAttribute(HELD_STYLE) ?? '') as RegExpExecArray;
      const depth = Number(level);
      const mark = (forOthers(paragraph, /^\[if !supportLists\]/i).join('') + [...paragraph.querySelectorAll(`[${HELD_STYLE}*="mso-list:Ignore" i]`)].map((ignored) => (ignored.remove(), ignored.textContent)).join('')).replace(/[\s\u00a0]/g, '');
      if (open.length && id !== open[0].id && depth <= open[0].level) open = [];
      while (open.length && open[open.length - 1].level > depth) open.pop();
      let top = open[open.length - 1];
      if (!top || top.level < depth) {
        const list = doc.createElement(/^\(?([0-9]+|[a-z]{1,4})[.)]/i.test(mark) ? 'ol' : 'ul');
        if (top) (top.list.lastElementChild ?? top.list).append(list);
        else paragraph.before(list);
        open.push((top = { level: depth, id, list }));
      }
      const item = doc.createElement('li');
      item.append(...paragraph.childNodes);
      top.list.append(item);
      paragraph.remove();
    }
  }
}

/** Pasted markup made plain: see above. Rows alone (a spreadsheet's fragment) in a table of their own. */
export function cleanPasted(html: string, doc: Document): string {
  const box = doc.createElement('template');
  box.innerHTML = heldHtml(/<table[\s>]/i.test(html) || !/<tr[\s>]/i.test(html) ? html : `<table>${html}</table>`);
  const content = box.content;
  // A Fieldia editor's own copy: its own styles kept, as a stored value keeps them.
  const own = content.querySelector(`[${COPIED}]`);
  if (own) return sanitizeHtml(givenHtml(own.innerHTML), doc);
  for (const sheet of content.querySelectorAll('style')) {
    for (const [, name, rules] of (sheet.textContent ?? '').matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
      for (const marked of content.querySelectorAll<HTMLElement>(`[class~="${name}"]`)) marked.setAttribute(HELD_STYLE, `${rules};${marked.getAttribute(HELD_STYLE) ?? ''}`);
    }
  }
  wordLists(content, doc);
  forOthers(content, /^\[if !supportLineBreakNewLine\]/i);
  for (const newline of content.querySelectorAll('br.Apple-interchange-newline')) newline.remove();
  // A link's words in its own colour, its own underline: the source's on its words go.
  for (const marked of content.querySelectorAll<HTMLElement>(`a[${HELD_STYLE}], a [${HELD_STYLE}]`)) {
    const style = styleOf(marked, doc);
    for (const name of ['color', 'text-decoration', 'text-decoration-line']) style.removeProperty(name);
    holdStyle(marked, style.cssText);
  }
  box.innerHTML = heldHtml(sanitizeHtml(givenHtml(box.innerHTML), doc));
  const plain = (parent: Node) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const element = node as HTMLElement;
      const tag = element.tagName;
      if (tag !== 'PRE') plain(element);
      if (tag === 'SPAN') {
        // Its colour, highlight and size the field's own; a person or record linked in place keeps its span.
        element.removeAttribute(HELD_STYLE);
        if (!element.attributes.length) element.replaceWith(...element.childNodes);
      } else if (tag === 'DIV' && element.children.length === 1 && element.firstElementChild?.tagName === 'TABLE') element.replaceWith(...element.childNodes);
      // A list nested beside an item (Google Docs'), in it.
      else if (/^[OU]L$/.test(tag) && /^[OU]L$/.test(element.parentElement?.tagName ?? '') && element.previousElementSibling?.tagName === 'LI') element.previousElementSibling.append(element);
      else if (/^(T[DH]|LI)$/.test(tag)) {
        const only = element.children.length === 1 && element.firstElementChild?.tagName === 'P' && ![...element.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) ? (element.firstElementChild as HTMLElement) : null;
        if (!only) continue;
        const [mine, its] = [styleOf(element, doc), styleOf(only, doc)];
        if (!mine.textAlign && its.textAlign) {
          mine.textAlign = its.textAlign;
          holdStyle(element, mine.cssText);
        }
        only.replaceWith(...only.childNodes);
        element.normalize();
        const [first, last] = [element.firstChild, element.lastChild];
        if (first?.nodeType === Node.TEXT_NODE) first.textContent = first.textContent?.trimStart() ?? '';
        if (last?.nodeType === Node.TEXT_NODE) last.textContent = last.textContent?.trimEnd() ?? '';
      }
    }
  };
  plain(box.content);
  // The lines its source was written in are spaces, and none is left beside a block.
  const spaces = (parent: Node) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName !== 'PRE') spaces(node);
      } else if (/^[ \t\n\r]*$/.test(node.textContent ?? '') && [node.previousSibling, node.nextSibling].some((by) => !by || BLOCKS.test(by.nodeName))) node.remove();
      else node.textContent = node.textContent?.replace(/\s*\n\s*/g, ' ') ?? '';
    }
  };
  spaces(box.content);
  // Kept as any value is kept, in its order: what is stored reads the same through `sanitizeHtml` again.
  return sanitizeHtml(givenHtml(box.innerHTML), doc);
}

/**
 * A table's cells as they were given to the browser: Chromium's insertHTML drops a cell's alignment where it matches
 * its line's own (`right` in a page right to left), which would change the table where the page runs the other way.
 */
export function keepCells(table: HTMLTableElement, as: HTMLTableElement): void {
  const given = [...as.rows].flatMap((row) => [...row.cells]);
  [...table.rows].flatMap((row) => [...row.cells]).forEach((cell, i) => {
    // As given: held (read with its styles held), or a table drawn here. Put on through its style object.
    const style = given[i]?.getAttribute(HELD_STYLE) ?? given[i]?.getAttribute('style');
    if (style) cell.style.cssText = style;
    else cell.removeAttribute('style');
  });
}

/** HTML put in where the caret is in `box`, in one step the browser's Undo takes back, the tables in it as given. */
export function putHtml(box: HTMLElement, html: string, doc: Document): void {
  const had = new Set(box.querySelectorAll('table'));
  // Under a strict Content-Security-Policy, its styles held as it goes in and put on through each element's style
  // object: never a style attribute for the browser to read. Without one, as the browser's own paste keeps the look.
  doc.execCommand?.('insertHTML', false, styleNonce(doc) ? heldHtml(html) : html);
  wearStyles(box);
  const given = doc.createElement('template');
  given.innerHTML = heldHtml(html);
  const tables = [...given.content.querySelectorAll('table')];
  [...box.querySelectorAll('table')].filter((table) => !had.has(table)).forEach((table, i) => tables[i] && keepCells(table, tables[i]));
}

/**
 * A paste into a formatted text (`box`): the clipboard's HTML put in as `cleanPasted` makes it, where the caret is
 * (`putHtml`). Words alone (no HTML: a plain text's, a file's) are the browser's to paste, as they were. True when it
 * took the paste.
 */
export function pasteHtml(event: ClipboardEvent, doc: Document, box: HTMLElement): boolean {
  const html = event.clipboardData?.getData('text/html') ?? '';
  if (!html.trim()) return false;
  event.preventDefault();
  putHtml(box, cleanPasted(html, doc), doc);
  return true;
}

/**
 * A copy or cut from a Fieldia editor (`box`): its selection as the editor keeps it — the words, the marks and look
 * round them (a coloured word copied alone keeps its span), cleaned as a stored value is — marked as its own, with its
 * words as plain text beside it. True when it put them on the clipboard.
 */
export function copyHtml(event: ClipboardEvent, box: HTMLElement, doc: Document): boolean {
  const selection = doc.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!event.clipboardData || !range || range.collapsed || !box.contains(range.commonAncestorContainer)) return false;
  let piece: Node = range.cloneContents();
  const common = range.commonAncestorContainer;
  for (let at = common.nodeType === Node.ELEMENT_NODE ? (common as Element) : common.parentElement; at && at !== box && INLINE.test(at.tagName); at = at.parentElement) {
    const look = at.cloneNode(false);
    look.appendChild(piece);
    piece = look;
  }
  const holder = doc.createElement('div');
  holder.append(piece);
  event.clipboardData.setData('text/html', `<div ${COPIED}="">${sanitizeHtml(holder.innerHTML, doc)}</div>`);
  event.clipboardData.setData('text/plain', selection?.toString() ?? '');
  event.preventDefault();
  return true;
}
