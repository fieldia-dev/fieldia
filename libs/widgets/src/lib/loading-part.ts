/**
 * The loading part (parts.ts): what a wait draws beyond words (loading.ts) — a skeleton (a few bars in a place, a form's
 * boxes under their labels, a page's layout while its parts come: page-skeleton.ts), a bar along the top or across the
 * middle, a spinner (a ring or three dots), the overlay over a form while it saves — and their sheet with its tokens
 * (styles-loading-part.ts); a loader over the middle of a place taller than the window, centred in what of it is in view. Asked for as a wait that draws from it starts, never waited for: until it has come, a wait
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

/** Loaders over the middle of the place they wait over — a ring, words, a bar across, the app's own drawing, the cover. */
const CENTRED = new Set(['spinner', 'text', 'custom', 'overlay', 'progress']);
/**
 * A loader over the middle of a place taller than the window shows it, centred in what of the place is in view when it
 * is drawn — never at the foot of a tall pane, below the fold (a record's ring at 878 of a 900 px window).
 */
export function centreInView(loader: HTMLElement, region: HTMLElement): void {
  const view = region.ownerDocument.defaultView;
  const way = loader.getAttribute('data-way') ?? '';
  if (!view || !CENTRED.has(way) || (way === 'progress' && loader.getAttribute('data-look') !== 'inline')) return;
  const box = region.getBoundingClientRect();
  const from = Math.max(0, -box.top);
  const to = Math.min(box.height, view.innerHeight - box.top);
  if (!box.height || to <= from || (from === 0 && to === box.height)) return;
  // Its middle where the part in view has its own: the grid centres it in what is left once one end is padded.
  const pad = from + to - box.height;
  loader.style.setProperty(pad > 0 ? 'padding-block-start' : 'padding-block-end', `${Math.round(Math.abs(pad))}px`);
}
