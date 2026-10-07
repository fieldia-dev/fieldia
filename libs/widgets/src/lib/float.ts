/**
 * A list floating under the control it belongs to, over everything else: in
 * the page's top layer where the browser has one, so no scrolling table, grid
 * cell or folded part clips it. At least as wide as its control, above it when
 * there is more room there, kept on the screen, and following the control
 * while the page scrolls.
 */
export function floatUnder(anchor: HTMLElement, box: HTMLElement) {
  const doc = anchor.ownerDocument;
  const win = doc.defaultView;
  const topLayer = typeof box.showPopover === 'function';
  if (topLayer) box.setAttribute('popover', 'manual');
  let shown = false;

  function place() {
    const at = anchor.getBoundingClientRect();
    const width = doc.documentElement.clientWidth;
    const height = doc.documentElement.clientHeight;
    const [below, above] = [height - at.bottom - 10, at.top - 10];
    const up = below < 160 && above > below;
    Object.assign(box.style, {
      position: 'fixed',
      inset: 'auto',
      margin: '0',
      minWidth: `${Math.min(Math.max(at.width, 224), width - 16)}px`,
      maxWidth: `${Math.max(at.width, Math.min(448, width - 16))}px`,
      maxHeight: `${Math.max(96, Math.min(240, up ? above : below))}px`,
    });
    const own = box.offsetWidth;
    const rtl = win?.getComputedStyle(anchor).direction === 'rtl';
    const left = Math.max(8, Math.min(rtl ? at.right - own : at.left, width - own - 8));
    Object.assign(box.style, { left: `${left}px`, top: `${up ? at.top - 2 - box.offsetHeight : at.bottom + 2}px` });
  }
  // Its control gone (a grid's cell closed under it), it goes too.
  const follow = () => {
    if (!shown) return;
    if (!anchor.isConnected) return floating.hide();
    place();
  };

  const floating = {
    show() {
      box.hidden = false;
      if (topLayer && !box.matches(':popover-open')) box.showPopover();
      place();
      if (!shown) {
        doc.addEventListener('scroll', follow, true);
        win?.addEventListener('resize', follow);
      }
      shown = true;
    },
    /** Placed again: its words changed, and with them its height. */
    place: follow,
    hide() {
      if (topLayer && box.matches(':popover-open')) box.hidePopover();
      box.hidden = true;
      if (shown) {
        doc.removeEventListener('scroll', follow, true);
        win?.removeEventListener('resize', follow);
      }
      shown = false;
    },
  };
  return floating;
}
