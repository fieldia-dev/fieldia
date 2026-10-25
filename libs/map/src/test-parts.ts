import { wordsReady } from '@fieldia/core';
import { formMapPart, mapViewPart, mapWidgetsPart } from './lib/map-parts';

/**
 * The maps' parts in before each file's tests — a list's map's, a form's map's and the place, area and address fields'
 * code — as a page has them once they have come (map-parts.ts: drawn whole at once), and Arabic's, German's and French's
 * words, each of which comes in a chunk of its own too (`wordsReady`). A `*-lazy.spec.ts` file starts without them, to
 * test what a page does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([mapViewPart.load(), formMapPart.load(), mapWidgetsPart.load(), ...['ar', 'de', 'fr'].map(wordsReady)]));
