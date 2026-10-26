/** Where a floating list goes and how big it is, when not as most lists are. */
export interface FloatPlace {
  /** Exactly as wide as its control, as a work tracker's path picker is: at least its control's width, and 224px, unless said. */
  sameWidth?: boolean;
  /** Its tallest, in pixels, room allowing: 240 unless said. */
  maxHeight?: number;
  /** Room between the control and the list, in pixels: 2 unless said. */
  gap?: number;
}

/**
 * A list floating under the control it belongs to, over everything else: in
 * the page's top layer where the browser has one, so no scrolling table, grid
 * cell or folded part clips it. At least as wide as its control, above it when
 * there is more room there, kept on the screen, and following the control
 * wherever it goes while the list is open: a scroll, a resize, or the page
 * moving it some other way (a line added above, a screenshot's resize).
 */
export function floatUnder(anchor: HTMLElement, box: HTMLElement, look: FloatPlace = {}) {
  const doc = anchor.ownerDocument;
  const win = doc.defaultView;
  const topLayer = typeof box.showPopover === 'function';
  if (topLayer) box.setAttribute('popover', 'manual');
  let shown = false;
  /** Where the control was when the list was last placed, watched each frame while it is open. */
  let placedAt = '';
  let watching = 0;

  function place() {
    const at = anchor.getBoundingClientRect();
    const width = doc.documentElement.clientWidth;
    const height = doc.documentElement.clientHeight;
    const [below, above] = [height - at.bottom - 10, at.top - 10];
    const up = below < 160 && above > below;
    const gap = look.gap ?? 2;
    Object.assign(box.style, {
      position: 'fixed',
      inset: 'auto',
      margin: '0',
      minWidth: `${look.sameWidth ? at.width : Math.min(Math.max(at.width, 224), width - 16)}px`,
      maxWidth: `${look.sameWidth ? at.width : Math.max(at.width, Math.min(448, width - 16))}px`,
      maxHeight: `${Math.max(96, Math.min(look.maxHeight ?? 240, up ? above : below))}px`,
    });
    placedAt = `${at.left},${at.top},${at.width},${width},${height}`;
    const own = box.offsetWidth;
    const rtl = win?.getComputedStyle(anchor).direction === 'rtl';
    const left = Math.max(8, Math.min(rtl ? at.right - own : at.left, width - own - 8));
    Object.assign(box.style, { left: `${left}px`, top: `${up ? at.top - gap - box.offsetHeight : at.bottom + gap}px` });
  }
  // Its control gone (a grid's cell closed under it), it goes too.
  const follow = () => {
    if (!shown) return;
    if (!anchor.isConnected) return floating.hide();
    place();
  };
  // Moved by anything but a scroll or a resize, it is placed again on the next frame.
  const watch = () => {
    if (!shown) return;
    const at = anchor.getBoundingClientRect();
    if (`${at.left},${at.top},${at.width},${doc.documentElement.clientWidth},${doc.documentElement.clientHeight}` !== placedAt) follow();
    watching = win?.requestAnimationFrame(watch) ?? 0;
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
      if (!watching && win?.requestAnimationFrame) watching = win.requestAnimationFrame(watch);
    },
    /** Placed again: its words changed, and with them its height. */
    place: follow,
    hide() {
      if (topLayer && box.matches(':popover-open')) box.hidePopover();
      // Hidden already, nothing is written: a closed list closed again at each change of its form writes nothing.
      if (!box.hidden) box.hidden = true;
      if (shown) {
        doc.removeEventListener('scroll', follow, true);
        win?.removeEventListener('resize', follow);
      }
      if (watching) win?.cancelAnimationFrame(watching);
      watching = 0;
      shown = false;
    },
  };
  return floating;
}
