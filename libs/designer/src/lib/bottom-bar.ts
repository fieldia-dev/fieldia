/** The air left between a control scrolled into view and the bar over it. */
const AIR = 8;

/**
 * A bar kept at the foot of the screen (`position: sticky` with a `bottom`) never hides what a person works on. The
 * area it floats over is told the room the bar takes — its height, its gap above the screen's edge with the screen's
 * safe area (its `bottom`), and a little air over it (`--fd-foot-room`) — and keeps its own controls clear of it as they
 * are scrolled into view, by the browser on focus (Tab to a switch) or by the editor (a card picked): each stops above
 * the bar (`.fd-bar-clear`'s `scroll-margin`). The bar stays where it is; the area's end is the bar's own place in the
 * flow, where it rests once the area is scrolled to its end. Where the bar is not at the foot (sticky no longer: a wide
 * screen's rail beside its card), the room is none.
 *
 * The scroll area is the page's, the app's: its `scroll-padding` is not the editor's to set, so the room is kept on
 * what is scrolled into view (`scroll-margin`), which `scrollIntoView` honours as it would `scroll-padding`; a control
 * an engine's own scroll on focus leaves behind the bar is scrolled out by the area itself.
 */
export function keepClearOfBar(bar: HTMLElement, area: HTMLElement): () => void {
  area.classList.add('fd-bar-clear');
  const view = bar.ownerDocument.defaultView;
  /** Whether the bar has been in the page: once taken out of it (a new drawer in its place), the watch ends. */
  let placed = false;
  const measure = () => {
    if (!bar.isConnected) return placed ? stop() : undefined;
    placed = true;
    const style = view?.getComputedStyle(bar);
    const atFoot = !!style && style.position === 'sticky' && style.bottom !== 'auto' && !bar.hidden;
    const room = atFoot ? Math.ceil(bar.getBoundingClientRect().height + (parseFloat(style.bottom) || 0) + AIR) : 0;
    area.style.setProperty('--fd-foot-room', `${room}px`);
  };
  // A control focused behind the bar — where the engine's own scroll on focus, which comes after the focus event and
  // knows nothing of the bar, left it (WebKit's text boxes, Chromium's lists) — is scrolled out from under it once that
  // scroll is done, its scroll margin stopping it above.
  const onFocus = (event: FocusEvent) => {
    const control = event.target as HTMLElement | null;
    if (!control?.getBoundingClientRect || !view) return;
    view.requestAnimationFrame(() => {
      if (!barRoom(area) || view.document.activeElement !== control) return;
      if (underBar(bar, control)) control.scrollIntoView?.({ block: 'end' });
    });
  };
  area.addEventListener('focusin', onFocus);
  const ResizeWatcher = (view as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)?.ResizeObserver;
  const watcher = ResizeWatcher ? new ResizeWatcher(measure) : null;
  // The bar's own size, and the area's width: a container query that puts the bar at the foot or takes it away.
  watcher?.observe(bar);
  watcher?.observe(area);
  measure();
  function stop() {
    watcher?.disconnect();
    area.removeEventListener('focusin', onFocus);
    area.style.removeProperty('--fd-foot-room');
  }
  return stop;
}

/**
 * Whether an element ends behind the bar (or below it): scrolled to `end` — never `nearest`, which Chromium leaves as it
 * is while the element itself is in the window, under the bar or not — its scroll margin then stops it above the bar.
 */
export const underBar = (bar: HTMLElement, element: HTMLElement): boolean => element.getBoundingClientRect().bottom > bar.getBoundingClientRect().top;

/** The room the bar takes now, as `keepClearOfBar` measured it: 0 where it is not at the foot. */
export const barRoom = (area: HTMLElement): number => parseFloat(area.style.getPropertyValue('--fd-foot-room')) || 0;
