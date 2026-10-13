/**
 * Formatted text kept safe: every value — typed, pasted or loaded — passes
 * through `sanitizeHtml`, so stored markup can never run script in the page.
 */

const ALLOWED = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'A', 'H1', 'H2', 'H3', 'H4',
  'BLOCKQUOTE', 'CODE', 'PRE', 'SPAN', 'DIV', 'IMG',
]);
const DROPPED_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH']);
/** Blocks that may keep their alignment, the one style the toolbar sets on a block. */
const ALIGNABLE = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE']);
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
 * checklist's items (`data-task`). Every other element and attribute goes.
 */
export function sanitizeHtml(html: string, document: Document = globalThis.document): string {
  const box = document.createElement('template');
  box.innerHTML = html;
  const clean = (parent: ParentNode) => {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) continue;
      if (node.nodeType !== Node.ELEMENT_NODE) {
        node.remove();
        continue;
      }
      const element = node as HTMLElement;
      if (DROPPED_WITH_CONTENT.has(element.tagName)) {
        element.remove();
        continue;
      }
      clean(element);
      if (!ALLOWED.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        continue;
      }
      const tag = element.tagName;
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
      const style = element.style;
      const align = ALIGNABLE.has(tag) ? style?.textAlign?.trim().toLowerCase() : '';
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
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      for (const [name, value] of kept) element.setAttribute(name, value);
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
