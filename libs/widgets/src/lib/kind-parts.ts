import type { Locale } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import type { WidgetState } from './widgets';

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

/** The words a widget shows: the page's, or English. */
export const wordsFor = (labels: WidgetLabels | undefined, locale: Locale | undefined): WidgetLabels => labels ?? WIDGET_LABELS[locale ?? 'en'];

/** `{name}` and the like filled in. */
export const fillIn = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

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
 * picked — a radio, once picked, cannot be unpicked; nor can a slider, once slid.
 */
export function clearSelection(document: Document, words: WidgetLabels, clear: () => void) {
  const button = maker(document)('button', { type: 'button', class: 'fd-choice-clear', hidden: '' }, words.clearSelection);
  button.addEventListener('click', clear);
  let open = false;
  return {
    button,
    /** Whether the answer may be left out: not required, and not read-only. */
    allow(state: WidgetState) {
      open = !state.required && !state.readonly;
    },
    show(picked: boolean) {
      setHidden(button, !(open && picked));
    },
  };
}
