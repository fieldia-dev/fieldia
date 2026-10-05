/**
 * What a language's add-on script does (`fieldia.ar.js`, `fieldia.de.js`,
 * `fieldia.fr.js`, built by tools/script-bundle.mjs): hand that language's
 * words to the one-tag script's `Fieldia.addLanguage`. It carries the words
 * alone — never a second copy of Fieldia — so it needs fieldia.js on the page.
 *
 * Loaded before fieldia.js (an `async` script may be), it leaves its words in
 * `FieldiaLanguages`, where fieldia.js takes them as it starts.
 */
import type { Locale } from '@fieldia/core';
import type { LanguageWords } from '@fieldia/viewer';

declare const __FIELDIA_VERSION__: string;

export interface LanguageHost {
  Fieldia?: { VERSION?: string; addLanguage?: (locale: Locale, words: LanguageWords) => void };
  FieldiaLanguages?: [Locale, LanguageWords][];
}

export function addOn(locale: Locale, words: LanguageWords): void {
  const host = globalThis as LanguageHost;
  const fieldia = host.Fieldia;
  if (!fieldia?.addLanguage) {
    (host.FieldiaLanguages ??= []).push([locale, words]);
    return;
  }
  if (fieldia.VERSION !== __FIELDIA_VERSION__) {
    console.warn(`Fieldia: fieldia.${locale}.js is version ${__FIELDIA_VERSION__} and fieldia.js is ${fieldia.VERSION}: load the same version of both, or some words may show in English.`);
  }
  fieldia.addLanguage(locale, words);
}
