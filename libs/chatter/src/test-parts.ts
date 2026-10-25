import { wordsReady } from '@fieldia/core';
import { loadParts } from '@fieldia/viewer';
import { channelsPart, discussionPart, historyPart } from './lib/chatter-parts';

/**
 * Every part (parts.ts in @fieldia/widgets) in before each file's tests — the
 * viewer's, the text editor, the Discussion, the History and the channels — as a page has
 * them once they have come. A `*-lazy.spec.ts` file starts without them.
 * Arabic's, German's and French's words, which come in chunks of their own (`wordsReady`), are in too, as on a page
 * shown in one once they have come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([loadParts(), discussionPart.load(), historyPart.load(), channelsPart.load(), ...['ar', 'de', 'fr'].map(wordsReady)]));
