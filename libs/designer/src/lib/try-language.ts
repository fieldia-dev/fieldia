import { isRightToLeft } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { languageName, languagesOf, pageLanguage } from './translations';

/**
 * Try it in a language: beside Try it's English and العربية, the languages
 * the page keeps, to try it in one — in its words, right to left where it is
 * written so. The two agree: picking a language presses the direction it
 * runs, العربية picks the page's Arabic when it keeps some, and English lets
 * go of a language written right to left.
 */

export interface TryLanguageOptions {
  el: ElementFactory;
  designer: Designer;
  /** Try it's bar, with its English and العربية buttons. */
  bar: HTMLElement;
  /** Draw the page again, in the language now picked. */
  redraw(): void;
}

export interface TryLanguage {
  /** What the viewer is given, for the direction pressed: the language picked, or else Arabic when right to left. */
  viewerOptions(direction: 'ltr' | 'rtl'): { dir: 'ltr' | 'rtl'; locale?: string };
}

const directionOf = (tag: string): 'ltr' | 'rtl' => (isRightToLeft(tag) ? 'rtl' : 'ltr');

export function tryLanguage({ el, designer, bar, redraw }: TryLanguageOptions): TryLanguage {
  const words = designer.words;
  const select = el('select', { class: 'fd-input' });
  const element = el('label', { class: 'fd-try-language', hidden: '' }, el('span', { class: 'fd-try-language-words' }, words.tryIt.wordsIn), select);
  const button = (direction: 'ltr' | 'rtl') => bar.querySelector<HTMLButtonElement>(`button[data-try="${direction}"]`);
  bar.insertBefore(element, button('rtl')?.parentElement ?? null);
  let picked: string | null = null;
  /** A direction pressed by this picker, not by a person. */
  let syncing = false;

  /** The page's languages now: one picked that the page no longer keeps is let go. */
  function refresh() {
    const page = designer.getPage();
    const languages = languagesOf(page);
    if (picked && !languages.includes(picked)) picked = null;
    element.hidden = !languages.length;
    select.replaceChildren(el('option', { value: '' }, words.rulesUi.asWritten(languageName(pageLanguage(page), words))), ...languages.map((tag) => el('option', { value: tag }, languageName(tag, words))));
    select.value = picked ?? '';
  }

  select.addEventListener('change', () => {
    picked = select.value || null;
    const want = directionOf(picked ?? pageLanguage(designer.getPage()));
    if (button(want)?.getAttribute('aria-pressed') === 'true') return redraw();
    syncing = true;
    try {
      button(want)?.click();
    } finally {
      syncing = false;
    }
  });
  // Heard before Try it's own: the language is settled before it draws.
  button('rtl')?.addEventListener('click', () => {
    if (!syncing) picked = languagesOf(designer.getPage()).includes('ar') ? 'ar' : null;
  });
  button('ltr')?.addEventListener('click', () => {
    if (!syncing && picked && isRightToLeft(picked)) picked = null;
  });

  return {
    viewerOptions(direction) {
      refresh();
      if (picked) return { dir: directionOf(picked), locale: picked };
      return direction === 'rtl' ? { dir: 'rtl', locale: 'ar' } : { dir: 'ltr' };
    },
  };
}
