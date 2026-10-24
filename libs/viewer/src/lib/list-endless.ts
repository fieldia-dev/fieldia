import type { El } from './dom';

/** How far under the window's foot the rows' end may be when the next page is asked for: a phone's thumb ahead. */
const AHEAD = '0px 0px 400px 0px';

/** A list's rows loaded as it is scrolled (`ListNode.endless`): its "Show 40 more" at their end, pressed by itself in sight. */
export interface EndlessRows {
  element: HTMLElement;
  /** The rows drawn: Show more says how many come next (`words`), or goes where none are left; in sight, they come. */
  drawn(left: number, words: string): void;
  destroy(): void;
}

/**
 * The end of a list whose rows come as it is scrolled: a button that loads the next page — said in words ("Show 40
 * more"), pressed by a hand or the keys — pressed by itself as it comes in sight, a phone's thumb ahead, where the
 * browser can tell (IntersectionObserver); and again while it stays in sight once they came (a short page).
 */
export function endlessRows(doc: Document, el: El, more: () => Promise<void>): EndlessRows {
  const button = el('button', { type: 'button', class: 'fd-button fd-button-link' });
  const element = el('div', { class: 'fd-list-more-rows', hidden: '' }, button);
  let asking = false;
  const ask = async () => {
    if (asking || element.hidden) return;
    asking = true;
    // Its wait is the list's, drawn here (`more`, loading.ts): the end busy, "Loading more…" in the button's place.
    try {
      await more();
    } finally {
      asking = false;
    }
    // Still in sight once they came (a page shorter than the window): asked again.
    if (!element.hidden && seen) {
      watcher?.unobserve(element);
      watcher?.observe(element);
    }
  };
  button.addEventListener('click', () => void ask());
  let seen = false;
  const View = doc.defaultView as (Window & typeof globalThis) | null;
  const watcher = View?.IntersectionObserver
    ? new View.IntersectionObserver(
        (entries) => {
          seen = entries.some((entry) => entry.isIntersecting);
          if (seen) void ask();
        },
        { rootMargin: AHEAD }
      )
    : null;
  watcher?.observe(element);
  return {
    element,
    drawn(left, words) {
      element.hidden = left <= 0;
      if (!element.hidden) button.textContent = words;
    },
    destroy: () => watcher?.disconnect(),
  };
}
