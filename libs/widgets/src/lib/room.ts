/**
 * Where a popup opened from a box goes, one rule for all of them (Fieldia's own list, the country list, a date's
 * calendar, the filter menus, the search's suggestions): under its box where it fits there; over it where it does not
 * and there is more room above than below; kept inside the window, 8px from its edges, and as tall as the room on its
 * side allows — scrolling within where neither side holds it whole. A popup a phone shows as a sheet is not one of
 * these: its sheet is the whole width of the foot of the screen.
 */

/** Room kept between a popup and the window's edge. */
const EDGE = 8;
/** The least a popup is made to shrink to: a few rows to scroll. */
const LEAST = 96;

/** The side of its box a popup of `height` opens on, in a window `view` tall, and the most it may be (null: as it is). */
export function roomFor(box: { top: number; bottom: number }, height: number, gap: number, view: number): { up: boolean; most: number | null } {
  const below = view - box.bottom - gap - EDGE;
  const above = box.top - gap - EDGE;
  const up = height > below && above > below;
  const room = Math.max(0, up ? above : below);
  return { up, most: height > room ? Math.max(LEAST, Math.floor(room)) : null };
}

/**
 * A popup its stylesheet hangs under its box, opened just now: over the box instead (`data-up`, which its sheet turns
 * into a place over the box) where `roomFor` says so, and no taller than the room on its side (`data-cut`, scrolling
 * within). Read once, as it opens.
 */
export function openToRoom(popup: HTMLElement, box: HTMLElement, gap = 4): void {
  popup.removeAttribute('data-up');
  popup.removeAttribute('data-cut');
  popup.style.removeProperty('max-height');
  const doc = popup.ownerDocument;
  const view = doc.documentElement.clientHeight || doc.defaultView?.innerHeight || 0;
  const height = popup.getBoundingClientRect().height;
  if (!view || !height) return;
  const { up, most } = roomFor(box.getBoundingClientRect(), height, gap, view);
  if (up) popup.setAttribute('data-up', '');
  if (most === null) return;
  // Shorter than it would be: it scrolls within (`data-cut`, for a sheet whose box does not scroll of itself).
  popup.setAttribute('data-cut', '');
  popup.style.setProperty('max-height', `${most}px`);
}
