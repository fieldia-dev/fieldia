import { wordsReady } from '@fieldia/core';

/**
 * Arabic's, German's and French's words in before each file's tests — the widgets', the viewer's and the maps' own —
 * as a page shown in one has them once they have come: each but English's comes in a chunk of its own (`wordsReady`).
 * A `*-lazy.spec.ts` file starts without them.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all(['ar', 'de', 'fr'].map(wordsReady)));
