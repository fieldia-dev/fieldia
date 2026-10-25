import { wordsReady } from '@fieldia/core';
import { loadParts } from '@fieldia/viewer';

/**
 * Every part (parts.ts in @fieldia/widgets) in before each file's tests, as a
 * page has them once they have come: drawn whole at once. A `*-lazy.spec.*`
 * file starts without them, to test what a page does before they come.
 * Arabic's, German's and French's words, which come in chunks of their own (`wordsReady`), are in too, as on a page
 * shown in one once they have come.
 */
if (!/-lazy\.spec\.tsx?$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([loadParts(), ...['ar', 'de', 'fr'].map(wordsReady)]));
