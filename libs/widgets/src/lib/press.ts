/**
 * A press of the pointer going on in a document: down, or lifted with its click still to come. A box left by the
 * press — its focus going to the button pressed — may say or unsay words under itself as it is left: a refusal's hint,
 * its own problem, an answer rule's advice, a cell's, a property's or a range's message, the duration box's decimal
 * hours. Done at once, they move what is below, the button with them, and the press ends on something else: its click
 * is lost (Apply after a refused paste, Save after a name the box looked up, a tap on Submit as the email box says
 * "Enter an email address"). What moves the page as a box is left waits for the press to end (`afterPress`), so the
 * click lands where it was aimed — its own handlers first (Submit's check, a button's steps) — then it is done. Left by
 * the keys (Tab), or by a program, it is done at once, as always.
 *
 * THE one mechanism for every box that says something as it is left — or adds or takes a row away under itself: fields,
 * a plain table's cells and the grid's, properties, a date range's ends, a list's custom filter, the boxes' hints, a
 * phone's Call and WhatsApp, an amount's shorthand line, a proof's Send a code (the verify part), a possible
 * duplicate's note.
 */

/** How long after a press is lifted its click may still come, in ms: a phone's click follows the lift, the focus first. */
const CLICK_AFTER_LIFT_MS = 400;
/** A press held longer than this lets what waits go: the page never stays unsaid while a pointer rests on it. */
const LONGEST_MS = 1500;

interface Presses {
  /** A press is going on: down, or lifted and its click still to come. */
  pressing: boolean;
  /** What waits for the press to end, by who asked: the latest of each. */
  waiting: Map<object, () => void>;
  timer: ReturnType<typeof setTimeout> | undefined;
}

/** Kept on the document under a key every copy of this module shares: the main script's and a part's watch one press. */
const KEY = Symbol.for('fieldia.presses');
type Watched = Document & { [KEY]?: Presses };

function pressesOf(doc: Document): Presses {
  const found = (doc as Watched)[KEY];
  if (found) return found;
  const presses: Presses = { pressing: false, waiting: new Map(), timer: undefined };
  (doc as Watched)[KEY] = presses;
  const wait = (ms: number) => {
    clearTimeout(presses.timer);
    presses.timer = setTimeout(ended, ms);
  };
  /** The press has ended: what waited is done, after the click's own handlers. */
  function ended() {
    clearTimeout(presses.timer);
    presses.timer = undefined;
    presses.pressing = false;
    const waiting = [...presses.waiting.values()];
    presses.waiting.clear();
    for (const act of waiting) act();
  }
  doc.addEventListener(
    'pointerdown',
    (event) => {
      // A second finger, or a mouse's other buttons, press nothing.
      if ((event as PointerEvent).isPrimary === false || ((event as PointerEvent).pointerType === 'mouse' && (event as PointerEvent).button > 0)) return;
      presses.pressing = true;
      wait(LONGEST_MS);
    },
    true
  );
  // Lifted: its click comes now (a mouse's) or a moment later (a finger's, which may move the focus first).
  const lifted = (event: Event) => {
    if ((event as PointerEvent).isPrimary === false || !presses.pressing) return;
    wait(CLICK_AFTER_LIFT_MS);
  };
  doc.addEventListener('pointerup', lifted, true);
  doc.addEventListener('dragend', lifted, true);
  // Cancelled (a scroll took it), or a key pressed — Tab to the next box, the person's next step: the press is over.
  doc.addEventListener('pointercancel', () => presses.pressing && ended(), true);
  doc.addEventListener('keydown', () => presses.pressing && ended(), true);
  // Its click handled — Submit's check, a button's steps — first, then what waited.
  doc.addEventListener('click', () => presses.pressing && wait(0), true);
  return presses;
}

/**
 * Do `act` now, or — a press going on — once it ends, after the click it makes; asked again by the same `who`
 * meanwhile (a hint shown, then hidden), only the latest is done.
 */
export function afterPress(doc: Document, who: object, act: () => void): void {
  const presses = pressesOf(doc);
  if (!presses.pressing) {
    presses.waiting.delete(who);
    return act();
  }
  presses.waiting.set(who, act);
}

/** Start watching presses in `doc`, so a box left by the first press already waits for it. */
export function watchPresses(doc: Document): void {
  pressesOf(doc);
}
