import { heldHtml, HELD_STYLE, styleOf } from './style-attributes';
/**
 * Markdown and the formatted text Fieldia keeps, both ways, written by hand so
 * the one-tag script stays small: a field edited in Markdown is still stored
 * as clean HTML, and HTML is written back as Markdown to edit it again.
 *
 * The subset of CommonMark it reads: paragraphs, line breaks (two spaces or a
 * backslash at a line's end), **bold**, *italic*, ~~strikethrough~~, `code`,
 * ==highlighted== words, fenced code, [links](https://…), <https://…> and bare web addresses,
 * ![pictures](https://…), headings 1 to 4, `-`/`*`/`+` lists, `1.` lists,
 * `- [ ]` checklists, nested by indenting, `>` quotes, and tables as GitHub
 * writes them (`| a | b |` over `| --- | ---: |`, a column's alignment by its
 * colons). Raw HTML is escaped: it shows as written, never runs.
 */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** An address a link may go to: the web and mail only. */
const SAFE_LINK = /^(https?:\/\/|mailto:)[^\s<>"]+$/i;
/** An address a picture may come from: the web, or a picture written into the text. */
const SAFE_IMAGE = /^(https:\/\/[^\s<>"]+|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)$/i;
/** A bare web address in running text, without the stop or bracket that ends its sentence. */
const BARE_URL = /\bhttps?:\/\/[^\s<>"\uE000]*[^\s<>".,;:!?)\]'*_~\uE000]/gi;

// ---- Markdown → HTML ----------------------------------------------------------

/** Words with their Markdown marks as HTML, every other character escaped. */
export function inlineMarkdown(text: string): string {
  // Code spans and escapes first, held aside as tokens so nothing inside them is read as marks.
  const held: string[] = [];
  const hold = (html: string) => `\uE000${held.push(html) - 1}\uE000`;
  let out = text
    .replace(/\uE000/g, '')
    .replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _ticks: string, code: string) => hold(`<code>${escapeHtml(code.replace(/^ (.*) $/, '$1'))}</code>`))
    .replace(/\\([\\`*_{}[\]()#+\-.!~<>|])/g, (_, c: string) => hold(escapeHtml(c)));
  // Pictures and links, their words read for marks of their own. Neither their words nor their address hold a bracket:
  // each "[" is tried once, never read on to the text's end again (a text of "[a](" over and over took seconds).
  // A picture from an address it may not come from is a link to it.
  out = out.replace(/!\[([^[\]]*)\]\(\s*<?([^\s)>[\]]+)>?\s*\)/g, (whole, alt: string, src: string) =>
    SAFE_IMAGE.test(src) ? hold(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`) : SAFE_LINK.test(src) ? hold(`<a href="${escapeHtml(src)}">${escapeHtml(alt || src)}</a>`) : whole
  );
  out = out.replace(/\[([^[\]]+)\]\(\s*<?([^\s)>[\]]+)>?\s*\)/g, (whole, words: string, href: string) =>
    SAFE_LINK.test(href) ? hold(`<a href="${escapeHtml(href)}">${inlineMarks(escapeHtml(words))}</a>`) : whole
  );
  out = out.replace(/<((?:https?:\/\/|mailto:)[^\s<>]+)>/gi, (_, href: string) => hold(`<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`));
  out = out.replace(BARE_URL, (href) => hold(`<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`));
  out = inlineMarks(escapeHtml(out));
  // Held parts may hold others (code in a link's words): put back until none is left.
  while (/\uE000\d+\uE000/.test(out)) out = out.replace(/\uE000(\d+)\uE000/g, (_, i: string) => held[Number(i)]);
  return out;
}

/** Bold, italic and strikethrough in words already escaped. */
function inlineMarks(text: string): string {
  return text
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>')
    .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?![\w*])/g, '$1<em>$2</em>')
    .replace(/(^|[^\w_])_(?=\S)([^_]*?\S)_(?![\w_])/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
    .replace(/==(?=\S)([\s\S]*?\S)==/g, `<span style="background-color: ${HIGHLIGHT};">$1</span>`);
}

/** The colour ==highlighted words== take. */
const HIGHLIGHT = 'rgb(255, 255, 0)';

