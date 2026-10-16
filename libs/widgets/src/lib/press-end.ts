/**
 * What leaving a box shows — its own problem under it, an answer rule's advice
 * — waits, when the box is left for a press elsewhere, until that press has
 * ended. A tap on Submit takes the focus from the email box as the finger
 * comes down; were "Enter an email address" shown then, Submit would move
 * down by the message's height before the finger lifted, and the tap would
 * end on nothing: the press is lost. Shown once the press has ended — its
 * click handled, or a moment after it was lifted or cancelled — the press
 * lands where it began, and what it pressed checks the whole form at once.
 * Left by the keys (Tab), or by a program, it is shown at once, as always.
 */

/** How long after a press is lifted its click may still come, in ms: a phone's click follows the lift. */
const CLICK_AFTER_LIFT_MS = 400;

interface Presses {
  /** A press is going on: down, or lifted and its click still to come. */
  pressing: boolean;
  /** What waits for it to end. */
  waiting: (() => void)[];
  timer: ReturnType<typeof setTimeout> | undefined;
}

/** Kept on the document under a key every copy of this module shares: the main script's and a part's watch one press. */
const KEY = Symbol.for('fieldia.presses');
type Watched = Document & { [KEY]?: Presses };

function pressesOf(doc: Document): Presses {
  const found = (doc as Watched)[KEY];
  if (found) return found;
  const presses: Presses = { pressing: false, waiting: [], timer: undefined };
  (doc as Watched)[KEY] = presses;
  /** The press has ended: what waited runs, after the click's own handlers. */
  const ended = () => {
    clearTimeout(presses.timer);
    presses.timer = undefined;
    presses.pressing = false;
    const waiting = presses.waiting.splice(0);
    for (const run of waiting) run();
  };
  doc.addEventListener(
    'pointerdown',
    (event) => {
      if (!event.isPrimary) return;
      clearTimeout(presses.timer);
      presses.pressing = true;
    },
    true
  );
  // Lifted: its click comes now (a mouse's) or a moment later (a finger's, which may move the focus first).
  doc.addEventListener(
    'pointerup',
    (event) => {
      if (!event.isPrimary || !presses.pressing) return;
      clearTimeout(presses.timer);
      presses.timer = setTimeout(ended, CLICK_AFTER_LIFT_MS);
    },
    true
  );
  doc.addEventListener('pointercancel', () => presses.pressing && ended(), true);
  // Its click handled — Submit's check, a button's steps — first, then what waited.
  doc.addEventListener(
    'click',
    () => {
      if (!presses.pressing) return;
      clearTimeout(presses.timer);
      presses.timer = setTimeout(ended, 0);
    },
    true
  );
  return presses;
}

/** Run `show` now, or, while a pointer press is going on in `doc`, once it has ended. */
export function afterPress(doc: Document, show: () => void): void {
  const presses = pressesOf(doc);
  if (presses.pressing) presses.waiting.push(show);
  else show();
}

/** Start watching presses in `doc`, so a box left by the first press already waits for it. */
export function watchPresses(doc: Document): void {
  pressesOf(doc);
}
