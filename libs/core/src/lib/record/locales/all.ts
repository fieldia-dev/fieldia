import type { Locale, Messages } from '../messages';
import { ar } from './ar';
import { de } from './de';
import { fr } from './fr';

/**
 * Every language besides English. The packages carry them all; the one-tag
 * script builds this module as an empty one and ships each language as its
 * own add-on script (tools/script-bundle.mjs).
 */
export const LANGUAGES: Record<Exclude<Locale, 'en'>, Messages> = { ar, de, fr };
