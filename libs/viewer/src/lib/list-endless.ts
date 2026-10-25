import type { El } from './dom';

/** How far under the window's foot the rows' end may be when the next page is asked for: a phone's thumb ahead. */
const AHEAD = '0px 0px 400px 0px';

/** A list's rows loaded as it is scrolled (`ListNode.endless`): its "Show 40 more" at their end, pressed by itself in sight. */
export interface EndlessRows {
  element: HTMLElement;
  /** The rows drawn: Show more says how many come next (`words`), or goes where none are left; in sight, they come. */
  drawn(left: number, words: string): void;
  /** Retry, pressed on a failure said here: asked again, and pressed by itself in sight once more after. */
  retry(): void;
  destroy(): void;
}

/**
 * The end of a list whose rows come as it is scrolled: a button that loads the next page — said in words ("Show 40
 * more"), pressed by a hand or the keys — pressed by itself as it comes in sight, a phone's thumb ahead, where the
 * browser can tell (IntersectionObserver); and again while it stays in sight once they came (a short page). Rows that
 * could not come (`more` answers false) are said here with Retry, and never asked for again by themselves: until the
 * person presses Retry or Show more, the end in sight asks nothing — the failure stays said.
 */
export function endlessRows(doc: Document, el: El, more: () => Promise<boolean | void>): EndlessRows {
  const button = el('button', { type: 'button', class: 'fd-button fd-button-link' });
  const element = el('div', { class: 'fd-list-more-rows', hidden: '' }, button);
  let asking = false;
  /** The last ask failed: nothing asks by itself until the person does. */
  let failed = false;
  const ask = async () => {
    if (asking || element.hidden) return;
    asking = true;
    let came: boolean | void;
    // Its wait is the list's, drawn here (`more`, loading.ts): the end busy, "Loading more…" in the button's place.
    try {
      came = await more();
    } finally {
      asking = false;
    }
    failed = came === false;
    // Still in sight once they came (a page shorter than the window): asked again — never after a failure.
    if (!failed && !element.hidden && seen) {
      watcher?.unobserve(element);
      watcher?.observe(element);
    }
  };
  /** The person's own ask: Show more, or Retry on a failure. */
  const pressed = () => {
    failed = false;
    void ask();
  };
  button.addEventListener('click', pressed);
  let seen = false;
  const View = doc.defaultView as (Window & typeof globalThis) | null;
  const watcher = View?.IntersectionObserver
    ? new View.IntersectionObserver(
        (entries) => {
          seen = entries.some((entry) => entry.isIntersecting);
          if (seen && !failed) void ask();
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
    retry: pressed,
    destroy: () => watcher?.disconnect(),
  };
}
