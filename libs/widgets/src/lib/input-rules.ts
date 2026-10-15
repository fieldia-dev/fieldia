import {
  cleanPastedNumber,
  couldBeNumber,
  decimalsWords,
  fill,
  MESSAGES,
  numberMisfit,
  readDuration,
  readNumber,
  stripMarks,
  type Locale,
  type Messages,
  type NumberLimits,
  type NumberRefusal,
} from '@fieldia/core';
import { fillIn, setAttr, wordsFor } from './kind-parts';
import type { WidgetLabels } from './labels';
import { formatNumber } from './numbers';

/**
 * The box's side of Fieldia's input rules: what a box refuses as it is typed
 * in, pasted into or dropped on, and the hint that says why. The reading
 * itself is @fieldia/core's (readNumber, couldBeNumber, cleanPastedNumber…),
 * so every box — a field, a table's cell, a filter, a designer's setting —
 * reads and refuses alike.
 *
 * A refused keystroke never lands: a short hint shows under the box, in the
 * page's language, in a polite live region and in the box's
 * aria-describedby, and goes at the next keystroke taken or when the box is
 * left. Never a dialog, never a disabled box, never a beep. A paste that
 * cannot be taken whole is refused whole, and the hint quotes it. Keyboards
 * whose edits cannot be stopped (an IME, a phone's) are put back to the last
 * text taken, caret and all, with the same hint.
 *
 * A box holds what is typed after a refused key at the same place (`hold`):
 * refused too, with the same words, so "1.5" typed into a box of whole numbers
 * never becomes 15, nor "-3" 3, nor "+20 1oo 123" a phone number of other
 * digits. The hold holds whichever way text comes: keys, a paste or a drop
 * there (joined to the keys held, the words said again), an IME's or a phone
 * keyboard's text (put back, and held with them), an autocorrection (refused
 * while keys are held, with the same words). Backspace takes the keys held
 * back one by one, a word's or a line's deletion and Undo all of them; a
 * deletion after the caret leaves them held; moving the caret lets them go.
 * Left while it holds them, the hint stays (nothing under the pointer moves as
 * the box is left), and the box is left with all that was typed, which its
 * widget reads and marks with why.
 *
 * Enter in a one-line box types nothing: it is never judged, held or stopped,
 * so it sends the form, or moves to the next field, as the page has it.
 */

/** The hint under a box that says why a keystroke or a paste was refused. */
export interface RefusalHint {
  readonly element: HTMLElement;
  readonly id: string;
  /** The words shown now: empty while hidden. */
  readonly words: string;
  /** Show these words, said politely. */
  show(words: string): void;
  hide(): void;
  /** The box's own aria-describedby (`base`) with the hint's while it shows. */
  describedBy(base: string | undefined): string | undefined;
}

/**
 * A hint for `box`, placed right after `anchor` (the box itself, or what its
 * widget wraps it in) the first time the box is entered: in the page by then,
 * and before anything is said, so a screen reader hears it.
 */
