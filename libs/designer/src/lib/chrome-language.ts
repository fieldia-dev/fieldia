import type { Locale, Page } from '@fieldia/core';
import { WIDGET_LABELS } from '@fieldia/widgets';
import type { Designer } from './designer';
import { designerDirection } from './designer-words';

/**
 * Which way the designer's own words run. Given a language, the editor runs
 * that language's way — English left to right on a page right to left, Arabic
 * right to left on one left to right — so its sentences keep their full stops
 * at their ends; what draws the page keeps the page's own language and
 * direction, as the form will have them. Given none, everything takes the
 * direction of the page around it, as before.
 */

/** The language and direction of the designer's own words, for an element of its own; nothing when it was given no language. */
export function chromeLanguage(designer: Designer): { lang?: string; dir?: 'ltr' | 'rtl' } {
  return designer.locale ? { lang: designer.locale, dir: designerDirection(designer.locale) } : {};
}

/** The direction of the page around the editor: the way its own form will run. */
export function hostDirection(host: Element): 'ltr' | 'rtl' {
  const css = host.ownerDocument.defaultView?.getComputedStyle(host).direction;
  if (css === 'rtl' || css === 'ltr') return css;
  return host.closest('[dir]')?.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * The editor in its own language and direction (`chromeLanguage`), while what
 * draws the page — the canvas, the cards — keeps the language and direction
 * of the page around it, as the form will have them. Returns a way to look
 * at the page around it again, as its direction may change.
 */
export function speakIn(root: HTMLElement, host: HTMLElement, designer: Designer, drawn: () => HTMLElement[]): () => void {
  const own = chromeLanguage(designer);
  if (!own.dir) return () => undefined;
  root.lang = own.lang as string;
  root.dir = own.dir;
  const sync = () => {
    const dir = hostDirection(host);
    const lang = host.closest('[lang]')?.getAttribute('lang') ?? '';
    for (const part of drawn()) {
      if (part.dir !== dir) part.dir = dir;
      if (part.lang !== lang) part.lang = lang;
    }
  };
  sync();
  return sync;
}

/** An element of the designer's own, put outside its parts (a menu, a chip): in the editor's language and direction, when it has one. */
export function speakLike(element: HTMLElement, from: Element | null): HTMLElement {
  const root = from?.closest<HTMLElement>('.fd-designer');
  if (root?.dir) {
    element.dir = root.dir;
    element.lang = root.lang;
  }
  return element;
}

/** The language of Fieldia's own words on the page drawn — a widget's "Add photos", a list's "Search…" — the page's (`language`), as its form will speak; English for one Fieldia has no words in. */
export function pageLocale(page: Page): Locale {
  const base = (page.language ?? 'en').split('-')[0];
  return Object.prototype.hasOwnProperty.call(WIDGET_LABELS, base) ? (base as Locale) : 'en';
}

/** What a widget drawn for the page needs to speak as it will on the form: its words, and the language. */
export function widgetWords(page: Page): { labels: (typeof WIDGET_LABELS)[Locale]; locale: Locale } {
  const locale = pageLocale(page);
  return { labels: WIDGET_LABELS[locale], locale };
}
