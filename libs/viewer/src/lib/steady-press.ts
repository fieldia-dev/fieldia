/**
 * A press lands on what the person aimed at. Save hides itself the moment it
 * saves, and the button beside it slides into its place: the second click of a
 * double-click on Save would press that one — "Approve", "Confirm", "Block" —
 * though the person never saw it there. So a press on a button that has come
 * under a pointer that has not moved since it last saw what was there — the
 * button it pressed or rested on hid, moved or was drawn over — is not taken:
 * it goes nowhere, and the focus stays where it was. Presses there stay refused
 * for half a second; one after that is taken, as is any once the pointer moves
 * (a mouse more than a double-click's few pixels, a finger a tap's; a finger
 * lifts between taps, so a tap a second after the last is a new look). Nothing is
 * disabled or dimmed — the buttons show as they are — and a key (Enter, Space,
 * a button's own key) or a program's `click()` is never refused.
 */

/** How far, in CSS pixels, a second press may land from the first and still be the same press: a double-click's, a double tap's. */
const SLOP: Record<string, number> = { mouse: 4, pen: 4, touch: 16 };
/** How long presses on a button that came under a still pointer stay refused, from the first refused, in ms. */
const SETTLE_MS = 500;
/** A finger lifts between taps, so it is still only for a double tap's moment: a tap this long after the last is a new look, in ms. */
const TAP_MS = 1000;

/** What is pressed: a button, a link, a summary. */
const PRESSABLE = 'button, [role="button"], a[href], summary';

/** What the pointer last saw: where it was, the button under it then, and that button's place and words. */
interface Seen {
  x: number;
  y: number;
  /** When it was seen. */
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
  let seen: Seen | null = null;
  /** When the first press since the pointer last saw what was there was refused; null when none was. */
  let refusedAt: number | null = null;
  /** The press refused: its mousedown and its click go nowhere. */
  let swallow = false;

  const pressable = (target: EventTarget | null): Element | null => (target instanceof Element ? target.closest(PRESSABLE) : null);
  const slop = (event: PointerEvent) => SLOP[event.pointerType] ?? SLOP['mouse'];
  const far = (event: PointerEvent, from: Seen) => Math.hypot(event.clientX - from.x, event.clientY - from.y) > slop(event);

  function look(event: PointerEvent) {
    const button = pressable(event.target);
    const rect = button?.getBoundingClientRect();
    seen = {
      x: event.clientX,
      y: event.clientY,
      at: now(),
      button,
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      words: button?.textContent ?? '',
    };
    refusedAt = null;
  }

  /** Whether `now` is the button that was seen there: the same one, or one drawn again in its place with its words. */
  function stayed(was: Seen, button: Element): boolean {
    if (was.button === button) return true;
    if (!was.button || was.button.isConnected || !was.rect) return false;
    const rect = button.getBoundingClientRect();
    const same = (a: number, b: number) => Math.abs(a - b) < 1;
    return was.words === (button.textContent ?? '') && same(rect.x, was.rect.x) && same(rect.y, was.rect.y) && same(rect.width, was.rect.width) && same(rect.height, was.rect.height);
  }

  const onMove = (event: PointerEvent) => {
    // A finger only moves while it is down: a tap elsewhere is seen at its press.
    if (event.pointerType === 'touch' || !event.isPrimary) return;
    if (!seen || far(event, seen)) look(event);
  };

  const onDown = (event: PointerEvent) => {
    swallow = false;
    if (!event.isPrimary) return;
    const button = pressable(event.target);
    const was = seen;
    const at = now();
    const still = was && !far(event, was) && (event.pointerType !== 'touch' || at - was.at < TAP_MS);
    if (button && scope.contains(button) && was && still && !stayed(was, button)) {
      refusedAt ??= at;
      if (at - refusedAt < SETTLE_MS) {
        swallow = true;
        return;
      }
    }
    look(event);
  };

  const onMouseDown = (event: MouseEvent) => {
    // Its focus stays where it was: the button it fell on was never chosen.
    if (swallow) event.preventDefault();
  };

  const onClick = (event: MouseEvent) => {
    if (!swallow) return;
    swallow = false;
    // A click made by a key or a program has no pointer, and is the person's (or the app's) own.
    if (event.detail === 0) return;
    const button = pressable(event.target);
    if (!button || !scope.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onKey = () => {
    swallow = false;
  };

  doc.addEventListener('pointermove', onMove, true);
  doc.addEventListener('pointerdown', onDown, true);
  doc.addEventListener('mousedown', onMouseDown, true);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKey, true);
  return () => {
    doc.removeEventListener('pointermove', onMove, true);
    doc.removeEventListener('pointerdown', onDown, true);
    doc.removeEventListener('mousedown', onMouseDown, true);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('keydown', onKey, true);
  };
}
