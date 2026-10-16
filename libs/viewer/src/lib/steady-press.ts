/**
 * A press lands on what the person aimed at. Save hides itself the moment it
 * saves, and the button beside it slides into its place: the second click of a
 * double-click on Save would press that one — "Approve", "Confirm", "Block" —
 * though the person never saw it there. So a click that goes on a double or a
 * triple click (the browser counts them: the pointer not moved past a few
 * pixels, the clicks a moment apart) is not taken by a bar's button that was
 * not where the first click of it landed — it goes nowhere, and the focus
 * stays where it was. A finger's double tap the same: a second tap a moment
 * after the first, where it landed, on a bar's button that came there since.
 * A single click is always taken, wherever the button came from, and so is a
 * key (Enter, Space, a button's own key) or a program's `click()`. Nothing is
 * disabled or dimmed: the buttons show as they are.
 */

/** How far, in CSS pixels, a second tap may land from the first and still be a double tap. */
const TAP_SLOP = 16;
/** How long after a tap a second one is a double tap, in ms. */
const TAP_MS = 500;

/** What is pressed: a button, a link, a summary. */
const PRESSABLE = 'button, [role="button"], a[href], summary';
/**
 * The bars whose buttons hide and show as the record changes, so that one slides into another's place: a sheet's
 * header (Save, Discard, the record's buttons, its statusbar), a page's actions and foot, a wizard's Back and Next,
 * the bar over a record, a work item's head, a dialog's head and foot, a question's Cancel and OK. A line's × in a
 * table is not one of them: lines deleted one after another, each × coming up under the pointer, are deleted.
 */
const BARS = '.fd-header, .fd-actions, .fd-wizard-nav, .fd-page-footer, .fd-record-bar, .fd-head-actions, .fd-form-dialog-head, .fd-form-dialog-foot';

/** Where a press landed and what it landed on: the button, its place and its words. */
interface Landed {
  x: number;
  y: number;
  at: number;
  button: Element | null;
  rect: { x: number; y: number; width: number; height: number } | null;
  words: string;
}

/**
 * Keep presses inside `scope` to what was under the pointer. Returns what
 * stops it. `now` is the clock, for tests.
 */
export function steadyPresses(scope: HTMLElement, now: () => number = () => scope.ownerDocument.defaultView?.performance.now() ?? Date.now()): () => void {
  const doc = scope.ownerDocument;
  /** Where the first click of the click going on landed (a mouse's), or the last tap (a finger's). */
  let first: Landed | null = null;
  let lastTap: Landed | null = null;
  /** The press refused: its mousedown and its click go nowhere. */
  let swallow = false;
  /** The pointer of the press going on. */
  let pointerType = 'mouse';

  const pressable = (target: EventTarget | null): Element | null => (target instanceof Element ? target.closest(PRESSABLE) : null);
  /** A bar's button of this scope: one that may have slid into another's place. */
  const barred = (button: Element | null): button is Element => !!button && scope.contains(button) && !!button.closest(BARS);

  function land(event: MouseEvent, button: Element | null): Landed {
    const rect = button?.getBoundingClientRect();
    return { x: event.clientX, y: event.clientY, at: now(), button, rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null, words: button?.textContent ?? '' };
  }

  /** Whether `button` is the one that was there: the same, or one drawn again in its place with its words. */
  function stayed(was: Landed, button: Element): boolean {
    if (was.button === button) return true;
    if (!was.button || was.button.isConnected || !was.rect) return false;
    const rect = button.getBoundingClientRect();
    const same = (a: number, b: number) => Math.abs(a - b) < 1;
    return was.words === (button.textContent ?? '') && same(rect.x, was.rect.x) && same(rect.y, was.rect.y) && same(rect.width, was.rect.width) && same(rect.height, was.rect.height);
  }

  const onPointerDown = (event: PointerEvent) => {
    swallow = false;
    if (!event.isPrimary) return;
    pointerType = event.pointerType || 'mouse';
    if (pointerType !== 'touch') return;
    // A finger: a second tap where the first landed, a moment after it, on a bar's button that came there since.
    const button = pressable(event.target);
    const was = lastTap;
    const double = !!was && now() - was.at < TAP_MS && Math.hypot(event.clientX - was.x, event.clientY - was.y) <= TAP_SLOP;
    if (double && barred(button) && !stayed(was as Landed, button)) {
      swallow = true;
      return;
    }
    lastTap = land(event, button);
  };

  const onMouseDown = (event: MouseEvent) => {
    if (pointerType === 'touch') {
      // Its focus stays where it was: the button it fell on was never chosen.
      if (swallow) event.preventDefault();
      return;
    }
    const button = pressable(event.target);
    // The browser's count of the clicks going on: 1 starts one, 2 and on go on with it where it began.
    if (event.detail <= 1 || !first) {
      swallow = false;
      first = land(event, button);
      return;
    }
    swallow = barred(button) && !stayed(first, button);
    if (swallow) event.preventDefault();
  };

  const onClick = (event: MouseEvent) => {
    if (!swallow) return;
    swallow = false;
    // A click made by a key or a program has no pointer, and is the person's (or the app's) own.
    if (event.detail === 0) return;
    if (!barred(pressable(event.target))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onKey = () => {
    swallow = false;
  };

  doc.addEventListener('pointerdown', onPointerDown, true);
  doc.addEventListener('mousedown', onMouseDown, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKey, true);
  return () => {
    doc.removeEventListener('pointerdown', onPointerDown, true);
    doc.removeEventListener('mousedown', onMouseDown, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('keydown', onKey, true);
  };
}
