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
 * duplicate's note — and a part a condition shows or hides (the viewer's `shownAsItsCondition`).
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
  /** The control pressed last, and when (`pressedControl`). */
  last?: { control: Element; at: number };
  /** The controls a press waits on, each with what ends its wait (`pressWait`). */
  waits: Map<Element, () => void>;
}

/** Kept on the document under a key every copy of this module shares: the main script's and a part's watch one press. */
const KEY = Symbol.for('fieldia.presses');
type Watched = Document & { [KEY]?: Presses };

function pressesOf(doc: Document): Presses {
  const found = (doc as Watched)[KEY];
  if (found) return found;
  const presses: Presses = { pressing: false, waiting: new Map(), timer: undefined, waits: new Map() };
  (doc as Watched)[KEY] = presses;
  // The control a click or a key presses, before its own handlers: an option of a box's list stands for its box, which
  // outlives the list it closes.
  const pressed = (event: Event) => {
    let at = event.target as Element | null;
    const list = at?.closest?.('[role="option"]') && at.closest('[role="listbox"]');
    if (list && list.id) at = doc.querySelector(`[aria-controls="${list.id}"]`) ?? at;
    const control = at?.closest?.(CONTROL);
    if (control) presses.last = { control, at: Date.now() };
  };
  doc.addEventListener('click', pressed, true);
  doc.addEventListener('keydown', (event) => ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') && pressed(event), true);
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
  // Its click handled — Submit's check, a button's steps — first, then what waited. The press is over as its click
  // comes: what the click itself changes (a switch's question shown, a step's badge) is done at once, as it moves
  // nothing a press is aimed at any more.
  doc.addEventListener('click', () => presses.pressing && ((presses.pressing = false), wait(0)), true);
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

/** What a press is waited on in: a button, a link, a box (an option of its list stands for it). */
const CONTROL = 'button, [role="button"], a[href], [role="combobox"]';
/** How long after its press a control still stands for what asks: a press's handlers may wait a few turns first. */
const PRESSED_MS = 1000;

/**
 * The control a person pressed just now in `doc`: the press its watch saw last, a moment ago at most — WebKit focuses no
 * button it clicks — else the focus's.
 */
export function pressedControl(doc: Document | undefined): Element | null {
  if (!doc) return null;
  const last = pressesOf(doc).last;
  if (last && last.control.isConnected && Date.now() - last.at < PRESSED_MS) return last.control;
  return doc.activeElement?.closest(CONTROL) ?? null;
}

/**
 * THE rule for a control a press waits on — a part on its way, then the app's answer (a link's record, a line's form):
 * `aria-busy`, and a ring turning in its place from the press, where the eye is — over an icon's glyph, at the end of a
 * name's words or of a box (its own buttons hidden meanwhile), a button's own ring at once. Never over the page, and
 * nothing moves for it. Ended by what it hands back: as its wait ends, or as a dialog shows over the page
 * (`dialogShown`). A second press of it meanwhile asks nothing more where the caller asks `pressing` first.
 */
export function pressWait(control: Element | null | undefined): () => void {
  const doc = control?.ownerDocument;
  const waits = doc && pressesOf(doc).waits;
  if (!control || !doc || !waits || waits.has(control)) return () => undefined;
  const box = control.matches('input, [role="combobox"]');
  const holder = (box && control.parentElement) || control;
  const way = box ? 'box' : control.classList.contains('fd-button') ? 'button' : (control.textContent ?? '').trim().length > 2 ? 'words' : 'icon';
  const busy = !control.hasAttribute('aria-busy');
  if (busy) control.setAttribute('aria-busy', 'true');
  holder.setAttribute('data-fd-pressing', way);
  // Fieldia's own controls: an app's own button, which asked for a dialog, is busy alone, its look its own.
  const ring = way === 'button' || !holder.closest('.fd-form') ? null : doc.createElement('span');
  if (ring) {
    ring.className = 'fd-pressing';
    ring.setAttribute('aria-hidden', 'true');
    holder.append(ring);
  }
  const end = () => {
    if (waits.get(control) !== end) return;
    waits.delete(control);
    if (busy) control.removeAttribute('aria-busy');
    holder.removeAttribute('data-fd-pressing');
    ring?.remove();
  };
  waits.set(control, end);
  return end;
}

/** Whether a press waits on `control` now: a second press asks nothing more. */
export const pressing = (control: Element | null | undefined): boolean => !!control?.ownerDocument && pressesOf(control.ownerDocument).waits.has(control);

/** A dialog shown over the page: every press waiting in it is answered, its ring gone under the dialog. */
export function dialogShown(doc: Document): void {
  for (const end of [...pressesOf(doc).waits.values()]) end();
}
