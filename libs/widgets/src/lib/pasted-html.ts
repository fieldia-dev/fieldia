import { sanitizeHtml } from './sanitize';

/**
 * A table pasted into a formatted text from Word, Excel, Google Docs or Google Sheets — or any page — made plain, in
 * the text part: the clipboard's HTML as `sanitizeHtml` keeps any value (no script, no event, no style but a block's
 * alignment and a span's colour, size and highlight), and plainer still, as the field's own words:
 *
 * - Excel's cells bold or aligned by a class of its sheet (`.xl65 { font-weight: 700 }`) are so as they come in;
 * - a cell holding one paragraph (Word's, Docs') holds its words, the paragraph's alignment the cell's;
 * - a span with nothing left to keep is its words, and the black or white every word of Docs is written in, the
 *   field's own colour (dark in a light scheme, light in a dark one);
 * - a block round a table alone (Docs') is the table, and the lines the source was written in are spaces.
 *
 * The result reads the same through `sanitizeHtml` again: what is stored is what was put in.
 */

/** What stands as a block of its own: a space beside one is nothing. */
const BLOCKS = /^(P|DIV|H[1-4]|UL|OL|LI|BLOCKQUOTE|PRE|BR|TABLE)$/;
/** The words' own colour, as the source wrote it: black or white. */
const OWN_COLOUR = /^rgba?\((0, 0, 0|255, 255, 255)(, 1)?\)$/;

/** Pasted markup made plain: see above. Rows alone (a spreadsheet's fragment) in a table of their own. */
export function cleanPasted(html: string, doc: Document): string {
  const box = doc.createElement('template');
  box.innerHTML = /<table[\s>]/i.test(html) || !/<tr[\s>]/i.test(html) ? html : `<table>${html}</table>`;
  for (const sheet of box.content.querySelectorAll('style')) {
    for (const [, name, rules] of (sheet.textContent ?? '').matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
      for (const marked of box.content.querySelectorAll<HTMLElement>(`[class~="${name}"]`)) marked.setAttribute('style', `${rules};${marked.getAttribute('style') ?? ''}`);
    }
  }
  box.innerHTML = sanitizeHtml(box.innerHTML, doc);
  const plain = (parent: Node) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const element = node as HTMLElement;
      const tag = element.tagName;
      if (tag !== 'PRE') plain(element);
      if (tag === 'SPAN') {
        for (const name of ['color', 'background-color']) if (OWN_COLOUR.test(element.style.getPropertyValue(name))) element.style.removeProperty(name);
        if (!element.getAttribute('style')) element.removeAttribute('style');
        if (!element.attributes.length) element.replaceWith(...element.childNodes);
      } else if (tag === 'DIV' && element.children.length === 1 && element.firstElementChild?.tagName === 'TABLE') element.replaceWith(...element.childNodes);
      else if (/^T[DH]$/.test(tag)) {
        const only = element.children.length === 1 && element.firstElementChild?.tagName === 'P' && ![...element.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) ? (element.firstElementChild as HTMLElement) : null;
        if (!only) continue;
        if (!element.style.textAlign && only.style.textAlign) element.style.textAlign = only.style.textAlign;
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
  return sanitizeHtml(box.innerHTML, doc);
}

/**
 * A table's cells as they were given to the browser: Chromium's insertHTML drops a cell's alignment where it matches
 * its line's own (`right` in a page right to left), which would change the table where the page runs the other way.
 */
export function keepCells(table: HTMLTableElement, as: HTMLTableElement): void {
  const given = [...as.rows].flatMap((row) => [...row.cells]);
  [...table.rows].flatMap((row) => [...row.cells]).forEach((cell, i) => {
    const style = given[i]?.getAttribute('style');
    if (style) cell.setAttribute('style', style);
    else cell.removeAttribute('style');
  });
}

/** HTML put in where the caret is in `box`, in one step the browser's Undo takes back, the tables in it as given. */
export function putHtml(box: HTMLElement, html: string, doc: Document): void {
  const had = new Set(box.querySelectorAll('table'));
  doc.execCommand?.('insertHTML', false, html);
  const given = doc.createElement('template');
  given.innerHTML = html;
  const tables = [...given.content.querySelectorAll('table')];
  [...box.querySelectorAll('table')].filter((table) => !had.has(table)).forEach((table, i) => tables[i] && keepCells(table, tables[i]));
}

/**
 * A paste into a formatted text (`box`): a table (or rows) on the clipboard put in as `cleanPasted` makes it, where the
 * caret is (`putHtml`). Whatever else is pasted is the browser's, as it was. True when it took the paste.
 */
export function pasteTable(event: ClipboardEvent, doc: Document, box: HTMLElement): boolean {
  const html = event.clipboardData?.getData('text/html') ?? '';
  if (!/<t(able|r)[\s>]/i.test(html)) return false;
  event.preventDefault();
  putHtml(box, cleanPasted(html, doc), doc);
  return true;
}