const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])( +|$)(.*)$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,4})(?: +(.*?))?(?: +#+)? *$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const RULE = /^ {0,3}([-*_])( *\1){2,} *$/;
/** A table's line under its header: a cell of dashes for each column, a colon at an end for its alignment. */
const TABLE_RULE = /^ {0,3}\|?( *:?-+:? *\|)*( *:?-+:? *)\|? *$/;

/** A table row's cells: split at each pipe not escaped (`\|` is one in the words), its pipes at either end left off. */
function tableCells(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  const text = line.trim();
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && text[i + 1] === '|') cell += text[i++] + '|';
    else if (text[i] === '|') {
      cells.push(cell);
      cell = '';
    } else cell += text[i];
  }
  cells.push(cell);
  if (text.startsWith('|')) cells.shift();
  if (text.endsWith('|') && !text.endsWith('\\|')) cells.pop();
  return cells.map((one) => one.trim());
}

/** Whether a table starts at line `i`: a row with a pipe, the line under it its columns' dashes, as many. */
const tableAt = (lines: string[], i: number) => lines[i].includes('|') && TABLE_RULE.test(lines[i + 1] ?? '') && lines[i + 1].includes('|') && tableCells(lines[i]).length === tableCells(lines[i + 1]).length;

/** A table from line `start`, and where the lines after it begin: its header row, its rows up to a line with no pipe. */
function table(lines: string[], start: number): [string, number] {
  const aligns = tableCells(lines[start + 1]).map((rule) => (rule.startsWith(':') && rule.endsWith(':') ? 'center' : rule.endsWith(':') ? 'right' : rule.startsWith(':') ? 'left' : ''));
  const row = (tag: string, cells: string[]) => `<tr>${aligns.map((align, c) => `<${tag}${align ? ` style="text-align: ${align};"` : ''}>${inlineMarkdown(cells[c] ?? '')}</${tag}>`).join('')}</tr>`;
  const body: string[] = [];
  let i = start + 2;
  while (i < lines.length && lines[i].trim() && lines[i].includes('|')) body.push(row('td', tableCells(lines[i++])));
  return [`<table><thead>${row('th', tableCells(lines[start]))}</thead>${body.length ? `<tbody>${body.join('')}</tbody>` : ''}</table>`, i];
}

/** Markdown as clean HTML: the subset above, raw HTML escaped. Nothing at all gives an empty string. */
export function markdownToHtml(markdown: string): string {
  return blocks(markdown.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'));
}

function blocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (tableAt(lines, i)) {
      const [html, next] = table(lines, i);
      out.push(html);
      i = next;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push(`<h${heading[1].length}>${inlineMarkdown(heading[2] ?? '')}</h${heading[1].length}>`);
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push((QUOTE.exec(lines[i++]) as RegExpExecArray)[1]);
      out.push(`<blockquote>${blocks(quoted)}</blockquote>`);
      continue;
    }
    if (LIST_ITEM.test(line) && !RULE.test(line)) {
      const [html, next] = list(lines, i);
      out.push(html);
      i = next;
      continue;
    }
    // A paragraph: lines up to a blank one or the start of another block.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !(para.length && (FENCE.test(lines[i]) || HEADING.test(lines[i]) || QUOTE.test(lines[i]) || LIST_ITEM.test(lines[i]) || tableAt(lines, i)))) para.push(lines[i++]);
    out.push(`<p>${paragraph(para)}</p>`);
  }
  return out.join('');
}

/** A paragraph's lines: a hard break where a line ends in two spaces or a backslash, a soft one elsewhere. */
function paragraph(lines: string[]): string {
  return lines
    .map((line, n) => {
      const last = n === lines.length - 1;
      const hard = !last && (/ {2,}$/.test(line) || /\\$/.test(line));
      const text = line.trim().replace(/\\$/, last ? '\\' : '');
      return inlineMarkdown(text) + (last ? '' : hard ? '<br>' : '\n');
    })
    .join('');
}

/** A list from line `start`, its items and the lists nested in them, and where the lines after it begin. */
function list(lines: string[], start: number): [string, number] {
  const first = LIST_ITEM.exec(lines[start]) as RegExpExecArray;
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const item = LIST_ITEM.exec(lines[i]);
    // A list goes on while its marks do: another bullet, or another stop after the number, starts a new one.
    if (!item || item[1].length !== indent || (ordered ? !/\d/.test(item[2]) || item[2].slice(-1) !== first[2].slice(-1) : item[2] !== first[2])) break;
    // The item's own lines: the next ones indented under it, blank lines inside it included.
    const own = [item[4]];
    const inner = indent + item[2].length + Math.max(1, item[3].length);
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) {
        if (i + 1 < lines.length && lines[i + 1].search(/\S/) >= Math.min(inner, indent + 2)) {
          own.push('');
          i++;
          continue;
        }
        break;
      }
      const depth = next.search(/\S/);
      if (depth < Math.min(inner, indent + 2) && (LIST_ITEM.test(next) || depth <= indent)) break;
      own.push(next.slice(Math.min(depth, inner)));
      i++;
    }
    const task = !ordered ? /^\[( |x|X)\] +(.*)$/.exec(own[0]) : null;
    if (task) own[0] = task[2];
    // A single line stays words; more makes blocks of them (a nested list).
    const body = own.length === 1 || !own.slice(1).some((l) => l.trim()) ? inlineMarkdown(own[0].trim()) : itemBlocks(own);
    items.push(task ? `<li data-task="${task[1] === ' ' ? 'open' : 'done'}">${body}</li>` : `<li>${body}</li>`);
  }
  while (i < lines.length && !lines[i].trim() && i + 1 < lines.length && LIST_ITEM.exec(lines[i + 1])?.[1].length === indent) i++;
  const tag = ordered ? 'ol' : 'ul';
  return [`<${tag}>${items.join('')}</${tag}>`, i];
}

