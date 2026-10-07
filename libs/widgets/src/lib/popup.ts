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
      const [a, h] = [anchor.getBoundingClientRect(), host.getBoundingClientRect()];
      const rtl = getComputedStyle(home).direction === 'rtl';
      Object.assign(box.style, { position: 'absolute', top: `${a.bottom - h.top + 4}px`, insetInlineStart: rtl ? `${h.right - a.right}px` : `${a.left - h.left}px` });
    }
    doc.addEventListener('pointerdown', outside, true);
  }
  function close() {
    if (box.hidden) return;
    box.hidden = true;
    anchor.setAttribute('aria-expanded', 'false');
    if (box.parentElement !== home) home.append(box);
    doc.removeEventListener('pointerdown', outside, true);
    onClose();
  }
  return { open, close, isOpen: () => !box.hidden };
}
