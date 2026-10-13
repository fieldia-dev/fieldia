import { loadParts } from './lib/viewer-parts';

/**
 * Every part (parts.ts in @fieldia/widgets) in before each file's tests, as a
 * page has them once they have come: drawn whole at once. A `*-lazy.spec.ts`
 * file starts without them, to test what a page does before they come.
 */
if (!/-lazy\.spec\.ts$/.test(expect.getState().testPath ?? '')) beforeAll(() => loadParts());
