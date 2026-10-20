/**
 * Formatted text kept safe: every value — typed, pasted or loaded — passes
 * through `sanitizeHtml`, so stored markup can never run script in the page.
 */

/** A table's own elements, kept as plain table markup: no widths, no columns' sizes (colgroup, col), no styles. */
const TABLE = ['TABLE', 'CAPTION', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD'];
const ALLOWED = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'H1', 'H2', 'H3', 'H4',
  'BLOCKQUOTE', 'CODE', 'PRE', 'SPAN', 'DIV', 'IMG', ...TABLE,
]);
const DROPPED_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'TITLE']);
/** Blocks that may keep their alignment, the one style the toolbar sets on a block: a table's cell too (a price at its end). */
const ALIGNABLE = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE', 'TD', 'TH']);
/** Words made bold, italic, underlined or struck by a style (Google Docs' spans, Sheets' cells), and the element saying so. */
const MARKS: [tag: string, says: (style: CSSStyleDeclaration) => boolean, already: RegExp][] = [
  ['B', (style) => /^(bold|bolder|[6-9]00)$/.test(style.fontWeight), /^(B|STRONG|TH|H[1-4])$/],
  ['I', (style) => /^(italic|oblique)/.test(style.fontStyle), /^(I|EM)$/],
  ['U', (style) => /underline/.test(style.textDecoration || style.textDecorationLine), /^U$/],
  ['S', (style) => /line-through/.test(style.textDecoration || style.textDecorationLine), /^S$/],
];
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify', 'start', 'end']);
/** A colour written as #rgb, #rrggbb or rgb()/rgba() of numbers: nothing a style could run. */
const COLOUR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i;
/** The sizes of words a text keeps, in pixels. */
const SIZES = new Set(['12px', '14px', '16px', '20px', '28px']);
/** A picture from the web, or written into the text as data. */
const IMAGE_SOURCE = /^(https:\/\/[^\s"'<>]+|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)$/i;
/** What names a person or a record linked in place, and the model it is of. */
const RECORD_ID = /^[\w.-]{1,64}$/;
const MODEL = /^[A-Za-z][\w.]{0,63}$/;

/**
 * Keep text structure, block alignment, http(s)/mailto links and pictures from
 * the web or written in; a span's colour, highlight and size; a person or a
 * record linked in place (`data-mention`, `data-record`, `data-model`) and a
 * checklist's items (`data-task`); tables, a cell's span over its neighbours
 * (`colspan`, `rowspan`) and a header's `scope`. Words a style makes bold,
 * italic, underlined or struck keep it as an element (`<b>`…), and a bold or
 * italic element whose style says it is not loses it: Google Docs wraps what
 * it copies in `<b style="font-weight:normal">`. Every other element and
 * attribute goes. (What is pasted from an office app is made plainer still by
 * the text part, pasted-html.ts.)
 */
export function sanitizeHtml(html: string, document: Document = globalThis.document): string {
  const box = document.createElement('template');
  box.innerHTML = html;
  const clean = (parent: ParentNode) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) {
        // The lines and spaces Word and Excel write between a table's rows and cells.
        if (/^(TABLE|THEAD|TBODY|TFOOT|TR)$/.test(parent.nodeName) && !node.textContent?.trim()) node.remove();
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        node.remove();
        continue;
      }
      const element = node as HTMLElement;
      const tag = element.tagName;
      if (DROPPED_WITH_CONTENT.has(tag)) {
        element.remove();
        continue;
      }
      clean(element);
      const style = element.style;
      if (style) {
        for (const [mark, says, already] of MARKS) {
          if (already.test(tag) || !says(style)) continue;
          const marked = document.createElement(mark);
          marked.append(...element.childNodes);
          element.append(marked);
        }
      }
      // A table's part outside a table (a fragment of rows) is its words, and so is a bold or italic element its style
      // undoes.
      const loose = TABLE.includes(tag) && tag !== 'TABLE' && !element.parentElement?.closest('table');
      const undone = (/^(B|STRONG)$/.test(tag) && /^(normal|lighter|[1-5]00)$/.test(style?.fontWeight ?? '')) || (/^(I|EM)$/.test(tag) && style?.fontStyle === 'normal');
      if (!ALLOWED.has(tag) || loose || undone) {
        element.replaceWith(...element.childNodes, ...(loose && /^T[DH]$/.test(tag) ? [' '] : []));
        continue;
      }
      const kept: [string, string][] = [];
      const href = tag === 'A' ? element.getAttribute('href')?.trim() : null;
      if (href && /^(https?:|mailto:)/i.test(href)) kept.push(['href', href]);
      if (tag === 'IMG') {
        const src = element.getAttribute('src')?.trim() ?? '';
        if (!IMAGE_SOURCE.test(src)) {
          element.remove();
          continue;
        }
        kept.push(['src', src], ['alt', element.getAttribute('alt') ?? '']);
      }
      const styles: string[] = [];
      // Its alignment as a style, or as the old `align` attribute: Firefox's toolbar centres a line with one.
      const align = ALIGNABLE.has(tag) ? (style?.textAlign || element.getAttribute('align') || '').trim().toLowerCase() : '';
      if (align && ALIGNMENTS.has(align)) styles.push(`text-align: ${align};`);
      if (tag === 'SPAN' && style) {
        const colour = style.color?.trim();
        const ground = style.backgroundColor?.trim();
        const size = style.fontSize?.trim();
        if (colour && COLOUR.test(colour)) styles.push(`color: ${colour};`);
        if (ground && COLOUR.test(ground)) styles.push(`background-color: ${ground};`);
        if (size && SIZES.has(size)) styles.push(`font-size: ${size};`);
      }
      if (styles.length) kept.push(['style', styles.join(' ')]);
      if (tag === 'SPAN' || tag === 'A') {
        for (const name of ['data-mention', 'data-record'] as const) {
          const value = element.getAttribute(name);
          if (value && RECORD_ID.test(value)) kept.push([name, value]);
        }
        const model = element.getAttribute('data-model');
        if (model && MODEL.test(model) && element.hasAttribute('data-record')) kept.push(['data-model', model]);
      }
      const task = tag === 'LI' ? element.getAttribute('data-task') : null;
      if (task === 'open' || task === 'done') kept.push(['data-task', task]);
      // A cell's span over its neighbours, a whole number the browser keeps (at most 1,000); a header's scope.
      for (const name of /^T[DH]$/.test(tag) ? ['colspan', 'rowspan'] : []) {
        const n = Number(element.getAttribute(name));
        if (Number.isInteger(n) && n > 1 && n <= 1000) kept.push([name, String(n)]);
      }
      const scope = tag === 'TH' ? element.getAttribute('scope') : null;
      if (scope === 'col' || scope === 'row') kept.push(['scope', scope]);
      // The way a table's columns run, as it was written: an Arabic table right to left in any page.
      const dir = tag === 'TABLE' ? element.getAttribute('dir')?.toLowerCase() : null;
      if (dir === 'rtl' || dir === 'ltr') kept.push(['dir', dir]);
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      for (const [name, value] of kept) element.setAttribute(name, value);
      // A table with no cell left is nothing.
      if (tag === 'TABLE' && !element.querySelector('td, th')) element.remove();
    }
  };
  clean(box.content);
  const out = document.createElement('div');
  out.append(box.content);
  return out.innerHTML;
}

/** A typed address as a link target: web and mail addresses only, "https://" added to a bare domain. */
export function linkAddress(typed: string): string | null {
  const text = typed.trim();
  if (/^(https?:\/\/|mailto:)\S+$/i.test(text)) return text;
  if (/^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/.test(text)) return `mailto:${text}`;
  if (/^[\w-]+(\.[\w-]+)+([/?#]\S*)?$/.test(text)) return `https://${text}`;
  return null;
}
