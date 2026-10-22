import type { Locale } from '@fieldia/core';
import { WIDGET_LABELS } from '@fieldia/widgets';
import { VIEWER_LABELS } from './labels';

/**
 * What a mount made before its page's language's words came (a chunk of their own, words-chunks.ts in @fieldia/core):
 * the viewer's own parts, never the page's — a status, a banner, the thanks after a send — each of English's words in
 * them put in the language's, their text and the attributes a person or a screen reader meets. The page itself is drawn
 * once the words have come.
 */
export function inOwnWords(elements: readonly Element[], locale: Locale): void {
  const swap = new Map<string, string>();
  for (const [english, own] of [
    [VIEWER_LABELS.en, VIEWER_LABELS[locale]],
    [WIDGET_LABELS.en, WIDGET_LABELS[locale]],
  ] as unknown as [Record<string, unknown>, Record<string, unknown> | undefined][]) {
    for (const [key, words] of Object.entries(english)) {
      const theirs = own?.[key];
      if (typeof words === 'string' && typeof theirs === 'string' && theirs !== words) swap.set(words, theirs);
    }
  }
  for (const root of elements) {
    for (const element of [root, ...root.querySelectorAll('*')]) {
      for (const node of element.childNodes) {
        const theirs = node.nodeType === 3 ? swap.get(node.textContent ?? '') : undefined;
        if (theirs) node.textContent = theirs;
      }
      for (const name of ['aria-label', 'title', 'placeholder']) {
        const theirs = swap.get(element.getAttribute(name) ?? '');
        if (theirs) element.setAttribute(name, theirs);
      }
    }
  }
}
