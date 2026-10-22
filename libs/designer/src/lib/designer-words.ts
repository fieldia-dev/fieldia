import { ar } from './locales/ar';
import { en } from './locales/en';
import type { Speaker } from './locales/speak';

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

/**
 * The designer's words in each language it has at hand: English and Arabic always. Turkish, Persian, Urdu and Spanish
 * come in a chunk each of their own (60 to 85 KB gzipped each), fetched by `designerWordsReady` — which
 * `createDesigner.open` awaits — so a designer that speaks none of them never carries them.
 */
export const DESIGNER_WORDS: Record<'en' | 'ar', DesignerWords> & Partial<Record<DesignerLocale, DesignerWords>> = { en, ar };

/** The languages whose words come in a chunk of their own, and how each is fetched. */
const LATER: Record<Exclude<DesignerLocale, 'en' | 'ar'>, () => Promise<DesignerWords>> = {
  tr: () => import('./locales/tr').then((words) => words.tr),
  fa: () => import('./locales/fa').then((words) => words.fa),
  ur: () => import('./locales/ur').then((words) => words.ur),
  es: () => import('./locales/es').then((words) => words.es),
};

/**
 * The designer's language for a language tag (`ar`, `ar-EG`, `en-GB`), or
 * null when none is given. A language it does not speak is English.
 */
export function designerLocale(tag: string | null | undefined): DesignerLocale | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split('-')[0];
  return Object.prototype.hasOwnProperty.call(DESIGNER_WORDS, base) || Object.prototype.hasOwnProperty.call(LATER, base) ? (base as DesignerLocale) : 'en';
}

/**
 * The designer's words in a language fetched, where they come in a chunk of their own (Turkish, Persian, Urdu, Spanish):
 * await it before `createDesigner` in such a language — `createDesigner.open` does. At once for any other.
 */
export async function designerWordsReady(tag: string | null | undefined): Promise<void> {
  const locale = designerLocale(tag);
  if (!locale || DESIGNER_WORDS[locale]) return;
  DESIGNER_WORDS[locale] = await LATER[locale as keyof typeof LATER]();
}

/** The designer's words in a language: its own where they are at hand, else English. */
export const wordsIn = (locale: DesignerLocale | null | undefined): DesignerWords => DESIGNER_WORDS[locale ?? 'en'] ?? en;

/** An option's words as the designer writes them for a new one — "Option 2", "الخيار 2" — in any language it speaks. */
export function isDefaultOption(label: string): boolean {
  const n = /\d+/.exec(label);
  return !!n && Object.values(DESIGNER_WORDS).some((w) => w?.defaults.option(Number(n[0])) === label);
}

/** A question's words as the designer writes them for a new one, in any language it speaks. */
export const isUntitled = (label: string): boolean => /^Untitled (question|field)$/.test(label) || Object.values(DESIGNER_WORDS).some((w) => w?.defaults.untitledQuestion === label);

/**
 * How each language writes dates and numbers: in Latin digits, as Arabic business software shows them, and on the
 * Gregorian calendar — Intl's own for Persian is the Solar Hijri.
 */
export const DATE_TAGS: Record<DesignerLocale, string> = { en: 'en-GB', ar: 'ar-u-nu-latn', tr: 'tr-u-nu-latn', fa: 'fa-u-ca-gregory-nu-latn', ur: 'ur-u-nu-latn', es: 'es-u-nu-latn' };

/** Which way a language the designer speaks is written: Arabic, Persian and Urdu right to left. */
export const designerDirection = (locale: DesignerLocale): 'ltr' | 'rtl' => (locale === 'ar' || locale === 'fa' || locale === 'ur' ? 'rtl' : 'ltr');
