import { wordsReady } from '@fieldia/core';
import { loadParts } from '@fieldia/viewer';

/**
 * Every part (parts.ts in @fieldia/widgets) in before each file's tests — a
 * table of lines' too, which a page whose one2many is not a grid draws — as a
 * page has them once they have come: drawn whole at once. A `*-lazy.spec.ts`
 * file starts without them.
 * Arabic's, German's and French's words, which come in chunks of their own (`wordsReady`), are in too, as on a page
 * shown in one once they have come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([loadParts(), ...['ar', 'de', 'fr'].map(wordsReady)]));
