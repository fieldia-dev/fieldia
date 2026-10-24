import { roomFor } from './room';
/** Where a popup goes beside the control that opens it, when not just under it at its start. */
export interface PopupPlace {
  /** The box the popup lines up with, its start edge at that box's: the control that opens it unless said. */
  alignTo?: HTMLElement;
  /** At least as wide as that box, as a work tracker's lists are as wide as their value's box. */
  matchWidth?: boolean;
  /** Room between that box and the popup, in pixels: 4 unless said. */
  gap?: number;
}

/**
 * A small menu or palette under the control that opens it: in a form it
 * floats over the page from there, so a table's cell or a folded part never
 * clips it, and goes back into its widget when it closes. A press outside it
 * closes it. Near the window's foot, with more room above, it opens over its
 * control instead, and it is never taller than the room on its side
 * (room.ts): it stays inside the window.
 */
export function popup(home: HTMLElement, anchor: HTMLElement, box: HTMLElement, onClose: () => void, place: PopupPlace = {}) {
  const doc = home.ownerDocument;
  const outside = (event: Event) => {
    if (!box.contains(event.target as Node) && !anchor.contains(event.target as Node) && !place.alignTo?.contains(event.target as Node)) close();
  };
  function open() {
    box.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    const host = home.closest<HTMLElement>('.fd-form');
    const along = place.alignTo ?? anchor;
    if (place.matchWidth) box.style.minWidth = `${along.getBoundingClientRect().width}px`;
    if (host) {
      host.append(box);
      // Placed at its containing block's origin first, then moved from there to the anchor: right whatever block that is.
      Object.assign(box.style, { position: 'absolute', top: '0px', left: '0px', right: 'auto' });
      const [a, origin, own] = [along.getBoundingClientRect(), box.getBoundingClientRect(), box.offsetWidth];
      const rtl = getComputedStyle(home).direction === 'rtl';
      // Its edge at the anchor's, the start edge of the page's language; kept on the screen.
      const width = doc.documentElement.clientWidth || own;
      const at = Math.max(8, Math.min(rtl ? a.right - own : a.left, width - own - 8));
      // Under the anchor, or over it where there is not room below and more above; no taller than the room there.
      const gap = place.gap ?? 4;
      const view = doc.documentElement.clientHeight || doc.defaultView?.innerHeight || 0;
      const { up, most } = view ? roomFor(a, origin.height, gap, view) : { up: false, most: null };
      if (most !== null) box.style.setProperty('max-height', `${most}px`);
      const tall = most === null ? origin.height : box.offsetHeight;
      box.toggleAttribute('data-up', up);
      Object.assign(box.style, { top: `${up ? a.top - origin.top - gap - tall : a.bottom - origin.top + gap}px`, left: `${at - origin.left}px` });
    }
    doc.addEventListener('pointerdown', outside, true);
  }
  function close() {
    if (box.hidden) return;
    box.hidden = true;
    anchor.setAttribute('aria-expanded', 'false');
    if (box.parentElement !== home) {
      home.append(box);
      for (const key of ['position', 'top', 'left', 'right', 'max-height'] as const) box.style.removeProperty(key);
      box.removeAttribute('data-up');
    }
    if (place.matchWidth) box.style.removeProperty('min-width');
    doc.removeEventListener('pointerdown', outside, true);
    onClose();
  }
  return { open, close, isOpen: () => !box.hidden };
}
