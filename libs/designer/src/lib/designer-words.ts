import { ar } from './locales/ar';
import { en } from './locales/en';
import { es } from './locales/es';
import { fa } from './locales/fa';
import type { Speaker } from './locales/speak';
import { tr } from './locales/tr';
import { ur } from './locales/ur';

/**
 * The designer's own words — its buttons, menus, messages, checks, the
 * sentences it reads rules in — in each language it speaks. English is the
 * source: its table is the type every other language's must fill, so a word
 * missing in Arabic does not compile. A sentence that names something or
 * counts is a function of what it names, so each language puts the words in
 * its own order and says a count in its own plural forms.
 *
 * The page's own words — its title, labels, options — are data: the designer
 * shows them as written, in any language.
 */
export type DesignerWords = typeof en;

/**
 * The languages the designer speaks: English, Arabic, and Turkish, Persian, Urdu and Spanish — the last four
 * machine-assisted, not yet reviewed by a native speaker (0.31).
 */
export type DesignerLocale = Speaker;

export const DESIGNER_WORDS: Record<DesignerLocale, DesignerWords> = { en, ar, tr, fa, ur, es };

/**
 * The designer's language for a language tag (`ar`, `ar-EG`, `en-GB`), or
 * null when none is given. A language it does not speak is English.
 */
export function designerLocale(tag: string | null | undefined): DesignerLocale | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split('-')[0];
  return Object.prototype.hasOwnProperty.call(DESIGNER_WORDS, base) ? (base as DesignerLocale) : 'en';
}

/** An option's words as the designer writes them for a new one — "Option 2", "الخيار 2" — in any language it speaks. */
export function isDefaultOption(label: string): boolean {
  const n = /\d+/.exec(label);
  return !!n && Object.values(DESIGNER_WORDS).some((w) => w.defaults.option(Number(n[0])) === label);
}

/** A question's words as the designer writes them for a new one, in any language it speaks. */
export const isUntitled = (label: string): boolean => /^Untitled (question|field)$/.test(label) || Object.values(DESIGNER_WORDS).some((w) => w.defaults.untitledQuestion === label);

/**
 * How each language writes dates and numbers: in Latin digits, as Arabic business software shows them, and on the
 * Gregorian calendar — Intl's own for Persian is the Solar Hijri.
 */
export const DATE_TAGS: Record<DesignerLocale, string> = { en: 'en-GB', ar: 'ar-u-nu-latn', tr: 'tr-u-nu-latn', fa: 'fa-u-ca-gregory-nu-latn', ur: 'ur-u-nu-latn', es: 'es-u-nu-latn' };

/** Which way a language the designer speaks is written: Arabic, Persian and Urdu right to left. */
export const designerDirection = (locale: DesignerLocale): 'ltr' | 'rtl' => (locale === 'ar' || locale === 'fa' || locale === 'ur' ? 'rtl' : 'ltr');
