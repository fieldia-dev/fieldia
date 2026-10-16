import { quietPart, themesPart } from './lib/look-parts';
import { businessPart, choicePart, datePart, filesPart, linesPart, pathPart, textPart } from './lib/widget-parts';

/**
 * The widgets' parts (parts.ts) in before each file's tests, as a page has them
 * once they have come: their widgets drawn whole at once. A `*-lazy.spec.ts`
 * file starts without them, to test what a page does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => Promise.all([textPart.load(), pathPart.load(), choicePart.load(), datePart.load(), linesPart.load(), businessPart.load(), filesPart.load(), themesPart.load(), quietPart.load()]));
