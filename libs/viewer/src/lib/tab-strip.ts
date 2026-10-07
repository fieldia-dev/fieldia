import type { El } from './dom';
import { setAttr, setHidden } from './dom';

/** Room kept beside a tab brought into sight: the button over that edge and the fade beside it. */
const EDGE = 64;

export interface TabStrip {
  /** The tabs' list with a button at each edge: what goes on the page. */
  element: HTMLElement;
  /** Look again at what is past each edge: after the tabs shown change, or the strip's width. */
  measure(): void;
  /** Scroll the strip, and only the strip, so this tab is in sight. */
  reveal(tab: HTMLElement): void;
  destroy(): void;
}

/**
 * A row of tabs too long for its room scrolls sideways: past an edge with more
 * beyond it, the tabs fade out under a button that moves the strip a width
 * along — to the left at the start of a right-to-left page. The buttons are
 * for a pointer: the keyboard moves along the tabs, which come into sight.
 */
export function tabStrip(list: HTMLElement, el: El): TabStrip {
  const rtl = () => list.closest('[dir]')?.getAttribute('dir') === 'rtl';
  const edge = (side: 'before' | 'after') =>
    el('button', { type: 'button', class: `fd-tabs-scroll fd-tabs-${side}`, tabindex: '-1', 'aria-hidden': 'true', hidden: '' });
  const before = edge('before');
  const after = edge('after');
  const element = el('div', { class: 'fd-tabbar' }, before, list, after);
  // A strip's width along, less a tab's room, toward the button's own edge.
  const move = (toward: 1 | -1) => list.scrollBy({ left: toward * (rtl() ? -1 : 1) * Math.max(list.clientWidth - 2 * EDGE, EDGE), behavior: 'smooth' });
  before.addEventListener('click', () => move(-1));
  after.addEventListener('click', () => move(1));

  function measure() {
    // How far along from the start: right to left, scrollLeft runs from 0 down.
    const along = Math.abs(list.scrollLeft);
    const start = along > 1;
    const end = along + list.clientWidth < list.scrollWidth - 1;
    setHidden(before, !start);
    setHidden(after, !end);
    const more = [start && 'start', end && 'end'].filter(Boolean).join(' ');
    setAttr(element, 'data-more', more || null);
  }

  function reveal(tab: HTMLElement) {
    if (!list.clientWidth || list.scrollWidth <= list.clientWidth) return;
    const room = list.getBoundingClientRect();
    const at = tab.getBoundingClientRect();
    // Either way round, a larger scrollLeft shows what is further right.
    if (at.left < room.left + EDGE) list.scrollLeft += at.left - room.left - EDGE;
    else if (at.right > room.right - EDGE) list.scrollLeft += at.right - room.right + EDGE;
    measure();
  }

  list.addEventListener('scroll', measure, { passive: true });
  const view = list.ownerDocument.defaultView;
  const watcher = view && 'ResizeObserver' in view ? new view.ResizeObserver(() => measure()) : null;
  watcher?.observe(list);

  return { element, measure, reveal, destroy: () => watcher?.disconnect() };
}
