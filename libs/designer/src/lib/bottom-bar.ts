/** The air left between a control and the bar at the foot of the screen. */
const AIR = 8;

/**
 * A bar kept at the foot of the screen (`position: sticky` with a `bottom`) never hides what a person works on, and
 * keeping it clear never hides it under the bar at the top instead (WCAG 2.4.11, both ways). A control focused in the
 * area the bar floats over — by Tab or Shift+Tab, by a press — is moved up from behind the bar once the engine's own
 * scroll on focus is done (that scroll knows nothing of it), but never so far that its top goes under the room the
 * top bar keeps (the scroller's `scroll-padding-top`, the designer bar's): where it cannot fit between the two, its
 * top wins. The bar stays where it is; the area's end is the bar's own place in the flow, where it rests once the area
 * is scrolled to its end. Where the bar is not at the foot (sticky no longer: a wide screen's rail beside its card),
 * nothing is moved.
 *
 * No `scroll-margin-bottom` on what is focused: an element taller than the room between the bars would then be
 * aligned by its end as the engine scrolls to it — walking up by Shift+Tab, its top under the top bar.
 */
export function keepClearOfBar(bar: HTMLElement, area: HTMLElement): () => void {
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
  const onFocus = (event: FocusEvent) => {
    const control = event.target as HTMLElement | null;
    if (!control?.getBoundingClientRect || !view) return;
    // After the engine's own scroll on focus, which comes after the focus event.
    view.requestAnimationFrame(() => {
      if (barRoom(area) && view.document.activeElement === control) clearOfBar(bar, control);
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
 * The scroller that can move an element up by `by`: its nearest ancestor that scrolls up and down with that much room
 * left — a row of tabs that scrolls sideways is no such scroller, though its `overflow-y` reads `auto` — else the page.
 */
function scrollerOf(element: HTMLElement, by: number): HTMLElement | null {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  for (let at = element.parentElement; at && at !== doc.body && at !== doc.documentElement; at = at.parentElement) {
    const overflow = view?.getComputedStyle(at).overflowY ?? 'visible';
    if ((overflow === 'auto' || overflow === 'scroll') && at.scrollHeight - at.clientHeight - at.scrollTop >= by) return at;
  }
  return null;
}

/**
 * An element moved up from behind the bar at the foot (with a little air), as far as that takes — but its top never
 * under the room its scroller keeps at its top (`scroll-padding-top`: the designer bar's, on the page). Where both
 * cannot hold, the top wins. Nothing moves for an element clear of the bar already.
 */
export function clearOfBar(bar: HTMLElement, element: HTMLElement): void {
  const box = element.getBoundingClientRect();
  const limit = bar.getBoundingClientRect().top - AIR;
  if (box.bottom <= limit) return;
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  const want = box.bottom - limit;
  const own = scrollerOf(element, want);
  const scroller = own ?? ((doc.scrollingElement as HTMLElement | null) ?? doc.documentElement);
  const top = (own ? own.getBoundingClientRect().top : 0) + (parseFloat(view?.getComputedStyle(scroller).scrollPaddingTop ?? '') || 0);
  const by = Math.min(want, box.top - top);
  if (by <= 0) return;
  if (own) own.scrollTop += by;
  else view?.scrollBy(0, by);
}

/** The room the bar takes now, as `keepClearOfBar` measured it: 0 where it is not at the foot. */
export const barRoom = (area: HTMLElement): number => parseFloat(area.style.getPropertyValue('--fd-foot-room')) || 0;
