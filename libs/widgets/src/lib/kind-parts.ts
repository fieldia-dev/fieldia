import { quotedLabel, type FieldNode, type Locale } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import type { TypedText, WidgetState } from './widgets';

/**
 * Small parts the question kinds share: making elements, their words, saying
 * what is wrong with them, and a polite voice for screen readers.
 */

export type Make = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string | undefined>, ...children: (Node | string)[]) => HTMLElementTagNameMap[K];

/** An element with its attributes and children, in one call. */
export function maker(document: Document): Make {
  return (tag, attrs = {}, ...children) => {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) element.setAttribute(name, value);
    element.append(...children);
    return element;
  };
}

/** The keyboard a phone shows for a line of words filled in for a purpose: a phone's keypad, an email's @, digits for a code. */
function purposeKeyboard(purpose: string): string | undefined {
  if (purpose.startsWith('tel')) return 'tel';
  if (purpose === 'email') return 'email';
  if (purpose === 'url' || purpose === 'photo' || purpose === 'impp') return 'url';
  if (purpose === 'transaction-amount') return 'decimal';
  return /^(one-time-code|cc-number|cc-csc|cc-exp-(month|year)|bday-(day|month|year))$/.test(purpose) ? 'numeric' : undefined;
}

/**
 * What a box is filled in with by the browser (`autocomplete`) and the keyboard a phone shows for it (`inputmode`), as
 * the box's attributes: the page's, on the field's node, over its kind's own (`own`: an email box's `email`); a box with
 * no keyboard of its own shows its purpose's (a phone's keypad for `tel`, digits for `one-time-code`). Left out where
 * neither says.
 */
export function boxPurpose(node: FieldNode, own: { autocomplete?: string; inputmode?: string } = {}): { autocomplete?: string; inputmode?: string } {
  const autocomplete = node.autocomplete ?? own.autocomplete;
  // The purpose itself: its last word, but webauthn ("work tel" is a phone).
  const purpose = node.autocomplete?.split(' ').filter((word) => word !== 'webauthn').pop();
  const inputmode = node.inputmode ?? own.inputmode ?? (purpose ? purposeKeyboard(purpose) : undefined);
  return { ...(autocomplete ? { autocomplete } : {}), ...(inputmode ? { inputmode } : {}) };
}

/** The words a widget shows: the page's, its language's, or English (a language the one-tag script was not given). */
export const wordsFor = (labels: WidgetLabels | undefined, locale: Locale | undefined): WidgetLabels => labels ?? WIDGET_LABELS[locale ?? 'en'] ?? WIDGET_LABELS.en;

/** The blanks a field's label fills: a question there is quoted (`quotedLabel`). */
const LABEL_BLANKS = new Set(['label', 'column', 'field']);
/** The language whose quotation marks a sentence quotes typed words in: „…“, « … », «…», else “…”. */
const marksOf = (template: string) => (template.includes('„') ? 'de' : template.includes('« ') ? 'fr' : template.includes('«') ? 'ar' : 'en');

/**
 * `{name}` and the like filled in; a label that is a question quoted, in the marks the sentence quotes in:
 * "“How many days?”: numbers only".
 */
export const fillIn = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in values)) return match;
    const value = values[key];
    return LABEL_BLANKS.has(key) && typeof value === 'string' ? quotedLabel(value, marksOf(template)) : String(value);
  });

/**
 * An attribute set, or taken away with null, only when that changes it.
 * Every field is brought up to date at each change of a form; writing what is
 * there already still has the browser look at the page anew, which on a big
 * page is most of the time a key takes.
 */
export function setAttr(element: Element, name: string, value: string | null): void {
  if (element.getAttribute(name) === value) return;
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** Shown or hidden, written only when that changes. */
export function setHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hidden !== hidden) element.hidden = hidden;
}

/** Words written only when they change: written again, they would be new words to lay out. */
export function setText(element: Node, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

/**
 * Text typed in a stand-in's box put in `box` as the person left it (`Widget.takeTyped`): the box focused, the text in
 * it, the caret where it was. `taken` runs once the text is in: where the box notes what the field held as it was
 * entered (`typed.entered`, which text that does not read puts back) and its guard takes the text as it stands — whole,
 * never put back, read as the box is left. Then an input says it was typed, as a key would: the box reads it as it
 * reads keys, and the viewer holds it as typed in, so autosave waits.
 */
export function typeInto(box: HTMLInputElement | HTMLTextAreaElement, typed: TypedText, taken: () => void = () => undefined): void {
  box.focus();
  box.value = typed.text;
  try {
    box.setSelectionRange(typed.start, typed.end);
  } catch {
    // A box that takes no selection (never one of ours).
  }
  taken();
  box.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Whether the answer is wrong, and the help and error that describe it, on the element assistive technology reads. */
export function describeState(element: HTMLElement, state: { invalid: boolean; describedBy?: string }) {
  setAttr(element, 'aria-invalid', String(state.invalid));
  setAttr(element, 'aria-describedby', state.describedBy || null);
}

/** Words said to screen readers when something moves or goes, without taking the focus. */
export function announcer(make: Make) {
  const element = make('div', { class: 'fd-announce', role: 'status', 'aria-live': 'polite' });
  return {
    element,
    say(text: string) {
      // The same words twice are still said: the region is emptied first.
      element.textContent = '';
      element.textContent = text;
    },
  };
}

/** Whether the element sits in a right-to-left page, where left is forward. */
export const rightToLeft = (element: Element) => element.closest('[dir]')?.getAttribute('dir') === 'rtl';

/**
 * "Clear selection", as Google Forms has it: under a single choice that need not be answered, once something is
 * picked — a radio, once picked, cannot be unpicked; nor can a slider, once slid. Never shown where the
 * page's node says `options.clear: false`, as an ERP's radios have none, or where `offered` is false.
 */
export function clearSelection(document: Document, words: WidgetLabels, clear: () => void, node: FieldNode, offered = true) {
  const button = maker(document)('button', { type: 'button', class: 'fd-choice-clear', hidden: '' }, words.clearSelection);
  button.addEventListener('click', clear);
  const wanted = offered && node.options?.clear !== false;
  let open = false;
  return {
    button,
    /** Whether the answer may be left out: not required, and not read-only. */
    allow(state: WidgetState) {
      open = wanted && !state.required && !state.readonly;
    },
    show(picked: boolean) {
      setHidden(button, !(open && picked));
    },
  };
}

/**
 * Removing asks first, in place: "Remove report.pdf?  Remove · Keep", the
 * focus on Keep, Escape keeping it. `ask` shows the question; `then` hears
 * the answer, true to remove. A dialog holding changes asks so before it lets
 * them go, its own `answers`: "Discard your changes?  Discard · Cancel".
 */
export function askFirst(make: Make, answers: { yes: string; no: string }) {
  const question = make('span');
  const yes = make('button', { type: 'button', class: 'fd-button fd-button-link' }, answers.yes);
  const no = make('button', { type: 'button', class: 'fd-button fd-button-link' }, answers.no);
  const element = make('div', { class: 'fd-file-confirm', hidden: '' }, question, yes, no);
  let then = (_remove: boolean) => undefined as void;
  const answered = (remove: boolean) => {
    element.hidden = true;
    then(remove);
  };
  yes.addEventListener('click', () => answered(true));
  no.addEventListener('click', () => answered(false));
  // Escape answers no — its own key, heard by nothing round it (a dialog it stands in would close).
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    answered(false);
  });
  return {
    element,
    ask(text: string, answer: (remove: boolean) => void) {
      question.textContent = text;
      then = answer;
      element.hidden = false;
      no.focus();
    },
  };
}