export function refusalHint(box: HTMLElement, anchor: HTMLElement = box): RefusalHint {
  const document = box.ownerDocument;
  const id = `${box.id || `fd-box-${Math.random().toString(36).slice(2, 8)}`}-hint`;
  const element = document.createElement('div');
  element.className = 'fd-refusal-hint';
  element.id = id;
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.hidden = true;
  const place = () => {
    if (!element.isConnected && anchor.parentNode) anchor.after(element);
  };
  box.addEventListener('focus', place);
  let words = '';
  const describe = () => {
    const tokens = (box.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((token) => token && token !== id);
    if (words) tokens.push(id);
    setAttr(box, 'aria-describedby', tokens.join(' ') || null);
  };
  return {
    element,
    id,
    get words() {
      return words;
    },
    show(next) {
      place();
      words = next;
      // Said again when the same words come twice in a row: the second refusal is news too.
      if (element.textContent === next) element.textContent = '';
      element.textContent = next;
      element.hidden = false;
      describe();
      // Floating over a table's cell (styles.ts), where the table cuts it off below its last line: above the box instead.
      element.removeAttribute('data-above');
      if (cutOff(element)) element.setAttribute('data-above', '');
    },
    hide() {
      if (!words) return;
      words = '';
      element.textContent = '';
      element.hidden = true;
      describe();
    },
    describedBy: (base) => [base, words ? id : ''].filter(Boolean).join(' ') || undefined,
  };
}

/**
 * Whether a hint floating under its box cannot be seen there: cut off by a box round it that clips (a table's
 * scroll, a grid's body), or covered by what is drawn over it (a grid's row of totals).
 */
function cutOff(hint: HTMLElement): boolean {
  const document = hint.ownerDocument;
  const view = document.defaultView;
  if (!view || view.getComputedStyle(hint).position !== 'absolute') return false;
  const at = hint.getBoundingClientRect();
  for (let round = hint.parentElement; round && round !== document.body; round = round.parentElement) {
    const clips = view.getComputedStyle(round).overflowY;
    if (clips && clips !== 'visible' && at.bottom > round.getBoundingClientRect().bottom + 0.5) return true;
  }
  const top = document.elementFromPoint?.(at.left + Math.min(at.width / 2, 12), at.top + at.height / 2);
  return !!top && top !== hint && !hint.contains(top);
}

/** What a box takes: its judge of the text an edit would leave, and how pasted text is cleaned. */
export interface InputRules {
  /** Why `next`, the text the box would hold after an edit (`before`, what it holds now), may not stand; null when it may. */
  judge(next: string, before: string): string | null;
  /**
   * Pasted or dropped text: what goes into the box in its place — with `say`, what is said of it, when what is taken
   * leaves out part of what was pasted — or why nothing does. Left out, it is judged as typed.
   */
  paste?(text: string): { text: string; say?: string } | { refuse: string };
  /** Keys typed after a refused one, at the same place, are held with it: a number's "1.5" never becomes 15. */
  hold?: boolean;
}

/** A box being guarded. */
export interface Guard {
  /** The box's text as it stands now is taken: written by its widget, it is what a refused edit goes back to. */
  accept(): void;
  /**
   * With `hold`, while keys refused (and those typed after them) are held: the text the box would hold with
   * them, as typed ("1.5" where the box shows "1"), and why the first was refused. Null when none are.
   */
  held(): { text: string; words: string } | null;
  destroy(): void;
}

type Box = HTMLInputElement | HTMLTextAreaElement;

/** Keys a box holds after a refused one: the box as it stood (its text, the caret where they went), them, and why. */
interface Held {
  value: string;
  start: number;
  end: number;
  typed: string;
  words: string;
}

/** The text a box would hold with `text` put in place of its selection. */
function spliced(box: Box, text: string): string {
  const start = box.selectionStart ?? box.value.length;
  const end = box.selectionEnd ?? start;
  return box.value.slice(0, start) + text + box.value.slice(end);
}

/**
 * Guard a box by `rules`: on beforeinput (a key), paste and drop the edit is
 * judged before it lands, and refused with `hint`; edits that cannot be
 * stopped (an IME's, a phone keyboard's) are judged on input and put back.
 * Deleting is never refused. The guard listens before the widget does, so
 * the widget never reads a refused text.
 */
export function guard(box: Box, rules: InputRules, hint: RefusalHint): Guard {
  const document = box.ownerDocument;
  let taken = { value: box.value, start: box.value.length, end: box.value.length };
  /** Where the selection was as the last edit began: a refused edit puts the caret back there. */
  let before = taken;
  let composing = false;
  let inserting = false;
  /** Keys refused, and those typed after them at the same place (`rules.hold`): where they went, and why the first was refused. */
  let held: Held | null = null;
  /** Whether the box still stands as it did when the held keys were refused: its text, and the caret where they went. */
  const holding = () => !!held && box.value === held.value && box.selectionStart === held.start && box.selectionEnd === held.end;
  /** Keys refused: held with their words, where the box holds keys. */
  const hold = (at: { value: string; start: number; end: number }, typed: string, words: string) => {
    held = rules.hold ? { value: at.value, start: at.start, end: at.end, typed, words } : null;
  };
  /** What an edit put in place of the selection `at` had: `box.value` against `at.value`. */
  const insertedSince = (at: { value: string; start: number; end: number }) => box.value.slice(at.start, box.value.length - (at.value.length - at.end));

  const accept = () => {
    taken = { value: box.value, start: box.selectionStart ?? box.value.length, end: box.selectionEnd ?? box.value.length };
    held = null;
  };
  const putBack = () => {
    const at = before.value === taken.value ? before : taken;
    box.value = taken.value;
    try {
      box.setSelectionRange(at.start, at.end);
    } catch {
      // A box that takes no selection (never one of ours).
    }
  };
  /** Text put in the box by the guard itself, as typing would: the browser's own undo keeps it where it can. */
  const insert = (text: string) => {
    inserting = true;
    let done: boolean;
    try {
      done = typeof document.execCommand === 'function' && document.activeElement === box && document.execCommand('insertText', false, text);
    } catch {
      done = false;
    }
    if (!done) {
      const start = box.selectionStart ?? box.value.length;
      box.setRangeText(text, start, box.selectionEnd ?? start, 'end');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    inserting = false;
  };

  const onFocus = () => accept();
  /** A one-line box: Enter there types nothing, it sends the form or moves on, as the page has it. */
  const oneLine = box.tagName === 'INPUT';
  /** Keys held as an edit began that changes nothing where they wait (a deletion after the caret): kept held once it lands. */
  let rebase: Held | null = null;
  /** Keys held as a composition began there: what it makes is held with them once it ends. */
  let composingAt: Held | null = null;
  /** The held keys taken back, all of them: Undo, or a word's or a line's deletion, typed after them. */
  const letGoHeld = () => {
    held = null;
    hint.hide();
  };
  const onBeforeInput = (event: Event) => {
    const edit = event as InputEvent;
    const type = edit.inputType ?? '';
    // Enter in one line: never judged, never held, never stopped — the form hears it as it did before the rules came.
    if (oneLine && (type === 'insertLineBreak' || type === 'insertParagraph')) return;
    // Where the selection was as the edit began: not the steps of a composition, whose text the box holds on the way.
    if (!composing) before = { value: box.value, start: box.selectionStart ?? box.value.length, end: box.selectionEnd ?? box.value.length };
    if (inserting || box.readOnly) return;
    const typing = type.startsWith('insert') && type !== 'insertCompositionText' && type !== 'insertFromPaste' && type !== 'insertFromDrop' && type !== 'insertReplacementText';
    const text = type === 'insertLineBreak' || type === 'insertParagraph' ? '\n' : (edit.data ?? edit.dataTransfer?.getData('text/plain') ?? '');
    // A keyboard whose keys cannot be stopped (a phone's), typing where keys are held: what it types is put back once it
    // lands, and held with them (onInput).
    if (held && holding() && !edit.cancelable && !type.startsWith('delete')) return;
    if (held && holding() && edit.cancelable) {
      if (type === 'deleteContentBackward') {
        // Backspace takes back the last key held, as it would have taken back a key that landed.
        event.preventDefault();
        held.typed = [...held.typed].slice(0, -1).join('');
        if (!held.typed) letGoHeld();
        return;
      }
      if (type === 'historyUndo' || /^delete(Word|SoftLine|HardLine)Backward$/.test(type)) {
        // Undo, or a word or a line taken back: the keys held were the last typed, and they go, all of them.
        event.preventDefault();
        return letGoHeld();
      }
      if (typing || type === 'insertReplacementText' || type === 'historyRedo') {
        // A key typed after a refused one, at the same place: it waits with it, the words said again. A correction
        // offered meanwhile (a spelling's, a phone keyboard's) would change what was typed round them: it waits too.
        event.preventDefault();
        if (typing) held.typed += text;
        hint.show(held.words);
        return;
      }
      // Anything else that deletes, after the caret: it lands, and the keys held stay where they wait. The text chosen,
      // which the keys held were typed over, deleted (Delete on it): they go with it, and the box is emptied of it as
      // asked — never a box that looks empty with keys still waiting in it.
      if (type.startsWith('delete')) {
        if (box.selectionStart === box.selectionEnd) rebase = held;
        else letGoHeld();
      }
    }
    // Deleting is never refused; a composition is judged once it ends; a paste or a drop has its own listener; a
    // correction, whose place a box does not say, is judged once it lands (onInput).
    if (!typing) return;
    const words = rules.judge(spliced(box, text), box.value);
    if (!words) {
      held = null;
      return;
    }
    if (!edit.cancelable) return hint.show(words);
    event.preventDefault();
    hint.show(words);
    hold(before, text, words);
  };
  const take = (event: Event, text: string) => {
    if (box.readOnly) return;
    const cleaned: ReturnType<NonNullable<InputRules['paste']>> = rules.paste ? rules.paste(text) : { text };
    if ('refuse' in cleaned) {
      event.preventDefault();
      hint.show(cleaned.refuse);
      return;
    }
    if (held && holding()) {
      // Pasted or dropped where keys wait after a refused one: it joins them, the words said again — never landing
      // beside the text typed before the refused key, as though that key had never been typed.
      event.preventDefault();
      if (event.type === 'drop') box.focus();
      held.typed += oneLine ? cleaned.text.replace(/\r\n|[\r\n]/g, ' ') : cleaned.text;
      hint.show(held.words);
      return;
    }
    const words = rules.judge(spliced(box, cleaned.text), box.value);
    if (words) {
      event.preventDefault();
      hint.show(words);
      return;
    }
    held = null;
    if (cleaned.text === text && event.type === 'paste' && !cleaned.say) return hint.hide();
    event.preventDefault();
    if (event.type === 'drop') box.focus();
    insert(cleaned.text);
    // What was taken and what was not, said as it lands: the next key taken lets it go.
    if (cleaned.say) hint.show(cleaned.say);
    else hint.hide();
  };
  const onPaste = (event: Event) => take(event, (event as ClipboardEvent).clipboardData?.getData('text/plain') ?? '');
  const onDrop = (event: Event) => {
    const text = (event as DragEvent).dataTransfer?.getData('text/plain');
    if (text !== undefined) take(event, text);
  };
  const onInput = (event: Event) => {
    const edit = event as InputEvent;
    if (inserting) return accept();
    if (composing || edit.isComposing) return;
    const type = edit.inputType ?? '';
    const kept = rebase;
    rebase = null;
    if (kept && kept === held && type.startsWith('delete') && box.selectionStart === box.selectionEnd) {
      // A deletion after the caret, keys held there: taken, and the keys wait where they were, said still.
      taken = { value: box.value, start: box.selectionStart ?? box.value.length, end: box.selectionEnd ?? box.value.length };
      Object.assign(kept, { value: box.value, start: taken.start, end: taken.end });
      return;
    }
    // The box as it was taken, keys held there (a composition's last word, after its text was put back): they wait on.
    if (box.value === taken.value && held && holding() && !type.startsWith('delete') && !type.startsWith('history')) return;
    if (type.startsWith('delete') || type.startsWith('history') || box.value === taken.value) {
      hint.hide();
      return accept();
    }
    // Typed where keys are held, by a keyboard that could not be stopped: held with them, and put back.
    const after = held && before.value === held.value && before.start === held.start && before.end === held.end && before.value === taken.value ? held : null;
    const words = after ? after.words : rules.judge(box.value, taken.value);
    if (!words) {
      hint.hide();
      return accept();
    }
    // An edit that could not be stopped: the last text taken comes back, and the widget never hears of it.
    event.stopImmediatePropagation();
    // A correction's place is not said: put back, and said, but nothing of it held.
    const typed = before.value === taken.value && type !== 'insertReplacementText' ? insertedSince(before) : '';
    putBack();
    hint.show(words);
    if (after) after.typed += typed;
    else if (typed) hold(before, typed, words);
  };
  const onCompositionStart = () => {
    composing = true;
    before = { value: box.value, start: box.selectionStart ?? box.value.length, end: box.selectionEnd ?? box.value.length };
    composingAt = held && holding() ? held : null;
  };
  const onCompositionEnd = () => {
    composing = false;
    const at = composingAt;
    composingAt = null;
    const typed = before.value === taken.value ? insertedSince(before) : '';
    // Composed where keys wait after a refused one: what it made waits with them, the words said again.
    const words = at && at === held ? at.words : box.value === taken.value ? null : rules.judge(box.value, taken.value);
    if (!words) return;
    putBack();
    hint.show(words);
    if (at && at === held) at.typed += typed;
    else if (typed) hold(before, typed, words);
    // The widget heard the composing text: it hears the text put back too — the keys held kept, as they were.
    const waiting = held;
    inserting = true;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    inserting = false;
    held = waiting;
  };
  // Left with keys held, the words still say why what was typed is not taken: the box's widget makes them its own.
  const onBlur = () => !(held && holding()) && hint.hide();
  const listeners: [string, (event: Event) => void][] = [
    ['focus', onFocus],
    ['beforeinput', onBeforeInput],
    ['paste', onPaste],
    ['drop', onDrop],
    ['input', onInput],
    ['compositionstart', onCompositionStart],
    ['compositionend', onCompositionEnd],
    ['blur', onBlur],
  ];
  for (const [type, listener] of listeners) box.addEventListener(type, listener);
  return {
    accept,
    held: () => (held && holding() ? { text: held.value.slice(0, held.start) + held.typed + held.value.slice(held.end), words: held.words } : null),
    destroy: () => listeners.forEach(([type, listener]) => box.removeEventListener(type, listener)),
  };
}

// ---------------------------------------------------------------------------
// Number boxes

/** What a number box needs to judge and to speak: its field's label, the page's language and words, its limits now. */
export interface NumberBox {
  label: string;
  locale: Locale;
  labels?: WidgetLabels;
  /** The validation messages in the page's language: the page's language's own when left out. */
  messages?: Messages;
  /** The limits now: a money box's places follow its currency. */
  limits(): NumberLimits;
  /** The box's own currency code, which a pasted amount may carry. */
  currency?(): string | null;
  /** Hours typed as hours and minutes (6:30) or hours (6.5). */
  duration?: boolean;
}

/** A pasted or typed text as a hint quotes it: on one line, not too long, set apart from the words round it. */
export function quoted(text: string): string {
  const line = stripMarks(text).replace(/\s+/g, ' ').trim();
  const short = [...line].length > 40 ? `${[...line].slice(0, 39).join('')}…` : line;
  return `\u2068${short}\u2069`;
}

const orLists = new Map<string, Intl.ListFormat>();

/**
 * Why a time or hours whose minutes have one digit is not read: `text` as typed, and each time it could be (`times`),
 * joined as the page's language offers a choice — "6:03 or 6:30", "14:05, 14:30 or 14:50", "6:03 أو 6:30".
 */
export function minuteDigitsWords(label: string, text: string, times: readonly string[], words: WidgetLabels, locale: string): string {
  let list = orLists.get(locale);
  if (!list) {
    try {
      list = new Intl.ListFormat(locale, { type: 'disjunction' });
    } catch {
      list = new Intl.ListFormat('en', { type: 'disjunction' });
    }
    orLists.set(locale, list);
  }
  return fillIn(words.minuteDigits, { label, text: quoted(text), times: list.format(times) });
}

/** The words for a refusal of a number box. */
export function refusalWords(refusal: NumberRefusal, box: Pick<NumberBox, 'label' | 'locale' | 'labels' | 'messages'>): string {
  const words = wordsFor(box.labels, box.locale);
  const messages = box.messages ?? MESSAGES[box.locale] ?? MESSAGES.en;
  const label = box.label;
  switch (refusal.problem) {
    case 'numbersOnly':
      return fillIn(words.numbersOnly, { label });
    case 'minusFirst':
      return words.minusFirst;
    case 'oneDecimalMark':
      return words.oneDecimalMark;
    case 'groupsOfThree':
      return fillIn(words.groupsOfThree, { example: formatNumber(1234567, 0, box.locale) });
    case 'severalValues':
      return fillIn(words.severalValues, { label });
    case 'integer':
      return fill(messages.integer, { label });
    case 'min':
      return fill(messages.min, { label, min: refusal.min });
    case 'decimals':
      return decimalsWords(label, refusal.places, messages);
    case 'digits':
      return fill(messages.digits, { label, n: refusal.n });
  }
}

/**
 * Why text left in a number box does not read, in words: "Seats: “12abc” is not
 * a number", "Digits are grouped in threes, like 1,234,567", the minutes of
 * hours past 59. Null when it reads.
 */
export function unreadWords(text: string, box: Pick<NumberBox, 'label' | 'locale' | 'labels' | 'messages' | 'duration'> & { percent?: boolean; limits?: () => NumberLimits }): string | null {
  const words = wordsFor(box.labels, box.locale);
  const label = box.label;
  if (box.duration) {
    const read = readDuration(text, box.locale);
    if (read.ok) return null;
    if (read.problem === 'minuteDigits') return minuteDigitsWords(label, text, read.times, words, box.locale);
    if (read.problem === 'minutes') return fillIn(words.minutes, { label });
    if (read.problem === 'severalValues') return fillIn(words.severalValues, { label });
    return fillIn(words.duration, { label, decimal: formatNumber(6.5, 1, box.locale) });
  }
  const read = readNumber(text, box.locale, { percent: box.percent, ungrouped: box.limits?.().ungrouped });
  if (read.ok) return null;
  if (read.problem === 'groupsOfThree' || read.problem === 'oneDecimalMark' || read.problem === 'minusFirst' || read.problem === 'severalValues') return refusalWords({ problem: read.problem }, box);
  return fillIn(words.notANumber, { label, text: quoted(text) });
}

/**
 * Why text a number box is left with cannot be taken, or null when it can:
 * text that does not read (unreadWords), or a number the field cannot hold as
 * it was typed — a decimal in a whole number, places or digits past the
 * field's. Typed key by key, "12.345" in a box of two places could not be
 * told from "12.345,67" on its way; left as it is, it is said now.
 */
export function leftWords(text: string, box: Pick<NumberBox, 'label' | 'locale' | 'labels' | 'messages' | 'duration' | 'limits'> & { percent?: boolean }): string | null {
  const unread = unreadWords(text, box);
  if (unread !== null || box.duration) return unread;
  const limits = box.limits();
  const read = readNumber(text, box.locale, { percent: box.percent, ungrouped: limits.ungrouped });
  const misfit = read.ok && read.value !== null ? numberMisfit(read.value, limits) : null;
  return misfit ? refusalWords(misfit, box) : null;
}

/**
 * Whether the text a number box holds reads as a number its field takes as it
 * stands: one to set as it is typed. "12.345" in a box of two places waits for
 * the next key ("12.345,6") or for the box to be left.
 */
export function numberFits(text: string, box: Pick<NumberBox, 'locale' | 'limits'> & { percent?: boolean }): boolean {
  const limits = box.limits();
  const read = readNumber(text, box.locale, { percent: box.percent, ungrouped: limits.ungrouped });
  return read.ok && (read.value === null || !numberMisfit(read.value, limits));
}

/**
 * The input rules of a number box: letters, a misplaced minus, a second
 * decimal mark, places and digits past the field's refused as typed, and the
 * keys typed after a refused one held with it; an amount pasted with the
 * box's own currency, grouped or as an accounting negative taken as the
 * plain number, when the field takes it; another currency named.
 */
export function numberRules(box: NumberBox): InputRules {
  const words = wordsFor(box.labels, box.locale);
  return {
    hold: true,
    judge(next, before) {
      const limits = { ...box.limits(), ...(box.duration ? { duration: true } : {}) };
      const refusal = couldBeNumber(next, box.locale, limits);
      if (!refusal) return null;
      // A text already out of shape (grouped wrongly, a mark too many) may still be edited into shape.
      if ((refusal.problem === 'groupsOfThree' || refusal.problem === 'oneDecimalMark') && couldBeNumber(before, box.locale, limits)) return null;
      return refusalWords(refusal, box);
    },
    paste(text) {
      if (box.duration) {
        const plain = stripMarks(text).replace(/(\r\n|[\r\n])$/, '').trim();
        if (/[\t\n\r]/.test(plain)) return { refuse: fillIn(words.severalValues, { label: box.label }) };
        const read = readDuration(plain, box.locale);
        return read.ok || read.problem === 'unfinished' ? { text: plain } : { refuse: unreadWords(plain, box) ?? fillIn(words.notPastedNumber, { text: quoted(text) }) };
      }
      const currency = box.currency?.() ?? null;
      const limits = box.limits();
      const cleaned = cleanPastedNumber(text, box.locale, { currency, percent: limits.percent, ungrouped: limits.ungrouped });
      // Pasted whole, the number is what it reads as: one the field cannot hold is refused whole, saying why.
      const misfit = cleaned.ok ? numberMisfit(cleaned.value, limits) : null;
      if (misfit) return { refuse: refusalWords(misfit, box) };
      if (cleaned.ok) return { text: cleaned.text };
      if (cleaned.problem === 'severalValues') return { refuse: fillIn(words.severalValues, { label: box.label }) };
      if (cleaned.problem === 'otherCurrency' && currency) return { refuse: fillIn(words.otherCurrency, { label: box.label, currency, pasted: cleaned.currency }) };
      return { refuse: fillIn(words.notPastedNumber, { text: quoted(text) }) };
    },
  };
}

/**
 * The keyboard a phone shows for a number box: digits alone for whole numbers
 * that are never negative, digits and a decimal mark for others never
 * negative, and the full keyboard where a minus may be typed (an iPhone's
 * number pad has none).
 */
export function numberKeyboard(limits: NumberLimits): 'numeric' | 'decimal' | 'text' {
  if (limits.min === undefined || limits.min < 0) return 'text';
  return limits.integer ? 'numeric' : 'decimal';
}
