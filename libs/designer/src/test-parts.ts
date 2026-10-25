import { wordsReady } from '@fieldia/core';
import { loadParts } from '@fieldia/viewer';
import { designerWordsReady } from './lib/designer-words';
import { pageSchemaPart } from './lib/schema-part';

/**
 * Every part (parts.ts in @fieldia/widgets) in before each file's tests, as the designer's pages have them once they
 * have come, with Arabic's, German's and French's words (`wordsReady`), the designer's own Arabic, and the format's
 * schemas (`pageSchemaPart`). A `*-lazy.spec.ts` file starts without them, to test what the designer does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([loadParts(), ...['ar', 'de', 'fr'].map(wordsReady), designerWordsReady('ar'), pageSchemaPart.load()]));
