import type { Locale } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';

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

/** Whether the answer is wrong, and the help and error that describe it, on the element assistive technology reads. */
export function describeState(element: HTMLElement, state: { invalid: boolean; describedBy?: string }) {
  element.setAttribute('aria-invalid', String(state.invalid));
  if (state.describedBy) element.setAttribute('aria-describedby', state.describedBy);
  else element.removeAttribute('aria-describedby');
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
