import { loadParts } from '@fieldia/viewer';
import { discussionPart, historyPart } from './lib/chatter-parts';

/**
 * Every part (parts.ts in @fieldia/widgets) in before each file's tests — the
 * viewer's, the text editor, the Discussion and the History — as a page has
 * them once they have come. A `*-lazy.spec.ts` file starts without them.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([loadParts(), discussionPart.load(), historyPart.load()]));
