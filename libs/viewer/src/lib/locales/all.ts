import type { ViewerLabels } from '../labels';
import { ar } from './ar';
import { de } from './de';
import { fr } from './fr';

/**
 * The languages besides English the packages carry at once. The one-tag script builds this module as an empty one and
 * ships each language as its own add-on script (tools/script-bundle.mjs). Turkish, Persian, Urdu and Spanish come in
 * chunks of their own, fetched where they are spoken (later.ts).
 */
export const LANGUAGES: Record<'ar' | 'de' | 'fr', ViewerLabels> = { ar, de, fr };
