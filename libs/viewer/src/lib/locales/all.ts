import type { Locale } from '@fieldia/core';
import type { ViewerLabels } from '../labels';
import { ar } from './ar';
import { de } from './de';
import { fr } from './fr';
import { tr } from './tr';
import { fa } from './fa';
import { ur } from './ur';
import { es } from './es';

/**
 * Every language besides English — Turkish, Persian, Urdu and Spanish
 * machine-assisted, not yet reviewed by a native speaker. The packages carry them all; the one-tag
 * script builds this module as an empty one and ships each language as its
 * own add-on script (tools/script-bundle.mjs).
 */
export const LANGUAGES: Record<Exclude<Locale, 'en'>, ViewerLabels> = { ar, de, fr, tr, fa, ur, es };
