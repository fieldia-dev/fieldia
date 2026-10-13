import {
  cleanPastedNumber,
  couldBeNumber,
  decimalsWords,
  fill,
  MESSAGES,
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
  /** Pasted or dropped text: what goes into the box in its place, or why nothing does. Left out, it is judged as typed. */
  paste?(text: string): { text: string } | { refuse: string };
}

/** A box being guarded. */
export interface Guard {
  /** The box's text as it stands now is taken: written by its widget, it is what a refused edit goes back to. */
  accept(): void;
  destroy(): void;
}

type Box = HTMLInputElement | HTMLTextAreaElement;

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

  const accept = () => {
    taken = { value: box.value, start: box.selectionStart ?? box.value.length, end: box.selectionEnd ?? box.value.length };
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
  const onBeforeInput = (event: Event) => {
    const edit = event as InputEvent;
    before = { value: box.value, start: box.selectionStart ?? box.value.length, end: box.selectionEnd ?? box.value.length };
    if (inserting || box.readOnly) return;
    const type = edit.inputType ?? '';
    // Deleting is never refused; a composition is judged once it ends; a paste or a drop has its own listener.
    if (!type.startsWith('insert') || type === 'insertCompositionText' || type === 'insertFromPaste' || type === 'insertFromDrop') return;
    const text = edit.data ?? edit.dataTransfer?.getData('text/plain') ?? '';
    const words = rules.judge(spliced(box, type === 'insertLineBreak' || type === 'insertParagraph' ? '\n' : text), box.value);
    if (!words) return;
    if (edit.cancelable) event.preventDefault();
    hint.show(words);
  };
  const take = (event: Event, text: string) => {
    if (box.readOnly) return;
    const cleaned = rules.paste ? rules.paste(text) : { text };
    if ('refuse' in cleaned) {
      event.preventDefault();
      hint.show(cleaned.refuse);
      return;
    }
    const words = rules.judge(spliced(box, cleaned.text), box.value);
    if (words) {
      event.preventDefault();
      hint.show(words);
      return;
    }
    hint.hide();
    if (cleaned.text === text && event.type === 'paste') return;
    event.preventDefault();
    if (event.type === 'drop') box.focus();
    insert(cleaned.text);
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
    if (type.startsWith('delete') || type.startsWith('history') || box.value === taken.value) {
      hint.hide();
      return accept();
    }
    const words = rules.judge(box.value, taken.value);
    if (!words) {
      hint.hide();
      return accept();
    }
    // An edit that could not be stopped: the last text taken comes back, and the widget never hears of it.
    event.stopImmediatePropagation();
    putBack();
    hint.show(words);
  };
  const onCompositionStart = () => {
    composing = true;
    before = { value: box.value, start: box.selectionStart ?? box.value.length, end: box.selectionEnd ?? box.value.length };
  };
  const onCompositionEnd = () => {
    composing = false;
    const words = box.value === taken.value ? null : rules.judge(box.value, taken.value);
    if (!words) return;
    putBack();
    hint.show(words);
    // The widget heard the composing text: it hears the text put back too.
    inserting = true;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    inserting = false;
  };
  const onBlur = () => hint.hide();
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
export function unreadWords(text: string, box: Pick<NumberBox, 'label' | 'locale' | 'labels' | 'messages' | 'duration'> & { percent?: boolean }): string | null {
  const words = wordsFor(box.labels, box.locale);
  const label = box.label;
  if (box.duration) {
    const read = readDuration(text, box.locale);
    if (read.ok) return null;
    if (read.problem === 'minutes') return fillIn(words.minutes, { label });
    if (read.problem === 'severalValues') return fillIn(words.severalValues, { label });
    return fillIn(words.duration, { label, decimal: formatNumber(6.5, 1, box.locale) });
  }
  const read = readNumber(text, box.locale, { percent: box.percent });
  if (read.ok) return null;
  if (read.problem === 'groupsOfThree' || read.problem === 'oneDecimalMark' || read.problem === 'minusFirst' || read.problem === 'severalValues') return refusalWords({ problem: read.problem }, box);
  return fillIn(words.notANumber, { label, text: quoted(text) });
}

/**
 * The input rules of a number box: letters, a misplaced minus, a second
 * decimal mark, places and digits past the field's refused as typed; an
 * amount pasted with the box's own currency, grouped or as an accounting
 * negative taken as the plain number; another currency named.
 */
export function numberRules(box: NumberBox): InputRules {
  const words = wordsFor(box.labels, box.locale);
  return {
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
      const cleaned = cleanPastedNumber(text, box.locale, { currency, percent: box.limits().percent });
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
