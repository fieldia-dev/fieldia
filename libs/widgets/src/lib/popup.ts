/**
 * A small menu or palette under the control that opens it: in a form it
 * floats over the page from there, so a table's cell or a folded part never
 * clips it, and goes back into its widget when it closes. A press outside it
 * closes it.
 */
export function popup(home: HTMLElement, anchor: HTMLElement, box: HTMLElement, onClose: () => void) {
  const doc = home.ownerDocument;
  const outside = (event: Event) => {
    if (!box.contains(event.target as Node) && !anchor.contains(event.target as Node)) close();
  };
  function open() {
    box.hidden = false;
    anchor.setAttribute('aria-expanded', 'true');
    const host = home.closest<HTMLElement>('.fd-form');
    if (host) {
      host.append(box);
      // Placed at its containing block's origin first, then moved from there to the anchor: right whatever block that is.
      Object.assign(box.style, { position: 'absolute', top: '0px', left: '0px', right: 'auto' });
      const [a, origin, own] = [anchor.getBoundingClientRect(), box.getBoundingClientRect(), box.offsetWidth];
      const rtl = getComputedStyle(home).direction === 'rtl';
      // Its edge at the anchor's, the start edge of the page's language; kept on the screen.
      const width = doc.documentElement.clientWidth || own;
      const at = Math.max(8, Math.min(rtl ? a.right - own : a.left, width - own - 8));
      Object.assign(box.style, { top: `${a.bottom - origin.top + 4}px`, left: `${at - origin.left}px` });
    }
    doc.addEventListener('pointerdown', outside, true);
  }
  function close() {
    if (box.hidden) return;
    box.hidden = true;
    anchor.setAttribute('aria-expanded', 'false');
    if (box.parentElement !== home) {
      home.append(box);
      for (const key of ['position', 'top', 'left', 'right'] as const) box.style.removeProperty(key);
    }
    doc.removeEventListener('pointerdown', outside, true);
    onClose();
  }
  return { open, close, isOpen: () => !box.hidden };
}
