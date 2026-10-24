/**
 * The loading part (parts.ts): what a wait draws beyond words (loading.ts) — a skeleton (a few bars in a place, a form's
 * boxes under their labels, a page's layout while its parts come: page-skeleton.ts), a bar along the top or across the
 * middle, a spinner (a ring or three dots), the overlay over a form while it saves — and their sheet with its tokens
 * (styles-loading-part.ts). Asked for as a wait that draws from it starts, never waited for: until it has come, a wait
 * drawn the first time says "Loading…" in words, any other is a screen reader's alone, and each is drawn as it says once
 * it has. A page, a part of it or an app that names one of its ways itself (a spinner, the overlay) has it waited for
 * with the page's parts (`asksLoadingPart`), so it is never drawn in words first.
 */
export { installLoadingStyles } from './styles-loading-part';
export { pageSkeleton } from './page-skeleton';

/** A loader's insides, as its way draws them: a skeleton's bars, a spinner and its words for a screen reader, a bar. */
export function drawLoader(loader: HTMLElement, words: string): void {
  const doc = loader.ownerDocument;
  const way = loader.getAttribute('data-way');
  const span = (className: string, text = '') => {
    const made = Object.assign(doc.createElement('span'), { className, textContent: text });
    made.setAttribute('aria-hidden', 'true');
    return made;
  };
  if (way === 'skeleton') {
    for (let i = 0; i < 3; i++) loader.append(span('fd-sk'));
    return;
  }
  if (way === 'spinner' || way === 'overlay' || way === 'progress') loader.append(span('fd-loader-words', words));
  loader.append(span(way === 'spinner' || way === 'overlay' ? 'fd-spin' : 'fd-bar'));
}
