/**
 * A press of the pointer going on in a document: down, not yet up. A box left by the press — its focus going to the
 * button pressed — may say or unsay words under itself as it is left; done at once, they move what is below, the
 * button with them, and the press ends on something else: its click is lost (Apply after a refused paste, Save after
 * a name the box looked up). What moves the page as a box is left waits for the press to end (`afterPress`), so the
 * click lands where it was aimed; then it is done.
 */

interface Presses {
  down: boolean;
  /** What waits for the press to end, by who asked: the latest of each. */
  waiting: Map<object, () => void>;
}

const tracked = new WeakMap<Document, Presses>();
/** A press held longer than this lets what waits go: the page never stays unsaid. */
const LONGEST_MS = 1500;

/** The presses of a document, heard from now on. */
export function pressesOf(doc: Document): Presses {
  const known = tracked.get(doc);
  if (known) return known;
  const presses: Presses = { down: false, waiting: new Map() };
  let cap: ReturnType<typeof setTimeout> | undefined;
  const end = () => {
    clearTimeout(cap);
    presses.down = false;
    const waiting = [...presses.waiting.values()];
    presses.waiting.clear();
    for (const act of waiting) act();
  };
  doc.addEventListener(
    'pointerdown',
    (event) => {
      // A mouse's other buttons press nothing.
      if (event.pointerType === 'mouse' && event.button > 0) return;
      presses.down = true;
      clearTimeout(cap);
      cap = setTimeout(end, LONGEST_MS);
    },
    true
  );
  // Released: the click the release makes is dispatched first, then what waited is done.
  const released = () => presses.down && setTimeout(end);
  doc.addEventListener('pointerup', released, true);
  doc.addEventListener('pointercancel', released, true);
  doc.addEventListener('dragend', released, true);
  tracked.set(doc, presses);
  return presses;
}

/** Do `act` now, or — a press going on — once it ends; asked again by the same `who` meanwhile, only the latest is done. */
export function afterPress(doc: Document, who: object, act: () => void): void {
  const presses = pressesOf(doc);
  if (!presses.down) {
    presses.waiting.delete(who);
    return act();
  }
  presses.waiting.set(who, act);
}