/** An item of several lines: its first words as they are, and any list under them as a list. */
function itemBlocks(own: string[]): string {
  const nested = own.findIndex((line, n) => n > 0 && LIST_ITEM.test(line));
  if (nested === -1) return blocks(own).replace(/^<p>([\s\S]*)<\/p>$/, '$1');
  const lead = own.slice(0, nested).filter((l) => l.trim());
  return paragraph(lead) + blocks(own.slice(nested));
}

// ---- HTML → Markdown ----------------------------------------------------------

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE']);

/** Marks that would read as Markdown in plain words, escaped with a backslash. */
const escapeMarkdown = (text: string) =>
  text
    .replace(/([\\`*_[\]<~])/g, '\\$1')
    .replace(/^(\s*)([#>+-])(?=\s)/gm, '$1\\$2')
    .replace(/^(\s*\d+)\.(?=\s)/gm, '$1\\.');

/** Formatted text written as Markdown, as near as Markdown can say it. */
export function htmlToMarkdown(html: string, doc: Document = globalThis.document): string {
  // Its style attributes held while it is read, as a strict Content-Security-Policy needs (style-attributes.ts).
  const box = doc.createElement('template');
  box.innerHTML = heldHtml(html);
  return blockChildren(box.content, '').replace(/\n{3,}/g, '\n\n').trim();
}

function blockChildren(parent: ParentNode, prefix: string): string {
  const parts: string[] = [];
  let inline: Node[] = [];
  const flush = () => {
    const text = inlineOf(inline).trim();
    if (text) parts.push(text);
    inline = [];
  };
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as Element).tagName)) {
      flush();
      const md = blockOf(node as Element, prefix);
      if (md.trim()) parts.push(md);
    } else inline.push(node);
  }
  flush();
  return parts.join('\n\n');
}

function blockOf(element: Element, prefix: string): string {
  const tag = element.tagName;
  if (/^H[1-4]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${inlineOf([...element.childNodes]).trim()}`;
  if (tag === 'PRE') return '```\n' + (element.textContent ?? '').replace(/\n$/, '') + '\n```';
  if (tag === 'TABLE') return tableMarkdown(element as HTMLTableElement);
  if (tag === 'BLOCKQUOTE') return blockChildren(element, prefix).split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n');
  if (tag === 'UL' || tag === 'OL') {
    let n = 0;
    return [...element.children]
      .filter((li) => li.tagName === 'LI')
      .map((li) => {
        n++;
        const task = li.getAttribute('data-task');
        const mark = tag === 'OL' ? `${n}.` : '-';
        const box = tag === 'UL' && (task === 'open' || task === 'done') ? `[${task === 'done' ? 'x' : ' '}] ` : '';
        const pad = ' '.repeat(mark.length + 1);
        const body = blockChildren(li, prefix).replace(/\n\n(?=\s*([-*+]|\d+\.) )/g, '\n');
        return `${mark} ${box}${body.split('\n').map((line, i) => (i && line ? pad + line : line)).join('\n')}`;
      })
      .join('\n');
  }
  return blockChildren(element, prefix);
}

function inlineOf(nodes: Node[]): string {
  return nodes.map(inlineNode).join('');
}

function inlineNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdown((node.textContent ?? '').replace(/\s*\n\s*/g, ' '));
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as Element;
  const inner = () => inlineOf([...element.childNodes]);
  const wrap = (mark: string) => {
    const text = inner();
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text) as RegExpExecArray;
    return core ? `${lead}${mark}${core}${mark}${trail}` : text;
  };
  switch (element.tagName) {
    case 'BR':
      return '\\\n';
    case 'STRONG':
    case 'B':
      return wrap('**');
    case 'EM':
    case 'I':
      return wrap('*');
    case 'S':
    case 'STRIKE':
    case 'DEL':
      return wrap('~~');
    case 'CODE': {
      const code = element.textContent ?? '';
      const ticks = '`'.repeat((code.match(/`+/g) ?? ['']).reduce((most, run) => Math.max(most, run.length), 0) + 1);
      return ticks.length > 1 || /^`|`$/.test(code) ? `${ticks} ${code} ${ticks}` : `\`${code}\``;
    }
    case 'A': {
      const href = element.getAttribute('href') ?? '';
      const words = inner();
      if (!href) return words;
      if (element.textContent !== href) return `[${words}](${href})`;
      // An address shown as itself: bare when it reads back whole, else in <…>.
      return (href.match(BARE_URL) ?? [])[0] === href ? href : `<${href}>`;
    }
    case 'SPAN':
      // Highlighted words, the one colour Markdown here can say.
      return highlightOnly(element) ? wrap('==') : inner();
    case 'IMG':
      return `![${escapeMarkdown(element.getAttribute('alt') ?? '')}](${element.getAttribute('src') ?? ''})`;
    default:
      return inner();
  }
}

/** A cell's alignment, as a column's colons can say it, or not ('?'). */
const alignOf = (cell: HTMLTableCellElement) => {
  const align = styleOf(cell).textAlign;
  return !align || /^(left|center|right)$/.test(align) ? align : '?';
};

/**
 * A table as GitHub writes one: its first row the header's, the line of dashes under it with each column's alignment
 * (its first row's), every cell its words on one line, a pipe in them escaped. As near as Markdown can say it: a cell
 * across several, a row of headers further down, a line break, a list in a cell — what `markdownLoses` asks about.
 */
function tableMarkdown(table: HTMLTableElement): string {
  const rows = [...table.rows].map((row) => [...row.cells]);
  const width = Math.max(1, ...rows.map((cells) => cells.length));
  const words = (cell?: HTMLTableCellElement) => (cell ? inlineOf([...cell.childNodes]).replace(/\\?\n/g, ' ').replace(/\|/g, '\\|').trim() : '');
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const each = <T>(of: (c: number) => T) => Array.from({ length: width }, (_, c) => of(c));
  const rule = each((c) => ({ left: ':---', center: ':---:', right: '---:' })[alignOf(rows[0]?.[c] ?? table.ownerDocument.createElement('td'))] ?? '---');
  return [line(each((c) => words(rows[0]?.[c]))), line(rule), ...rows.slice(1).map((cells) => line(each((c) => words(cells[c]))))].join('\n');
}

/** Whether a table written as Markdown would lose some of it: anything but a header row over rows of words, each column aligned one way. */
function tableLoses(table: HTMLTableElement): boolean {
  const rows = [...table.rows];
  const width = rows[0]?.cells.length ?? 0;
  return (
    !width ||
    !!table.caption ||
    !!table.tFoot ||
    table.hasAttribute('dir') ||
    rows.some((row, r) =>
      [...row.cells].some((cell, c) => row.cells.length !== width || cell.colSpan > 1 || cell.rowSpan > 1 || (cell.tagName === 'TH') !== (r === 0) || !!cell.querySelector('p, div, ul, ol, blockquote, pre, h1, h2, h3, h4, table, br') || alignOf(cell) === '?' || alignOf(cell) !== alignOf(rows[0].cells[c]))
    )
  );
}

/**
 * Whether writing this formatted text as Markdown would lose some of it:
 * underlining, colours, sizes, alignment (but a table's columns'), a person
 * or record linked in place, a table Markdown cannot write as it is.
 * Asked before a field switches from the rich editor to Markdown.
 */
export function markdownLoses(html: string, doc: Document = globalThis.document): boolean {
  const box = doc.createElement('template');
  box.innerHTML = heldHtml(html);
  return [...box.content.querySelectorAll('*')].some(
    (element) =>
      element.tagName === 'U' ||
      element.hasAttribute('data-mention') ||
      element.hasAttribute('data-record') ||
      (element.tagName === 'TABLE' && tableLoses(element as HTMLTableElement)) ||
      (element.hasAttribute(HELD_STYLE) && !highlightOnly(element) && !/^T[DH]$/.test(element.tagName)) ||
      (element.tagName === 'SPAN' && element.attributes.length > 0 && !highlightOnly(element))
  );
}

/** A span that only highlights its words, as ==words== write it. */
function highlightOnly(element: Element): boolean {
  if (element.tagName !== 'SPAN' || element.attributes.length !== 1) return false;
  const style = styleOf(element);
  return !!style.backgroundColor && style.length === 1;
}
