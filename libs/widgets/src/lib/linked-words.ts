import { safeUrl } from '@fieldia/core';
import { drawIcon } from './icons';

/**
 * Words with `[words](address)` in them, drawn with those as links: web and
 * mail addresses only, opened in a tab of their own, an icon after each that
 * leaves the page. Anything else in brackets stays as it is written. Neither
 * a link's words nor its address hold a bracket: each "[" is tried once, never
 * read on to the end of the words again (a text of "[" over and over took seconds).
 */
const LINK = /\[([^[\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)[\]]+)\)/g;

export function linkedWords(doc: Document, text: string, options: { external?: boolean } = {}): Node[] {
  const nodes: Node[] = [];
  let at = 0;
  for (const match of text.matchAll(LINK)) {
    if (match.index > at) nodes.push(doc.createTextNode(text.slice(at, match.index)));
    const link = doc.createElement('a');
    link.href = safeUrl(match[2], ['http', 'https', 'mailto']) ?? '';
    link.textContent = match[1];
    if (/^https?:/i.test(match[2])) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    nodes.push(link);
    const icon = options.external && /^https?:/i.test(match[2]) ? drawIcon(doc, 'external') : null;
    if (icon) {
      icon.classList.add('fd-external');
      nodes.push(icon);
    }
    at = match.index + match[0].length;
  }
  if (at < text.length) nodes.push(doc.createTextNode(text.slice(at)));
  return nodes;
}

/** Whether words hold any such link. */
export const hasLinks = (text: string) => new RegExp(LINK.source).test(text);
